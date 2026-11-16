import os
import sys

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

os.environ['DATABASE_URL'] = ''
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'

from backend.database.connection import SessionLocal
from backend.database.models import Candidate, JobDescription, ProjectSkillRequirement, EmployeeSkill
from backend.services.shortlist_service import generate_project_shortlist
from backend.embeddings.vector_store import vector_store_manager
from scripts.metrics import calculate_team_coverage
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import faiss

db = SessionLocal()
candidates = db.query(Candidate).all()
cand_map = {c.id: c for c in candidates}

# Build skill map per candidate: {normalized_name: proficiency_value}
cand_skills_map = {}
for c in candidates:
    emp_skills = db.query(EmployeeSkill).filter(EmployeeSkill.candidate_id == c.id).all()
    skills_dict = {}
    for es in emp_skills:
        name = (es.normalized_skill_name or es.skill_name or '').lower()
        val = es.proficiency_value or 2
        skills_dict[name] = max(skills_dict.get(name, 0), val)
    cand_skills_map[c.id] = skills_dict

cand_texts = [
    f"Title: {c.designation or ''}. Skills: {', '.join(c.skills or [])}. Summary: {c.technical_summary or ''}."
    for c in candidates
]

tfidf = TfidfVectorizer().fit(cand_texts)
cand_tfidf = tfidf.transform(cand_texts)

vector_store_manager._ensure_model()
cand_embs = np.array(vector_store_manager.get_embeddings(cand_texts), dtype=np.float32)
faiss.normalize_L2(cand_embs)
index = faiss.IndexFlatIP(cand_embs.shape[1])
index.add(cand_embs)

coverage_results = {}

for pid in [1, 2, 6, 7, 8]:
    jd = db.query(JobDescription).filter(JobDescription.id == pid).first()
    team_size = jd.required_team_size or 1
    shortlist_size = team_size * 2
    
    reqs_db = db.query(ProjectSkillRequirement).filter(ProjectSkillRequirement.job_description_id == pid).all()
    reqs = [
        {
            'skill_name': r.original_name,
            'normalized_name': r.normalized_name,
            'priority': r.priority,
            'required_level_value': r.required_level_value or 2
        }
        for r in reqs_db
    ]
    
    jd_query = f"Role: {jd.title}. Skills: {', '.join(jd.skills_required or [])}."
    
    # M1
    sims1 = cosine_similarity(tfidf.transform([jd_query]), cand_tfidf)[0]
    top_m1_cids = [candidates[i].id for i in np.argsort(-sims1)[:shortlist_size]]
    cov_m1 = calculate_team_coverage(reqs, [cand_skills_map[cid] for cid in top_m1_cids]) if reqs else 100.0
    
    # M2
    q_emb = np.array([vector_store_manager.get_embedding(jd_query)], dtype=np.float32)
    faiss.normalize_L2(q_emb)
    _, top_m2_idx = index.search(q_emb, shortlist_size)
    top_m2_cids = [candidates[i].id for i in top_m2_idx[0]]
    cov_m2 = calculate_team_coverage(reqs, [cand_skills_map[cid] for cid in top_m2_cids]) if reqs else 100.0
    
    # M3
    res_m3 = generate_project_shortlist(db, pid)
    top_m3_cids = [emp['id'] for emp in res_m3.get('shortlisted_employees', [])]
    cov_m3 = calculate_team_coverage(reqs, [cand_skills_map[cid] for cid in top_m3_cids]) if reqs else 100.0
    
    coverage_results[pid] = {
        "req_count": len(reqs),
        "cov_m1": cov_m1,
        "cov_m2": cov_m2,
        "cov_m3": cov_m3
    }
    print(f"Project {pid} ('{jd.title}', team_size={team_size}, reqs={len(reqs)}): M1 Cov = {cov_m1:.1f}%, M2 Cov = {cov_m2:.1f}%, M3 Cov = {cov_m3:.1f}%")

avg_m1 = np.mean([v["cov_m1"] for v in coverage_results.values()])
avg_m2 = np.mean([v["cov_m2"] for v in coverage_results.values()])
avg_m3 = np.mean([v["cov_m3"] for v in coverage_results.values()])
print(f"Mean Team Coverage across test projects: M1 = {avg_m1:.1f}%, M2 = {avg_m2:.1f}%, M3 = {avg_m3:.1f}%")

db.close()
