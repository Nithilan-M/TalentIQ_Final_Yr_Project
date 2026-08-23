import os
import shutil
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database.connection import get_db
from backend.database.models import Candidate, EmployeeSkill, Project, Certification, CandidateEmbedding, User
from backend.api.auth import get_current_user
from backend.parsers.doc_parser import parse_document
from backend.agents.candidate_agent import parse_candidate_resume
from backend.parsers.skill_normalizer import normalize_skill_name
from backend.embeddings.vector_store import vector_store_manager

from backend.services.employee_service import (
    format_employee_list_item,
    format_employee_profile,
    validate_employee_data,
    detect_duplicate_employee,
    generate_next_employee_id
)
from backend.services.excel_import import (
    generate_excel_template,
    validate_excel_import
)
from backend.services.skill_service import (
    lookup_or_normalize_skill,
    get_proficiency_value
)

router = APIRouter(prefix="/api/employee", tags=["Employee Master Data"])

TEMP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp_uploads")
os.makedirs(TEMP_DIR, exist_ok=True)


# ── Pydantic Request Schemas ──────────────────────────────────────────────

class EmployeeSkillInput(BaseModel):
    skill_name: str
    normalized_skill_name: Optional[str] = None
    proficiency_level: Optional[str] = None  # Beginner, Intermediate, Advanced, Expert
    experience_years: Optional[float] = None
    source: Optional[str] = "Manual Entry"

class ProjectHistoryInput(BaseModel):
    title: str
    description: Optional[str] = None
    technologies: List[str] = []
    role: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    responsibilities: Optional[str] = None
    domain: Optional[str] = None

class CertificationInput(BaseModel):
    name: str
    issuing_organization: Optional[str] = None
    year: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    credential_id: Optional[str] = None

class EmployeeCreateRequest(BaseModel):
    employee_id: Optional[str] = None
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    total_experience_years: Optional[float] = None
    technical_summary: Optional[str] = None
    domain_experience: List[str] = []
    status: Optional[str] = "Active"
    
    # Current Assignment & Availability
    current_project: Optional[str] = None
    assignment_start_date: Optional[str] = None
    assignment_end_date: Optional[str] = None
    allocation_percentage: Optional[int] = 100
    available_from: Optional[str] = None
    
    # Performance
    performance_rating: Optional[float] = None
    performance_review_period: Optional[str] = None
    performance_notes: Optional[str] = None
    
    # Collections
    skills: List[EmployeeSkillInput] = []
    projects: List[ProjectHistoryInput] = []
    certifications: List[CertificationInput] = []

class ConfirmExcelImportRequest(BaseModel):
    valid_data: Dict[str, Any]
    update_existing: Optional[bool] = True


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.get("/list")
def list_employees(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = None,
    department: Optional[str] = None,
    designation: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get paginated Employee Master Data collection with search (by Name, Employee ID, Skill)
    and multi-field filters (Department, Designation, Status).
    """
    query = db.query(Candidate)

    # Status filter
    if status_filter and status_filter.strip():
        query = query.filter(Candidate.status == status_filter.strip())

    # Department filter
    if department and department.strip():
        query = query.filter(Candidate.department == department.strip())

    # Designation filter
    if designation and designation.strip():
        query = query.filter(Candidate.designation == designation.strip())

    # Search filter
    if search and search.strip():
        s = f"%{search.strip()}%"
        # Match employee_id, name, department, designation, or employee_skills
        query = query.outerjoin(EmployeeSkill).filter(
            (Candidate.name.ilike(s)) |
            (Candidate.employee_id.ilike(s)) |
            (Candidate.department.ilike(s)) |
            (Candidate.designation.ilike(s)) |
            (EmployeeSkill.skill_name.ilike(s)) |
            (EmployeeSkill.normalized_skill_name.ilike(s))
        ).distinct()

    total_count = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(Candidate.id.desc()).offset(offset).limit(page_size).all()

    return {
        "items": [format_employee_list_item(emp) for emp in items],
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size if page_size > 0 else 1
    }


@router.get("/stats")
def get_employee_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get workforce counts: Total Employees, Active Employees, Inactive Employees."""
    total = db.query(Candidate).count()
    active = db.query(Candidate).filter(Candidate.status == "Active").count()
    inactive = db.query(Candidate).filter(Candidate.status == "Inactive").count()
    
    # Department breakdown
    departments = db.query(Candidate.department).filter(Candidate.department.isnot(None)).distinct().all()
    dept_list = [d[0] for d in departments if d[0]]

    return {
        "total_employees": total,
        "active_employees": active,
        "inactive_employees": inactive,
        "departments": dept_list
    }


@router.get("/excel-template")
def download_excel_template():
    """Download standard 5-sheet Excel template for bulk employee import."""
    bytes_content = generate_excel_template()
    return Response(
        content=bytes_content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=TalentIQ_Employee_Import_Template.xlsx"
        }
    )


@router.post("/import-excel")
async def upload_excel_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 1: Upload Excel file, run 13-rule validation pipeline, return data preview with error rows.
    Does NOT modify the database yet.
    """
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext != ".xlsx":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only Excel files (.xlsx) are supported."
        )

    file_bytes = await file.read()
    validation_res = validate_excel_import(file_bytes, db)
    return validation_res


@router.post("/import-excel/confirm")
def confirm_excel_import(
    req: ConfirmExcelImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 2: Confirm import of validated Excel records. Saves/updates records in Employee Master Data.
    """
    valid_data = req.valid_data
    if not valid_data or "employees" not in valid_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid data provided for import."
        )

    employees_list = valid_data.get("employees", [])
    skills_list = valid_data.get("skills", [])
    projects_list = valid_data.get("projects", [])
    assignments_list = valid_data.get("assignments", [])
    certs_list = valid_data.get("certifications", [])

    created_count = 0
    updated_count = 0

    try:
        # 1. Process Employees
        for emp_raw in employees_list:
            emp_id = str(emp_raw.get("Employee ID") or "").strip()
            if not emp_id:
                continue

            existing = db.query(Candidate).filter(Candidate.employee_id == emp_id).first()
            if existing:
                if not req.update_existing:
                    continue  # Skip existing
                db_emp = existing
                updated_count += 1
            else:
                db_emp = Candidate(employee_id=emp_id)
                db.add(db_emp)
                created_count += 1

            # Update core employee fields
            db_emp.name = str(emp_raw.get("Name") or "").strip()
            db_emp.email = str(emp_raw.get("Email") or "").strip() or None
            db_emp.department = str(emp_raw.get("Department") or "").strip() or None
            db_emp.designation = str(emp_raw.get("Designation") or "").strip() or None
            
            exp = emp_raw.get("Total Experience Years")
            db_emp.total_experience_years = float(exp) if exp is not None and exp != "" else None
            
            db_emp.status = str(emp_raw.get("Status") or "Active").strip()
            
            rating = emp_raw.get("Performance Rating")
            db_emp.performance_rating = float(rating) if rating is not None and rating != "" else None
            db_emp.performance_review_period = str(emp_raw.get("Performance Review Period") or "").strip() or None
            db_emp.performance_notes = str(emp_raw.get("Performance Notes") or "").strip() or None

            db.flush()

        # Build mapping of employee_id -> candidate DB entity
        emp_map = {e.employee_id: e for e in db.query(Candidate).filter(Candidate.employee_id.isnot(None)).all()}

        # 2. Process Current Assignments
        for asn in assignments_list:
            emp_id = str(asn.get("Employee ID") or "").strip()
            if emp_id in emp_map:
                e = emp_map[emp_id]
                e.current_project = str(asn.get("Project Name") or "").strip() or None
                e.assignment_start_date = str(asn.get("Assignment Start Date") or "").strip() or None
                e.assignment_end_date = str(asn.get("Assignment End Date") or "").strip() or None
                alloc = asn.get("Allocation Percentage")
                e.allocation_percentage = int(float(str(alloc))) if alloc is not None and alloc != "" else 100
                e.available_from = str(asn.get("Available From") or "").strip() or None

        # 3. Process Skills
        for sk in skills_list:
            emp_id = str(sk.get("Employee ID") or "").strip()
            skill_name = str(sk.get("Skill") or "").strip()
            if emp_id in emp_map and skill_name:
                e = emp_map[emp_id]
                norm = normalize_skill_name(skill_name)
                
                # Check existing skill
                existing_sk = db.query(EmployeeSkill).filter(
                    EmployeeSkill.candidate_id == e.id,
                    EmployeeSkill.normalized_skill_name == norm
                ).first()

                prof = str(sk.get("Proficiency Level") or "").strip() or None
                exp_yrs = sk.get("Experience Years")
                exp_val = float(exp_yrs) if exp_yrs is not None and exp_yrs != "" else None
                src = str(sk.get("Source") or "System Import").strip()

                if existing_sk:
                    existing_sk.skill_name = skill_name
                    existing_sk.proficiency_level = prof or existing_sk.proficiency_level
                    existing_sk.experience_years = exp_val or existing_sk.experience_years
                    existing_sk.source = src
                else:
                    db_sk = EmployeeSkill(
                        candidate_id=e.id,
                        skill_name=skill_name,
                        normalized_skill_name=norm,
                        proficiency_level=prof,
                        experience_years=exp_val,
                        source=src
                    )
                    db.add(db_sk)

        # 4. Process Project History
        for proj in projects_list:
            emp_id = str(proj.get("Employee ID") or "").strip()
            p_name = str(proj.get("Project Name") or "").strip()
            if emp_id in emp_map and p_name:
                e = emp_map[emp_id]
                techs = [t.strip() for t in str(proj.get("Technologies") or "").split(",") if t.strip()]
                db_p = Project(
                    candidate_id=e.id,
                    title=p_name,
                    role=str(proj.get("Role") or "").strip() or None,
                    start_date=str(proj.get("Start Date") or "").strip() or None,
                    end_date=str(proj.get("End Date") or "").strip() or None,
                    technologies=techs,
                    responsibilities=str(proj.get("Responsibilities") or "").strip() or None,
                    domain=str(proj.get("Domain") or "").strip() or None,
                )
                db.add(db_p)

        # 5. Process Certifications
        for cert in certs_list:
            emp_id = str(cert.get("Employee ID") or "").strip()
            c_name = str(cert.get("Certification Name") or "").strip()
            if emp_id in emp_map and c_name:
                e = emp_map[emp_id]
                db_c = Certification(
                    candidate_id=e.id,
                    name=c_name,
                    issuing_organization=str(cert.get("Issuing Organization") or "").strip() or None,
                    issue_date=str(cert.get("Issue Date") or "").strip() or None,
                    expiry_date=str(cert.get("Expiry Date") or "").strip() or None,
                    credential_id=str(cert.get("Credential ID") or "").strip() or None,
                )
                db.add(db_c)

        db.commit()

        # Update vector store
        try:
            embeddings_list = db.query(CandidateEmbedding).all()
            c_data = [{"candidate_id": item.candidate_id, "embedding": item.embedding} for item in embeddings_list]
            vector_store_manager.build_index(c_data)
        except Exception:
            pass

        return {
            "message": f"Successfully imported workforce data. Created: {created_count}, Updated: {updated_count}.",
            "created": created_count,
            "updated": updated_count
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import Excel data: {str(e)}"
        )


@router.post("/import-resume")
async def import_employee_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Single Resume/Profile Import workflow. Parses text, calls Gemini AI to extract structure,
    runs duplicate check, and returns employee profile preview for user review.
    """
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in [".pdf", ".docx", ".txt"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported format. Only PDF, DOCX, and TXT profile documents are allowed."
        )

    temp_file_path = os.path.join(TEMP_DIR, f"emp_resume_{current_user.id}_{file.filename}")
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        raw_text = parse_document(temp_file_path)
        if not raw_text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Extracted profile document content is empty."
            )

        extracted = await parse_candidate_resume(raw_text)
        
        # Check duplicate by email
        email = extracted.get("email")
        dup = detect_duplicate_employee(db, employee_id=None, email=email)
        
        next_id = generate_next_employee_id(db)

        return {
            "message": "Employee profile extracted successfully",
            "extracted_data": {
                "employee_id": next_id,
                "name": extracted.get("name") or file.filename.split(".")[0],
                "email": extracted.get("email", ""),
                "phone": extracted.get("phone", ""),
                "department": "Engineering",
                "designation": extracted.get("experience", [{}])[0].get("role") if extracted.get("experience") else "Software Engineer",
                "total_experience_years": len(extracted.get("experience", [])) * 1.5,
                "technical_summary": extracted.get("technical_summary", ""),
                "skills": [
                    {
                        "skill_name": sk,
                        "normalized_skill_name": normalize_skill_name(sk),
                        "proficiency_level": "Intermediate",
                        "experience_years": 2.0,
                        "source": "Resume"
                    } for sk in extracted.get("skills", [])
                ],
                "projects": [
                    {
                        "title": p.get("title", ""),
                        "description": p.get("description", ""),
                        "technologies": p.get("technologies", []),
                        "role": "Project Contributor"
                    } for p in extracted.get("projects", [])
                ],
                "certifications": [
                    {
                        "name": c.get("name", ""),
                        "issuing_organization": c.get("issuing_organization", ""),
                        "year": str(c.get("year", ""))
                    } for c in extracted.get("certifications", [])
                ],
                "status": "Active"
            },
            "duplicate_warning": dup
        }

    finally:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass


@router.get("/{id}")
def get_employee_details(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get full employee profile by internal ID or string Employee ID."""
    emp = db.query(Candidate).filter(
        (Candidate.id == id) | (Candidate.employee_id == str(id))
    ).first()

    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {id} not found."
        )

    return format_employee_profile(emp)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_employee(
    req: EmployeeCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manual Employee creation."""
    payload_dict = req.dict()
    val_res = validate_employee_data(payload_dict)
    if not val_res["is_valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation failed: {'; '.join(val_res['errors'])}"
        )

    emp_id = req.employee_id or generate_next_employee_id(db)

    # Check uniqueness of Employee ID
    existing = db.query(Candidate).filter(Candidate.employee_id == emp_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Employee ID '{emp_id}' already exists. Please use a unique Employee ID."
        )

    try:
        db_emp = Candidate(
            employee_id=emp_id,
            name=req.name.strip(),
            email=req.email.strip() if req.email else None,
            phone=req.phone.strip() if req.phone else None,
            department=req.department.strip() if req.department else None,
            designation=req.designation.strip() if req.designation else None,
            total_experience_years=req.total_experience_years,
            technical_summary=req.technical_summary,
            domain_experience=req.domain_experience,
            status=req.status or "Active",
            current_project=req.current_project.strip() if req.current_project else None,
            assignment_start_date=req.assignment_start_date,
            assignment_end_date=req.assignment_end_date,
            available_from=req.available_from,
            allocation_percentage=req.allocation_percentage or 100,
            performance_rating=req.performance_rating,
            performance_review_period=req.performance_review_period,
            performance_notes=req.performance_notes,
            skills=[sk.skill_name for sk in req.skills]
        )
        db.add(db_emp)
        db.flush()

        # Add Skills
        for sk in req.skills:
            tax_res = lookup_or_normalize_skill(db, sk.skill_name)
            prof_val = get_proficiency_value(sk.proficiency_level)
            db_sk = EmployeeSkill(
                candidate_id=db_emp.id,
                skill_id=tax_res["skill_id"],
                skill_name=sk.skill_name.strip(),
                normalized_skill_name=tax_res["normalized_skill_name"],
                proficiency_level=sk.proficiency_level,
                proficiency_value=prof_val,
                experience_years=sk.experience_years,
                source=sk.source or "Manual Entry"
            )
            db.add(db_sk)

        # Add Projects
        for p in req.projects:
            db_p = Project(
                candidate_id=db_emp.id,
                title=p.title.strip(),
                description=p.description,
                technologies=p.technologies,
                role=p.role,
                start_date=p.start_date,
                end_date=p.end_date,
                responsibilities=p.responsibilities,
                domain=p.domain
            )
            db.add(db_p)

        # Add Certifications
        for c in req.certifications:
            db_c = Certification(
                candidate_id=db_emp.id,
                name=c.name.strip(),
                issuing_organization=c.issuing_organization,
                year=c.year,
                issue_date=c.issue_date,
                expiry_date=c.expiry_date,
                credential_id=c.credential_id
            )
            db.add(db_c)

        db.commit()
        db.refresh(db_emp)

        return {
            "message": "Employee record created successfully.",
            "data": format_employee_profile(db_emp)
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create employee record: {str(e)}"
        )


@router.put("/{id}")
def update_employee(
    id: int,
    req: EmployeeCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update employee profile, skills, project history, assignment, availability, and performance."""
    db_emp = db.query(Candidate).filter(Candidate.id == id).first()
    if not db_emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {id} not found."
        )

    payload_dict = req.dict()
    val_res = validate_employee_data(payload_dict)
    if not val_res["is_valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation failed: {'; '.join(val_res['errors'])}"
        )

    try:
        if req.employee_id:
            dup = detect_duplicate_employee(db, employee_id=req.employee_id, email=None, exclude_id=id)
            if dup:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Employee ID '{req.employee_id}' is already assigned to another employee."
                )
            db_emp.employee_id = req.employee_id.strip()

        db_emp.name = req.name.strip()
        db_emp.email = req.email.strip() if req.email else None
        db_emp.phone = req.phone.strip() if req.phone else None
        db_emp.department = req.department.strip() if req.department else None
        db_emp.designation = req.designation.strip() if req.designation else None
        db_emp.total_experience_years = req.total_experience_years
        db_emp.technical_summary = req.technical_summary
        db_emp.domain_experience = req.domain_experience
        db_emp.status = req.status or "Active"
        
        db_emp.current_project = req.current_project.strip() if req.current_project else None
        db_emp.assignment_start_date = req.assignment_start_date
        db_emp.assignment_end_date = req.assignment_end_date
        db_emp.available_from = req.available_from
        db_emp.allocation_percentage = req.allocation_percentage or 100
        
        db_emp.performance_rating = req.performance_rating
        db_emp.performance_review_period = req.performance_review_period
        db_emp.performance_notes = req.performance_notes
        db_emp.skills = [sk.skill_name for sk in req.skills]

        # Replace skills
        db.query(EmployeeSkill).filter(EmployeeSkill.candidate_id == db_emp.id).delete()
        for sk in req.skills:
            tax_res = lookup_or_normalize_skill(db, sk.skill_name)
            prof_val = get_proficiency_value(sk.proficiency_level)
            db_sk = EmployeeSkill(
                candidate_id=db_emp.id,
                skill_id=tax_res["skill_id"],
                skill_name=sk.skill_name.strip(),
                normalized_skill_name=tax_res["normalized_skill_name"],
                proficiency_level=sk.proficiency_level,
                proficiency_value=prof_val,
                experience_years=sk.experience_years,
                source=sk.source or "Manual Entry"
            )
            db.add(db_sk)

        # Replace projects
        db.query(Project).filter(Project.candidate_id == db_emp.id).delete()
        for p in req.projects:
            db_p = Project(
                candidate_id=db_emp.id,
                title=p.title.strip(),
                description=p.description,
                technologies=p.technologies,
                role=p.role,
                start_date=p.start_date,
                end_date=p.end_date,
                responsibilities=p.responsibilities,
                domain=p.domain
            )
            db.add(db_p)

        # Replace certifications
        db.query(Certification).filter(Certification.candidate_id == db_emp.id).delete()
        for c in req.certifications:
            db_c = Certification(
                candidate_id=db_emp.id,
                name=c.name.strip(),
                issuing_organization=c.issuing_organization,
                year=c.year,
                issue_date=c.issue_date,
                expiry_date=c.expiry_date,
                credential_id=c.credential_id
            )
            db.add(db_c)

        db.commit()
        db.refresh(db_emp)

        return {
            "message": "Employee profile updated successfully.",
            "data": format_employee_profile(db_emp)
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update employee profile: {str(e)}"
        )


@router.delete("/{id}")
def deactivate_employee(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soft-deactivate an employee record (status = 'Inactive')."""
    db_emp = db.query(Candidate).filter(Candidate.id == id).first()
    if not db_emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {id} not found."
        )

    db_emp.status = "Inactive"
    db.commit()

    return {
        "message": f"Employee {db_emp.name} ({db_emp.employee_id}) deactivated successfully.",
        "id": id,
        "status": "Inactive"
    }
