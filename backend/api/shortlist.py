from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from backend.database.connection import get_db
from backend.database.models import JobDescription, User
from backend.api.auth import get_current_user
from backend.services.shortlist_service import (
    generate_project_shortlist,
    get_project_shortlist
)

router = APIRouter(prefix="/api/project", tags=["2x Shortlisting Module"])


@router.post("/{project_id}/shortlist/generate")
def generate_shortlist_for_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 5 in TalentIQ Workflow:
    Generates or regenerates project shortlist based on the 2x Required Team Size rule (Shortlist = Team Size * 2).
    Consumes Employee Ranking Engine output without re-ranking. Persists shortlist to DB without changing permanent candidate master status.
    """
    jd = db.query(JobDescription).filter(JobDescription.id == project_id).first()
    if not jd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project Requirement with ID {project_id} not found."
        )

    res = generate_project_shortlist(db=db, project_id=project_id)
    if res.get("error"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res["message"]
        )

    return res


@router.get("/{project_id}/shortlist")
def get_project_shortlist_view(
    project_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status_filter: Optional[str] = Query(None, pattern="^(SHORTLISTED|NOT_SHORTLISTED)$"),
    department: Optional[str] = None,
    designation: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves project shortlist metrics, cutoff information, warnings, and paginated employee list.
    """
    jd = db.query(JobDescription).filter(JobDescription.id == project_id).first()
    if not jd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project Requirement with ID {project_id} not found."
        )

    res = get_project_shortlist(
        db=db,
        project_id=project_id,
        page=page,
        page_size=page_size,
        status_filter=status_filter,
        department=department,
        designation=designation,
        search=search
    )

    if res.get("error"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res["message"]
        )

    return res
