"""
Project Manager Dashboard Service
Orchestrates and aggregates workflow metrics from existing modules:
1. Project Requirement Extraction
2. Employee Master Data
3. Skill Taxonomy
4. Employee Availability Engine
5. Employee-Project Skill Matching Engine
6. Employee Ranking Engine
7. 2x Shortlisting Module

STRICT RULE: Does NOT recalculate or duplicate business logic from these modules.
Only calls module services and formats orchestration payloads for PM Dashboard.
"""

from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.database.models import JobDescription, Candidate, Skill, ProjectShortlist, User
from backend.services.availability_service import evaluate_workforce_availability
from backend.services.matching_service import match_available_employees_for_project
from backend.services.ranking_service import rank_available_employees_for_project
from backend.services.shortlist_service import get_project_shortlist


def format_date_str(val: Any) -> Optional[str]:
    if not val:
        return None
    if hasattr(val, "strftime"):
        return val.strftime("%Y-%m-%d")
    return str(val)


def get_global_dashboard_summary(db: Session, current_user: User) -> Dict[str, Any]:
    """
    Returns global aggregate metrics for the PM Dashboard home page.
    """
    # 1. Project metrics
    proj_query = db.query(JobDescription).filter(JobDescription.user_id == current_user.id)
    total_projects = proj_query.count()
    active_projects = proj_query.filter(JobDescription.extraction_status != "draft").count()

    # Projects ready for assessment
    try:
        ready_for_assessment_count = db.query(ProjectShortlist.job_description_id).distinct().count()
    except Exception:
        db.rollback()
        ready_for_assessment_count = 0

    # 2. Employee workforce metrics
    total_employees = db.query(Candidate).count()
    active_employees = db.query(Candidate).filter(Candidate.status == "Active").count()
    inactive_employees = total_employees - active_employees

    # 3. Skill taxonomy metrics
    total_skills = db.query(Skill).count()

    # 4. Recent projects list with status summary
    recent_jds = proj_query.order_by(JobDescription.created_at.desc()).limit(10).all()
    recent_projects_list = []

    for jd in recent_jds:
        # Determine status
        try:
            shortlist_count = db.query(ProjectShortlist).filter(ProjectShortlist.job_description_id == jd.id).count()
        except Exception:
            db.rollback()
            shortlist_count = 0
        if shortlist_count > 0:
            status_str = "READY_FOR_ASSESSMENT"
        elif jd.extraction_status == "confirmed":
            status_str = "REQUIREMENT_REVIEWED"
        elif jd.extraction_status == "extracted":
            status_str = "REQUIREMENT_EXTRACTED"
        else:
            status_str = "DRAFT"

        team_size = jd.required_team_size or 1
        target_shortlist = team_size * 2

        recent_projects_list.append({
            "id": jd.id,
            "title": jd.title,
            "project_name": jd.project_name or jd.title,
            "domain": jd.domain or "General",
            "required_team_size": team_size,
            "target_shortlist": target_shortlist,
            "start_date": format_date_str(jd.start_date),
            "end_date": format_date_str(jd.end_date),
            "duration_text": jd.duration_text or "N/A",
            "status": status_str,
            "created_at": jd.created_at.isoformat() if hasattr(jd.created_at, "isoformat") else str(jd.created_at) if jd.created_at else None
        })

    return {
        "error": False,
        "total_projects": total_projects,
        "active_projects": active_projects,
        "projects_ready_for_assessment": ready_for_assessment_count,
        "workforce": {
            "total_employees": total_employees,
            "active_employees": active_employees,
            "inactive_employees": inactive_employees
        },
        "taxonomy": {
            "total_skills": total_skills
        },
        "recent_projects": recent_projects_list
    }


def get_project_workspace_summary(db: Session, project_id: int, current_user: User) -> Dict[str, Any]:
    """
    Returns complete project-specific workspace orchestration payload for PM.
    Combines requirements, availability summary, matching summary, ranking summary, and 2x shortlist summary.
    """
    jd = db.query(JobDescription).filter(
        JobDescription.id == project_id,
        JobDescription.user_id == current_user.id
    ).first()

    if not jd:
        # Fallback query without user filter if admin view
        jd = db.query(JobDescription).filter(JobDescription.id == project_id).first()
        if not jd:
            return {
                "error": True,
                "message": f"Project Requirement with ID {project_id} not found."
            }

    team_size = jd.required_team_size or 1
    target_shortlist = team_size * 2

    # ── 1. Requirements Summary ──
    req_summary = {
        "id": jd.id,
        "project_name": jd.project_name or jd.title,
        "domain": jd.domain or "Healthcare",
        "required_team_size": team_size,
        "target_shortlist": target_shortlist,
        "start_date": format_date_str(jd.start_date),
        "end_date": format_date_str(jd.end_date),
        "roles": jd.roles or [],
        "skills_required": jd.skills_required or [],
        "skills_preferred": jd.skills_preferred or [],
        "extraction_status": jd.extraction_status or "draft"
    }

    # ── 2. Availability Summary (Calls Availability Service) ──
    start_str = format_date_str(jd.start_date) or "2026-09-01"
    end_str = format_date_str(jd.end_date) or "2026-11-30"
    avail_res = evaluate_workforce_availability(
        db=db,
        project_start_str=start_str,
        project_end_str=end_str,
        project_id=project_id,
        page=1,
        page_size=1
    )
    avail_summary = {
        "total_workforce": avail_res.get("total_workforce", 0),
        "available_count": avail_res.get("available_count", 0),
        "unavailable_count": avail_res.get("unavailable_count", 0),
        "availability_percentage": avail_res.get("availability_percentage", 0.0)
    }

    # ── 3. Skill Matching Summary (Calls Matching Service) ──
    match_res = match_available_employees_for_project(db=db, project_id=project_id, page=1, page_size=1)
    matched_items = match_res.get("items", [])
    matched_count = match_res.get("total_matched", 0)
    top_match_score = matched_items[0]["overall_match_score"] if matched_items else 0.0

    match_summary = {
        "available_pool": avail_summary["available_count"],
        "total_matched": matched_count,
        "top_match_score": top_match_score
    }

    # ── 4. Ranking Summary (Calls Ranking Service) ──
    ranking_res = rank_available_employees_for_project(db=db, project_id=project_id, page=1, page_size=1, mode="PRE_ASSESSMENT")
    ranked_items = ranking_res.get("items", [])
    ranked_count = ranking_res.get("total_ranked", 0)
    top_employee_id = ranked_items[0]["employee_id"] if ranked_items else "N/A"
    top_ranking_score = ranked_items[0]["ranking_score"] if ranked_items else 0.0

    ranking_summary = {
        "total_ranked": ranked_count,
        "top_employee_id": top_employee_id,
        "top_ranking_score": top_ranking_score,
        "ranking_mode": "PRE_ASSESSMENT"
    }

    # ── 5. 2x Shortlist Summary (Calls Shortlisting Service) ──
    shortlist_res = get_project_shortlist(db=db, project_id=project_id, page=1, page_size=1)
    shortlist_summary = {
        "required_team_size": team_size,
        "required_shortlist_size": target_shortlist,
        "actual_shortlist_size": shortlist_res.get("actual_shortlist_size", 0),
        "total_eligible_ranked": shortlist_res.get("total_eligible_ranked", 0),
        "cutoff_rank": shortlist_res.get("cutoff_rank", 0),
        "status": shortlist_res.get("status", "INSUFFICIENT_POOL"),
        "warning": shortlist_res.get("warning")
    }

    # ── 6. Workflow Progression Flags ──
    has_shortlist = shortlist_summary["actual_shortlist_size"] > 0
    has_ranking = ranked_count > 0
    has_matching = matched_count > 0
    has_availability = avail_summary["available_count"] > 0

    if has_shortlist:
        current_status = "READY_FOR_ASSESSMENT"
    elif has_ranking:
        current_status = "RANKING_COMPLETED"
    elif has_matching:
        current_status = "MATCHING_COMPLETED"
    elif has_availability:
        current_status = "AVAILABILITY_COMPLETED"
    elif jd.extraction_status == "confirmed":
        current_status = "REQUIREMENT_REVIEWED"
    elif jd.extraction_status == "extracted":
        current_status = "REQUIREMENT_EXTRACTED"
    else:
        current_status = "DRAFT"

    workflow_stepper = [
        {"step": 1, "name": "Requirement Upload", "completed": bool(jd.source_file_path or jd.title)},
        {"step": 2, "name": "Requirement Extraction", "completed": jd.extraction_status in ["extracted", "confirmed"]},
        {"step": 3, "name": "Requirement Review", "completed": jd.extraction_status == "confirmed"},
        {"step": 4, "name": "Availability Engine", "completed": has_availability},
        {"step": 5, "name": "Skill Matching", "completed": has_matching},
        {"step": 6, "name": "Employee Ranking", "completed": has_ranking},
        {"step": 7, "name": "2× Shortlisting", "completed": has_shortlist},
        {"step": 8, "name": "Project Assessment", "completed": False, "pending_semester": 2},
        {"step": 9, "name": "Final Team Selection", "completed": False, "pending_semester": 2}
    ]

    return {
        "error": False,
        "project_id": jd.id,
        "status": current_status,
        "requirement": req_summary,
        "availability": avail_summary,
        "matching": match_summary,
        "ranking": ranking_summary,
        "shortlist": shortlist_summary,
        "workflow_stepper": workflow_stepper
    }
