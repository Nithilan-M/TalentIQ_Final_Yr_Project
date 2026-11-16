import os
import sys
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import numpy as np
from datetime import date
os.environ['DATABASE_URL'] = ''
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'

from backend.database.connection import SessionLocal
from backend.database.models import Candidate, JobDescription
from backend.services.availability_service import evaluate_employee_availability, parse_iso_date
from backend.services.shortlist_service import generate_project_shortlist
from backend.embeddings.vector_store import vector_store_manager
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import faiss

db = SessionLocal()
candidates = db.query(Candidate).all()
cand_texts = [
    f"Title: {c.designation or ''}. Skills: {', '.join(c.skills or [])}. Summary: {c.technical_summary or ''}."
    for c in candidates
]

# Precompute TF-IDF and BGE embeddings
tfidf = TfidfVectorizer().fit(cand_texts)
cand_tfidf = tfidf.transform(cand_texts)

vector_store_manager._ensure_model()
cand_embs = np.array(vector_store_manager.get_embeddings(cand_texts), dtype=np.float32)
faiss.normalize_L2(cand_embs)
index = faiss.IndexFlatIP(cand_embs.shape[1])
index.add(cand_embs)

results = {}

for pid in [1, 2]:
    jd = db.query(JobDescription).filter(JobDescription.id == pid).first()
    p_start = parse_iso_date(jd.start_date) or date(2026, 6, 1)
    p_end = parse_iso_date(jd.end_date) or date(2026, 12, 31)
    team_size = jd.required_team_size or 1
    shortlist_size = team_size * 2 # 2 candidates
    
    jd_query = f"Role: {jd.title}. Skills: {', '.join(jd.skills_required or [])}."
    
    # M1: TF-IDF top shortlist_size WITHOUT availability filtering
    q_vec = tfidf.transform([jd_query])
    sims1 = cosine_similarity(q_vec, cand_tfidf)[0]
    top_m1_idx = np.argsort(-sims1)[:shortlist_size]
    m1_viols = sum(
        1 for idx in top_m1_idx 
        if evaluate_employee_availability(candidates[idx], p_start, p_end)['availability_status'] == 'Unavailable'
    )
    m1_viol_pct = (m1_viols / shortlist_size) * 100.0

    # M2: BGE-Small + FAISS top shortlist_size WITHOUT availability filtering
    q_emb = np.array([vector_store_manager.get_embedding(jd_query)], dtype=np.float32)
    faiss.normalize_L2(q_emb)
    _, top_m2_idx = index.search(q_emb, shortlist_size)
    m2_viols = sum(
        1 for idx in top_m2_idx[0]
        if evaluate_employee_availability(candidates[idx], p_start, p_end)['availability_status'] == 'Unavailable'
    )
    m2_viol_pct = (m2_viols / shortlist_size) * 100.0

    # M3: TalentIQ WITH availability filtering
    res_m3 = generate_project_shortlist(db, pid)
    shortlisted_m3 = res_m3.get('shortlisted_employees', [])
    m3_viols = sum(
        1 for emp in shortlisted_m3
        if emp.get('availability_status') != 'Available'
    )
    m3_viol_pct = (m3_viols / len(shortlisted_m3)) * 100.0 if shortlisted_m3 else 0.0

    results[pid] = {
        "m1_viol": m1_viol_pct,
        "m2_viol": m2_viol_pct,
        "m3_viol": m3_viol_pct
    }
    print(f"Project {pid}: M1 Violations = {m1_viol_pct}%, M2 Violations = {m2_viol_pct}%, M3 Violations = {m3_viol_pct}%")

db.close()
