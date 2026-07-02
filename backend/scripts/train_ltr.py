import os
import sys
import json
import pandas as pd
import numpy as np

# Add project root to sys.path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.parsers.jd_loader import jd_loader
from backend.retrieval.retriever import candidate_retriever
from backend.faiss.index_manager import candidate_index_manager
from backend.feature_engineering.feature_calculator import CandidateFeatureCalculator
from backend.learning_to_rank.ltr_model import LearningToRankModel
from backend.risk_engine.trap_detector import TrapDetector

async def train_and_save_ltr_model():
    print("Initializing components for training...")
    
    # 1. Load job description criteria
    jd_data = await jd_loader.get_structured_jd()
    print(f"Loaded job description: {jd_data.get('title')}")

    # 2. Ensure candidates are loaded into memory cache
    from backend.offline_pipeline.pipeline_runner import JSONL_PATH
    if not candidate_retriever.candidates_cache:
        candidate_retriever.load_candidates_to_cache(JSONL_PATH)

    # 3. Ensure FAISS/vector index is loaded
    candidate_index_manager.load_index()

    # 4. Retrieve candidates (top 3000 to construct a robust dataset)
    print("Retrieving candidates for LTR training...")
    retrieved_candidates = candidate_retriever.retrieve_top_candidates(jd_data, top_k=3000)
    print(f"Retrieved {len(retrieved_candidates)} candidates.")

    if not retrieved_candidates:
        print("No candidates retrieved. Aborting training.")
        return

    # 5. Compute features and synthesize target relevance label (0-4)
    calculator = CandidateFeatureCalculator(jd_data)
    features_list = []
    labels = []

    print("Computing features and generating training labels...")
    for cand, emb_sim in retrieved_candidates:
        # Calculate features
        feats = calculator.compute_all_features(cand, emb_sim)
        
        # Detect risk profile
        risk_analysis = TrapDetector.detect_traps(cand)
        risk_score = risk_analysis.get("risk_score", 0.0)
        is_trap = risk_analysis.get("is_trap", False)

        # Map to 0-4 relevance grade based on high-quality heuristic target rules:
        skills_score = feats.get("skill_match_score", 50.0)
        exp_score = feats.get("experience_score", 50.0)
        beh_score = feats.get("behavioral_score", 50.0)
        
        if is_trap or skills_score < 20:
            relevance = 0  # Not relevant / Trap
        elif skills_score < 40 or risk_score > 50:
            relevance = 1  # Poor match
        elif skills_score >= 75 and exp_score >= 70 and risk_score < 20 and emb_sim >= 0.55:
            relevance = 4  # Perfect match
        elif skills_score >= 55 and exp_score >= 50 and risk_score < 35:
            relevance = 3  # Good match
        else:
            relevance = 2  # Average match
            
        features_list.append(feats)
        labels.append(relevance)

    # Convert to DataFrame
    df = pd.DataFrame(features_list)
    y = pd.Series(labels)

    # Filter to match model's expected feature names exactly
    model = LearningToRankModel()
    feature_names = model.feature_names
    X = df[feature_names]

    print(f"Dataset shape: {X.shape}")
    print(f"Target label distribution:\n{y.value_counts()}")

    # 6. Train the LTR model
    model.train(X, y)
    print("LTR model training sequence complete.")

if __name__ == "__main__":
    import asyncio
    asyncio.run(train_and_save_ltr_model())
