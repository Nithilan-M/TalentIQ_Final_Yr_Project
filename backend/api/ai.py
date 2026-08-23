"""
FastAPI Router for TalentIQ Central AI Services
Provides health check and structured AI extraction/explanation gateways.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from backend.database.connection import get_db
from backend.api.auth import get_current_user
from backend.database.models import User
from backend.ai.ai_service import ai_service

router = APIRouter(prefix="/api/ai", tags=["Central AI Service (Ollama + Ornith 9b)"])


@router.get("/health")
async def get_ai_health():
    """
    Health check endpoint for local AI service:
    Verifies Ollama server reachability and presence of configured model (ornith:9b).
    """
    health_status = await ai_service.health_check_async()
    return health_status


@router.post("/project-extraction")
async def extract_project_requirements_api(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Extracts structured project requirements from raw text via Ollama + Ornith 9b.
    Automatically normalizes extracted skills against Centralized Skill Taxonomy.
    """
    text = payload.get("text") or payload.get("document_text") or ""
    if not text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document text is required for project requirement extraction."
        )

    result = await ai_service.extract_project_requirements(text, db=db)
    return {
        "status": "success",
        "data": result
    }


@router.post("/employee-extraction")
async def extract_employee_profile_api(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Extracts structured employee profile from resume/profile text via Ollama + Ornith 9b.
    Normalizes extracted skills against Centralized Skill Taxonomy.
    """
    text = payload.get("text") or payload.get("resume_text") or ""
    if not text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume text is required for employee profile extraction."
        )

    result = await ai_service.extract_employee_profile(text, db=db)
    return {
        "status": "success",
        "data": result
    }


@router.post("/match-explanation")
async def explain_match_api(
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user)
):
    """
    Generates AI natural-language narrative for an ALREADY-CALCULATED match result.
    Does NOT calculate or alter match scores.
    """
    result = await ai_service.explain_match(payload)
    return {
        "status": "success",
        "data": result
    }


@router.post("/skill-gap")
async def analyze_skill_gap_api(
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user)
):
    """
    Explains structured skill gap data using local Ornith 9b model.
    """
    result = await ai_service.analyze_skill_gap(payload)
    return {
        "status": "success",
        "data": result
    }


@router.post("/upskilling-recommendation")
async def generate_upskilling_recommendation_api(
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user)
):
    """
    Generates structured learning paths and practical exercises for identified skill gaps.
    """
    result = await ai_service.generate_upskilling_recommendation(payload)
    return {
        "status": "success",
        "data": result
    }
