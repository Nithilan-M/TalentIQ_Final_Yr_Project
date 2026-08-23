"""
Explainable Matching Module Service
Provides transparent, auditable, human-readable explanations for already-calculated
Employee-Project Skill Match results.

STRICT RULES:
1. Consumes single source of truth from calculate_employee_project_match(...).
2. Does NOT recalculate scores or alter match scores.
3. Provides 6-dimension score trace (35% Coverage, 25% Proficiency, 15% Skill Exp, 10% Role, 10% Domain, 5% Tech).
4. Categorizes skills into MATCHED, PARTIAL, MISSING, RELATED, NOT_EVALUATED.
5. Generates Positive Factors (✓), Negative Factors (⚠/✗), and deterministic synthesis.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from backend.database.models import JobDescription, Candidate, EmployeeSkill, ProjectSkillRequirement
from backend.services.matching_service import calculate_employee_project_match
from backend.services.availability_service import evaluate_employee_availability, parse_iso_date


def generate_match_explanation_for_employee(
    db: Session,
    project_id: int,
    employee_id: int
) -> Dict[str, Any]:
    """
    Generates structured, transparent explainable matching payload for an employee against a project requirement.
    Consumes single source of truth from calculate_employee_project_match.
    """
    jd = db.query(JobDescription).filter(JobDescription.id == project_id).first()
    if not jd:
        return {
            "error": True,
            "message": f"Project Requirement with ID {project_id} not found."
        }

    cand = db.query(Candidate).filter(Candidate.id == employee_id).first()
    if not cand:
        return {
            "error": True,
            "message": f"Employee with ID {employee_id} not found."
        }

    # ── 1. Check Availability Status ──
    p_start = parse_iso_date(jd.start_date) or parse_iso_date("2026-09-01")
    p_end = parse_iso_date(jd.end_date) or parse_iso_date("2026-11-30")
    avail_dto = evaluate_employee_availability(cand, p_start, p_end)

    if avail_dto.get("availability_status") == "Unavailable" or cand.status == "Inactive":
        return {
            "error": False,
            "project_id": jd.id,
            "project_name": jd.project_name or jd.title,
            "employee_id": cand.employee_id or f"EMP{cand.id:03d}",
            "employee_name": cand.name,
            "availability_status": "Unavailable",
            "overall_match_score": 0.0,
            "match_category": "Excluded",
            "explanation": f"Employee {cand.name} ({cand.employee_id}) was excluded from project matching because they are unavailable or inactive during the requested project period ({jd.start_date or '01 Sep'} to {jd.end_date or '30 Nov'}). Reason: {avail_dto.get('reason')}",
            "positive_factors": [],
            "negative_factors": [f"Employee is unavailable/conflict: {avail_dto.get('reason')}"],
            "score_trace": {},
            "skill_analysis": []
        }

    # ── 2. Check Project Requirements ──
    project_reqs = db.query(ProjectSkillRequirement).filter(
        ProjectSkillRequirement.job_description_id == jd.id
    ).all()

    if not project_reqs and not jd.skills_required:
        return {
            "error": False,
            "project_id": jd.id,
            "project_name": jd.project_name or jd.title,
            "employee_id": cand.employee_id or f"EMP{cand.id:03d}",
            "employee_name": cand.name,
            "availability_status": "Available",
            "overall_match_score": 0.0,
            "match_category": "Insufficient Requirements",
            "explanation": "Match explanation cannot be generated because the project requirement does not contain sufficient structured skill requirements.",
            "positive_factors": [],
            "negative_factors": ["Project requirement lacks extracted skill criteria."],
            "score_trace": {},
            "skill_analysis": []
        }

    # ── 3. Consume Single Source of Truth from Matching Engine ──
    match_dto = calculate_employee_project_match(cand, jd, db)
    overall_score = match_dto["overall_match_score"]

    # Match Category Thresholds
    if overall_score >= 85.0:
        match_category = "Strong Match"
    elif overall_score >= 65.0:
        match_category = "Moderate Match"
    else:
        match_category = "Weak Match"

    # ── 4. Score Trace Breakdown (6 Weighted Dimensions) ──
    score_trace = {
        "skill_coverage": {
            "raw_score": match_dto["skill_coverage"],
            "weight": 0.35,
            "weighted_contribution": round(match_dto["skill_coverage"] * 0.35, 2),
            "description": "Skill Coverage (35% Weight)"
        },
        "proficiency_match": {
            "raw_score": match_dto["proficiency_match"],
            "weight": 0.25,
            "weighted_contribution": round(match_dto["proficiency_match"] * 0.25, 2),
            "description": "Proficiency Level Match (25% Weight)"
        },
        "experience_match": {
            "raw_score": match_dto["experience_match"],
            "weight": 0.15,
            "weighted_contribution": round(match_dto["experience_match"] * 0.15, 2),
            "description": "Skill Experience Match (15% Weight)"
        },
        "role_relevance": {
            "raw_score": match_dto["role_relevance"],
            "weight": 0.10,
            "weighted_contribution": round(match_dto["role_relevance"] * 0.10, 2),
            "description": "Role & Designation Relevance (10% Weight)"
        },
        "domain_relevance": {
            "raw_score": match_dto["domain_relevance"],
            "weight": 0.10,
            "weighted_contribution": round(match_dto["domain_relevance"] * 0.10, 2),
            "description": "Domain Experience Alignment (10% Weight)"
        },
        "technology_relevance": {
            "raw_score": match_dto["technology_relevance"],
            "weight": 0.05,
            "weighted_contribution": round(match_dto["technology_relevance"] * 0.05, 2),
            "description": "Technology Stack Alignment (5% Weight)"
        }
    }

    # ── 5. Detailed Skill-by-Skill Analysis ──
    skill_analysis: List[Dict[str, Any]] = []

    # Map candidate skills for evidence source lookup
    emp_skills_list = db.query(EmployeeSkill).filter(EmployeeSkill.candidate_id == cand.id).all()
    emp_source_map = {}
    for es in emp_skills_list:
        name_key = (es.normalized_skill_name or es.skill_name or "").lower()
        emp_source_map[name_key] = es.source or "System Import"

    # Matched Skills
    for s in match_dto.get("matched_skills", []):
        name_key = (s.get("normalized_name") or s.get("skill_name") or "").lower()
        source = emp_source_map.get(name_key, "Resume")
        is_semantic = "Semantic" in s.get("match_type", "")

        status_label = "RELATED" if is_semantic else "MATCHED"

        skill_analysis.append({
            "skill_name": s["skill_name"],
            "priority": s["priority"],
            "required_level": s["required_level"],
            "employee_level": s["employee_level"],
            "required_experience": s["required_experience"],
            "employee_experience_years": s["employee_experience_years"],
            "match_status": status_label,
            "match_type": s["match_type"],
            "evidence_source": source,
            "explanation": f"Employee proficiency ({s['employee_level']}) meets or exceeds the required {s['required_level']} level. Evidence source: {source}."
        })

    # Partial Skills
    for s in match_dto.get("partial_skills", []):
        name_key = (s.get("normalized_name") or s.get("skill_name") or "").lower()
        source = emp_source_map.get(name_key, "Resume")

        skill_analysis.append({
            "skill_name": s["skill_name"],
            "priority": s["priority"],
            "required_level": s["required_level"],
            "employee_level": s["employee_level"],
            "required_experience": s["required_experience"],
            "employee_experience_years": s["employee_experience_years"],
            "match_status": "PARTIAL",
            "match_type": s["match_type"],
            "evidence_source": source,
            "explanation": f"Employee has {s['employee_level']} proficiency, which is below the required {s['required_level']} level. Evidence source: {source}."
        })

    # Missing Skills
    for s in match_dto.get("missing_skills", []):
        skill_analysis.append({
            "skill_name": s["skill_name"],
            "priority": s["priority"],
            "required_level": s["required_level"],
            "employee_level": "Not Specified",
            "required_experience": s["required_experience"],
            "employee_experience_years": 0.0,
            "match_status": "MISSING",
            "match_type": "Missing",
            "evidence_source": "None",
            "explanation": f"Required skill '{s['skill_name']}' ({s['priority']}) was not found in the employee profile."
        })

    # ── 6. Positive & Negative Factors Extraction ──
    positive_factors: List[str] = []
    negative_factors: List[str] = []

    matched_count = len(match_dto.get("matched_skills", []))
    partial_count = len(match_dto.get("partial_skills", []))
    missing_count = len(match_dto.get("missing_skills", []))

    if matched_count > 0:
        crit_matched = [s["skill_name"] for s in match_dto.get("matched_skills", []) if s["priority"] == "Critical"]
        if crit_matched:
            positive_factors.append(f"Satisfies {len(crit_matched)} Critical technical requirement(s): {', '.join(crit_matched)}.")
        positive_factors.append(f"Fully matched {matched_count} project requirement skill(s).")

    if match_dto["domain_relevance"] >= 85.0:
        positive_factors.append(f"Strong domain alignment with project industry/domain ({jd.domain or 'General'}).")
    elif match_dto["domain_relevance"] < 60.0 and jd.domain:
        negative_factors.append(f"Limited domain experience in project domain ({jd.domain}).")

    if match_dto["role_relevance"] >= 80.0:
        positive_factors.append(f"Designation '{cand.designation}' aligns well with requested project role.")

    if match_dto["technology_relevance"] >= 80.0:
        positive_factors.append(f"Strong technology stack alignment ({match_dto['technology_relevance']}%).")
    elif match_dto["technology_relevance"] < 50.0 and jd.technologies:
        negative_factors.append(f"Technology stack coverage is low ({match_dto['technology_relevance']}%).")

    if partial_count > 0:
        for ps in match_dto.get("partial_skills", [])[:3]:
            negative_factors.append(f"Proficiency for '{ps['skill_name']}' is {ps['employee_level']} (Required: {ps['required_level']}).")

    if missing_count > 0:
        crit_missing = [s["skill_name"] for s in match_dto.get("missing_skills", []) if s["priority"] == "Critical"]
        if crit_missing:
            negative_factors.append(f"Missing {len(crit_missing)} Critical requirement(s): {', '.join(crit_missing)}.")
        else:
            other_missing = [s["skill_name"] for s in match_dto.get("missing_skills", [])[:3]]
            negative_factors.append(f"Missing required skill(s): {', '.join(other_missing)}.")

    # ── 7. Human-Readable Synthesis ──
    synthesis_parts = []
    synthesis_parts.append(f"{cand.name} ({cand.employee_id}) achieved an overall match score of {overall_score}% ({match_category}).")

    if positive_factors:
        synthesis_parts.append("Key Strengths: " + " ".join(positive_factors[:3]))

    if negative_factors:
        synthesis_parts.append("Areas of Concern: " + " ".join(negative_factors[:3]))

    final_synthesis = " ".join(synthesis_parts)

    return {
        "error": False,
        "project_id": jd.id,
        "project_name": jd.project_name or jd.title,
        "project_domain": jd.domain or "General",
        "required_team_size": jd.required_team_size or 1,
        "employee_id": cand.employee_id or f"EMP{cand.id:03d}",
        "employee_name": cand.name,
        "designation": cand.designation,
        "department": cand.department,
        "availability_status": "Available",
        "overall_match_score": overall_score,
        "match_category": match_category,
        "explanation": final_synthesis,
        "positive_factors": positive_factors,
        "negative_factors": negative_factors,
        "score_trace": score_trace,
        "skill_analysis": skill_analysis,
        "engine_version": "BGE-Small FAISS Match Engine v1.0",
        "generated_at": datetime.utcnow().isoformat()
    }
