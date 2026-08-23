"""
Central AIService Facade for TalentIQ
Provider-independent interface connecting backend feature logic to local Ollama + Ornith 9b runtime.
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from backend.ai.ollama_client import ollama_client_instance
from backend.ai.ornith_service import OrnithService, load_prompt_template, _clean_json_response

logger = logging.getLogger("talentiq.ai_service")

class AIService:
    @staticmethod
    def health_check_sync() -> Dict[str, Any]:
        """Synchronous health check for Ollama + Ornith 9b."""
        return ollama_client_instance.check_health_sync()

    @staticmethod
    async def health_check_async() -> Dict[str, Any]:
        """Asynchronous health check for Ollama + Ornith 9b."""
        return await ollama_client_instance.check_health_async()

    @staticmethod
    async def generate_text(
        prompt: str,
        system_prompt: str = "You are an AI assistant in TalentIQ.",
        json_mode: bool = False,
        temperature: float = 0.2
    ) -> str:
        """Central text/JSON generation call."""
        return await ollama_client_instance.chat_async(
            system_prompt=system_prompt,
            user_prompt=prompt,
            json_mode=json_mode,
            temperature=temperature
        )

    @staticmethod
    def generate_text_sync(
        prompt: str,
        system_prompt: str = "You are an AI assistant in TalentIQ.",
        json_mode: bool = False,
        temperature: float = 0.2
    ) -> str:
        """Synchronous central text generation call."""
        return ollama_client_instance.chat_sync(
            system_prompt=system_prompt,
            user_prompt=prompt,
            json_mode=json_mode,
            temperature=temperature
        )

    @staticmethod
    async def extract_project_requirements(document_text: str, db: Optional[Session] = None) -> Dict[str, Any]:
        """Extract structured project requirements using Ollama + Ornith 9b."""
        return await OrnithService.extract_project_requirements_async(document_text, db=db)

    @staticmethod
    async def extract_employee_profile(resume_text: str, db: Optional[Session] = None) -> Dict[str, Any]:
        """Extract structured employee profile/resume using Ollama + Ornith 9b."""
        return await OrnithService.extract_employee_profile_async(resume_text, db=db)

    @staticmethod
    async def explain_match(match_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate human-readable match explanation narrative."""
        return await OrnithService.explain_match_async(match_data)

    @staticmethod
    async def analyze_skill_gap(gap_data: Dict[str, Any]) -> Dict[str, Any]:
        """Explain structured skill gap calculation."""
        system_prompt = load_prompt_template("skill_gap_analysis.txt")
        user_prompt = f"SKILL GAP DATA:\n{json.dumps(gap_data, indent=2)}"
        raw_res = await ollama_client_instance.chat_async(system_prompt, user_prompt, json_mode=True)
        try:
            return json.loads(_clean_json_response(raw_res))
        except Exception:
            return {"gap_summary": "Evaluated skill gaps against project requirements.", "skill_gaps": []}

    @staticmethod
    async def generate_upskilling_recommendation(skill_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate structured upskilling learning path."""
        system_prompt = load_prompt_template("upskilling_recommendation.txt")
        user_prompt = f"TARGET SKILLS & GAPS:\n{json.dumps(skill_data, indent=2)}"
        raw_res = await ollama_client_instance.chat_async(system_prompt, user_prompt, json_mode=True)
        try:
            return json.loads(_clean_json_response(raw_res))
        except Exception:
            return {"recommendations": []}

ai_service = AIService()
