"""
Employee-Project Skill Matching Engine Service
Calculates how well AVAILABLE employees match structured project requirements.
Integrates Centralized Skill Taxonomy, 4-level numeric proficiency matching,
skill-specific experience, role relevance, domain relevance, technology stack alignment,
and BGE/FAISS semantic similarity.

STRICT RULE: Only AVAILABLE employees are evaluated. Unavailable employees are excluded.
Scores are transparently calculated using 6 weighted dimensions.
Explanations are deterministically generated from computed breakdown metrics (No AI hallucinations).
"""

import math
import re
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from sqlalchemy.orm import Session
from backend.database.models import Candidate, EmployeeSkill, ProjectSkillRequirement, JobDescription, Project
from backend.services.skill_service import lookup_or_normalize_skill, get_proficiency_value, get_proficiency_label
from backend.services.availability_service import evaluate_workforce_availability
from backend.embeddings.vector_store import vector_store_manager


def _cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Compute cosine similarity between two vector lists."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    a = np.array(v1, dtype=np.float32)
    b = np.array(v2, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def _extract_numeric_years(exp_str: Optional[str]) -> float:
    """Extract floating point years from strings like '3 years', '3.5', '5+ yrs'."""
    if not exp_str:
        return 0.0
    if isinstance(exp_str, (int, float)):
        return float(exp_str)
    match = re.search(r"(\d+(?:\.\d+)?)", str(exp_str))
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return 0.0
    return 0.0


def calculate_employee_project_match(
    candidate: Candidate,
    job_description: JobDescription,
    db: Session
) -> Dict[str, Any]:
    """
    Computes transparent Employee-Project suitability match across 6 dimensions:
    1. Skill Coverage (35%)
    2. Proficiency Match (25%)
    3. Experience Match (15%)
    4. Role Relevance (10%)
    5. Domain Relevance (10%)
    6. Technology Relevance (5%)
    """
    # ── Fetch Project Skill Requirements ──
    project_reqs = db.query(ProjectSkillRequirement).filter(
        ProjectSkillRequirement.job_description_id == job_description.id
    ).all()

    # ── Fetch Employee Skills ──
    emp_skills = db.query(EmployeeSkill).filter(
        EmployeeSkill.candidate_id == candidate.id
    ).all()

    # Build Map of Employee Skills by skill_id, normalized_name, and raw name
    emp_skill_map: Dict[str, EmployeeSkill] = {}
    emp_skill_id_map: Dict[int, EmployeeSkill] = {}

    for es in emp_skills:
        if es.skill_id:
            emp_skill_id_map[es.skill_id] = es
        if es.normalized_skill_name:
            emp_skill_map[es.normalized_skill_name.lower()] = es
        if es.skill_name:
            emp_skill_map[es.skill_name.lower()] = es

    matched_skills: List[Dict[str, Any]] = []
    partial_skills: List[Dict[str, Any]] = []
    missing_skills: List[Dict[str, Any]] = []

    total_weighted_req_points = 0.0
    total_coverage_earned = 0.0
    total_proficiency_earned = 0.0
    total_experience_earned = 0.0
    evaluated_skills_count = 0

    if project_reqs:
        for req in project_reqs:
            # Priority Weight: Critical=1.5, Required=1.0, Preferred=0.7
            priority = (req.priority or "Required").strip().capitalize()
            p_weight = 1.5 if priority == "Critical" else (0.7 if priority == "Preferred" else 1.0)
            total_weighted_req_points += p_weight
            evaluated_skills_count += 1

            matched_emp_skill: Optional[EmployeeSkill] = None
            match_type = "None"

            # 1. Exact Canonical ID Match
            if req.skill_id and req.skill_id in emp_skill_id_map:
                matched_emp_skill = emp_skill_id_map[req.skill_id]
                match_type = "Canonical Taxonomy Match"
            # 2. Normalized Name Match
            elif req.normalized_name and req.normalized_name.lower() in emp_skill_map:
                matched_emp_skill = emp_skill_map[req.normalized_name.lower()]
                match_type = "Normalized Name Match"
            # 3. Original Raw Name Match
            elif req.original_name and req.original_name.lower() in emp_skill_map:
                matched_emp_skill = emp_skill_map[req.original_name.lower()]
                match_type = "Alias Match"
            # 4. Semantic Similarity Match (Guard: Reject distinct skills like Java vs JavaScript)
            else:
                req_norm = (req.normalized_name or req.original_name or "").lower()
                for es in emp_skills:
                    es_norm = (es.normalized_skill_name or es.skill_name or "").lower()
                    # Explicit guard against over-merging distinct terms
                    if ("java" in req_norm and "javascript" in es_norm) or ("javascript" in req_norm and "java" in es_norm):
                        continue
                    if ("python" in req_norm and "cython" in es_norm) or ("cython" in req_norm and "python" in es_norm):
                        continue

                    # Vector similarity fallback if names are related
                    emb1 = vector_store_manager.get_embedding(req.original_name)
                    emb2 = vector_store_manager.get_embedding(es.skill_name)
                    sim = _cosine_similarity(emb1, emb2)
                    if sim >= 0.85:
                        matched_emp_skill = es
                        match_type = f"Semantic Match ({int(sim * 100)}%)"
                        break

            if matched_emp_skill:
                # Skill Coverage Earned
                total_coverage_earned += p_weight

                # Proficiency Match Evaluation
                req_prof_val = req.required_level_value or get_proficiency_value(req.required_level) or 2
                emp_prof_val = matched_emp_skill.proficiency_value or get_proficiency_value(matched_emp_skill.proficiency_level) or 2

                if emp_prof_val >= req_prof_val:
                    prof_satisfaction = 1.0
                else:
                    prof_satisfaction = max(0.25, emp_prof_val / req_prof_val)

                total_proficiency_earned += (prof_satisfaction * p_weight)

                # Skill Experience Evaluation
                req_exp_yrs = _extract_numeric_years(req.experience_required)
                emp_exp_yrs = matched_emp_skill.experience_years or candidate.total_experience_years or 0.0

                if req_exp_yrs <= 0 or emp_exp_yrs >= req_exp_yrs:
                    exp_satisfaction = 1.0
                else:
                    exp_satisfaction = max(0.3, emp_exp_yrs / req_exp_yrs)

                total_experience_earned += (exp_satisfaction * p_weight)

                # Categorize skill
                skill_info = {
                    "skill_name": req.original_name,
                    "normalized_name": req.normalized_name,
                    "priority": priority,
                    "required_level": req.required_level or "Intermediate",
                    "required_level_value": req_prof_val,
                    "employee_level": matched_emp_skill.proficiency_level or get_proficiency_label(emp_prof_val) or "Intermediate",
                    "employee_level_value": emp_prof_val,
                    "required_experience": req.experience_required or "N/A",
                    "employee_experience_years": emp_exp_yrs,
                    "proficiency_satisfaction_percent": round(prof_satisfaction * 100, 1),
                    "match_type": match_type
                }

                if prof_satisfaction >= 1.0 and exp_satisfaction >= 1.0:
                    matched_skills.append(skill_info)
                else:
                    partial_skills.append(skill_info)
            else:
                # Missing Skill
                missing_skills.append({
                    "skill_name": req.original_name,
                    "normalized_name": req.normalized_name,
                    "priority": priority,
                    "required_level": req.required_level or "Intermediate",
                    "required_level_value": req.required_level_value or 2,
                    "required_experience": req.experience_required or "N/A",
                    "match_type": "Missing"
                })

    # Dimension 1: Skill Coverage Score (0-100)
    skill_coverage_score = (
        round((total_coverage_earned / total_weighted_req_points) * 100, 1)
        if total_weighted_req_points > 0 else 100.0
    )

    # Dimension 2: Proficiency Match Score (0-100)
    proficiency_match_score = (
        round((total_proficiency_earned / total_weighted_req_points) * 100, 1)
        if total_weighted_req_points > 0 else 100.0
    )

    # Dimension 3: Experience Match Score (0-100)
    skill_experience_score = (
        round((total_experience_earned / total_weighted_req_points) * 100, 1)
        if total_weighted_req_points > 0 else 100.0
    )

    # Dimension 4: Role & Designation Relevance Score (0-100)
    role_relevance_score = 60.0
    emp_desig = (candidate.designation or "").lower()
    proj_roles = [r.lower() for r in (job_description.roles or [])]
    proj_title = (job_description.title or "").lower()

    if emp_desig:
        if any(r in emp_desig or emp_desig in r for r in proj_roles) or (proj_title and (emp_desig in proj_title or proj_title in emp_desig)):
            role_relevance_score = 100.0
        elif any(k in emp_desig for k in ["developer", "engineer", "architect", "lead", "analyst"]):
            role_relevance_score = 80.0

    # Dimension 5: Domain Relevance Score (0-100)
    domain_relevance_score = 70.0 # Neutral default if project domain is unspecified
    proj_domain = (job_description.domain or job_description.industry or "").strip().lower()

    if proj_domain and proj_domain != "general" and proj_domain != "other":
        emp_domains = [d.lower() for d in (candidate.domain_experience or [])]
        history_domains = [p.domain.lower() for p in (candidate.projects or []) if p.domain]

        if proj_domain in emp_domains or proj_domain in history_domains:
            domain_relevance_score = 100.0
        elif any(proj_domain in d or d in proj_domain for d in emp_domains + history_domains):
            domain_relevance_score = 85.0
        else:
            domain_relevance_score = 50.0

    # Dimension 6: Technology Stack Relevance Score (0-100)
    technology_relevance_score = 100.0
    proj_techs = [t.strip().lower() for t in (job_description.technologies or []) if t and t.strip()]

    if proj_techs:
        emp_tech_pool = set()
        for es in emp_skills:
            if es.normalized_skill_name: emp_tech_pool.add(es.normalized_skill_name.lower())
            if es.skill_name: emp_tech_pool.add(es.skill_name.lower())
        for p in (candidate.projects or []):
            for t in (p.technologies or []):
                emp_tech_pool.add(t.lower())

        tech_matches = sum(1 for pt in proj_techs if any(pt in et or et in pt for et in emp_tech_pool))
        technology_relevance_score = round((tech_matches / len(proj_techs)) * 100, 1)

    # ── Weighted Overall Match Score Calculation ──
    # Weights: Skill Coverage 35%, Proficiency 25%, Experience 15%, Role 10%, Domain 10%, Tech 5%
    overall_match_score = round(
        (0.35 * skill_coverage_score) +
        (0.25 * proficiency_match_score) +
        (0.15 * skill_experience_score) +
        (0.10 * role_relevance_score) +
        (0.10 * domain_relevance_score) +
        (0.05 * technology_relevance_score),
        1
    )

    # ── Deterministic Explanation Generation ──
    explanation_parts = []

    if matched_skills:
        names = ", ".join([s["skill_name"] for s in matched_skills[:4]])
        explanation_parts.append(f"Fully matched {len(matched_skills)} required skill(s) ({names}).")

    if partial_skills:
        for ps in partial_skills[:3]:
            explanation_parts.append(
                f"Partial match for '{ps['skill_name']}': Employee level is {ps['employee_level']} (Required: {ps['required_level']})."
            )

    if missing_skills:
        crit_missing = [ms["skill_name"] for ms in missing_skills if ms["priority"] == "Critical"]
        if crit_missing:
            explanation_parts.append(f"Missing Critical skill(s): {', '.join(crit_missing)}.")
        else:
            other_missing = [ms["skill_name"] for ms in missing_skills[:3]]
            explanation_parts.append(f"Missing skill(s): {', '.join(other_missing)}.")

    if domain_relevance_score >= 85.0 and proj_domain:
        explanation_parts.append(f"Strong domain alignment in {job_description.domain}.")

    explanation_str = " ".join(explanation_parts) if explanation_parts else "Evaluated skills and experience alignment."

    return {
        "id": candidate.id,
        "employee_id": candidate.employee_id or f"EMP{candidate.id:03d}",
        "name": candidate.name,
        "department": candidate.department or "Unassigned",
        "designation": candidate.designation or "Employee",
        "total_experience_years": candidate.total_experience_years or 0.0,
        "availability_status": "Available",
        
        # Core Match Scores
        "overall_match_score": overall_match_score,
        "skill_coverage": skill_coverage_score,
        "proficiency_match": proficiency_match_score,
        "experience_match": skill_experience_score,
        "role_relevance": role_relevance_score,
        "domain_relevance": domain_relevance_score,
        "technology_relevance": technology_relevance_score,

        # Skill Categorization Arrays
        "matched_skills": matched_skills,
        "partial_skills": partial_skills,
        "missing_skills": missing_skills,
        "matched_skills_count": len(matched_skills),
        "partial_skills_count": len(partial_skills),
        "missing_skills_count": len(missing_skills),

        # Deterministic Explanation String
        "explanation": explanation_str
    }


def match_available_employees_for_project(
    db: Session,
    project_id: int,
    page: int = 1,
    page_size: int = 25,
    department: Optional[str] = None,
    designation: Optional[str] = None,
    min_score: Optional[float] = None,
    search: Optional[str] = None
) -> Dict[str, Any]:
    """
    Step 3 in TalentIQ Workflow:
    1. Retrieves confirmed Project Requirement by project_id.
    2. Invokes Availability Engine to get AVAILABLE employees ONLY.
    3. Runs hybrid skill matching engine on available employees.
    4. Applies filters, sorts by overall match score, and returns paginated match DTOs.
    """
    jd = db.query(JobDescription).filter(JobDescription.id == project_id).first()
    if not jd:
        return {
            "error": True,
            "message": f"Project Requirement with ID {project_id} not found."
        }

    if not jd.start_date or not jd.end_date:
        return {
            "error": True,
            "message": f"Project Requirement '{jd.title or jd.project_name}' is missing start/end dates. Dates are required for availability filtering."
        }

    # ── STEP 1: Invoke Availability Engine (Get Available Employees ONLY) ──
    avail_res = evaluate_workforce_availability(
        db=db,
        project_start_str=jd.start_date,
        project_end_str=jd.end_date,
        project_id=jd.id,
        project_name=jd.project_name or jd.title,
        page=1,
        page_size=10000 # Evaluate full workforce for filtering
    )

    if avail_res.get("error"):
        return avail_res

    # Extract ONLY available candidate IDs
    available_items = [item for item in avail_res.get("items", []) if item.get("availability_status") == "Available"]
    available_cand_ids = [item["id"] for item in available_items]

    if not available_cand_ids:
        return {
            "error": False,
            "project_id": jd.id,
            "project_name": jd.project_name or jd.title,
            "total_available_workforce": 0,
            "matched_count": 0,
            "high_potential_count": 0,
            "average_match_score": 0.0,
            "items": [],
            "page": page,
            "page_size": page_size,
            "total_pages": 1,
            "message": "No available employees found for the requested project period."
        }

    # Fetch available candidate objects
    available_candidates = db.query(Candidate).filter(Candidate.id.in_(available_cand_ids)).all()

    # ── STEP 2: Execute Hybrid Skill Matching Engine ──
    match_results: List[Dict[str, Any]] = []

    for cand in available_candidates:
        match_dto = calculate_employee_project_match(cand, jd, db)

        # Apply Filters
        if min_score is not None and match_dto["overall_match_score"] < min_score:
            continue

        if department and department.strip():
            if (cand.department or "").strip().lower() != department.strip().lower():
                continue

        if designation and designation.strip():
            if (cand.designation or "").strip().lower() != designation.strip().lower():
                continue

        if search and search.strip():
            s = search.strip().lower()
            emp_id = match_dto["employee_id"].lower()
            name = cand.name.lower()
            matched_names = " ".join([sm["skill_name"].lower() for sm in match_dto["matched_skills"]])
            if s not in emp_id and s not in name and s not in matched_names:
                continue

        match_results.append(match_dto)

    # Sort by Overall Match Score descending
    match_results.sort(key=lambda x: x["overall_match_score"], reverse=True)

    total_matched = len(match_results)
    high_potential = len([m for m in match_results if m["overall_match_score"] >= 80.0])
    avg_score = round(sum(m["overall_match_score"] for m in match_results) / total_matched, 1) if total_matched > 0 else 0.0

    # Paginate
    offset = (page - 1) * page_size
    paginated_items = match_results[offset : offset + page_size]

    return {
        "error": False,
        "project_id": jd.id,
        "project_name": jd.project_name or jd.title,
        "project_start_date": jd.start_date,
        "project_end_date": jd.end_date,
        "required_team_size": jd.required_team_size or 1,
        "domain": jd.domain or "General",
        "total_available_workforce": len(available_cand_ids),
        "total_matched_evaluated": total_matched,
        "high_potential_count": high_potential,
        "average_match_score": avg_score,
        "items": paginated_items,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_matched + page_size - 1) // page_size if page_size > 0 else 1
    }
