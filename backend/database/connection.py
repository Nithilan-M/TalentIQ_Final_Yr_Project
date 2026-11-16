import os
import sys

# Ensure database.connection and backend.database.connection alias to the exact same module
if "database.connection" in sys.modules and "backend.database.connection" not in sys.modules:
    sys.modules["backend.database.connection"] = sys.modules["database.connection"]
elif "backend.database.connection" in sys.modules and "database.connection" not in sys.modules:
    sys.modules["database.connection"] = sys.modules["backend.database.connection"]

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Load env variables from backend/.env or cwd
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_env = os.path.join(backend_dir, ".env")
if os.path.exists(backend_env):
    load_dotenv(backend_env)
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
Base = declarative_base()

db_url = DATABASE_URL
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

engine = None

if db_url and ("postgresql" in db_url or "postgres" in db_url):
    try:
        temp_engine = create_engine(db_url, pool_pre_ping=True)
        # Verify connection
        with temp_engine.connect() as conn:
            pass
        engine = temp_engine
        print("Database connection: Supabase PostgreSQL")
    except Exception as exc:
        print(f"Notice: Supabase PostgreSQL unreachable ({exc}). Falling back to local SQLite database.")
        engine = None

if engine is None:
    # Use local talent_iq.db
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    root_dir = os.path.dirname(backend_dir)
    
    db_path = os.path.join(backend_dir, "talent_iq.db")
    if not os.path.exists(db_path) and os.path.exists(os.path.join(root_dir, "talent_iq.db")):
        db_path = os.path.join(root_dir, "talent_iq.db")
        
    db_url = f"sqlite:///{db_path}"
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    print(f"Database connection: Local SQLite ({db_path})")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# FastAPI dependency to yield database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

