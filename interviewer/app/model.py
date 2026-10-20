from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class Interivew(BaseModel):
    username: str
    session_id: str
    resume_txt: str

# Standard alias
Interview = Interivew


class ReviewCreate(BaseModel):
    session_id: str
    rating: Optional[float] = Field(default=5.0, ge=0.0, le=10.0)
    feedback: Optional[str] = ""
    technical_score: Optional[float] = None
    communication_score: Optional[float] = None
    strengths: Optional[List[str]] = []
    improvements: Optional[List[str]] = []
    decision: Optional[str] = "hire"  # e.g., hire, strong_hire, reject


class SubmissionPayload(BaseModel):
    question_number: int
    question: str
    answer_text: Optional[str] = ""

