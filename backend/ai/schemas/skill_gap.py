from typing import List, Optional
from pydantic import BaseModel

class SkillGapItem(BaseModel):
    skill_name: str
    required_level: str
    current_level: str
    explanation: str

class AISkillGapSchema(BaseModel):
    gap_summary: str
    skill_gaps: Optional[List[SkillGapItem]] = []
