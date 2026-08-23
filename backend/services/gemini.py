"""
Backward Compatibility AI Wrapper Module
Redirects legacy Gemini API calls transparently to Central AIService (Ollama + Ornith 9b).
No external GEMINI_API_KEY or Google API connection required.
"""

import os
import json
import logging
from backend.ai.ai_service import ai_service

logger = logging.getLogger("talentiq.ai_compatibility")

async def call_gemini_async(prompt: str, json_mode: bool = False, temperature: float = 0.2) -> str:
    """
    Backward-compatible async AI generation call.
    Routes directly to local Ollama + Ornith 9b via Central AIService.
    """
    try:
        return await ai_service.generate_text(
            prompt=prompt,
            system_prompt="You are an AI processing engine for TalentIQ.",
            json_mode=json_mode,
            temperature=temperature
        )
    except Exception as e:
        logger.error(f"Ollama AI async call failed: {e}")
        raise e


def call_gemini_sync(prompt: str, json_mode: bool = False, temperature: float = 0.2) -> str:
    """
    Backward-compatible sync AI generation call.
    Routes directly to local Ollama + Ornith 9b via Central AIService.
    """
    try:
        return ai_service.generate_text_sync(
            prompt=prompt,
            system_prompt="You are an AI processing engine for TalentIQ.",
            json_mode=json_mode,
            temperature=temperature
        )
    except Exception as e:
        logger.error(f"Ollama AI sync call failed: {e}")
        raise e
