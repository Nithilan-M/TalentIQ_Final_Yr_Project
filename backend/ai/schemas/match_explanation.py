from typing import List, Optional
from pydantic import BaseModel

class AIMatchExplanationSchema(BaseModel):
    summary: str
    strengths: Optional[List[str]] = []
    partial_matches: Optional[List[str]] = []
    gaps: Optional[List[str]] = []
    experience_explanation: Optional[str] = ""
