"""
Employee Ranking Engine Service
Ranks available, matched employees based on project suitability using approved workforce factors,
transparent scoring, and configurable weights.

STRICT RULES:
1. ONLY available employees who passed the Availability Engine and Skill Matching Engine are ranked.
2. In PRE_ASSESSMENT mode (Semester 1), assessment_score is explicitly null.
3. No fake assessment or random scores are generated.
4. Uses deterministic tie-breaking (Skill Match -> Relevant Exp -> Performance -> Matched Count -> Employee ID).
5. Explanations are deterministically generated from computed factor scores (No AI hallucinations).
"""

import math
import re
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from backend.database.models import Candidate, JobDescription
from backend.services.matching_service import match_available_employees_for_project, calculate_employee_project_match


# ── Centralized Ranking Configuration ──
DEFAULT_RANKING_CONFIG = {
    "FINAL": {
        "mode_description": "Semester 2 Final Ranking (Includes Assessment)",
        "skill_match_weight": 0.40,
        "assessment_weight": 0.30,
        "experience_weight": 0.15,
        "performance_weight": 0.10,
        "other_weight": 0.05
    },
    "PRE_ASSESSMENT": {
        "mode_description": "Semester 1 Pre-Assessment Ranking (Renormalized Active Factors)",
        "skill_match_weight": 0.5714,  # 0.40 / 0.70
        "assessment_weight": 0.0,       # Pending Semester 2 Assessment Engine
        "experience_weight": 0.2143,   # 0.15 / 0.70
        "performance_weight": 0.1429,  # 0.10 / 0.70
        "other_weight": 0.0714         # 0.05 / 0.70
    }
}


def _extract_numeric_exp(exp_str: Optional[str]) -> float:
    """Extract float numeric years from string."""
    if not exp_str:
        return 0.0
    if isinstance(exp_str, (int, float)):
        return float(exp_str)
    m = re.search(r"(\d+(?:\.\d+)?)", str(exp_str))
    return float(m.group(1)) if m else 0.0


def calculate_employee_ranking_score(
    match_dto: Dict[str, Any],
    candidate: Candidate,
    job_description: JobDescription,
    mode: str = "PRE_ASSESSMENT"
) -> Dict[str, Any]:
    """
    Computes transparent ranking score across approved workforce factors.
    Supports PRE_ASSESSMENT mode (Semester 1) and FINAL mode (Semester 2).
    """
    config = DEFAULT_RANKING_CONFIG.get(mode, DEFAULT_RANKING_CONFIG["PRE_ASSESSMENT"])

    # ── Factor 1: Skill Match Score (0 - 100) ──
    skill_match_score = float(match_dto.get("overall_match_score", 0.0))

    # ── Factor 2: Relevant Experience Score (0 - 100) ──
    # Calculate relevant project experience from candidate.projects and total experience
    proj_domain = (job_description.domain or "").strip().lower()
    rel_exp_years = candidate.total_experience_years or 0.0

    # If domain experience or relevant project history exists, compute relevant years
    if candidate.projects:
        rel_projects = [p for p in candidate.projects if p.domain and proj_domain and proj_domain in p.domain.lower()]
        if rel_projects:
            rel_exp_years = max(rel_exp_years, len(rel_projects) * 1.5)

    req_exp_years = 3.0 # Benchmark requirement default if unspecified
    req_exp_str = getattr(job_description, "experience_required", None) or getattr(job_description, "description", None)
    if req_exp_str:
        extracted = _extract_numeric_exp(req_exp_str)
        if extracted > 0:
            req_exp_years = extracted

    if req_exp_years > 0:
        experience_score = round(min(100.0, max(30.0, (rel_exp_years / req_exp_years) * 100.0)), 1)
    else:
        experience_score = 80.0

    # ── Factor 3: Past Performance Score (0 - 100) ──
    performance_unspecified = False
    perf_rating = getattr(candidate, "performance_rating", None)

    if perf_rating is not None and perf_rating > 0:
        performance_score = round(min(100.0, (float(perf_rating) / 5.0) * 100.0), 1)
    else:
        # Benchmark neutral performance (3.5 / 5.0 = 70.0%)
        performance_score = 70.0
        performance_unspecified = True

    # ── Factor 4: Other Approved Factors Score (0 - 100) ──
    # Includes certifications alignment and domain expertise
    certs_count = len(candidate.certifications) if candidate.certifications else 0
    domain_score = match_dto.get("domain_relevance", 70.0)
    other_score = round(min(100.0, (0.7 * domain_score) + min(30.0, certs_count * 10.0)), 1)

    # ── Factor 5: Assessment Score (Pending Semester 2) ──
    assessment_score = None # Explicitly null for Semester 1

    # ── Calculate Weighted Ranking Score ──
    w_skill = config["skill_match_weight"]
    w_exp = config["experience_weight"]
    w_perf = config["performance_weight"]
    w_other = config["other_weight"]

    ranking_score = round(
        (w_skill * skill_match_score) +
        (w_exp * experience_score) +
        (w_perf * performance_score) +
        (w_other * other_score),
        1
    )

    # ── Deterministic Explanation Generation ──
    exp_parts = []
    exp_parts.append(f"Skill Match: {skill_match_score}% ({match_dto.get('matched_skills_count', 0)} matched skills).")
    exp_parts.append(f"Relevant Experience: {rel_exp_years:.1f} yrs ({experience_score}%).")

    if not performance_unspecified and perf_rating:
        exp_parts.append(f"Performance Rating: {perf_rating}/5.0 ({performance_score}%).")
    else:
        exp_parts.append("Performance: Benchmark default (70.0%).")

    if mode == "PRE_ASSESSMENT":
        exp_parts.append("Assessment: Pending Semester 2.")

    explanation_str = " ".join(exp_parts)

    return {
        "id": candidate.id,
        "employee_id": candidate.employee_id or f"EMP{candidate.id:03d}",
        "name": candidate.name,
        "department": candidate.department or "Unassigned",
        "designation": candidate.designation or "Employee",
        "total_experience_years": candidate.total_experience_years or 0.0,
        "relevant_experience_years": round(rel_exp_years, 1),
        "performance_rating": perf_rating,
        "performance_unspecified": performance_unspecified,
        "availability_status": "Available",
        
        # Core Ranking Metrics
        "ranking_score": ranking_score,
        "ranking_mode": mode,
        "skill_match_score": skill_match_score,
        "assessment_score": assessment_score, # Null in Semester 1
        "relevant_experience_score": experience_score,
        "performance_score": performance_score,
        "other_score": other_score,

        # Breakdown from Skill Matching Engine
        "matched_skills": match_dto.get("matched_skills", []),
        "partial_skills": match_dto.get("partial_skills", []),
        "missing_skills": match_dto.get("missing_skills", []),
        "matched_skills_count": match_dto.get("matched_skills_count", 0),
        "partial_skills_count": match_dto.get("partial_skills_count", 0),
        "missing_skills_count": match_dto.get("missing_skills_count", 0),

        # Deterministic Ranking Explanation
        "ranking_explanation": explanation_str
    }


def rank_available_employees_for_project(
    db: Session,
    project_id: int,
    page: int = 1,
    page_size: int = 25,
    department: Optional[str] = None,
    designation: Optional[str] = None,
    min_score: Optional[float] = None,
    search: Optional[str] = None,
    mode: str = "PRE_ASSESSMENT"
) -> Dict[str, Any]:
    """
    Step 4 in TalentIQ Workflow:
    1. Consumes output from Skill Matching Engine for AVAILABLE employees ONLY.
    2. Calculates transparent ranking scores using active weight configuration.
    3. Sorts employees using deterministic tie-breaking rules.
    4. Assigns ordinal ranks (Rank 1, Rank 2, ...) and returns paginated ranking DTOs.
    """
    jd = db.query(JobDescription).filter(JobDescription.id == project_id).first()
    if not jd:
        return {
            "error": True,
            "message": f"Project Requirement with ID {project_id} not found."
        }

    # ── STEP 1 & 2: Consume Skill Matching Engine output (Available Employees ONLY) ──
    match_res = match_available_employees_for_project(
        db=db,
        project_id=project_id,
        page=1,
        page_size=10000 # Retrieve full available set for ranking
    )

    if match_res.get("error"):
        return match_res

    available_matches = match_res.get("items", [])
    if not available_matches:
        return {
            "error": False,
            "project_id": jd.id,
            "project_name": jd.project_name or jd.title,
            "required_team_size": jd.required_team_size or 1,
            "ranking_mode": mode,
            "total_available_workforce": match_res.get("total_available_workforce", 0),
            "total_ranked_evaluated": 0,
            "high_suitability_count": 0,
            "top_ranking_score": 0.0,
            "average_ranking_score": 0.0,
            "active_weights": DEFAULT_RANKING_CONFIG.get(mode, DEFAULT_RANKING_CONFIG["PRE_ASSESSMENT"]),
            "items": [],
            "page": page,
            "page_size": page_size,
            "total_pages": 1,
            "message": "No available matched employees found for ranking."
        }

    # Fetch candidate database records for available IDs
    cand_ids = [m["id"] for m in available_matches]
    candidates_list = db.query(Candidate).filter(Candidate.id.in_(cand_ids)).all()
    cand_map = {c.id: c for c in candidates_list}

    # ── STEP 3: Execute Ranking Engine ──
    ranked_records: List[Dict[str, Any]] = []

    for match_dto in available_matches:
        cid = match_dto["id"]
        cand = cand_map.get(cid)
        if not cand:
            continue

        rank_dto = calculate_employee_ranking_score(match_dto, cand, jd, mode=mode)

        # Apply Filters
        if min_score is not None and rank_dto["ranking_score"] < min_score:
            continue

        if department and department.strip():
            if (cand.department or "").strip().lower() != department.strip().lower():
                continue

        if designation and designation.strip():
            if (cand.designation or "").strip().lower() != designation.strip().lower():
                continue

        if search and search.strip():
            s = search.strip().lower()
            emp_id = rank_dto["employee_id"].lower()
            name = cand.name.lower()
            if s not in emp_id and s not in name:
                continue

        ranked_records.append(rank_dto)

    # ── STEP 4: Deterministic Tie-Breaking & Sorting ──
    # Sort Key: (ranking_score, skill_match_score, relevant_experience_score, performance_score, matched_skills_count, -cand_id)
    ranked_records.sort(
        key=lambda r: (
            r["ranking_score"],
            r["skill_match_score"],
            r["relevant_experience_score"],
            r["performance_score"],
            r["matched_skills_count"],
            -r["id"]
        ),
        reverse=True
    )

    # Assign Ordinal Ranks (Rank 1, Rank 2, ...)
    for idx, r in enumerate(ranked_records, start=1):
        r["rank"] = idx

    total_ranked = len(ranked_records)
    high_suitability = len([r for r in ranked_records if r["ranking_score"] >= 80.0])
    top_score = ranked_records[0]["ranking_score"] if total_ranked > 0 else 0.0
    avg_score = round(sum(r["ranking_score"] for r in ranked_records) / total_ranked, 1) if total_ranked > 0 else 0.0

    # Paginate
    offset = (page - 1) * page_size
    paginated_items = ranked_records[offset : offset + page_size]

    return {
        "error": False,
        "project_id": jd.id,
        "project_name": jd.project_name or jd.title,
        "project_start_date": jd.start_date,
        "project_end_date": jd.end_date,
        "required_team_size": jd.required_team_size or 1,
        "ranking_mode": mode,
        "total_available_workforce": match_res.get("total_available_workforce", 0),
        "total_ranked_evaluated": total_ranked,
        "high_suitability_count": high_suitability,
        "top_ranking_score": top_score,
        "average_ranking_score": avg_score,
        "active_weights": DEFAULT_RANKING_CONFIG.get(mode, DEFAULT_RANKING_CONFIG["PRE_ASSESSMENT"]),
        "items": paginated_items,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_ranked + page_size - 1) // page_size if page_size > 0 else 1
    }
