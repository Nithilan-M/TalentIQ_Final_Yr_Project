from typing import List, Optional
from pydantic import BaseModel

class ExtractedEmployeeSkill(BaseModel):
    skill_name: str
    proficiency_level: Optional[str] = "Intermediate"
    experience_years: Optional[float] = 0.0
    evidence: Optional[str] = None
    source: Optional[str] = "Resume"

class ExtractedProjectHistory(BaseModel):
    title: Optional[str] = "Project"
    domain: Optional[str] = None
    role: Optional[str] = None
    technologies: Optional[List[str]] = []

class ExtractedEmployeeProfile(BaseModel):
    employee_id: Optional[str] = None
    name: str
    email: Optional[str] = None
    department: Optional[str] = "Engineering"
    designation: Optional[str] = "Software Engineer"
    total_experience_years: Optional[float] = 0.0
    skills: Optional[List[ExtractedEmployeeSkill]] = []
    technologies: Optional[List[str]] = []
    domain_experience: Optional[List[str]] = []
    projects: Optional[List[ExtractedProjectHistory]] = []
