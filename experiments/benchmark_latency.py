"""
TalentIQ Latency Benchmark
Measures:
1. M1: TF-IDF (scikit-learn) query encoding + cosine similarity ranked retrieval.
2. M2: BGE-Small (BAAI/bge-small-en-v1.5) query encoding + FAISS IndexFlatIP search.
3. M3: TalentIQ full pipeline (project input -> availability filtering -> 6-dim matching -> ranking -> 2x shortlist).
Protocol: 5 warmup runs, followed by 30 measured runs. Reports mean and std.
"""

import os
import sys
import time
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import faiss

# Ensure project root is in sys.path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Force SQLite local database for offline reproducible latency
os.environ["DATABASE_URL"] = ""
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

from backend.database.connection import SessionLocal
from backend.database.models import Candidate, JobDescription
from backend.embeddings.vector_store import vector_store_manager
from backend.services.shortlist_service import generate_project_shortlist

def run_latency_benchmark():
    db = SessionLocal()
    
    # Fetch candidates and project 1 text
    candidates = db.query(Candidate).all()
    jd = db.query(JobDescription).filter(JobDescription.id == 1).first()
    
    cand_texts = [
        f"Title: {c.designation or 'Engineer'}. Dept: {c.department or 'Tech'}. Skills: {', '.join(c.skills or [])}. Summary: {c.technical_summary or ''}."
        for c in candidates
    ]
    
    jd_query = f"Role: {jd.title}. Skills required: {', '.join(jd.skills_required or [])}. Description: {jd.description or jd.raw_text or ''}."
    
    print(f"Loaded {len(cand_texts)} candidate texts for benchmarking.")
    print(f"Benchmarking on Project ID 1: {jd.title}")

    # ─────────────────────────────────────────────────────────────
    # Method 1: TF-IDF + Cosine Similarity
    # ─────────────────────────────────────────────────────────────
    tfidf = TfidfVectorizer().fit(cand_texts)
    cand_tfidf_matrix = tfidf.transform(cand_texts)

    def run_m1():
        q_vec = tfidf.transform([jd_query])
        sims = cosine_similarity(q_vec, cand_tfidf_matrix)[0]
        ranked_indices = np.argsort(-sims)
        return ranked_indices

    # Warmup 5 runs
    for _ in range(5):
        run_m1()

    m1_times = []
    for _ in range(30):
        t0 = time.perf_counter()
        run_m1()
        t1 = time.perf_counter()
        m1_times.append((t1 - t0) * 1000.0)

    m1_mean = np.mean(m1_times)
    m1_std = np.std(m1_times)
    print(f"M1 (TF-IDF Retrieval): Mean = {m1_mean:.3f} ms, Std = {m1_std:.3f} ms")

    # ─────────────────────────────────────────────────────────────
    # Method 2: BGE-Small + FAISS IndexFlatIP
    # ─────────────────────────────────────────────────────────────
    vector_store_manager._ensure_model()
    # Pre-encode candidate embeddings
    cand_embs = np.array(vector_store_manager.get_embeddings(cand_texts), dtype=np.float32)
    faiss.normalize_L2(cand_embs)
    index = faiss.IndexFlatIP(cand_embs.shape[1])
    index.add(cand_embs)

    def run_m2():
        q_emb = np.array([vector_store_manager.get_embedding(jd_query)], dtype=np.float32)
        faiss.normalize_L2(q_emb)
        scores, indices = index.search(q_emb, 10)
        return indices[0]

    # Warmup 5 runs
    for _ in range(5):
        run_m2()

    m2_times = []
    for _ in range(30):
        t0 = time.perf_counter()
        run_m2()
        t1 = time.perf_counter()
        m2_times.append((t1 - t0) * 1000.0)

    m2_mean = np.mean(m2_times)
    m2_std = np.std(m2_times)
    print(f"M2 (BGE-Small + FAISS Retrieval): Mean = {m2_mean:.3f} ms, Std = {m2_std:.3f} ms")

    # ─────────────────────────────────────────────────────────────
    # Method 3: TalentIQ Full Pipeline
    # ─────────────────────────────────────────────────────────────
    def run_m3():
        res = generate_project_shortlist(db, 1)
        return res

    # Warmup 5 runs
    for _ in range(5):
        run_m3()

    m3_times = []
    for _ in range(30):
        t0 = time.perf_counter()
        run_m3()
        t1 = time.perf_counter()
        m3_times.append((t1 - t0) * 1000.0)

    m3_mean = np.mean(m3_times)
    m3_std = np.std(m3_times)
    print(f"M3 (TalentIQ Full Pipeline): Mean = {m3_mean:.3f} ms, Std = {m3_std:.3f} ms")

    db.close()

    return {
        "m1_mean": round(float(m1_mean), 2),
        "m1_std": round(float(m1_std), 2),
        "m2_mean": round(float(m2_mean), 2),
        "m2_std": round(float(m2_std), 2),
        "m3_mean": round(float(m3_mean), 2),
        "m3_std": round(float(m3_std), 2),
    }

if __name__ == "__main__":
    import json
    results = run_latency_benchmark()
    with open("experiments/latency_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("Latency benchmark complete. Saved to experiments/latency_results.json.")
