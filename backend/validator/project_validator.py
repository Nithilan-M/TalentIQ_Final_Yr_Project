from typing import Dict, Any, List, Tuple
from datetime import datetime

VALID_LEVELS = {"Beginner", "Intermediate", "Advanced", "Expert"}
VALID_PRIORITIES = {"Critical", "Required", "Preferred"}

def validate_project_requirement(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates extracted/submitted Project Requirement data.
    Returns a dictionary containing:
      - is_valid: bool (True if all critical constraints met)
      - missing_fields: List[str]
      - errors: List[str]
      - warnings: List[str]
    """
    missing_fields: List[str] = []
    errors: List[str] = []
    warnings: List[str] = []

    # 1. Project Name
    proj_name = data.get("project_name") or data.get("title")
    if not proj_name or not str(proj_name).strip():
        missing_fields.append("Project Name")
        errors.append("Project Name could not be identified from the uploaded document.")

    # 2. Project Description
    desc = data.get("project_description") or data.get("raw_text") or data.get("description")
    if not desc or not str(desc).strip():
        missing_fields.append("Project Description")
        errors.append("Project Description could not be identified from the uploaded document.")

    # 3. Required Team Size
    team_size = data.get("required_team_size")
    if team_size is None or str(team_size).strip() == "":
        missing_fields.append("Required Team Size")
        errors.append("Required team size could not be identified from the uploaded document.")
    else:
        try:
            val = int(team_size)
            if val <= 0:
                missing_fields.append("Required Team Size")
                errors.append("Required team size must be a valid positive number.")
        except (ValueError, TypeError):
            missing_fields.append("Required Team Size")
            errors.append("Required team size must be a valid positive number.")

    # 4. Required Skills
    req_skills = data.get("required_skills", [])
    if not req_skills or not isinstance(req_skills, list) or len(req_skills) == 0:
        missing_fields.append("Required Skills")
        errors.append("At least one required skill must be specified.")
    else:
        valid_skill_found = False
        for idx, skill in enumerate(req_skills):
            if isinstance(skill, dict):
                s_name = skill.get("skill_name") or skill.get("original_name") or skill.get("normalized_name")
                if s_name and str(s_name).strip():
                    valid_skill_found = True
                
                # Check skill level if provided (None is allowed when not specified in PDF)
                s_level = skill.get("required_level")
                if s_level and str(s_level).strip() and str(s_level).strip().title() not in VALID_LEVELS:
                    warnings.append(f"Skill '{s_name}' has unrecognized proficiency level '{s_level}'. Allowed: Beginner, Intermediate, Advanced, Expert.")

                # Check priority if provided
                s_prio = skill.get("priority")
                if s_prio and str(s_prio).strip() and str(s_prio).strip().title() not in VALID_PRIORITIES:
                    warnings.append(f"Skill '{s_name}' has unrecognized priority '{s_prio}'. Allowed: Critical, Required, Preferred.")
            elif isinstance(skill, str) and skill.strip():
                valid_skill_found = True
        
        if not valid_skill_found:
            missing_fields.append("Required Skills")
            errors.append("Skill names cannot be empty. At least one valid skill is required.")

    # 4b. Preferred Skills (Optional)
    pref_skills = data.get("preferred_skills", [])
    if isinstance(pref_skills, list):
        for idx, skill in enumerate(pref_skills):
            if isinstance(skill, dict):
                s_name = skill.get("skill_name") or skill.get("original_name")
                s_level = skill.get("required_level")
                if s_level and str(s_level).strip() and str(s_level).strip().title() not in VALID_LEVELS:
                    warnings.append(f"Preferred skill '{s_name}' has unrecognized level '{s_level}'.")

    # 5. Date Validation (if provided)
    start_date_str = data.get("start_date")
    end_date_str = data.get("end_date")
    
    parsed_start = None
    parsed_end = None

    if start_date_str and str(start_date_str).strip():
        parsed_start = _parse_date(str(start_date_str).strip())
        if not parsed_start:
            warnings.append(f"Start date '{start_date_str}' is not in a recognized date format.")

    if end_date_str and str(end_date_str).strip():
        parsed_end = _parse_date(str(end_date_str).strip())
        if not parsed_end:
            warnings.append(f"End date '{end_date_str}' is not in a recognized date format.")

    if parsed_start and parsed_end:
        if parsed_start > parsed_end:
            errors.append("Start date cannot be after the end date.")

    is_valid = len(errors) == 0

    return {
        "is_valid": is_valid,
        "missing_fields": missing_fields,
        "errors": errors,
        "warnings": warnings
    }

def _parse_date(date_str: str):
    """Helper to attempt parsing various common date formats."""
    formats = [
        "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y",
        "%Y/%m/%d", "%b %d, %Y", "%B %d, %Y",
        "%d %b %Y", "%d %B %Y"
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            pass
    return None
