from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database.connection import get_db
from backend.database.models import Skill, EmployeeSkill, ProjectSkillRequirement, User
from backend.api.auth import get_current_user
from backend.parsers.skill_normalizer import normalize_skill_name

from backend.services.skill_service import (
    PROFICIENCY_DEFINITIONS,
    STANDARD_CATEGORIES,
    get_proficiency_value,
    get_proficiency_label,
    lookup_or_normalize_skill,
    format_skill_dto
)

router = APIRouter(prefix="/api/skills", tags=["Skill Taxonomy"])


# ── Request Schemas ───────────────────────────────────────────────────────

class SkillCreateRequest(BaseModel):
    name: str
    normalized_name: Optional[str] = None
    category: Optional[str] = "Programming Languages"
    description: Optional[str] = None
    aliases: List[str] = []
    status: Optional[str] = "Active"

class SkillUpdateRequest(BaseModel):
    name: str
    normalized_name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    aliases: List[str] = []
    status: Optional[str] = "Active"


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.get("")
def list_skills(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = None,
    category: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get paginated Skill Taxonomy repository with search (by Name, Normalized Name, Aliases)
    and filters (Category, Status). Includes employee and project usage metrics.
    """
    query = db.query(Skill)

    if status_filter and status_filter.strip():
        query = query.filter(Skill.status == status_filter.strip())

    if category and category.strip():
        query = query.filter(Skill.category == category.strip())

    if search and search.strip():
        s = f"%{search.strip()}%"
        query = query.filter(
            (Skill.name.ilike(s)) |
            (Skill.normalized_name.ilike(s)) |
            (Skill.category.ilike(s))
        )

    total_count = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(Skill.name.asc()).offset(offset).limit(page_size).all()

    return {
        "items": [format_skill_dto(sk, db) for sk in items],
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size if page_size > 0 else 1
    }


@router.get("/search")
def search_skills_autocomplete(
    q: str = Query("", min_length=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fast search endpoint for UI auto-complete dropdowns.
    Returns taxonomy matches mapped to canonical skills.
    """
    if not q or not q.strip():
        # Return top 20 popular active skills
        skills = db.query(Skill).filter(Skill.status == "Active").limit(20).all()
        return [format_skill_dto(sk, db) for sk in skills]

    cleaned = q.strip()
    s = f"%{cleaned}%"
    norm = normalize_skill_name(cleaned)

    # Search DB
    skills = db.query(Skill).filter(
        Skill.status == "Active",
        (Skill.name.ilike(s)) |
        (Skill.normalized_name.ilike(f"%{norm}%")) |
        (Skill.category.ilike(s))
    ).limit(15).all()

    results = [format_skill_dto(sk, db) for sk in skills]

    # If no DB taxonomy record found, perform online normalization preview
    if not results:
        res = lookup_or_normalize_skill(db, cleaned)
        results.append({
            "id": None,
            "name": res["skill_name"],
            "normalized_name": res["normalized_skill_name"],
            "category": "Unmapped",
            "description": "Custom skill (Not yet in standard taxonomy)",
            "aliases": [cleaned],
            "status": "Active",
            "employee_usage_count": 0,
            "project_usage_count": 0,
            "total_usage_count": 0,
            "is_taxonomy_matched": False
        })

    return results


@router.get("/categories")
def get_skill_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of standard skill categories and active DB categories."""
    db_categories = db.query(Skill.category).filter(
        Skill.category.isnot(None),
        Skill.status == "Active"
    ).distinct().all()

    existing = {c[0] for c in db_categories if c[0]}
    combined = sorted(list(set(STANDARD_CATEGORIES).union(existing)))

    return {
        "categories": combined
    }


@router.get("/proficiency-levels")
def get_proficiency_levels():
    """Get standard proficiency levels with numeric scale (1-4) and definitions."""
    return {
        "levels": [
            PROFICIENCY_DEFINITIONS["Beginner"],
            PROFICIENCY_DEFINITIONS["Intermediate"],
            PROFICIENCY_DEFINITIONS["Advanced"],
            PROFICIENCY_DEFINITIONS["Expert"],
        ]
    }


@router.get("/{id}")
def get_skill_details(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed Skill Taxonomy record by ID."""
    skill = db.query(Skill).filter(Skill.id == id).first()
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill with ID {id} not found."
        )
    return format_skill_dto(skill, db)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_skill(
    req: SkillCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a new canonical skill to the Skill Taxonomy."""
    name = req.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Skill name is required."
        )

    norm_name = req.normalized_name.strip() if req.normalized_name else normalize_skill_name(name)

    # Prevent duplicate canonical skills
    existing = db.query(Skill).filter(
        (Skill.normalized_name.ilike(norm_name)) | (Skill.name.ilike(name))
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Skill '{name}' (Normalized: '{norm_name}') already exists in taxonomy."
        )

    # Clean aliases
    aliases_list = [a.strip() for a in req.aliases if a and a.strip()]
    if name not in aliases_list:
        aliases_list.append(name)
    if norm_name not in aliases_list:
        aliases_list.append(norm_name)

    try:
        db_skill = Skill(
            name=name,
            normalized_name=norm_name,
            category=req.category.strip() if req.category else "Other",
            description=req.description.strip() if req.description else None,
            aliases=aliases_list,
            status=req.status or "Active"
        )
        db.add(db_skill)
        db.commit()
        db.refresh(db_skill)

        return {
            "message": "Skill added to taxonomy successfully.",
            "data": format_skill_dto(db_skill, db)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create skill record: {str(e)}"
        )


@router.put("/{id}")
def update_skill(
    id: int,
    req: SkillUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update canonical skill details, aliases, category, or status."""
    db_skill = db.query(Skill).filter(Skill.id == id).first()
    if not db_skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill with ID {id} not found."
        )

    name = req.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Skill name is required."
        )

    norm_name = req.normalized_name.strip() if req.normalized_name else normalize_skill_name(name)

    # Check for name conflict on other records
    existing = db.query(Skill).filter(
        Skill.id != id,
        ((Skill.normalized_name.ilike(norm_name)) | (Skill.name.ilike(name)))
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Another skill '{existing.name}' already uses normalized name '{norm_name}'."
        )

    aliases_list = [a.strip() for a in req.aliases if a and a.strip()]
    if name not in aliases_list:
        aliases_list.append(name)
    if norm_name not in aliases_list:
        aliases_list.append(norm_name)

    try:
        db_skill.name = name
        db_skill.normalized_name = norm_name
        db_skill.category = req.category.strip() if req.category else db_skill.category
        db_skill.description = req.description.strip() if req.description else None
        db_skill.aliases = aliases_list
        db_skill.status = req.status or "Active"

        db.commit()
        db.refresh(db_skill)

        return {
            "message": "Skill record updated successfully.",
            "data": format_skill_dto(db_skill, db)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update skill record: {str(e)}"
        )


@router.delete("/{id}")
def deactivate_skill(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soft-deactivate a Skill Taxonomy record (status = 'Inactive')."""
    db_skill = db.query(Skill).filter(Skill.id == id).first()
    if not db_skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Skill with ID {id} not found."
        )

    db_skill.status = "Inactive"
    db.commit()

    return {
        "message": f"Skill '{db_skill.name}' deactivated successfully.",
        "id": id,
        "status": "Inactive"
    }
