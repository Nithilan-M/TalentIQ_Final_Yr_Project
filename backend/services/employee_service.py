"""
Employee Service Layer
Abstracts the Candidate DB model into clean Employee DTOs for the application layer.
Provides formatting, validation, duplicate detection, and ID generation utilities.
"""

import re
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from backend.database.models import Candidate, EmployeeSkill, Project, Certification
from backend.parsers.skill_normalizer import normalize_skill_name

VALID_PROFICIENCY_LEVELS = {"Beginner", "Intermediate", "Advanced", "Expert"}
VALID_SOURCES = {"Resume", "Manual Entry", "Manager Update", "Certification", "System Import"}
VALID_STATUSES = {"Active", "Inactive"}

# ── Formatting Helpers ───────────────────────────────────────────────────

def format_employee_list_item(emp: Candidate) -> Dict[str, Any]:
    """Format a Candidate DB row into an Employee list-table row."""
    skills_count = len(emp.employee_skills) if emp.employee_skills else len(emp.skills or [])
    certs_count = len(emp.certifications) if emp.certifications else 0

    return {
        "id": emp.id,
        "employee_id": emp.employee_id or f"EMP{emp.id:03d}",
        "name": emp.name,
        "email": emp.email,
        "designation": emp.designation or "",
        "department": emp.department or "",
        "total_experience_years": emp.total_experience_years,
        "current_project": emp.current_project or "",
        "available_from": emp.available_from or "",
        "skills_count": skills_count,
        "certifications_count": certs_count,
        "performance_rating": emp.performance_rating,
        "status": emp.status or "Active",
    }


def format_employee_profile(emp: Candidate) -> Dict[str, Any]:
    """Format a Candidate DB row into a full Employee profile DTO."""
    # Skills
    skills_list = []
    if emp.employee_skills:
        for es in emp.employee_skills:
            skills_list.append({
                "id": es.id,
                "skill_name": es.skill_name,
                "normalized_skill_name": es.normalized_skill_name,
                "proficiency_level": es.proficiency_level,
                "experience_years": es.experience_years,
                "source": es.source,
                "last_updated": str(es.last_updated) if es.last_updated else None,
            })
    elif emp.skills:
        for sk in emp.skills:
            skills_list.append({
                "skill_name": sk,
                "normalized_skill_name": normalize_skill_name(sk),
                "proficiency_level": None,
                "experience_years": None,
                "source": "Resume",
                "last_updated": None,
            })

    # Project History
    projects_list = []
    if emp.projects:
        for p in emp.projects:
            projects_list.append({
                "id": p.id,
                "title": p.title,
                "description": p.description,
                "technologies": p.technologies or [],
                "role": p.role,
                "start_date": p.start_date,
                "end_date": p.end_date,
                "responsibilities": p.responsibilities,
                "domain": p.domain,
            })

    # Certifications
    certs_list = []
    if emp.certifications:
        for c in emp.certifications:
            certs_list.append({
                "id": c.id,
                "name": c.name,
                "issuing_organization": c.issuing_organization,
                "year": c.year,
                "issue_date": c.issue_date,
                "expiry_date": c.expiry_date,
                "credential_id": c.credential_id,
            })

    # Experiences
    experiences_list = []
    if emp.experiences:
        for e in emp.experiences:
            experiences_list.append({
                "id": e.id,
                "company": e.company,
                "role": e.role,
                "duration": e.duration,
                "description": e.description,
            })

    return {
        "id": emp.id,
        "employee_id": emp.employee_id or f"EMP{emp.id:03d}",
        "name": emp.name,
        "email": emp.email,
        "phone": emp.phone,
        "department": emp.department or "",
        "designation": emp.designation or "",
        "total_experience_years": emp.total_experience_years,
        "technical_summary": emp.technical_summary,
        "domain_experience": emp.domain_experience or [],
        "status": emp.status or "Active",
        # Current Assignment
        "current_project": emp.current_project or "",
        "assignment_start_date": emp.assignment_start_date or "",
        "assignment_end_date": emp.assignment_end_date or "",
        "allocation_percentage": emp.allocation_percentage or 100,
        "available_from": emp.available_from or "",
        # Performance
        "performance_rating": emp.performance_rating,
        "performance_review_period": emp.performance_review_period or "",
        "performance_notes": emp.performance_notes or "",
        # Sub-collections
        "skills": skills_list,
        "experiences": experiences_list,
        "projects": projects_list,
        "certifications": certs_list,
        "created_at": str(emp.created_at) if emp.created_at else None,
        "updated_at": str(emp.updated_at) if emp.updated_at else None,
    }


# ── Validation ───────────────────────────────────────────────────────────

def validate_employee_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate employee creation/update payload.
    Returns { is_valid, errors, warnings }.
    """
    errors: List[str] = []
    warnings: List[str] = []

    # Required: Name
    name = data.get("name")
    if not name or not str(name).strip():
        errors.append("Employee name is required.")

    # Employee ID format
    emp_id = data.get("employee_id")
    if emp_id and not re.match(r'^[A-Za-z0-9_-]+$', str(emp_id).strip()):
        errors.append("Employee ID must contain only letters, digits, hyphens, or underscores.")

    # Email format
    email = data.get("email")
    if email and str(email).strip():
        if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', str(email).strip()):
            errors.append("Invalid email format.")

    # Experience
    exp = data.get("total_experience_years")
    if exp is not None and exp != "":
        try:
            val = float(exp)
            if val < 0:
                errors.append("Total experience years cannot be negative.")
        except (ValueError, TypeError):
            errors.append("Total experience years must be a valid number.")

    # Status
    status = data.get("status")
    if status and str(status).strip() and str(status).strip() not in VALID_STATUSES:
        errors.append(f"Invalid status '{status}'. Allowed: Active, Inactive.")

    # Performance rating
    rating = data.get("performance_rating")
    if rating is not None and rating != "":
        try:
            val = float(rating)
            if val < 0 or val > 5:
                errors.append("Performance rating must be between 0.0 and 5.0.")
        except (ValueError, TypeError):
            errors.append("Performance rating must be a valid number.")

    # Allocation percentage
    alloc = data.get("allocation_percentage")
    if alloc is not None and alloc != "":
        try:
            val = int(alloc)
            if val < 0 or val > 100:
                errors.append("Allocation percentage must be between 0 and 100.")
        except (ValueError, TypeError):
            errors.append("Allocation percentage must be a valid integer.")

    # Date validations
    for field_name, field_label in [
        ("assignment_start_date", "Assignment Start Date"),
        ("assignment_end_date", "Assignment End Date"),
        ("available_from", "Available From"),
    ]:
        date_val = data.get(field_name)
        if date_val and str(date_val).strip():
            if not _is_valid_date(str(date_val).strip()):
                warnings.append(f"{field_label} '{date_val}' is not in YYYY-MM-DD format.")

    # Assignment end > start check
    start = data.get("assignment_start_date")
    end = data.get("assignment_end_date")
    if start and end and _is_valid_date(str(start)) and _is_valid_date(str(end)):
        if str(end) < str(start):
            errors.append("Assignment end date cannot be before start date.")

    # Skills validation
    skills = data.get("skills", [])
    if isinstance(skills, list):
        for idx, sk in enumerate(skills):
            if isinstance(sk, dict):
                sk_name = sk.get("skill_name") or sk.get("normalized_skill_name")
                if not sk_name or not str(sk_name).strip():
                    errors.append(f"Skill at position {idx + 1} has an empty name.")
                prof = sk.get("proficiency_level")
                if prof and str(prof).strip() and str(prof).strip() not in VALID_PROFICIENCY_LEVELS:
                    warnings.append(f"Skill '{sk_name}' has unrecognized proficiency '{prof}'.")

    return {
        "is_valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }


# ── Duplicate Detection ──────────────────────────────────────────────────

def detect_duplicate_employee(db: Session, employee_id: Optional[str], email: Optional[str], exclude_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """
    Check if an employee with the given employee_id or email already exists.
    Returns the existing employee info dict if found, None otherwise.
    """
    if employee_id and str(employee_id).strip():
        q = db.query(Candidate).filter(Candidate.employee_id == str(employee_id).strip())
        if exclude_id:
            q = q.filter(Candidate.id != exclude_id)
        existing = q.first()
        if existing:
            return {"id": existing.id, "employee_id": existing.employee_id, "name": existing.name, "match_field": "employee_id"}

    if email and str(email).strip():
        q = db.query(Candidate).filter(Candidate.email == str(email).strip())
        if exclude_id:
            q = q.filter(Candidate.id != exclude_id)
        existing = q.first()
        if existing:
            return {"id": existing.id, "employee_id": existing.employee_id, "name": existing.name, "match_field": "email"}

    return None


# ── ID Generation ────────────────────────────────────────────────────────

def generate_next_employee_id(db: Session) -> str:
    """Generate the next available EMP### ID."""
    # Find the max existing employee_id
    all_emps = db.query(Candidate.employee_id).filter(
        Candidate.employee_id.isnot(None)
    ).all()

    max_num = 0
    for (eid,) in all_emps:
        if eid:
            match = re.match(r'^EMP(\d+)$', str(eid).strip(), re.IGNORECASE)
            if match:
                num = int(match.group(1))
                if num > max_num:
                    max_num = num

    return f"EMP{max_num + 1:03d}"


# ── Helpers ──────────────────────────────────────────────────────────────

def _is_valid_date(date_str: str) -> bool:
    """Check if a string is a valid YYYY-MM-DD date."""
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
        return True
    except ValueError:
        return False
