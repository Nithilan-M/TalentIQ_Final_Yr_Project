"""
Skill Taxonomy & Proficiency Service
Provides canonical skill lookups, alias resolution, category management,
and numeric proficiency level mapping (Beginner=1, Intermediate=2, Advanced=3, Expert=4).
"""

from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from backend.database.models import Skill, EmployeeSkill, ProjectSkillRequirement
from backend.parsers.skill_normalizer import normalize_skill_name

# Fixed Numeric Proficiency Scale
PROFICIENCY_MAP: Dict[str, int] = {
    "beginner": 1,
    "intermediate": 2,
    "advanced": 3,
    "expert": 4
}

PROFICIENCY_LABELS: Dict[int, str] = {
    1: "Beginner",
    2: "Intermediate",
    3: "Advanced",
    4: "Expert"
}

PROFICIENCY_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    "Beginner": {
        "level_value": 1,
        "name": "Beginner",
        "description": "Basic familiarity and ability to perform simple tasks with guidance."
    },
    "Intermediate": {
        "level_value": 2,
        "name": "Intermediate",
        "description": "Ability to independently perform routine tasks and solve common problems."
    },
    "Advanced": {
        "level_value": 3,
        "name": "Advanced",
        "description": "Ability to independently handle complex tasks and apply skills in real-world projects."
    },
    "Expert": {
        "level_value": 4,
        "name": "Expert",
        "description": "Deep technical authority, architecture design, mentorship, and decision-making."
    }
}

STANDARD_CATEGORIES: List[str] = [
    "Programming Languages",
    "Frontend",
    "Backend",
    "Database",
    "Cloud",
    "DevOps",
    "Machine Learning",
    "Artificial Intelligence",
    "Data Engineering",
    "Data Science",
    "Mobile Development",
    "Testing",
    "Security",
    "Networking",
    "Tools",
    "Frameworks",
    "Soft Skills",
    "Domain Skills"
]


def get_proficiency_value(level_str: Optional[str]) -> Optional[int]:
    """Map proficiency string label to fixed numeric integer value (1-4)."""
    if not level_str or not isinstance(level_str, str):
        return None
    key = level_str.strip().lower()
    return PROFICIENCY_MAP.get(key, None)


def get_proficiency_label(level_val: Optional[int]) -> Optional[str]:
    """Map numeric proficiency value (1-4) back to standard string label."""
    if level_val is None:
        return None
    return PROFICIENCY_LABELS.get(level_val, None)


def lookup_or_normalize_skill(db: Session, raw_name: str) -> Dict[str, Any]:
    """
    Look up a raw skill string in the canonical Skill Taxonomy table (by name, normalized_name, or aliases).
    Returns dict containing:
    {
      "skill_id": int | None,
      "skill_name": str,
      "normalized_skill_name": str,
      "category": str | None,
      "is_taxonomy_matched": bool
    }
    """
    if not raw_name or not isinstance(raw_name, str) or not raw_name.strip():
        return {
            "skill_id": None,
            "skill_name": "",
            "normalized_skill_name": "",
            "category": None,
            "is_taxonomy_matched": False
        }

    cleaned = raw_name.strip()
    norm_alias = normalize_skill_name(cleaned)

    # 1. Search DB taxonomy by normalized_name
    skill_db = db.query(Skill).filter(
        Skill.normalized_name == norm_alias,
        Skill.status == "Active"
    ).first()

    if skill_db:
        return {
            "skill_id": skill_db.id,
            "skill_name": skill_db.name,
            "normalized_skill_name": skill_db.normalized_name,
            "category": skill_db.category,
            "is_taxonomy_matched": True
        }

    # 2. Search DB taxonomy by canonical name
    skill_db = db.query(Skill).filter(
        Skill.name.ilike(cleaned),
        Skill.status == "Active"
    ).first()

    if skill_db:
        return {
            "skill_id": skill_db.id,
            "skill_name": skill_db.name,
            "normalized_skill_name": skill_db.normalized_name,
            "category": skill_db.category,
            "is_taxonomy_matched": True
        }

    # 3. Search DB taxonomy by aliases array
    all_skills = db.query(Skill).filter(Skill.status == "Active").all()
    cleaned_lower = cleaned.lower()
    for sk in all_skills:
        aliases_list = [a.lower() for a in (sk.aliases or [])]
        if cleaned_lower in aliases_list or norm_alias.lower() in aliases_list:
            return {
                "skill_id": sk.id,
                "skill_name": sk.name,
                "normalized_skill_name": sk.normalized_name,
                "category": sk.category,
                "is_taxonomy_matched": True
            }

    # Fallback to local skill_normalizer dictionary
    return {
        "skill_id": None,
        "skill_name": cleaned,
        "normalized_skill_name": norm_alias,
        "category": None,
        "is_taxonomy_matched": False
    }


def format_skill_dto(skill: Skill, db: Optional[Session] = None) -> Dict[str, Any]:
    """Format a Skill database record into a clean taxonomy DTO with usage metrics."""
    emp_usage = 0
    proj_usage = 0

    if db and skill.id:
        emp_usage = db.query(EmployeeSkill).filter(EmployeeSkill.skill_id == skill.id).count()
        proj_usage = db.query(ProjectSkillRequirement).filter(ProjectSkillRequirement.skill_id == skill.id).count()

    return {
        "id": skill.id,
        "name": skill.name,
        "normalized_name": skill.normalized_name,
        "category": skill.category or "Other",
        "description": skill.description or "",
        "aliases": skill.aliases or [],
        "status": skill.status or "Active",
        "employee_usage_count": emp_usage,
        "project_usage_count": proj_usage,
        "total_usage_count": emp_usage + proj_usage,
        "created_at": str(skill.created_at) if skill.created_at else None,
        "updated_at": str(skill.updated_at) if skill.updated_at else None,
    }
