import datetime
import sys

# Ensure database.models and backend.database.models alias to the exact same module object
if "database.models" in sys.modules and "backend.database.models" not in sys.modules:
    sys.modules["backend.database.models"] = sys.modules["database.models"]
elif "backend.database.models" in sys.modules and "database.models" not in sys.modules:
    sys.modules["database.models"] = sys.modules["backend.database.models"]

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Float, JSON, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.database.connection import Base

class User(Base):
    __tablename__ = "users"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    job_descriptions = relationship("JobDescription", back_populates="user", cascade="all, delete-orphan")


class Skill(Base):
    """
    Centralized Skill Taxonomy entity representing the organization's standard skill vocabulary.
    Shared equally by Employee Master Data and Project Requirements.
    """
    __tablename__ = "skill_taxonomy"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)                           # Canonical name e.g. "Amazon Web Services"
    normalized_name = Column(String, unique=True, index=True, nullable=False) # e.g. "AWS"
    category = Column(String, nullable=True, index=True)            # e.g. "Cloud", "Programming Languages"
    description = Column(Text, nullable=True)
    aliases = Column(JSON, default=[])                              # e.g. ["AWS", "Amazon Web Services", "AWS Cloud"]
    status = Column(String, default="Active")                       # Active / Inactive
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    employee_skills = relationship("EmployeeSkill", back_populates="skill")
    project_skills = relationship("ProjectSkillRequirement", back_populates="skill")


class JobDescription(Base):
    __tablename__ = "job_descriptions"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    raw_text = Column(Text, nullable=False)
    
    # Project Requirement specific fields
    project_name = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)
    duration_text = Column(String, nullable=True)      # e.g., "6-month project"
    required_team_size = Column(Integer, nullable=True, default=1)
    roles = Column(JSON, default=[])                 # List of strings
    role_skill_mapping = Column(JSON, default={})    # Map of role -> skill list
    domain = Column(String, nullable=True)           # Project domain
    source_file_name = Column(String, nullable=True)
    source_file_path = Column(String, nullable=True)
    extraction_status = Column(String, default="draft") # 'draft', 'confirmed', 'failed'
    confidence_scores = Column(JSON, default={})      # Extraction confidence metadata
    
    # Extracted fields from Gemini
    skills_required = Column(JSON, default=[])       # List of strings (for legacy/backwards compatibility)
    skills_preferred = Column(JSON, default=[])      # List of strings
    experience_required = Column(String, nullable=True)
    education_required = Column(String, nullable=True)
    responsibilities = Column(JSON, default=[])      # List of strings
    industry = Column(String, nullable=True)
    soft_skills = Column(JSON, default=[])           # List of strings
    leadership_requirements = Column(JSON, default=[]) # List of strings
    technologies = Column(JSON, default=[])          # List of strings
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="job_descriptions")
    candidates = relationship("Candidate", back_populates="job_description", cascade="all, delete-orphan")
    rankings = relationship("RankingResult", back_populates="job_description", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="job_description", cascade="all, delete-orphan")
    interview_questions = relationship("InterviewQuestion", back_populates="job_description", cascade="all, delete-orphan")
    project_skills = relationship("ProjectSkillRequirement", back_populates="job_description", cascade="all, delete-orphan")
    shortlists = relationship("ProjectShortlist", back_populates="job_description", cascade="all, delete-orphan")


class ProjectSkillRequirement(Base):
    __tablename__ = "project_skill_requirements"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    job_description_id = Column(Integer, ForeignKey("job_descriptions.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skill_taxonomy.id"), nullable=True) # Reference to canonical Skill
    original_name = Column(String, nullable=False)
    normalized_name = Column(String, nullable=False)
    required_level = Column(String, nullable=True)       # Beginner, Intermediate, Advanced, Expert
    required_level_value = Column(Integer, nullable=True) # 1=Beginner, 2=Intermediate, 3=Advanced, 4=Expert
    priority = Column(String, nullable=True)             # Critical, Required, Preferred
    experience_required = Column(String, nullable=True)
    is_preferred = Column(Boolean, default=False)        # True if preferred, False if required
    confidence = Column(Float, nullable=True)            # Extraction confidence (0.0 - 1.0)

    job_description = relationship("JobDescription", back_populates="project_skills")
    skill = relationship("Skill", back_populates="project_skills")


class Candidate(Base):
    """
    Primary workforce entity. Internally named 'Candidate' for backward compatibility
    with FAISS indexing, embeddings, and ranking. In the application/UI layer this is
    referred to as 'Employee'.
    """
    __tablename__ = "candidates"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    job_description_id = Column(Integer, ForeignKey("job_descriptions.id"), nullable=True)
    name = Column(String, nullable=False, index=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    
    skills = Column(JSON, default=[])                 # List of strings (legacy flat list)
    technical_summary = Column(Text, nullable=True)
    achievements = Column(JSON, default=[])           # List of strings
    languages = Column(JSON, default=[])              # List of strings
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # ── Employee Master Data fields ──────────────────────────────────────
    employee_id = Column(String, unique=True, index=True, nullable=True)  # e.g. "EMP001"
    department = Column(String, nullable=True)            # e.g. "Engineering"
    designation = Column(String, nullable=True)           # e.g. "Senior Backend Developer"
    total_experience_years = Column(Float, nullable=True) # e.g. 4.5
    status = Column(String, default="Active")             # Active / Inactive
    current_project = Column(String, nullable=True)       # e.g. "Banking API Migration"
    assignment_start_date = Column(String, nullable=True) # ISO YYYY-MM-DD
    assignment_end_date = Column(String, nullable=True)   # ISO YYYY-MM-DD
    available_from = Column(String, nullable=True)        # ISO YYYY-MM-DD
    allocation_percentage = Column(Integer, nullable=True, default=100)
    performance_rating = Column(Float, nullable=True)     # e.g. 4.5 out of 5.0
    performance_review_period = Column(String, nullable=True) # e.g. "2025-Q4"
    performance_notes = Column(Text, nullable=True)
    domain_experience = Column(JSON, default=[])          # e.g. ["Healthcare", "FinTech"]
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # ── Relationships ────────────────────────────────────────────────────
    job_description = relationship("JobDescription", back_populates="candidates")
    
    # Candidate/Employee detailed subcomponents
    experiences = relationship("Experience", back_populates="candidate", cascade="all, delete-orphan")
    educations = relationship("Education", back_populates="candidate", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="candidate", cascade="all, delete-orphan")
    certifications = relationship("Certification", back_populates="candidate", cascade="all, delete-orphan")
    employee_skills = relationship("EmployeeSkill", back_populates="candidate", cascade="all, delete-orphan")
    embedding = relationship("CandidateEmbedding", back_populates="candidate", uselist=False, cascade="all, delete-orphan")
    
    # Ranking & Evaluation results (existing downstream infrastructure)
    rankings = relationship("RankingResult", back_populates="candidate", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="candidate", cascade="all, delete-orphan")
    interview_questions = relationship("InterviewQuestion", back_populates="candidate", cascade="all, delete-orphan")
    shortlists = relationship("ProjectShortlist", back_populates="candidate", cascade="all, delete-orphan")


class EmployeeSkill(Base):
    """Employee-specific skill with proficiency level, numeric value, and experience duration."""
    __tablename__ = "employee_skills"
    __table_args__ = (
        UniqueConstraint('candidate_id', 'normalized_skill_name', name='uq_employee_skill'),
        {'extend_existing': True}
    )

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skill_taxonomy.id"), nullable=True) # Reference to canonical Skill
    skill_name = Column(String, nullable=False)              # Original name e.g. "Amazon Web Services"
    normalized_skill_name = Column(String, nullable=False)    # Normalized e.g. "AWS"
    proficiency_level = Column(String, nullable=True)         # Beginner/Intermediate/Advanced/Expert
    proficiency_value = Column(Integer, nullable=True)        # 1=Beginner, 2=Intermediate, 3=Advanced, 4=Expert
    experience_years = Column(Float, nullable=True)           # e.g. 3.5
    source = Column(String, nullable=True)                    # Resume/Manual Entry/Manager Update/Certification/System Import
    last_updated = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    candidate = relationship("Candidate", back_populates="employee_skills")
    skill = relationship("Skill", back_populates="employee_skills")


class Experience(Base):
    __tablename__ = "experiences"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    company = Column(String, nullable=False)
    role = Column(String, nullable=False)
    duration = Column(String, nullable=True)  # e.g., "Jan 2020 - Dec 2022" or "3 years"
    description = Column(Text, nullable=True)

    candidate = relationship("Candidate", back_populates="experiences")

class Education(Base):
    __tablename__ = "educations"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    degree = Column(String, nullable=False)
    field_of_study = Column(String, nullable=True)
    institution = Column(String, nullable=True)
    year = Column(String, nullable=True)

    candidate = relationship("Candidate", back_populates="educations")

class Project(Base):
    """Employee project history record."""
    __tablename__ = "projects"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    technologies = Column(JSON, default=[])
    # ── Extended project history fields ──
    role = Column(String, nullable=True)              # e.g. "Backend Developer"
    start_date = Column(String, nullable=True)        # ISO YYYY-MM-DD
    end_date = Column(String, nullable=True)          # ISO YYYY-MM-DD
    responsibilities = Column(Text, nullable=True)
    domain = Column(String, nullable=True)            # e.g. "Healthcare"

    candidate = relationship("Candidate", back_populates="projects")

class Certification(Base):
    """Employee certification record."""
    __tablename__ = "certifications"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    name = Column(String, nullable=False)
    issuing_organization = Column(String, nullable=True)
    year = Column(String, nullable=True)
    # ── Extended certification fields ──
    issue_date = Column(String, nullable=True)        # ISO YYYY-MM-DD
    expiry_date = Column(String, nullable=True)       # ISO YYYY-MM-DD
    credential_id = Column(String, nullable=True)

    candidate = relationship("Candidate", back_populates="certifications")

class CandidateEmbedding(Base):
    __tablename__ = "candidate_embeddings"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    embedding = Column(JSON, nullable=False) # Store float list

    candidate = relationship("Candidate", back_populates="embedding")

class RankingResult(Base):
    __tablename__ = "ranking_results"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    job_description_id = Column(Integer, ForeignKey("job_descriptions.id"), nullable=False)
    
    # Specific dimensions out of 100
    overall_score = Column(Float, nullable=False)
    skill_match_score = Column(Float, nullable=False)
    experience_score = Column(Float, nullable=False)
    projects_score = Column(Float, nullable=False)
    education_score = Column(Float, nullable=False)
    certifications_score = Column(Float, nullable=False)
    leadership_score = Column(Float, nullable=False)
    soft_skills_score = Column(Float, nullable=False)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    candidate = relationship("Candidate", back_populates="rankings")
    job_description = relationship("JobDescription", back_populates="rankings")

class Recommendation(Base):
    __tablename__ = "recommendations"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    job_description_id = Column(Integer, ForeignKey("job_descriptions.id"), nullable=False)
    
    advocate_feedback = Column(Text, nullable=False)
    skeptic_feedback = Column(Text, nullable=False)
    judge_decision = Column(String, nullable=False) # Strong Hire, Hire, Borderline, No Hire
    judge_confidence = Column(Float, nullable=False)
    judge_summary = Column(Text, nullable=False)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    candidate = relationship("Candidate", back_populates="recommendations")
    job_description = relationship("JobDescription", back_populates="recommendations")

class InterviewQuestion(Base):
    __tablename__ = "interview_questions"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)
    job_description_id = Column(Integer, ForeignKey("job_descriptions.id"), nullable=False)
    
    questions = Column(JSON, default=[]) # List of question objects
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    candidate = relationship("Candidate", back_populates="interview_questions")
    job_description = relationship("JobDescription", back_populates="interview_questions")


class ProjectShortlist(Base):
    """
    Project-specific 2x shortlist persistence table.
    Tracks employees shortlisted for a specific project based on 2x required team size rule.
    Does NOT modify permanent employee master status.
    """
    __tablename__ = "project_shortlists"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    job_description_id = Column(Integer, ForeignKey("job_descriptions.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False)

    rank_at_shortlisting = Column(Integer, nullable=False)
    ranking_score = Column(Float, nullable=False)
    skill_match_score = Column(Float, nullable=False)
    shortlist_status = Column(String, default="SHORTLISTED") # 'SHORTLISTED', 'NOT_SHORTLISTED'
    version = Column(Integer, default=1)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    candidate = relationship("Candidate", back_populates="shortlists")
    job_description = relationship("JobDescription", back_populates="shortlists")

