from typing import List, Optional
from pydantic import BaseModel

class SkillRequirementItem(BaseModel):
    name: str
    proficiency: Optional[str] = "Intermediate"
    priority: Optional[str] = "Required"
    experience_required: Optional[str] = "N/A"

class ProjectRequirementExtracted(BaseModel):
    project_name: Optional[str] = "Untitled Project"
    domain: Optional[str] = "General"
    description: Optional[str] = ""
    required_team_size: Optional[int] = 1
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    roles: Optional[List[str]] = []
    skills_required: Optional[List[SkillRequirementItem]] = []
    technologies: Optional[List[str]] = []
