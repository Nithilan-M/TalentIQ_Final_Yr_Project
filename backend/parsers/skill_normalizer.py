import re
from typing import Dict, Any

# Dictionary of standard skill mappings
SKILL_MAPPINGS = {
    # Languages
    "python programming": "Python",
    "python development": "Python",
    "python": "Python",
    "py": "Python",
    "javascript": "JavaScript",
    "js": "JavaScript",
    "typescript": "TypeScript",
    "ts": "TypeScript",
    "golang": "Go",
    "go lang": "Go",
    "go programming": "Go",
    "c++": "C++",
    "cpp": "C++",
    "c#": "C#",
    "c sharp": "C#",
    "java programming": "Java",
    "java": "Java",

    # Cloud & DevOps
    "amazon web services": "AWS",
    "amazon web service": "AWS",
    "aws cloud": "AWS",
    "aws": "AWS",
    "google cloud platform": "GCP",
    "google cloud": "GCP",
    "gcp": "GCP",
    "microsoft azure": "Azure",
    "azure cloud": "Azure",
    "azure": "Azure",
    "docker container": "Docker",
    "docker containers": "Docker",
    "docker": "Docker",
    "kubernetes": "Kubernetes",
    "k8s": "Kubernetes",

    # Frontend / Backend
    "react.js": "React",
    "reactjs": "React",
    "react js": "React",
    "react": "React",
    "node.js": "Node.js",
    "nodejs": "Node.js",
    "node js": "Node.js",
    "vue.js": "Vue.js",
    "vuejs": "Vue.js",
    "angular.js": "Angular",
    "angularjs": "Angular",
    "fastapi": "FastAPI",
    "fast api": "FastAPI",
    "django framework": "Django",
    "django": "Django",
    "flask": "Flask",
    "next.js": "Next.js",
    "nextjs": "Next.js",

    # Databases & AI
    "postgresql": "PostgreSQL",
    "postgres": "PostgreSQL",
    "mongodb": "MongoDB",
    "mongo db": "MongoDB",
    "redis": "Redis",
    "faiss": "FAISS",
    "scikit-learn": "Scikit-Learn",
    "sklearn": "Scikit-Learn",
    "tensorflow": "TensorFlow",
    "pytorch": "PyTorch",
    "xgboost": "XGBoost",
    "lightgbm": "LightGBM"
}

def normalize_skill_name(raw_name: str) -> str:
    """Normalize a single skill string into a standardized name."""
    if not raw_name or not isinstance(raw_name, str):
        return ""
    
    cleaned = raw_name.strip()
    key = cleaned.lower()

    # Check exact dictionary match first
    if key in SKILL_MAPPINGS:
        return SKILL_MAPPINGS[key]

    # Regex cleanup for common suffixes
    key_no_suffix = re.sub(r'\s+(programming|development|developer|framework|library|lib|sdk|tool|tools)$', '', key, flags=re.IGNORECASE)
    if key_no_suffix in SKILL_MAPPINGS:
        return SKILL_MAPPINGS[key_no_suffix]

    # Default fallback: title case or uppercase if short acronym
    if len(cleaned) <= 4:
        return cleaned.upper()
    return cleaned.title()

def normalize_skill(raw_skill: Any) -> Dict[str, Any]:
    """
    Accepts either a string skill or a dict, and returns a dictionary with:
    { "skill_name": str, "original_name": str, "normalized_name": str, "normalized_skill_name": str }
    """
    if isinstance(raw_skill, dict):
        orig = raw_skill.get("skill_name") or raw_skill.get("original_name") or ""
        norm = normalize_skill_name(orig)
        res = dict(raw_skill)
        res["skill_name"] = orig
        res["original_name"] = orig
        res["normalized_name"] = norm
        res["normalized_skill_name"] = norm
        return res
    elif isinstance(raw_skill, str):
        norm = normalize_skill_name(raw_skill)
        return {
            "skill_name": raw_skill,
            "original_name": raw_skill,
            "normalized_name": norm,
            "normalized_skill_name": norm
        }
    orig_str = str(raw_skill)
    norm = normalize_skill_name(orig_str)
    return {
        "skill_name": orig_str,
        "original_name": orig_str,
        "normalized_name": norm,
        "normalized_skill_name": norm
    }
