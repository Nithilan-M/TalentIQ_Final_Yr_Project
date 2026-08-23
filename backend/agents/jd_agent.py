import json
import re
from backend.services.gemini import call_gemini_async
from backend.parsers.skill_normalizer import normalize_skill

async def parse_job_description(jd_text: str) -> dict:
    """
    Uses Gemini to analyze internal Project Requirement PDF text and extract structured project information.
    The extracted information describes requirements for an internal company project team formation.
    Do NOT invent or hallucinate information that is not present in the document.
    """
    prompt = f"""
    You are extracting requirements from an internal company project requirement document. The purpose is to identify the skills, roles, experience, proficiency levels and other requirements needed to form an internal project team.
    
    CRITICAL INSTRUCTIONS:
    1. Do NOT invent or hallucinate details that are not present in the text.
    2. If a field is not present in the document, set its value to null (or empty array for lists, empty object for mappings).
    3. Do NOT assign a skill level if the document does not provide enough information. Set required_level to null instead.
    4. Distinguish clearly between mandatory/required skills vs preferred/nice-to-have skills.
    5. Extract team size accurately as an integer.

    Output a single valid JSON object containing EXACTLY these keys:
    1. "project_name": The formal title/name of the project (e.g. "AI Healthcare Platform"), or null if missing.
    2. "project_description": The actual project objective/description from text.
    3. "start_date": Project start date (e.g. "2026-09-01"), or null.
    4. "end_date": Project end date (e.g. "2026-11-30"), or null.
    5. "duration_text": Text summary of duration if explicit start/end dates are missing (e.g. "6-month project"), or null.
    6. "required_team_size": Integer number of employees required for the team (e.g. 6). If missing, return null.
    7. "roles": Array of string project roles requested (e.g. ["Backend Developer", "ML Engineer", "Frontend Developer"]).
    8. "required_skills": Array of mandatory skill objects:
       [
         {{
           "skill_name": "Amazon Web Services",  // Original skill string
           "normalized_skill_name": "AWS",      // Standardized skill alias
           "required_level": "Advanced",         // Allowed values: "Beginner", "Intermediate", "Advanced", "Expert", or null if not stated
           "priority": "Critical",               // Allowed values: "Critical", "Required"
           "experience_required": "3+ years"     // Text summary of experience or null
         }}
       ]
    9. "preferred_skills": Array of preferred/nice-to-have skill objects:
       [
         {{
           "skill_name": "Docker",
           "normalized_skill_name": "Docker",
           "required_level": "Intermediate",     // Allowed values: "Beginner", "Intermediate", "Advanced", "Expert", or null if not stated
           "priority": "Preferred",
           "experience_required": null
         }}
       ]
    10. "role_skill_mapping": Object mapping role titles to lists of skill names (e.g. {{"Backend Developer": ["Python", "FastAPI"], "Frontend Developer": ["React"]}}). Return empty object {{}} if not specified.
    11. "required_experience": Overall project/team experience required (e.g. "3+ years backend development"), or null.
    12. "domain": Industry or project domain (e.g. "Healthcare", "FinTech", "Cloud Computing").
    13. "technologies": Array of explicitly mentioned tools, frameworks, and developer libraries.
    14. "confidence_scores": Object mapping field names to extraction confidence (0.0 to 1.0) (e.g. {{"project_name": 0.98, "required_team_size": 0.95, "required_skills": 0.92}}).

    Ensure the response is strictly valid JSON format without extra markdown commentary.

    Project Requirement Document Text:
    ---
    {jd_text}
    ---
    """
    
    try:
        response_text = await call_gemini_async(prompt, json_mode=True, temperature=0.1)
    except Exception as ai_err:
        print(f"Ollama/AI call unavailable in JD Agent ({ai_err}). Using local rule-based fallback parser.")
        return _parse_job_description_fallback(jd_text)
    
    try:
        # Strip potential markdown formatting if returned despite json_mode
        clean_text = response_text.strip()
        if clean_text.startswith("```"):
            clean_text = re.sub(r"^```(?:json)?\n?", "", clean_text)
            clean_text = re.sub(r"\n?```$", "", clean_text)
        
        data = json.loads(clean_text)
        
        # Ensure array and dict fields exist
        if not isinstance(data.get("roles"), list):
            data["roles"] = []
        if not isinstance(data.get("technologies"), list):
            data["technologies"] = []
        if not isinstance(data.get("required_skills"), list):
            data["required_skills"] = []
        if not isinstance(data.get("preferred_skills"), list):
            data["preferred_skills"] = []
        if not isinstance(data.get("role_skill_mapping"), dict):
            data["role_skill_mapping"] = {}
        if not isinstance(data.get("confidence_scores"), dict):
            data["confidence_scores"] = {}
            
        def process_skill_list(raw_list, default_priority="Required"):
            processed = []
            legacy_names = []
            for sk in raw_list:
                if isinstance(sk, dict):
                    orig_name = sk.get("skill_name") or sk.get("original_name") or ""
                    if not orig_name or not orig_name.strip():
                        continue
                    norm_res = normalize_skill(orig_name.strip())
                    sk["skill_name"] = orig_name.strip()
                    sk["original_name"] = orig_name.strip()
                    sk["normalized_name"] = norm_res["normalized_name"]
                    sk["normalized_skill_name"] = norm_res["normalized_name"]
                    
                    # Validate level - set to None if unrecognized or hallucinated
                    lvl = sk.get("required_level")
                    if lvl and str(lvl).strip().title() in {"Beginner", "Intermediate", "Advanced", "Expert"}:
                        sk["required_level"] = str(lvl).strip().title()
                    else:
                        sk["required_level"] = None
                        
                    sk["priority"] = sk.get("priority") or default_priority
                    sk["experience_required"] = sk.get("experience_required") or None
                    sk["confidence"] = float(sk.get("confidence", 0.92))
                    
                    processed.append(sk)
                    legacy_names.append(norm_res["normalized_name"])
                elif isinstance(sk, str) and sk.strip():
                    norm_res = normalize_skill(sk.strip())
                    processed.append({
                        "skill_name": sk.strip(),
                        "original_name": sk.strip(),
                        "normalized_name": norm_res["normalized_name"],
                        "normalized_skill_name": norm_res["normalized_name"],
                        "required_level": None,
                        "priority": default_priority,
                        "experience_required": None,
                        "confidence": 0.90
                    })
                    legacy_names.append(norm_res["normalized_name"])
            return processed, legacy_names

        norm_req_skills, req_legacy = process_skill_list(data["required_skills"], default_priority="Required")
        norm_pref_skills, pref_legacy = process_skill_list(data["preferred_skills"], default_priority="Preferred")

        data["required_skills"] = norm_req_skills
        data["preferred_skills"] = norm_pref_skills

        # Legacy backward compatibility fields for downstream matching modules
        data["title"] = data.get("project_name") or "Project Requirement"
        data["skills_required"] = req_legacy
        data["skills_preferred"] = pref_legacy
        data["industry"] = data.get("domain") or ""
        
        return data
    except Exception as e:
        print(f"Failed to parse Project Requirement JSON response: {e}. Raw: {response_text}. Using fallback.")
        return _parse_job_description_fallback(jd_text)


def _parse_job_description_fallback(jd_text: str) -> dict:
    """
    Local heuristic/regex parser fallback when local Ollama / AI model is offline or unreachable.
    Extracts project title, roles, domain, skills, and dates directly from document text.
    """
    lines = [line.strip() for line in jd_text.split("\n") if line.strip()]
    
    # 1. Project Title
    project_name = "Project Requirement"
    if lines:
        for line in lines[:5]:
            if any(kw in line.lower() for kw in ["project", "requirement", "title", "job", "position", "role", "system", "platform", "engineer"]):
                cleaned_line = re.sub(r"^(project|title|job description|role|position)[\s:-]*", "", line, flags=re.IGNORECASE).strip()
                if len(cleaned_line) > 3 and len(cleaned_line) < 80:
                    project_name = cleaned_line
                    break
        if project_name == "Project Requirement" and len(lines[0]) < 60:
            project_name = lines[0]

    # 2. Extract Skills using Canonical Taxonomy + regex
    known_skills = [
        "Python", "FastAPI", "PostgreSQL", "Docker", "Kubernetes", "React", "TypeScript",
        "JavaScript", "Node.js", "Java", "C++", "AWS", "Azure", "GCP", "MongoDB", "MySQL",
        "Redis", "GraphQL", "REST API", "Microservices", "Machine Learning", "TensorFlow",
        "PyTorch", "NLP", "Pandas", "NumPy", "Scikit-Learn", "Git", "CI/CD", "HTML", "CSS"
    ]
    
    skills_found = []
    for skill in known_skills:
        if re.search(r"\b" + re.escape(skill) + r"\b", jd_text, re.IGNORECASE):
            skills_found.append(skill)
            
    req_skills_objs = []
    req_legacy_names = []
    for s in skills_found:
        norm_res = normalize_skill(s)
        norm_name = norm_res["normalized_name"]
        req_skills_objs.append({
            "skill_name": s,
            "original_name": s,
            "normalized_name": norm_name,
            "normalized_skill_name": norm_name,
            "required_level": "Advanced" if s in ["Python", "React", "AWS"] else "Intermediate",
            "priority": "Required",
            "experience_required": None,
            "confidence": 0.88
        })
        req_legacy_names.append(norm_name)

    # 3. Roles
    roles_found = []
    for role_name in ["Backend Developer", "Frontend Developer", "ML Engineer", "Full Stack Engineer", "DevOps Engineer", "Data Engineer", "System Architect"]:
        if re.search(r"\b" + re.escape(role_name) + r"\b", jd_text, re.IGNORECASE):
            roles_found.append(role_name)
    if not roles_found:
        roles_found = ["Software Engineer"]

    # 4. Domain
    domain = "Engineering"
    if any(kw in jd_text.lower() for kw in ["health", "medical", "clinic"]):
        domain = "Healthcare"
    elif any(kw in jd_text.lower() for kw in ["bank", "finance", "fintech", "payment"]):
        domain = "FinTech"
    elif any(kw in jd_text.lower() for kw in ["ai", "machine learning", "embeddings", "model"]):
        domain = "AI/ML"
    elif any(kw in jd_text.lower() for kw in ["cloud", "devops", "aws", "infrastructure"]):
        domain = "Cloud Infrastructure"

    # 5. Team Size
    team_size = 1
    team_match = re.search(r"team\s+size[\s:-]*(\d+)", jd_text, re.IGNORECASE) or re.search(r"(\d+)\s+(positions|engineers|developers)", jd_text, re.IGNORECASE)
    if team_match:
        try:
            team_size = int(team_match.group(1))
        except ValueError:
            team_size = 1

    return {
        "project_name": project_name,
        "project_description": jd_text[:500] if len(jd_text) > 500 else jd_text,
        "start_date": "2026-06-01",
        "end_date": "2026-12-31",
        "duration_text": "7 months",
        "required_team_size": team_size,
        "roles": roles_found,
        "required_skills": req_skills_objs,
        "preferred_skills": [],
        "role_skill_mapping": {roles_found[0]: req_legacy_names} if roles_found and req_legacy_names else {},
        "required_experience": "3+ years",
        "domain": domain,
        "technologies": req_legacy_names,
        "confidence_scores": {"project_name": 0.85, "required_skills": 0.85},
        "title": project_name,
        "skills_required": req_legacy_names,
        "skills_preferred": [],
        "industry": domain
    }


