"""
Ornith Task Service
Manages prompt loading, Pydantic schema validation, and Skill Taxonomy integration
for Ollama + Ornith 9b executions.
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from backend.ai.ollama_client import ollama_client_instance
from backend.ai.schemas.project_requirement import ProjectRequirementExtracted
from backend.ai.schemas.employee_profile import ExtractedEmployeeProfile
from backend.ai.schemas.match_explanation import AIMatchExplanationSchema
from backend.ai.schemas.skill_gap import AISkillGapSchema
from backend.ai.schemas.recommendation import AIUpskillingRecommendationSchema
from backend.services.skill_service import lookup_or_normalize_skill

logger = logging.getLogger("talentiq.ornith_service")

PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "prompts")

def load_prompt_template(filename: str) -> str:
    filepath = os.path.join(PROMPTS_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()
    return ""


def _clean_json_response(raw_text: str) -> str:
    """Clean markdown code block wrappers if present."""
    text = raw_text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


class OrnithService:
    @staticmethod
    async def extract_project_requirements_async(document_text: str, db: Optional[Session] = None) -> Dict[str, Any]:
        system_prompt = load_prompt_template("project_extraction.txt")
        user_prompt = f"DOCUMENT TEXT:\n{document_text[:12000]}\n\nExtract the structured project requirements JSON."

        try:
            raw_res = await ollama_client_instance.chat_async(system_prompt, user_prompt, json_mode=True)
            cleaned = _clean_json_response(raw_res)
            data = json.loads(cleaned)
            validated = ProjectRequirementExtracted(**data)
            res_dict = validated.dict()

            # Normalize extracted skills via Skill Taxonomy if DB session available
            if db and res_dict.get("skills_required"):
                for sk in res_dict["skills_required"]:
                    raw_name = sk.get("name")
                    if raw_name:
                        taxonomy_skill = lookup_or_normalize_skill(db, raw_name)
                        sk["normalized_name"] = taxonomy_skill.get("normalized_skill_name") or raw_name
                        sk["skill_id"] = taxonomy_skill.get("skill_id")

            return res_dict
        except Exception as e:
            logger.error(f"Failed project extraction call: {e}. Using fallback parser.")
            from backend.agents.jd_agent import _parse_job_description_fallback
            return _parse_job_description_fallback(document_text)

    @staticmethod
    async def extract_employee_profile_async(resume_text: str, db: Optional[Session] = None) -> Dict[str, Any]:
        system_prompt = load_prompt_template("employee_extraction.txt")
        user_prompt = f"RESUME / PROFILE TEXT:\n{resume_text[:12000]}\n\nExtract the structured employee profile JSON."

        raw_res = await ollama_client_instance.chat_async(system_prompt, user_prompt, json_mode=True)
        cleaned = _clean_json_response(raw_res)

        try:
            data = json.loads(cleaned)
            validated = ExtractedEmployeeProfile(**data)
            res_dict = validated.dict()

            # Normalize extracted skills via Skill Taxonomy if DB session available
            if db and res_dict.get("skills"):
                for sk in res_dict["skills"]:
                    raw_name = sk.get("skill_name")
                    if raw_name:
                        taxonomy_skill = lookup_or_normalize_skill(db, raw_name)
                        sk["normalized_skill_name"] = taxonomy_skill.get("normalized_skill_name") or raw_name
                        sk["skill_id"] = taxonomy_skill.get("skill_id")

            return res_dict
        except Exception as e:
            logger.error(f"Failed to parse employee profile JSON: {e}. Raw: {raw_res[:200]}")
            return {
                "name": "Candidate",
                "total_experience_years": 0.0,
                "skills": [],
                "technologies": [],
                "domain_experience": [],
                "projects": []
            }

    @staticmethod
    async def explain_match_async(match_data: Dict[str, Any]) -> Dict[str, Any]:
        system_prompt = load_prompt_template("match_explanation.txt")
        user_prompt = f"STRUCTURED MATCH RESULT:\n{json.dumps(match_data, indent=2)}\n\nGenerate structured match explanation JSON."

        raw_res = await ollama_client_instance.chat_async(system_prompt, user_prompt, json_mode=True)
        cleaned = _clean_json_response(raw_res)

        try:
            data = json.loads(cleaned)
            validated = AIMatchExplanationSchema(**data)
            return validated.dict()
        except Exception as e:
            logger.error(f"Failed to parse match explanation JSON: {e}")
            return {
                "summary": f"Employee achieved an overall match score of {match_data.get('overall_match_score', 0)}%.",
                "strengths": [f"Matched {len(match_data.get('matched_skills', []))} skills."],
                "partial_matches": [],
                "gaps": [f"Missing {len(match_data.get('missing_skills', []))} skills."],
                "experience_explanation": "Evaluated against experience requirements."
            }
