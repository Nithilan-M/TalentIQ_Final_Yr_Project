import os
import shutil
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database.connection import get_db
from backend.database.models import JobDescription, ProjectSkillRequirement, User
from backend.api.auth import get_current_user
from backend.parsers.doc_parser import parse_document
from backend.agents.jd_agent import parse_job_description
from backend.validator.project_validator import validate_project_requirement
from backend.parsers.skill_normalizer import normalize_skill
from backend.services.skill_service import lookup_or_normalize_skill, get_proficiency_value

router = APIRouter(prefix="/api/job-description", tags=["Project Requirements"])

# Ensure temp directory exists
TEMP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp_uploads")
os.makedirs(TEMP_DIR, exist_ok=True)

class ProjectSkillSchema(BaseModel):
    skill_name: Optional[str] = None
    original_name: Optional[str] = None
    normalized_name: Optional[str] = None
    normalized_skill_name: Optional[str] = None
    required_level: Optional[str] = None  # Beginner, Intermediate, Advanced, Expert, or None
    priority: Optional[str] = None        # Critical, Required, Preferred
    experience_required: Optional[str] = None
    is_preferred: Optional[bool] = False
    confidence: Optional[float] = 0.92

class ConfirmProjectRequirementRequest(BaseModel):
    project_id: Optional[int] = None
    project_name: str
    project_description: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    duration_text: Optional[str] = None
    required_team_size: int
    roles: List[str] = []
    role_skill_mapping: Optional[Dict[str, List[str]]] = {}
    domain: Optional[str] = None
    required_skills: List[ProjectSkillSchema] = []
    preferred_skills: List[ProjectSkillSchema] = []
    required_experience: Optional[str] = None
    technologies: List[str] = []
    confidence_scores: Optional[Dict[str, float]] = {}


def _format_project_response(jd: JobDescription):
    """Helper to format JobDescription model into a clean Project Requirement JSON."""
    req_skills_list = []
    pref_skills_list = []
    
    if jd.project_skills:
        for ps in jd.project_skills:
            item = {
                "id": ps.id,
                "skill_name": ps.original_name,
                "original_name": ps.original_name,
                "normalized_name": ps.normalized_name,
                "normalized_skill_name": ps.normalized_name,
                "required_level": ps.required_level,
                "priority": ps.priority or ("Preferred" if ps.is_preferred else "Required"),
                "experience_required": ps.experience_required,
                "is_preferred": ps.is_preferred or False,
                "confidence": ps.confidence or 0.92
            }
            if ps.is_preferred:
                pref_skills_list.append(item)
            else:
                req_skills_list.append(item)
    else:
        # Fallback to legacy skills_required if project_skills table is empty
        for sk in (jd.skills_required or []):
            norm = normalize_skill(sk)
            req_skills_list.append({
                "skill_name": norm["original_name"],
                "original_name": norm["original_name"],
                "normalized_name": norm["normalized_name"],
                "normalized_skill_name": norm["normalized_name"],
                "required_level": None,
                "priority": "Required",
                "experience_required": None,
                "is_preferred": False,
                "confidence": 0.90
            })
        for sk in (jd.skills_preferred or []):
            norm = normalize_skill(sk)
            pref_skills_list.append({
                "skill_name": norm["original_name"],
                "original_name": norm["original_name"],
                "normalized_name": norm["normalized_name"],
                "normalized_skill_name": norm["normalized_name"],
                "required_level": None,
                "priority": "Preferred",
                "experience_required": None,
                "is_preferred": True,
                "confidence": 0.90
            })

    return {
        "id": jd.id,
        "project_id": jd.id,
        "project_name": jd.project_name or jd.title,
        "title": jd.project_name or jd.title,
        "project_description": jd.description or jd.raw_text,
        "description": jd.description or jd.raw_text,
        "raw_text": jd.raw_text,
        "start_date": jd.start_date,
        "end_date": jd.end_date,
        "duration_text": jd.duration_text,
        "required_team_size": jd.required_team_size or 1,
        "roles": jd.roles or [],
        "role_skill_mapping": jd.role_skill_mapping or {},
        "domain": jd.domain or jd.industry,
        "industry": jd.domain or jd.industry,
        "required_skills": req_skills_list,
        "preferred_skills": pref_skills_list,
        "skills_required": [s["normalized_name"] for s in req_skills_list],
        "skills_preferred": [s["normalized_name"] for s in pref_skills_list],
        "required_experience": jd.experience_required,
        "experience_required": jd.experience_required,
        "technologies": jd.technologies or [],
        "source_file_name": jd.source_file_name,
        "extraction_status": jd.extraction_status or "confirmed",
        "confidence_scores": jd.confidence_scores or {},
        "created_at": jd.created_at,
        "updated_at": jd.updated_at
    }


@router.post("/upload", status_code=status.HTTP_200_OK)
async def upload_project_requirement(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 1 & 2: Upload Project Requirement PDF, extract text, run Gemini AI requirement extraction,
    normalize skills, and run validation. Returns extracted data + validation status for PM review.
    """
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext != ".pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported format. Only Project Requirement PDF files are allowed."
        )

    # File size check (max 10MB)
    MAX_FILE_SIZE = 10 * 1024 * 1024
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the 10MB limit. Please upload a smaller PDF."
        )

    temp_file_path = os.path.join(TEMP_DIR, f"proj_{current_user.id}_{file.filename}")
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Parse text using PyMuPDF (fitz)
        try:
            raw_text = parse_document(temp_file_path)
        except ValueError as val_err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(val_err)
            )

        # Extract structured requirement via Gemini AI
        try:
            extracted = await parse_job_description(raw_text)
        except Exception as gem_err:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unable to extract project requirements using Gemini AI: {str(gem_err)}"
            )

        # Run validation engine
        validation_res = validate_project_requirement(extracted)

        # Save draft in database
        project_name = extracted.get("project_name") or file.filename.rsplit(".", 1)[0]
        db_jd = JobDescription(
            title=project_name,
            project_name=project_name,
            description=extracted.get("project_description") or raw_text,
            raw_text=raw_text,
            start_date=extracted.get("start_date") or "2026-06-01",
            end_date=extracted.get("end_date") or "2026-12-31",
            duration_text=extracted.get("duration_text") or "7 months",
            required_team_size=extracted.get("required_team_size"),
            roles=extracted.get("roles") or [],
            role_skill_mapping=extracted.get("role_skill_mapping") or {},
            domain=extracted.get("domain") or "",
            industry=extracted.get("domain") or "",
            experience_required=extracted.get("required_experience") or "",
            technologies=extracted.get("technologies") or [],
            confidence_scores=extracted.get("confidence_scores") or {},
            skills_required=[s.get("normalized_name") for s in extracted.get("required_skills", []) if isinstance(s, dict) and s.get("normalized_name")],
            skills_preferred=[s.get("normalized_name") for s in extracted.get("preferred_skills", []) if isinstance(s, dict) and s.get("normalized_name")],
            source_file_name=file.filename,
            source_file_path=temp_file_path,
            extraction_status="draft",
            user_id=current_user.id
        )

        db.add(db_jd)
        db.commit()
        db.refresh(db_jd)

        # Save initial required skill objects
        for sk in extracted.get("required_skills", []):
            if isinstance(sk, dict) and sk.get("skill_name"):
                s_name = sk["skill_name"]
                tax_res = lookup_or_normalize_skill(db, s_name)
                req_val = get_proficiency_value(sk.get("required_level"))
                db_skill = ProjectSkillRequirement(
                    job_description_id=db_jd.id,
                    skill_id=tax_res["skill_id"],
                    original_name=s_name,
                    normalized_name=tax_res["normalized_skill_name"],
                    required_level=sk.get("required_level"),
                    required_level_value=req_val,
                    priority=sk.get("priority") or "Required",
                    experience_required=sk.get("experience_required"),
                    is_preferred=False,
                    confidence=float(sk.get("confidence", 0.92))
                )
                db.add(db_skill)

        # Save initial preferred skill objects
        for sk in extracted.get("preferred_skills", []):
            if isinstance(sk, dict) and sk.get("skill_name"):
                s_name = sk["skill_name"]
                tax_res = lookup_or_normalize_skill(db, s_name)
                req_val = get_proficiency_value(sk.get("required_level"))
                db_skill = ProjectSkillRequirement(
                    job_description_id=db_jd.id,
                    skill_id=tax_res["skill_id"],
                    original_name=s_name,
                    normalized_name=tax_res["normalized_skill_name"],
                    required_level=sk.get("required_level"),
                    required_level_value=req_val,
                    priority=sk.get("priority") or "Preferred",
                    experience_required=sk.get("experience_required"),
                    is_preferred=True,
                    confidence=float(sk.get("confidence", 0.90))
                )
                db.add(db_skill)
        
        db.commit()
        db.refresh(db_jd)

        formatted_resp = _format_project_response(db_jd)

        return {
            "message": "Project requirements extracted successfully",
            "project_id": db_jd.id,
            "id": db_jd.id,
            "extraction_status": "draft",
            "validation": validation_res,
            "extracted_data": formatted_resp
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process project requirement document: {str(e)}"
        )
    finally:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass


@router.post("/confirm")
def confirm_project_requirement(
    req: ConfirmProjectRequirementRequest,
    id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 5: PM confirms/saves the reviewed & edited Project Requirement.
    Persists structured requirement in the database and updates status to 'confirmed'.
    """
    target_id = id or req.project_id
    if not target_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project ID is required to confirm requirements."
        )

    db_jd = db.query(JobDescription).filter(
        JobDescription.id == target_id,
        JobDescription.user_id == current_user.id
    ).first()

    if not db_jd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project Requirement with ID {target_id} not found."
        )

    # Validate reviewed data
    payload_dict = req.dict()
    validation_res = validate_project_requirement(payload_dict)
    if not validation_res["is_valid"]:
        error_msg = "; ".join(validation_res["errors"])
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation failed: {error_msg}"
        )

    try:
        # Update JobDescription record
        db_jd.title = req.project_name
        db_jd.project_name = req.project_name
        db_jd.description = req.project_description
        db_jd.raw_text = req.project_description or db_jd.raw_text
        db_jd.start_date = req.start_date
        db_jd.end_date = req.end_date
        db_jd.duration_text = req.duration_text
        db_jd.required_team_size = req.required_team_size
        db_jd.roles = req.roles
        db_jd.role_skill_mapping = req.role_skill_mapping or {}
        db_jd.domain = req.domain
        db_jd.industry = req.domain
        db_jd.experience_required = req.required_experience
        db_jd.technologies = req.technologies
        db_jd.confidence_scores = req.confidence_scores or {}
        db_jd.extraction_status = "confirmed"

        # Replace project skills
        db.query(ProjectSkillRequirement).filter(
            ProjectSkillRequirement.job_description_id == db_jd.id
        ).delete()

        legacy_req = []
        for sk in req.required_skills:
            s_name = sk.skill_name or sk.original_name
            if not s_name or not s_name.strip():
                continue
            tax_res = lookup_or_normalize_skill(db, s_name.strip())
            req_val = get_proficiency_value(sk.required_level)
            
            ps = ProjectSkillRequirement(
                job_description_id=db_jd.id,
                skill_id=tax_res["skill_id"],
                original_name=s_name.strip(),
                normalized_name=tax_res["normalized_skill_name"],
                required_level=sk.required_level,
                required_level_value=req_val,
                priority=sk.priority or "Required",
                experience_required=sk.experience_required,
                is_preferred=False,
                confidence=sk.confidence or 0.92
            )
            db.add(ps)
            legacy_req.append(tax_res["normalized_skill_name"])

        legacy_pref = []
        for sk in req.preferred_skills:
            s_name = sk.skill_name or sk.original_name
            if not s_name or not s_name.strip():
                continue
            tax_res = lookup_or_normalize_skill(db, s_name.strip())
            req_val = get_proficiency_value(sk.required_level)
            
            ps = ProjectSkillRequirement(
                job_description_id=db_jd.id,
                skill_id=tax_res["skill_id"],
                original_name=s_name.strip(),
                normalized_name=tax_res["normalized_skill_name"],
                required_level=sk.required_level,
                required_level_value=req_val,
                priority=sk.priority or "Preferred",
                experience_required=sk.experience_required,
                is_preferred=True,
                confidence=sk.confidence or 0.90
            )
            db.add(ps)
            legacy_pref.append(tax_res["normalized_skill_name"])

        db_jd.skills_required = legacy_req
        db_jd.skills_preferred = legacy_pref

        db.commit()
        db.refresh(db_jd)

        return {
            "message": "Project requirement saved successfully.",
            "data": _format_project_response(db_jd)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save confirmed project requirement: {str(e)}"
        )


@router.get("/latest")
def get_latest_jd(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get latest Project Requirement for current user."""
    jd = db.query(JobDescription)\
        .filter(JobDescription.user_id == current_user.id)\
        .order_by(JobDescription.created_at.desc())\
        .first()
        
    if not jd:
        return None
        
    return _format_project_response(jd)


@router.get("/list")
def list_jds(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all Project Requirements created by current user."""
    jds = db.query(JobDescription)\
        .filter(JobDescription.user_id == current_user.id)\
        .order_by(JobDescription.created_at.desc())\
        .all()
        
    return [
        {
            "id": jd.id,
            "project_id": jd.id,
            "title": jd.project_name or jd.title,
            "project_name": jd.project_name or jd.title,
            "extraction_status": jd.extraction_status,
            "created_at": jd.created_at
        } for jd in jds
    ]


@router.get("/{id}")
def get_jd_details(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed Project Requirement by ID."""
    jd = db.query(JobDescription).filter(
        JobDescription.id == id,
        JobDescription.user_id == current_user.id
    ).first()
    
    if not jd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project requirement not found"
        )
    return _format_project_response(jd)
