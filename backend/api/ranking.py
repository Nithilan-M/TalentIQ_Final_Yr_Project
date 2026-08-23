from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from backend.database.connection import get_db
from backend.database.models import JobDescription, Candidate, User
from backend.api.auth import get_current_user
from backend.services.ranking_service import (
    rank_available_employees_for_project,
    calculate_employee_ranking_score,
    DEFAULT_RANKING_CONFIG
)
from backend.services.matching_service import calculate_employee_project_match

router = APIRouter(prefix="/api/project", tags=["Employee Ranking Engine"])


@router.get("/{project_id}/ranking")
def get_project_employee_rankings(
    project_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    department: Optional[str] = None,
    designation: Optional[str] = None,
    min_score: Optional[float] = Query(None, ge=0, le=100),
    search: Optional[str] = None,
    mode: str = Query("PRE_ASSESSMENT", pattern="^(PRE_ASSESSMENT|FINAL)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 4 in TalentIQ Workflow:
    Executes Employee Ranking Engine on AVAILABLE matched employees ONLY.
    Calculates transparent ranking scores across approved workforce factors (Skill Match, Relevant Experience,
    Past Performance, Other Factors). In PRE_ASSESSMENT mode (Semester 1), assessment_score remains explicitly null.
    """
    jd = db.query(JobDescription).filter(JobDescription.id == project_id).first()
    if not jd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project Requirement with ID {project_id} not found."
        )

    res = rank_available_employees_for_project(
        db=db,
        project_id=project_id,
        page=page,
        page_size=page_size,
        department=department,
        designation=designation,
        min_score=min_score,
        search=search,
        mode=mode
    )

    if res.get("error"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res["message"]
        )

    return res


@router.get("/{project_id}/ranking/config")
def get_ranking_configuration(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns active ranking configuration weights for Semester 1 (PRE_ASSESSMENT) and Semester 2 (FINAL).
    """
    return {
        "project_id": project_id,
        "configurations": DEFAULT_RANKING_CONFIG,
        "active_mode": "PRE_ASSESSMENT",
        "semester": "Semester 1 (Pre-Assessment)"
    }


@router.get("/{project_id}/ranking/{employee_id}")
def get_employee_ranking_details(
    project_id: int,
    employee_id: int,
    mode: str = Query("PRE_ASSESSMENT", pattern="^(PRE_ASSESSMENT|FINAL)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed ranking breakdown for a single available employee against a project requirement.
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
    rank_dto = calculate_employee_ranking_score(match_dto, cand, jd, mode=mode)

    return {
        "project_id": jd.id,
        "project_name": jd.project_name or jd.title,
        "required_team_size": jd.required_team_size or 1,
        "employee_ranking_details": rank_dto
    }
