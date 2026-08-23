from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from backend.database.connection import get_db
from backend.database.models import JobDescription, Candidate, User
from backend.api.auth import get_current_user
from backend.services.matching_service import (
    match_available_employees_for_project,
    calculate_employee_project_match
)

router = APIRouter(prefix="/api/project", tags=["Employee-Project Skill Matching Engine"])


@router.get("/{project_id}/skill-matches")
def get_project_skill_matches(
    project_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    department: Optional[str] = None,
    designation: Optional[str] = None,
    min_score: Optional[float] = Query(None, ge=0, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 3 in TalentIQ Workflow:
    Executes Employee–Project Skill Matching Engine on AVAILABLE employees ONLY.
    Calculates 6-dimension match scores (Skill Coverage, Proficiency Match, Experience Match,
    Role Relevance, Domain Relevance, Technology Stack Alignment) and generates transparent explanations.
    """
    jd = db.query(JobDescription).filter(JobDescription.id == project_id).first()
    if not jd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project Requirement with ID {project_id} not found."
        )

    res = match_available_employees_for_project(
        db=db,
        project_id=project_id,
        page=page,
        page_size=page_size,
        department=department,
        designation=designation,
        min_score=min_score,
        search=search
    )

    if res.get("error"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res["message"]
        )

    return res


@router.get("/{project_id}/skill-matches/{employee_id}")
def get_employee_skill_match_details(
    project_id: int,
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed match profile breakdown for a specific available employee against a project requirement.
    """
    jd = db.query(JobDescription).filter(JobDescription.id == project_id).first()
    if not jd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project Requirement with ID {project_id} not found."
        )

    cand = db.query(Candidate).filter(Candidate.id == employee_id).first()
    if not cand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found."
        )

    match_dto = calculate_employee_project_match(cand, jd, db)
    return {
        "project_id": jd.id,
        "project_name": jd.project_name or jd.title,
        "project_start_date": jd.start_date,
        "project_end_date": jd.end_date,
        "required_team_size": jd.required_team_size or 1,
        "domain": jd.domain or "General",
        "employee_match": match_dto
    }


@router.get("/{project_id}/employees/{employee_id}/match-explanation")
@router.get("/{project_id}/skill-matches/{employee_id}/explanation")
def get_employee_match_explanation(
    project_id: int,
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Explainable Matching Module Endpoint:
    Returns structured 6-dimension score trace, skill-by-skill evaluation (Matched, Partial, Missing, Related),
    positive/negative factor analysis, evidence sources, and deterministic summary synthesis.
    """
    from backend.services.explainability_service import generate_match_explanation_for_employee

    res = generate_match_explanation_for_employee(db=db, project_id=project_id, employee_id=employee_id)
    if res.get("error"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res["message"]
        )

    return res

