from typing import List, Optional
from pydantic import BaseModel

class UpskillingItem(BaseModel):
    skill_name: str
    learning_path: Optional[List[str]] = []
    suggested_topics: Optional[List[str]] = []
    practical_exercises: Optional[List[str]] = []

class AIUpskillingRecommendationSchema(BaseModel):
    recommendations: Optional[List[UpskillingItem]] = []
