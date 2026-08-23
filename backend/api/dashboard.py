from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database.connection import get_db
from backend.database.models import User, JobDescription
from backend.api.auth import get_current_user
from backend.services.dashboard_service import (
    get_global_dashboard_summary,
    get_project_workspace_summary
)

router = APIRouter(prefix="/api/dashboard", tags=["Project Manager Dashboard"])


@router.get("/summary")
def get_global_pm_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns global aggregate metrics, workforce counts, taxonomy totals,
    and recent project list for PM Dashboard home page.
    """
    return get_global_dashboard_summary(db=db, current_user=current_user)


@router.get("/project/{project_id}")
def get_project_pm_workspace(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns project-specific workspace orchestration payload for PM:
    Requirements, Availability, Matching, Ranking, 2x Shortlist, and Workflow Stepper.
    """
    jd = db.query(JobDescription).filter(JobDescription.id == project_id).first()
    if not jd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project Requirement with ID {project_id} not found."
        )

    res = get_project_workspace_summary(db=db, project_id=project_id, current_user=current_user)
    if res.get("error"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=res["message"]
        )

    return res
