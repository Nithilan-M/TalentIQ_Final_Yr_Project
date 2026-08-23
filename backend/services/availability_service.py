"""
Employee Availability Engine Service
Provides 100% deterministic, auditable workforce availability filtering for requested project periods.
Evaluates date overlaps (assignment_start <= project_end AND assignment_end >= project_start),
available_from dates, employee active/inactive status, allocation percentages, and multiple project assignments.

STRICT RULE: NO AI (LLMs, FAISS, embeddings) is used for availability evaluation.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, date
from sqlalchemy.orm import Session
from backend.database.models import Candidate, Project, JobDescription


def parse_iso_date(date_str: Optional[str]) -> Optional[date]:
    """Safely parse ISO date string (YYYY-MM-DD or YYYY/MM/DD) into a Python datetime.date object."""
    if not date_str or not isinstance(date_str, str):
        return None
    cleaned = date_str.strip()
    if not cleaned:
        return None

    # Common date formats
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    return None


def evaluate_employee_availability(
    candidate: Candidate,
    project_start: date,
    project_end: date
) -> Dict[str, Any]:
    """
    Evaluates an individual employee's availability against a requested project period.
    Returns structured DTO with status, conflict flag, reason, and conflicting project list.
    """
    conflicting_projects: List[Dict[str, Any]] = []
    reasons: List[str] = []

    # ── RULE 1: Inactive Employee Check ────────────────────────────────────
    if candidate.status and candidate.status.strip().lower() == "inactive":
        return {
            "id": candidate.id,
            "employee_id": candidate.employee_id or f"EMP{candidate.id:03d}",
            "name": candidate.name,
            "department": candidate.department or "N/A",
            "designation": candidate.designation or "N/A",
            "employee_status": candidate.status,
            "availability_status": "Unavailable",
            "available_from": candidate.available_from,
            "allocation_percentage": candidate.allocation_percentage or 100,
            "conflict": True,
            "reason": "Employee status is Inactive. Inactive workforce members are not eligible for project allocation.",
            "conflicting_projects": []
        }

    # ── RULE 2: Available From Date Check ──────────────────────────────────
    if candidate.available_from:
        avail_dt = parse_iso_date(candidate.available_from)
        if avail_dt and avail_dt > project_start:
            reasons.append(
                f"Employee is available from {candidate.available_from}, which is after requested project start date ({project_start.isoformat()})."
            )

    # ── RULE 3: Current Assignment Date Overlap Check ──────────────────────
    if candidate.current_project and (candidate.assignment_start_date or candidate.assignment_end_date):
        asn_start = parse_iso_date(candidate.assignment_start_date)
        asn_end = parse_iso_date(candidate.assignment_end_date)

        if asn_start and asn_end:
            # Date Overlap Condition: assignment_start <= project_end AND assignment_end >= project_start
            # Same-day boundary rule: assignment_end == project_start is treated as Unavailable (same-day handoff prohibited)
            if (asn_start <= project_end) and (asn_end >= project_start):
                conflicting_projects.append({
                    "project_name": candidate.current_project,
                    "start_date": candidate.assignment_start_date,
                    "end_date": candidate.assignment_end_date,
                    "allocation_percentage": candidate.allocation_percentage or 100,
                    "source": "Current Assignment",
                    "overlap_period": f"{max(asn_start, project_start).isoformat()} to {min(asn_end, project_end).isoformat()}"
                })
                reasons.append(
                    f"Assigned to '{candidate.current_project}' ({candidate.assignment_start_date} to {candidate.assignment_end_date}) overlapping requested project period."
                )

    # ── RULE 4: Multiple Project History Overlap Check ──────────────────────
    if candidate.projects:
        for proj in candidate.projects:
            if proj.start_date and proj.end_date:
                p_start = parse_iso_date(proj.start_date)
                p_end = parse_iso_date(proj.end_date)
                if p_start and p_end:
                    if (p_start <= project_end) and (p_end >= project_start):
                        # Avoid duplicate current project logging if already recorded
                        already_recorded = any(
                            c["project_name"] == proj.title and c["start_date"] == proj.start_date
                            for c in conflicting_projects
                        )
                        if not already_recorded:
                            conflicting_projects.append({
                                "project_name": proj.title,
                                "start_date": proj.start_date,
                                "end_date": proj.end_date,
                                "role": proj.role or "Team Member",
                                "source": "Project History",
                                "overlap_period": f"{max(p_start, project_start).isoformat()} to {min(p_end, project_end).isoformat()}"
                            })
                            reasons.append(
                                f"Project history record '{proj.title}' ({proj.start_date} to {proj.end_date}) overlaps requested project period."
                            )

    # Determine Final Availability Result
    is_unavailable = len(conflicting_projects) > 0 or len(reasons) > 0

    if is_unavailable:
        combined_reason = "; ".join(reasons) if reasons else "Conflicting project assignments found."
        return {
            "id": candidate.id,
            "employee_id": candidate.employee_id or f"EMP{candidate.id:03d}",
            "name": candidate.name,
            "department": candidate.department or "Unassigned",
            "designation": candidate.designation or "Employee",
            "employee_status": candidate.status or "Active",
            "availability_status": "Unavailable",
            "available_from": candidate.available_from,
            "allocation_percentage": candidate.allocation_percentage or 100,
            "conflict": True,
            "reason": combined_reason,
            "conflicting_projects": conflicting_projects
        }

    return {
        "id": candidate.id,
        "employee_id": candidate.employee_id or f"EMP{candidate.id:03d}",
        "name": candidate.name,
        "department": candidate.department or "Unassigned",
        "designation": candidate.designation or "Employee",
        "employee_status": candidate.status or "Active",
        "availability_status": "Available",
        "available_from": candidate.available_from,
        "allocation_percentage": candidate.allocation_percentage or 100,
        "conflict": False,
        "reason": "Employee has no conflicting assignments during the requested project period.",
        "conflicting_projects": []
    }


def evaluate_workforce_availability(
    db: Session,
    project_start_str: str,
    project_end_str: str,
    project_id: Optional[int] = None,
    project_name: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
    status_filter: Optional[str] = None,
    department: Optional[str] = None,
    designation: Optional[str] = None,
    search: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluates full workforce availability for a given project period.
    Returns summary metrics, available list, unavailable list, and paginated records.
    """
    p_start = parse_iso_date(project_start_str)
    p_end = parse_iso_date(project_end_str)

    if not p_start or not p_end:
        return {
            "error": True,
            "message": "Project start and end dates are required in valid format (YYYY-MM-DD) to determine employee availability."
        }

    if p_end < p_start:
        return {
            "error": True,
            "message": f"Invalid project dates: Project end date ({project_end_str}) cannot be before start date ({project_start_str})."
        }

    # Retrieve all workforce candidates
    all_candidates = db.query(Candidate).order_by(Candidate.name.asc()).all()

    evaluated_items: List[Dict[str, Any]] = []
    available_list: List[Dict[str, Any]] = []
    unavailable_list: List[Dict[str, Any]] = []

    for cand in all_candidates:
        res = evaluate_employee_availability(cand, p_start, p_end)
        
        # Filter checks
        if status_filter and status_filter.strip():
            if res["availability_status"].lower() != status_filter.strip().lower():
                continue

        if department and department.strip():
            if (cand.department or "").strip().lower() != department.strip().lower():
                continue

        if designation and designation.strip():
            if (cand.designation or "").strip().lower() != designation.strip().lower():
                continue

        if search and search.strip():
            s = search.strip().lower()
            emp_id = (res["employee_id"] or "").lower()
            name = (cand.name or "").lower()
            dept = (cand.department or "").lower()
            desig = (cand.designation or "").lower()
            if s not in emp_id and s not in name and s not in dept and s not in desig:
                continue

        evaluated_items.append(res)
        if res["availability_status"] == "Available":
            available_list.append(res)
        else:
            unavailable_list.append(res)

    total_evaluated = len(evaluated_items)
    avail_count = len([x for x in evaluated_items if x["availability_status"] == "Available"])
    unavail_count = len([x for x in evaluated_items if x["availability_status"] == "Unavailable"])

    # Pagination
    offset = (page - 1) * page_size
    paginated_items = evaluated_items[offset : offset + page_size]

    return {
        "error": False,
        "project_id": project_id,
        "project_name": project_name or "Project Requirement",
        "project_start_date": p_start.isoformat(),
        "project_end_date": p_end.isoformat(),
        "total_workforce": len(all_candidates),
        "total_evaluated": total_evaluated,
        "available_count": avail_count,
        "unavailable_count": unavail_count,
        "availability_ratio_percent": round((avail_count / total_evaluated * 100), 1) if total_evaluated > 0 else 0.0,
        "items": paginated_items,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_evaluated + page_size - 1) // page_size if page_size > 0 else 1
    }
