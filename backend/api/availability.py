from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from backend.database.connection import get_db
from backend.database.models import JobDescription, Candidate, User
from backend.api.auth import get_current_user
from backend.services.availability_service import (
    evaluate_workforce_availability,
    evaluate_employee_availability,
    parse_iso_date
)

router = APIRouter(prefix="/api/availability", tags=["Employee Availability Engine"])


@router.get("/project/{project_id}")
def get_project_availability(
    project_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"), # 'Available' or 'Unavailable'
    department: Optional[str] = None,
    designation: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 2 in TalentIQ Workflow:
    Evaluates workforce availability against a confirmed Project Requirement (project_id).
    Returns total workforce counts (Available vs Unavailable), date overlap explanations, and paginated records.
    """
    jd = db.query(JobDescription).filter(JobDescription.id == project_id).first()
    if not jd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project Requirement with ID {project_id} not found."
        )

    if not jd.start_date or not jd.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project Requirement '{jd.title or jd.project_name}' does not have valid start and end dates. Please edit project requirements to set start and end dates."
        )

    res = evaluate_workforce_availability(
        db=db,
        project_start_str=jd.start_date,
        project_end_str=jd.end_date,
        project_id=jd.id,
        project_name=jd.project_name or jd.title,
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

    # Attach project metadata
    res["required_team_size"] = jd.required_team_size or 1
    res["roles"] = jd.roles or []
    res["domain"] = jd.domain or "General"

    return res


@router.get("/check-dates")
def check_dates_availability(
    start_date: str = Query(..., description="ISO start date YYYY-MM-DD"),
    end_date: str = Query(..., description="ISO end date YYYY-MM-DD"),
    project_name: Optional[str] = "Custom Project Check",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    department: Optional[str] = None,
    designation: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Evaluates workforce availability against explicit custom project start and end dates.
    """
    res = evaluate_workforce_availability(
        db=db,
        project_start_str=start_date,
        project_end_str=end_date,
        project_id=None,
        project_name=project_name,
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


@router.get("/departments")
def get_availability_filter_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of unique departments and designations for filtering availability results."""
    depts = db.query(Candidate.department).filter(Candidate.department.isnot(None)).distinct().all()
    desigs = db.query(Candidate.designation).filter(Candidate.designation.isnot(None)).distinct().all()

    return {
        "departments": sorted([d[0] for d in depts if d[0]]),
        "designations": sorted([d[0] for d in desigs if d[0]])
    }
