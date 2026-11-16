import os
import sys

# Prevent OpenMP runtime conflict on Windows
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

# Pre-initialize PyTorch and FAISS C++ runtimes early before other C extensions load
try:
    import torch
except ImportError:
    pass

try:
    import faiss
except ImportError:
    pass

try:
    import sentence_transformers
except ImportError:
    pass

from contextlib import asynccontextmanager

# Add the project root to sys.path so backend imports resolve when run directly from this folder
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
curr_pp = os.environ.get("PYTHONPATH", "")
if project_root not in curr_pp:
    os.environ["PYTHONPATH"] = f"{project_root}{os.pathsep}{curr_pp}".strip(os.pathsep)

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database.connection import engine, Base, SessionLocal
from backend.database.models import (
    User, Candidate, EmployeeSkill, Project, Certification, 
    CandidateEmbedding, Skill, ProjectShortlist, JobDescription
)
from backend.api import auth, job_desc, resume, candidate, analytics, reports, challenge, employee, skills, availability, matching, ranking, shortlist, dashboard, ai
from backend.api.auth import get_password_hash
from backend.embeddings.vector_store import vector_store_manager
from sqlalchemy import inspect, text

# Database columns synchronization helper
def sync_db_columns():
    """Ensure missing columns in existing database tables are dynamically added."""
    try:
        is_postgres = "postgresql" in str(engine.url).lower()
        with engine.connect() as conn:
            inspector = inspect(engine)
            existing_tables = set(inspector.get_table_names())
            columns_by_table = {
                t: {c["name"] for c in inspector.get_columns(t)}
                for t in ["job_descriptions", "project_skill_requirements", "candidates", "employee_skills", "projects", "certifications"]
                if t in existing_tables
            }
            
            # Helper to safely add column
            def add_col_if_missing(table_name, col_name, pg_type, sqlite_type):
                if table_name in columns_by_table:
                    if col_name not in columns_by_table[table_name]:
                        col_type = pg_type if is_postgres else sqlite_type
                        try:
                            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
                            conn.commit()
                            columns_by_table[table_name].add(col_name)
                        except Exception as e:
                            conn.rollback()
                            print(f"Notice adding column {table_name}.{col_name}: {e}")

            # 1. job_descriptions table sync
            add_col_if_missing("job_descriptions", "project_name", "VARCHAR", "VARCHAR")
            add_col_if_missing("job_descriptions", "description", "TEXT", "TEXT")
            add_col_if_missing("job_descriptions", "start_date", "VARCHAR", "VARCHAR")
            add_col_if_missing("job_descriptions", "end_date", "VARCHAR", "VARCHAR")
            add_col_if_missing("job_descriptions", "duration_text", "VARCHAR", "VARCHAR")
            add_col_if_missing("job_descriptions", "required_team_size", "INTEGER DEFAULT 1", "INTEGER DEFAULT 1")
            add_col_if_missing("job_descriptions", "roles", "JSONB DEFAULT '[]'::jsonb", "JSON DEFAULT '[]'")
            add_col_if_missing("job_descriptions", "role_skill_mapping", "JSONB DEFAULT '{}'::jsonb", "JSON DEFAULT '{}'")
            add_col_if_missing("job_descriptions", "domain", "VARCHAR", "VARCHAR")
            add_col_if_missing("job_descriptions", "source_file_name", "VARCHAR", "VARCHAR")
            add_col_if_missing("job_descriptions", "source_file_path", "VARCHAR", "VARCHAR")
            add_col_if_missing("job_descriptions", "extraction_status", "VARCHAR DEFAULT 'draft'", "VARCHAR DEFAULT 'draft'")
            add_col_if_missing("job_descriptions", "confidence_scores", "JSONB DEFAULT '{}'::jsonb", "JSON DEFAULT '{}'")
            add_col_if_missing("job_descriptions", "updated_at", "TIMESTAMP", "DATETIME")

            # 2. project_skill_requirements table sync
            add_col_if_missing("project_skill_requirements", "skill_id", "INTEGER REFERENCES skill_taxonomy(id)", "INTEGER")
            add_col_if_missing("project_skill_requirements", "required_level_value", "INTEGER", "INTEGER")
            add_col_if_missing("project_skill_requirements", "is_preferred", "BOOLEAN DEFAULT FALSE", "BOOLEAN DEFAULT FALSE")
            add_col_if_missing("project_skill_requirements", "confidence", "FLOAT", "FLOAT")

            # 3. candidates table (Employee Master) column sync
            add_col_if_missing("candidates", "employee_id", "VARCHAR", "VARCHAR")
            add_col_if_missing("candidates", "department", "VARCHAR", "VARCHAR")
            add_col_if_missing("candidates", "designation", "VARCHAR", "VARCHAR")
            add_col_if_missing("candidates", "total_experience_years", "FLOAT", "FLOAT")
            add_col_if_missing("candidates", "status", "VARCHAR DEFAULT 'Active'", "VARCHAR DEFAULT 'Active'")
            add_col_if_missing("candidates", "current_project", "VARCHAR", "VARCHAR")
            add_col_if_missing("candidates", "assignment_start_date", "VARCHAR", "VARCHAR")
            add_col_if_missing("candidates", "assignment_end_date", "VARCHAR", "VARCHAR")
            add_col_if_missing("candidates", "available_from", "VARCHAR", "VARCHAR")
            add_col_if_missing("candidates", "allocation_percentage", "INTEGER DEFAULT 100", "INTEGER DEFAULT 100")
            add_col_if_missing("candidates", "performance_rating", "FLOAT", "FLOAT")
            add_col_if_missing("candidates", "performance_review_period", "VARCHAR", "VARCHAR")
            add_col_if_missing("candidates", "performance_notes", "TEXT", "TEXT")
            add_col_if_missing("candidates", "domain_experience", "JSONB DEFAULT '[]'::jsonb", "JSON DEFAULT '[]'")
            add_col_if_missing("candidates", "updated_at", "TIMESTAMP", "DATETIME")

            # Ensure candidates.job_description_id is nullable for employee records
            if is_postgres:
                try:
                    conn.execute(text("ALTER TABLE candidates ALTER COLUMN job_description_id DROP NOT NULL"))
                    conn.commit()
                except Exception as e:
                    conn.rollback()
            else:
                try:
                    res = conn.execute(text("PRAGMA table_info(candidates)")).fetchall()
                    jd_col = next((c for c in res if c[1] == "job_description_id"), None)
                    if jd_col and jd_col[3] == 1:
                        # SQLite NOT NULL constraint needs table rebuild
                        conn.execute(text("PRAGMA foreign_keys = OFF;"))
                        existing_cols = [c[1] for c in res]
                        cols_sql = ", ".join(existing_cols)
                        conn.execute(text(f"""
                            CREATE TABLE candidates_fix (
                                id INTEGER PRIMARY KEY,
                                job_description_id INTEGER,
                                name VARCHAR NOT NULL,
                                email VARCHAR,
                                phone VARCHAR,
                                skills JSON,
                                technical_summary TEXT,
                                achievements JSON,
                                languages JSON,
                                created_at DATETIME,
                                employee_id VARCHAR,
                                department VARCHAR,
                                designation VARCHAR,
                                total_experience_years FLOAT,
                                status VARCHAR DEFAULT 'Active',
                                current_project VARCHAR,
                                assignment_start_date VARCHAR,
                                assignment_end_date VARCHAR,
                                available_from VARCHAR,
                                allocation_percentage INTEGER DEFAULT 100,
                                performance_rating FLOAT,
                                performance_review_period VARCHAR,
                                performance_notes TEXT,
                                domain_experience JSON DEFAULT '[]',
                                updated_at DATETIME,
                                FOREIGN KEY(job_description_id) REFERENCES job_descriptions(id)
                            );
                        """))
                        conn.execute(text(f"INSERT INTO candidates_fix ({cols_sql}) SELECT {cols_sql} FROM candidates;"))
                        conn.execute(text("DROP TABLE candidates;"))
                        conn.execute(text("ALTER TABLE candidates_fix RENAME TO candidates;"))
                        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_candidates_id ON candidates(id);"))
                        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_candidates_name ON candidates(name);"))
                        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_candidates_employee_id ON candidates(employee_id);"))
                        conn.commit()
                except Exception as e:
                    conn.rollback()
                    print(f"Notice syncing SQLite candidates nullability: {e}")

            # 4. employee_skills table column sync
            add_col_if_missing("employee_skills", "skill_id", "INTEGER REFERENCES skill_taxonomy(id)", "INTEGER")
            add_col_if_missing("employee_skills", "proficiency_value", "INTEGER", "INTEGER")

            # 5. projects table column sync
            add_col_if_missing("projects", "role", "VARCHAR", "VARCHAR")
            add_col_if_missing("projects", "start_date", "VARCHAR", "VARCHAR")
            add_col_if_missing("projects", "end_date", "VARCHAR", "VARCHAR")
            add_col_if_missing("projects", "responsibilities", "TEXT", "TEXT")
            add_col_if_missing("projects", "domain", "VARCHAR", "VARCHAR")

            # 6. certifications table column sync
            add_col_if_missing("certifications", "issue_date", "VARCHAR", "VARCHAR")
            add_col_if_missing("certifications", "expiry_date", "VARCHAR", "VARCHAR")
            add_col_if_missing("certifications", "credential_id", "VARCHAR", "VARCHAR")

    except Exception as exc:
        print(f"Database column sync notice: {exc}")


def seed_sample_employees(db):
    """Seed 10 sample employees if database has no employees."""
    existing_count = db.query(Candidate).filter(Candidate.employee_id.isnot(None)).count()
    if existing_count > 0:
        return

    sample_workforce = [
        {
            "employee_id": "EMP001",
            "name": "Employee A",
            "email": "emp.a@company.com",
            "department": "Engineering",
            "designation": "Senior Backend Developer",
            "total_experience_years": 4.5,
            "status": "Active",
            "current_project": "Banking API Migration",
            "assignment_start_date": "2026-05-01",
            "assignment_end_date": "2026-09-30",
            "available_from": "2026-10-01",
            "allocation_percentage": 100,
            "performance_rating": 4.5,
            "performance_review_period": "2025-Q4",
            "performance_notes": "Exceeds expectations in system design and API reliability.",
            "skills": [
                ("Python", "Advanced", 4.0, "Manager Update"),
                ("FastAPI", "Advanced", 3.0, "Resume"),
                ("PostgreSQL", "Intermediate", 3.0, "Resume"),
                ("Docker", "Intermediate", 2.0, "System Import"),
            ],
            "projects": [
                {"title": "Healthcare Management System", "role": "Backend Developer", "start_date": "2024-01-01", "end_date": "2025-12-31", "technologies": ["Python", "FastAPI", "PostgreSQL"], "domain": "Healthcare"}
            ],
            "certs": [
                {"name": "AWS Certified Cloud Practitioner", "org": "AWS", "issue": "2025-03-15", "expiry": "2028-03-15", "cred_id": "AWS-CCP-001"}
            ]
        },
        {
            "employee_id": "EMP002",
            "name": "Employee B",
            "email": "emp.b@company.com",
            "department": "AI/ML",
            "designation": "ML Engineer",
            "total_experience_years": 3.0,
            "status": "Active",
            "current_project": "AI Chatbot Platform",
            "assignment_start_date": "2026-04-01",
            "assignment_end_date": "2026-11-30",
            "available_from": "2026-12-01",
            "allocation_percentage": 80,
            "performance_rating": 4.2,
            "performance_review_period": "2025-Q4",
            "performance_notes": "Strong machine learning model development skills.",
            "skills": [
                ("Python", "Intermediate", 3.0, "Resume"),
                ("TensorFlow", "Advanced", 2.5, "Certification"),
                ("PyTorch", "Intermediate", 2.0, "Resume"),
                ("Scikit-Learn", "Advanced", 3.0, "Resume"),
            ],
            "projects": [
                {"title": "Fraud Detection System", "role": "ML Engineer", "start_date": "2024-06-01", "end_date": "2025-06-30", "technologies": ["Python", "TensorFlow", "Scikit-Learn"], "domain": "FinTech"}
            ],
            "certs": [
                {"name": "TensorFlow Developer Certificate", "org": "Google", "issue": "2025-01-10", "expiry": "", "cred_id": "TF-DEV-002"}
            ]
        },
        {
            "employee_id": "EMP003",
            "name": "Employee C",
            "email": "emp.c@company.com",
            "department": "Frontend",
            "designation": "Lead Frontend Developer",
            "total_experience_years": 5.5,
            "status": "Active",
            "current_project": "E-Commerce Dashboard",
            "assignment_start_date": "2026-06-01",
            "assignment_end_date": "2026-12-31",
            "available_from": "2027-01-01",
            "allocation_percentage": 100,
            "performance_rating": 4.8,
            "performance_review_period": "2025-Q4",
            "performance_notes": "Outstanding UI/UX architecture and leadership.",
            "skills": [
                ("React", "Expert", 5.0, "Manager Update"),
                ("TypeScript", "Advanced", 4.0, "Resume"),
                ("Next.js", "Advanced", 3.0, "Resume"),
                ("CSS", "Expert", 5.0, "Resume"),
            ],
            "projects": [
                {"title": "Global Retail Analytics Portal", "role": "Frontend Lead", "start_date": "2024-03-01", "end_date": "2025-09-30", "technologies": ["React", "TypeScript", "Next.js"], "domain": "E-Commerce"}
            ],
            "certs": [
                {"name": "Meta Front-End Developer Certificate", "org": "Meta", "issue": "2024-05-20", "expiry": "", "cred_id": "META-FE-003"}
            ]
        },
        {
            "employee_id": "EMP004",
            "name": "Employee D",
            "email": "emp.d@company.com",
            "department": "Cloud & DevOps",
            "designation": "DevOps Specialist",
            "total_experience_years": 4.0,
            "status": "Active",
            "current_project": "Infrastructure Automation",
            "assignment_start_date": "2026-01-15",
            "assignment_end_date": "2026-08-31",
            "available_from": "2026-09-01",
            "allocation_percentage": 100,
            "performance_rating": 4.4,
            "performance_review_period": "2025-Q4",
            "performance_notes": "Expert in CI/CD pipeline automation and Kubernetes.",
            "skills": [
                ("Docker", "Expert", 4.0, "Manager Update"),
                ("Kubernetes", "Advanced", 3.0, "Certification"),
                ("AWS", "Advanced", 3.5, "Certification"),
                ("Python", "Intermediate", 2.0, "Resume"),
            ],
            "projects": [
                {"title": "Multi-Cloud Kubernetes Migration", "role": "DevOps Engineer", "start_date": "2024-08-01", "end_date": "2025-11-30", "technologies": ["Docker", "Kubernetes", "AWS"], "domain": "Cloud Infrastructure"}
            ],
            "certs": [
                {"name": "Certified Kubernetes Administrator (CKA)", "org": "CNCF", "issue": "2024-11-01", "expiry": "2027-11-01", "cred_id": "CKA-9942"}
            ]
        },
        {
            "employee_id": "EMP005",
            "name": "Employee E",
            "email": "emp.e@company.com",
            "department": "Engineering",
            "designation": "Full Stack Engineer",
            "total_experience_years": 3.5,
            "status": "Active",
            "current_project": "Internal HR Portal",
            "assignment_start_date": "2026-03-01",
            "assignment_end_date": "2026-07-31",
            "available_from": "2026-08-01",
            "allocation_percentage": 100,
            "performance_rating": 4.1,
            "performance_review_period": "2025-Q4",
            "performance_notes": "Reliable full-stack developer with strong team spirit.",
            "skills": [
                ("Python", "Intermediate", 3.0, "Resume"),
                ("React", "Intermediate", 2.5, "Resume"),
                ("Node.js", "Intermediate", 2.0, "Resume"),
                ("PostgreSQL", "Intermediate", 2.5, "Resume"),
            ],
            "projects": [
                {"title": "Employee Self-Service App", "role": "Full Stack Developer", "start_date": "2024-05-01", "end_date": "2025-04-30", "technologies": ["React", "Node.js", "PostgreSQL"], "domain": "Enterprise Software"}
            ],
            "certs": []
        },
        {
            "employee_id": "EMP006",
            "name": "Employee F",
            "email": "emp.f@company.com",
            "department": "QA",
            "designation": "QA Automation Lead",
            "total_experience_years": 6.0,
            "status": "Active",
            "current_project": "Payment Gateway Test Automation",
            "assignment_start_date": "2026-02-01",
            "assignment_end_date": "2026-10-15",
            "available_from": "2026-10-16",
            "allocation_percentage": 100,
            "performance_rating": 4.6,
            "performance_review_period": "2025-Q4",
            "performance_notes": "High attention to detail and automated testing coverage.",
            "skills": [
                ("Python", "Advanced", 4.0, "Resume"),
                ("Selenium", "Expert", 5.0, "Manager Update"),
                ("Postman", "Advanced", 4.0, "Resume"),
                ("CI/CD", "Intermediate", 3.0, "Resume"),
            ],
            "projects": [
                {"title": "Enterprise E-Commerce QA Automation", "role": "QA Lead", "start_date": "2023-09-01", "end_date": "2025-01-31", "technologies": ["Python", "Selenium", "Postman"], "domain": "Quality Assurance"}
            ],
            "certs": [
                {"name": "ISTQB Certified Tester", "org": "ISTQB", "issue": "2023-06-15", "expiry": "", "cred_id": "ISTQB-8812"}
            ]
        },
        {
            "employee_id": "EMP007",
            "name": "Employee G",
            "email": "emp.g@company.com",
            "department": "Engineering",
            "designation": "Backend Engineer",
            "total_experience_years": 2.5,
            "status": "Active",
            "current_project": "Log Analytics Pipeline",
            "assignment_start_date": "2026-05-15",
            "assignment_end_date": "2026-09-15",
            "available_from": "2026-09-16",
            "allocation_percentage": 100,
            "performance_rating": 3.9,
            "performance_review_period": "2025-Q4",
            "performance_notes": "Fast learner progressing quickly in Go and microservices.",
            "skills": [
                ("Go", "Intermediate", 2.0, "Resume"),
                ("Python", "Intermediate", 2.0, "Resume"),
                ("Docker", "Beginner", 1.0, "Resume"),
                ("Redis", "Intermediate", 1.5, "Resume"),
            ],
            "projects": [
                {"title": "Real-time Metrics Aggregator", "role": "Backend Engineer", "start_date": "2024-10-01", "end_date": "2025-04-30", "technologies": ["Go", "Redis", "Docker"], "domain": "Data Engineering"}
            ],
            "certs": []
        },
        {
            "employee_id": "EMP008",
            "name": "Employee H",
            "email": "emp.h@company.com",
            "department": "Cloud & DevOps",
            "designation": "Cloud Architect",
            "total_experience_years": 7.0,
            "status": "Active",
            "current_project": "Enterprise Multi-Region AWS Migration",
            "assignment_start_date": "2026-01-01",
            "assignment_end_date": "2026-11-01",
            "available_from": "2026-11-02",
            "allocation_percentage": 100,
            "performance_rating": 4.9,
            "performance_review_period": "2025-Q4",
            "performance_notes": "Tier-1 Cloud Architect with top-grade technical leadership.",
            "skills": [
                ("AWS", "Expert", 6.0, "Certification"),
                ("Azure", "Advanced", 4.0, "Certification"),
                ("Kubernetes", "Expert", 5.0, "Manager Update"),
                ("Python", "Advanced", 4.0, "Resume"),
            ],
            "projects": [
                {"title": "Bank Core Infrastructure Modernization", "role": "Principal Cloud Architect", "start_date": "2023-01-01", "end_date": "2024-12-31", "technologies": ["AWS", "Azure", "Kubernetes"], "domain": "Banking"}
            ],
            "certs": [
                {"name": "AWS Certified Solutions Architect – Professional", "org": "AWS", "issue": "2024-02-10", "expiry": "2027-02-10", "cred_id": "AWS-SAP-7711"}
            ]
        },
        {
            "employee_id": "EMP009",
            "name": "Employee I",
            "email": "emp.i@company.com",
            "department": "Engineering",
            "designation": "Database Engineer",
            "total_experience_years": 4.5,
            "status": "Inactive",
            "current_project": None,
            "assignment_start_date": None,
            "assignment_end_date": None,
            "available_from": "2026-01-01",
            "allocation_percentage": 0,
            "performance_rating": 4.0,
            "performance_review_period": "2025-Q4",
            "performance_notes": "Currently on extended sabbatical leave.",
            "skills": [
                ("PostgreSQL", "Expert", 4.5, "Resume"),
                ("MongoDB", "Advanced", 3.0, "Resume"),
                ("Redis", "Advanced", 3.0, "Resume"),
                ("Python", "Intermediate", 2.0, "Resume"),
            ],
            "projects": [
                {"title": "High-Throughput Financial DB Cluster", "role": "Database Administrator", "start_date": "2023-06-01", "end_date": "2024-12-31", "technologies": ["PostgreSQL", "Redis"], "domain": "Finance"}
            ],
            "certs": []
        },
        {
            "employee_id": "EMP010",
            "name": "Employee J",
            "email": "emp.j@company.com",
            "department": "AI/ML",
            "designation": "Data Scientist",
            "total_experience_years": 3.8,
            "status": "Active",
            "current_project": "Customer Churn Predictive Analytics",
            "assignment_start_date": "2026-03-15",
            "assignment_end_date": "2026-08-31",
            "available_from": "2026-09-01",
            "allocation_percentage": 100,
            "performance_rating": 4.3,
            "performance_review_period": "2025-Q4",
            "performance_notes": "Excellent statistical modeling and data storytelling skills.",
            "skills": [
                ("Python", "Advanced", 3.5, "Resume"),
                ("Scikit-Learn", "Advanced", 3.0, "Resume"),
                ("SQL", "Advanced", 3.5, "Resume"),
                ("PyTorch", "Intermediate", 2.0, "Resume"),
            ],
            "projects": [
                {"title": "Retail Demand Forecasting Model", "role": "Data Scientist", "start_date": "2024-04-01", "end_date": "2025-03-31", "technologies": ["Python", "Scikit-Learn", "SQL"], "domain": "Retail Analytics"}
            ],
            "certs": [
                {"name": "Microsoft Certified: Azure Data Scientist Associate", "org": "Microsoft", "issue": "2024-08-15", "expiry": "2026-08-15", "cred_id": "MS-DS-010"}
            ]
        }
    ]

    try:
        from backend.parsers.skill_normalizer import normalize_skill_name
        for data in sample_workforce:
            emp = Candidate(
                employee_id=data["employee_id"],
                name=data["name"],
                email=data["email"],
                department=data["department"],
                designation=data["designation"],
                total_experience_years=data["total_experience_years"],
                status=data["status"],
                current_project=data["current_project"],
                assignment_start_date=data["assignment_start_date"],
                assignment_end_date=data["assignment_end_date"],
                available_from=data["available_from"],
                allocation_percentage=data["allocation_percentage"],
                performance_rating=data["performance_rating"],
                performance_review_period=data["performance_review_period"],
                performance_notes=data["performance_notes"],
                skills=[sk[0] for sk in data["skills"]]
            )
            db.add(emp)
            db.flush()

            for sk_tuple in data["skills"]:
                sk_name, prof, exp_yrs, src = sk_tuple
                norm = normalize_skill_name(sk_name)
                db_sk = EmployeeSkill(
                    candidate_id=emp.id,
                    skill_name=sk_name,
                    normalized_skill_name=norm,
                    proficiency_level=prof,
                    experience_years=exp_yrs,
                    source=src
                )
                db.add(db_sk)

            for p in data["projects"]:
                db_p = Project(
                    candidate_id=emp.id,
                    title=p["title"],
                    role=p["role"],
                    start_date=p["start_date"],
                    end_date=p["end_date"],
                    technologies=p["technologies"],
                    domain=p["domain"]
                )
                db.add(db_p)

            for c in data["certs"]:
                db_c = Certification(
                    candidate_id=emp.id,
                    name=c["name"],
                    issuing_organization=c["org"],
                    issue_date=c["issue"],
                    expiry_date=c["expiry"],
                    credential_id=c["cred_id"]
                )
                db.add(db_c)

        db.commit()
        print(f"Successfully seeded {len(sample_workforce)} sample employee records into Employee Master Data.")
    except Exception as e:
        db.rollback()
        print(f"Notice: Failed to seed sample employee records: {e}")


def seed_skill_taxonomy(db):
    """Seed 35+ canonical skills across 8 standard categories if Skill Taxonomy is empty."""
    existing_count = db.query(Skill).count()
    if existing_count > 0:
        return

    sample_taxonomy = [
        # Programming Languages
        {"name": "Python", "normalized_name": "Python", "category": "Programming Languages", "description": "High-level interpreted programming language for backend, AI, and data engineering.", "aliases": ["Python", "python", "py", "Python Programming", "Python Development"]},
        {"name": "Java", "normalized_name": "Java", "category": "Programming Languages", "description": "Class-based object-oriented programming language for enterprise software.", "aliases": ["Java", "java", "Java Programming"]},
        {"name": "JavaScript", "normalized_name": "JavaScript", "category": "Programming Languages", "description": "High-level language for modern web development.", "aliases": ["JavaScript", "javascript", "js", "JS"]},
        {"name": "TypeScript", "normalized_name": "TypeScript", "category": "Programming Languages", "description": "Strongly typed programming language that builds on JavaScript.", "aliases": ["TypeScript", "typescript", "ts", "TS"]},
        {"name": "Go", "normalized_name": "Go", "category": "Programming Languages", "description": "Statically typed, compiled language designed at Google for system services.", "aliases": ["Go", "go", "golang", "Go Lang", "Go Programming"]},
        {"name": "C++", "normalized_name": "C++", "category": "Programming Languages", "description": "General-purpose programming language created as an extension of C.", "aliases": ["C++", "c++", "cpp", "CPP"]},
        {"name": "C#", "normalized_name": "C#", "category": "Programming Languages", "description": "Modern object-oriented language developed by Microsoft.", "aliases": ["C#", "c#", "c sharp", "C Sharp"]},

        # Frontend
        {"name": "React", "normalized_name": "React", "category": "Frontend", "description": "Free and open-source front-end JavaScript library for building user interfaces.", "aliases": ["React", "react", "React.js", "ReactJS", "React JS"]},
        {"name": "Angular", "normalized_name": "Angular", "category": "Frontend", "description": "TypeScript-based open-source web application framework led by Google.", "aliases": ["Angular", "angular", "Angular.js", "AngularJS"]},
        {"name": "Vue.js", "normalized_name": "Vue.js", "category": "Frontend", "description": "Progressive JavaScript framework for building user interfaces.", "aliases": ["Vue.js", "Vue", "vue", "VueJS", "Vue JS"]},
        {"name": "Next.js", "normalized_name": "Next.js", "category": "Frontend", "description": "React framework for full-stack web applications with server rendering.", "aliases": ["Next.js", "Next", "nextjs", "Next JS"]},
        {"name": "HTML/CSS", "normalized_name": "HTML/CSS", "category": "Frontend", "description": "Core markup and styling languages of the World Wide Web.", "aliases": ["HTML/CSS", "HTML", "CSS", "HTML5", "CSS3"]},

        # Backend
        {"name": "FastAPI", "normalized_name": "FastAPI", "category": "Backend", "description": "Modern, fast web framework for building APIs with Python based on standard Python type hints.", "aliases": ["FastAPI", "fastapi", "Fast API"]},
        {"name": "Django", "normalized_name": "Django", "category": "Backend", "description": "High-level Python web framework that encourages rapid development.", "aliases": ["Django", "django", "Django Framework"]},
        {"name": "Flask", "normalized_name": "Flask", "category": "Backend", "description": "Micro web framework written in Python.", "aliases": ["Flask", "flask"]},
        {"name": "Node.js", "normalized_name": "Node.js", "category": "Backend", "description": "Open-source, cross-platform JavaScript runtime environment.", "aliases": ["Node.js", "nodejs", "Node", "Node JS"]},
        {"name": "Spring Boot", "normalized_name": "Spring Boot", "category": "Backend", "description": "Java-based framework used to create microservices and web applications.", "aliases": ["Spring Boot", "Spring", "springboot", "Spring Framework"]},

        # Database
        {"name": "PostgreSQL", "normalized_name": "PostgreSQL", "category": "Database", "description": "Free and open-source relational database management system.", "aliases": ["PostgreSQL", "postgres", "Postgres", "Postgre SQL"]},
        {"name": "MySQL", "normalized_name": "MySQL", "category": "Database", "description": "Open-source relational database management system.", "aliases": ["MySQL", "mysql", "My SQL"]},
        {"name": "MongoDB", "normalized_name": "MongoDB", "category": "Database", "description": "Source-available cross-platform document-oriented database program.", "aliases": ["MongoDB", "mongodb", "Mongo DB", "Mongo"]},
        {"name": "Redis", "normalized_name": "Redis", "category": "Database", "description": "In-memory data structure store used as a database, cache, and message broker.", "aliases": ["Redis", "redis"]},

        # Cloud
        {"name": "AWS", "normalized_name": "AWS", "category": "Cloud", "description": "Amazon Web Services cloud computing platform.", "aliases": ["AWS", "Amazon Web Services", "Amazon Web Service", "AWS Cloud"]},
        {"name": "Azure", "normalized_name": "Azure", "category": "Cloud", "description": "Microsoft Azure cloud computing service.", "aliases": ["Azure", "Microsoft Azure", "Azure Cloud"]},
        {"name": "GCP", "normalized_name": "GCP", "category": "Cloud", "description": "Google Cloud Platform suite of cloud computing services.", "aliases": ["GCP", "Google Cloud Platform", "Google Cloud"]},

        # DevOps
        {"name": "Docker", "normalized_name": "Docker", "category": "DevOps", "description": "Platform for developing, shipping, and running applications in containers.", "aliases": ["Docker", "docker", "Docker Container", "Docker Containers"]},
        {"name": "Kubernetes", "normalized_name": "Kubernetes", "category": "DevOps", "description": "Open-source container orchestration system.", "aliases": ["Kubernetes", "kubernetes", "k8s", "K8s"]},
        {"name": "CI/CD", "normalized_name": "CI/CD", "category": "DevOps", "description": "Continuous Integration and Continuous Deployment pipeline automation.", "aliases": ["CI/CD", "ci/cd", "CICD", "Continuous Integration"]},
        {"name": "Git", "normalized_name": "Git", "category": "DevOps", "description": "Distributed version control system.", "aliases": ["Git", "git", "GitHub", "GitLab"]},

        # AI & ML
        {"name": "Machine Learning", "normalized_name": "Machine Learning", "category": "Machine Learning", "description": "Field of study devoted to understanding and building methods that learn.", "aliases": ["Machine Learning", "ML", "machine learning"]},
        {"name": "Deep Learning", "normalized_name": "Deep Learning", "category": "Artificial Intelligence", "description": "Subset of machine learning based on artificial neural networks.", "aliases": ["Deep Learning", "deep learning", "Neural Networks"]},
        {"name": "TensorFlow", "normalized_name": "TensorFlow", "category": "Machine Learning", "description": "Open-source library for machine learning and artificial intelligence.", "aliases": ["TensorFlow", "tensorflow", "TF"]},
        {"name": "PyTorch", "normalized_name": "PyTorch", "category": "Machine Learning", "description": "Open-source machine learning framework based on Torch.", "aliases": ["PyTorch", "pytorch"]},
        {"name": "Scikit-Learn", "normalized_name": "Scikit-Learn", "category": "Machine Learning", "description": "Free software machine learning library for the Python programming language.", "aliases": ["Scikit-Learn", "scikit-learn", "sklearn", "Sklearn"]},

        # Testing & Tools
        {"name": "Selenium", "normalized_name": "Selenium", "category": "Testing", "description": "Open-source umbrella project for browser automation.", "aliases": ["Selenium", "selenium"]},
        {"name": "Postman", "normalized_name": "Postman", "category": "Tools", "description": "API platform for building and using APIs.", "aliases": ["Postman", "postman"]},
        {"name": "Cybersecurity", "normalized_name": "Cybersecurity", "category": "Security", "description": "Practice of protecting systems, networks, and programs from digital attacks.", "aliases": ["Cybersecurity", "security", "Information Security"]}
    ]

    try:
        for item in sample_taxonomy:
            sk = Skill(
                name=item["name"],
                normalized_name=item["normalized_name"],
                category=item["category"],
                description=item["description"],
                aliases=item["aliases"],
                status="Active"
            )
            db.add(sk)
        db.commit()
        print(f"Successfully seeded {len(sample_taxonomy)} canonical skills into Skill Taxonomy.")
    except Exception as e:
        db.rollback()
        print(f"Notice: Failed to seed skill taxonomy: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs on server startup:
    1. Seeds a default recruiter account if the database is empty.
    2. Seeds 35+ canonical skills in Skill Taxonomy if empty.
    3. Seeds 10 sample employees if Employee Master Data is empty.
    4. Syncs/rebuilds the FAISS/NumPy in-memory vector search index.
    """
    # 1. Initialize Database tables & sync dynamic columns
    try:
        Base.metadata.create_all(bind=engine)
        sync_db_columns()
    except Exception as e:
        print(f"Notice during database tables/columns initialization: {e}")

    db = SessionLocal()
    try:
        # Seed default admin / PM recruiter users if none exists
        for admin_email in ["admin@talent_iq.ai", "admin@gmail.com", "pm@talent_iq.ai", "pm@gmail.com"]:
            existing_admin = db.query(User).filter(User.email == admin_email).first()
            if not existing_admin:
                hashed_pw = get_password_hash("password123")
                admin_user = User(email=admin_email, hashed_password=hashed_pw)
                db.add(admin_user)
                db.commit()
                print(f"Seeded default user: {admin_email} (password: password123)")

        # Seed Skill Taxonomy (35+ canonical skills)
        seed_skill_taxonomy(db)

        # Seed sample employees (EMP001 - EMP010)
        seed_sample_employees(db)

        # Ensure all existing JobDescriptions have valid start and end dates configured
        jds_without_dates = db.query(JobDescription).filter(
            (JobDescription.start_date.is_(None)) | (JobDescription.end_date.is_(None))
        ).all()
        for jd in jds_without_dates:
            if not jd.start_date:
                jd.start_date = "2026-06-01"
            if not jd.end_date:
                jd.end_date = "2026-12-31"
            if not jd.duration_text:
                jd.duration_text = "7 months"
        if jds_without_dates:
            db.commit()

        # Sync/build semantic vector search index
        embeddings_list = db.query(CandidateEmbedding).all()
        if embeddings_list:
            print("Synchronizing semantic vector index from database...")
            candidates_data = [
                {"candidate_id": item.candidate_id, "embedding": item.embedding}
                for item in embeddings_list
            ]
            vector_store_manager.build_index(candidates_data)
            print("Semantic vector index synchronized successfully.")
        else:
            print("Database candidate embeddings empty; preserving local index vectors.")
        
    except Exception as e:
        print(f"Error during server startup: {e}")
    finally:
        db.close()
    
    yield


app = FastAPI(
    title="TalentIQ Workforce Matching & Staffing API",
    description="Enterprise-grade AI-powered workforce platform backend.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth.router)
app.include_router(job_desc.router)
app.include_router(resume.router)
app.include_router(candidate.router)
app.include_router(employee.router)
app.include_router(skills.router)
app.include_router(availability.router)
app.include_router(matching.router)
app.include_router(ranking.router)
app.include_router(shortlist.router)
app.include_router(dashboard.router)
app.include_router(analytics.router)
app.include_router(reports.router)
app.include_router(challenge.router)
app.include_router(ai.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": "AI Hiring Committee API",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
