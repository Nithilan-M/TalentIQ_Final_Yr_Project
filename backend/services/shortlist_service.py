"""
2x Shortlisting Module Service
Reduces the ranked eligible employee pool to a manageable assessment shortlist using
the dynamic 2 x Required Team Size rule.

STRICT RULES:
1. Shortlist Size = Required Team Size * 2 (Never static or hardcoded).
2. Consumes output from Employee Ranking Engine without re-ranking or recalculating.
3. Ranks 1..2N = SHORTLISTED. Ranks > 2N = NOT_SHORTLISTED.
4. If fewer than 2N employees exist, shortlists all available employees and returns a clear warning.
5. Project-specific shortlist persistence (ProjectShortlist DB table). Candidate master status is NOT changed.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from backend.database.models import JobDescription, Candidate, ProjectShortlist
from backend.services.ranking_service import rank_available_employees_for_project


def generate_project_shortlist(db: Session, project_id: int) -> Dict[str, Any]:
    """
    Step 5 in TalentIQ Workflow:
    Calculates dynamic required shortlist size (Team Size * 2), consumes Employee Ranking output,
    applies cutoff, persists shortlist records, and returns structured DTO.
    """
    jd = db.query(JobDescription).filter(JobDescription.id == project_id).first()
    if not jd:
        return {
            "error": True,
            "message": f"Project Requirement with ID {project_id} not found."
        }

    team_size = jd.required_team_size or 1
    if team_size <= 0:
        return {
            "error": True,
            "message": "Required team size must be greater than zero."
        }

    required_shortlist_size = team_size * 2

    # ── Retrieve Ranked Eligible Employees (Consumes Ranking Engine Output) ──
    ranking_res = rank_available_employees_for_project(
        db=db,
        project_id=project_id,
        page=1,
        page_size=10000,
        mode="PRE_ASSESSMENT"
    )

    if ranking_res.get("error"):
        return ranking_res

    ranked_items = ranking_res.get("items", [])
    total_eligible = len(ranked_items)

    warning_msg = None
    if total_eligible == 0:
        warning_msg = "No eligible employees are currently available for this project."
        actual_shortlist_size = 0
        cutoff_rank = 0
    elif total_eligible < required_shortlist_size:
        warning_msg = f"Only {total_eligible} eligible employees are available for the required shortlist of {required_shortlist_size}."
        actual_shortlist_size = total_eligible
        cutoff_rank = total_eligible
    else:
        actual_shortlist_size = required_shortlist_size
        cutoff_rank = required_shortlist_size

    # ── Separate Shortlisted vs Not Shortlisted Pools ──
    shortlisted_dtos: List[Dict[str, Any]] = []
    not_shortlisted_dtos: List[Dict[str, Any]] = []

    for item in ranked_items:
        r_num = item["rank"]
        if r_num <= cutoff_rank:
            item_copy = dict(item)
            item_copy["shortlist_status"] = "SHORTLISTED"
            item_copy["shortlist_reason"] = f"Rank {r_num} is within top {required_shortlist_size} cutoff (2x Team Size {team_size})."
            shortlisted_dtos.append(item_copy)
        else:
            item_copy = dict(item)
            item_copy["shortlist_status"] = "NOT_SHORTLISTED"
            item_copy["shortlist_reason"] = f"Rank {r_num} is below top {required_shortlist_size} cutoff."
            not_shortlisted_dtos.append(item_copy)

    # ── Database Persistence (Regeneration Safety) ──
    # Remove existing active shortlist records for this job_description_id to avoid duplicate records
    db.query(ProjectShortlist).filter(
        ProjectShortlist.job_description_id == project_id
    ).delete(synchronize_session=False)

    now = datetime.utcnow()
    new_db_records = []

    for item in shortlisted_dtos:
        new_db_records.append(
            ProjectShortlist(
                job_description_id=project_id,
                candidate_id=item["id"],
                rank_at_shortlisting=item["rank"],
                ranking_score=item["ranking_score"],
                skill_match_score=item["skill_match_score"],
                shortlist_status="SHORTLISTED",
                created_at=now
            )
        )

    for item in not_shortlisted_dtos:
        new_db_records.append(
            ProjectShortlist(
                job_description_id=project_id,
                candidate_id=item["id"],
                rank_at_shortlisting=item["rank"],
                ranking_score=item["ranking_score"],
                skill_match_score=item["skill_match_score"],
                shortlist_status="NOT_SHORTLISTED",
                created_at=now
            )
        )

    if new_db_records:
        db.add_all(new_db_records)
        db.commit()

    return {
        "error": False,
        "project_id": jd.id,
        "project_name": jd.project_name or jd.title,
        "required_team_size": team_size,
        "shortlist_multiplier": 2,
        "required_shortlist_size": required_shortlist_size,
        "actual_shortlist_size": actual_shortlist_size,
        "total_eligible_ranked": total_eligible,
        "cutoff_rank": cutoff_rank,
        "status": "READY_FOR_ASSESSMENT" if actual_shortlist_size > 0 else "INSUFFICIENT_POOL",
        "warning": warning_msg,
        "shortlisted_employees": shortlisted_dtos,
        "not_shortlisted_employees": not_shortlisted_dtos,
        "generated_at": now.isoformat()
    }


def get_project_shortlist(
    db: Session,
    project_id: int,
    page: int = 1,
    page_size: int = 25,
    status_filter: Optional[str] = None, # 'SHORTLISTED' | 'NOT_SHORTLISTED'
    department: Optional[str] = None,
    designation: Optional[str] = None,
    search: Optional[str] = None
) -> Dict[str, Any]:
    """
    Retrieves project shortlist with metrics, cutoff info, warnings, and pagination.
    Generates shortlist dynamically if not yet generated in DB.
    """
    jd = db.query(JobDescription).filter(JobDescription.id == project_id).first()
    if not jd:
        return {
            "error": True,
            "message": f"Project Requirement with ID {project_id} not found."
        }

    # Check if DB shortlist records exist
    existing_count = db.query(ProjectShortlist).filter(
        ProjectShortlist.job_description_id == project_id
    ).count()

    if existing_count == 0:
        # Generate shortlist
        res = generate_project_shortlist(db, project_id)
        if res.get("error"):
            return res

    # Always fetch latest from generate_project_shortlist DTO to ensure complete enriched fields
    full_data = generate_project_shortlist(db, project_id)
    if full_data.get("error"):
        return full_data

    shortlisted = full_data.get("shortlisted_employees", [])
    not_shortlisted = full_data.get("not_shortlisted_employees", [])

    if status_filter == "SHORTLISTED":
        target_pool = shortlisted
    elif status_filter == "NOT_SHORTLISTED":
        target_pool = not_shortlisted
    else:
        target_pool = shortlisted + not_shortlisted

    # Apply Search & Select Filters
    filtered_items: List[Dict[str, Any]] = []
    for item in target_pool:
        if department and department.strip():
            if (item.get("department") or "").strip().lower() != department.strip().lower():
                continue
        if designation and designation.strip():
            if (item.get("designation") or "").strip().lower() != designation.strip().lower():
                continue
        if search and search.strip():
            s = search.strip().lower()
            emp_id = item.get("employee_id", "").lower()
            name = item.get("name", "").lower()
            if s not in emp_id and s not in name:
                continue
        filtered_items.append(item)

    total_filtered = len(filtered_items)
    offset = (page - 1) * page_size
    paginated_items = filtered_items[offset : offset + page_size]

    return {
        "error": False,
        "project_id": jd.id,
        "project_name": jd.project_name or jd.title,
        "required_team_size": jd.required_team_size or 1,
        "shortlist_multiplier": 2,
        "required_shortlist_size": full_data["required_shortlist_size"],
        "actual_shortlist_size": full_data["actual_shortlist_size"],
        "total_eligible_ranked": full_data["total_eligible_ranked"],
        "cutoff_rank": full_data["cutoff_rank"],
        "status": full_data["status"],
        "warning": full_data["warning"],
        "items": paginated_items,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_filtered + page_size - 1) // page_size if page_size > 0 else 1
    }
