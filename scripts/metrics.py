"""
TalentIQ Evaluation Metrics Suite
Computes information retrieval, workforce matching, and allocation metrics
for paper evaluations. Includes self-test unit verification.
"""

import math
from typing import List, Dict, Any, Optional

def precision_at_k(ranked_grades: List[int], k: int = 5, binary_threshold: int = 2) -> float:
    """
    Precision@K: Fraction of top-K retrieved items that are relevant (grade >= binary_threshold).
    """
    if k <= 0:
        return 0.0
    top_k = ranked_grades[:k]
    if not top_k:
        return 0.0
    relevant_count = sum(1 for g in top_k if g >= binary_threshold)
    return relevant_count / k

def recall_at_k(ranked_grades: List[int], all_grades_for_query: List[int], k: int = 10, binary_threshold: int = 2) -> float:
    """
    Recall@K: Fraction of all relevant items retrieved in top-K.
    """
    total_relevant = sum(1 for g in all_grades_for_query if g >= binary_threshold)
    if total_relevant == 0:
        return 0.0
    top_k = ranked_grades[:k]
    retrieved_relevant = sum(1 for g in top_k if g >= binary_threshold)
    return retrieved_relevant / total_relevant

def dcg_at_k(grades: List[int], k: int) -> float:
    """
    Discounted Cumulative Gain at K using exponential gain: 2^rel - 1 and discount log2(i + 1).
    """
    dcg = 0.0
    for i, rel in enumerate(grades[:k], start=1):
        gain = (2.0 ** rel) - 1.0
        discount = math.log2(i + 1.0)
        dcg += gain / discount
    return dcg

def ndcg_at_k(ranked_grades: List[int], all_grades_for_query: List[int], k: int) -> float:
    """
    Normalized Discounted Cumulative Gain at K.
    IDCG is computed from all candidate grades for this query sorted descending.
    """
    if k <= 0:
        return 0.0
    actual_dcg = dcg_at_k(ranked_grades, k)
    ideal_grades = sorted(all_grades_for_query, reverse=True)
    ideal_dcg = dcg_at_k(ideal_grades, k)
    if ideal_dcg == 0.0:
        return 0.0
    return actual_dcg / ideal_dcg

def mrr_at_k(ranked_grades: List[int], k: int = 10, binary_threshold: int = 2) -> float:
    """
    Mean Reciprocal Rank at K: Reciprocal of the rank of the first relevant item (grade >= threshold).
    If no relevant item is in top-K, returns 0.0.
    """
    for i, g in enumerate(ranked_grades[:k], start=1):
        if g >= binary_threshold:
            return 1.0 / i
    return 0.0

def calculate_skill_coverage(
    project_requirements: List[Dict[str, Any]], 
    candidate_skills: Dict[str, int]
) -> float:
    """
    Individual Skill Coverage (%) weighted by priority:
    Critical=1.5, Required=1.0, Preferred=0.7.
    A skill counts as covered if candidate's proficiency_value >= required_level_value.
    """
    if not project_requirements:
        return 100.0
    total_weight = 0.0
    covered_weight = 0.0
    for req in project_requirements:
        priority = (req.get("priority") or "Required").capitalize()
        weight = 1.5 if priority == "Critical" else (0.7 if priority == "Preferred" else 1.0)
        total_weight += weight
        
        req_name = req.get("normalized_name", req.get("skill_name", "")).lower()
        req_val = req.get("required_level_value", 2)
        
        cand_val = candidate_skills.get(req_name, 0)
        if cand_val >= req_val:
            covered_weight += weight
            
    return (covered_weight / total_weight) * 100.0 if total_weight > 0 else 100.0

def calculate_team_coverage(
    project_requirements: List[Dict[str, Any]], 
    team_candidate_skills: List[Dict[str, int]]
) -> float:
    """
    Team Coverage (%):
    Uses the MAX proficiency across all team members for each skill.
    Weighted by priority (Critical=1.5, Required=1.0, Preferred=0.7).
    A skill counts as covered if max_proficiency >= required_level_value.
    """
    if not project_requirements:
        return 100.0
    if not team_candidate_skills:
        return 0.0
        
    total_weight = 0.0
    covered_weight = 0.0
    for req in project_requirements:
        priority = (req.get("priority") or "Required").capitalize()
        weight = 1.5 if priority == "Critical" else (0.7 if priority == "Preferred" else 1.0)
        total_weight += weight
        
        req_name = req.get("normalized_name", req.get("skill_name", "")).lower()
        req_val = req.get("required_level_value", 2)
        
        max_team_val = max(
            [cand_skills.get(req_name, 0) for cand_skills in team_candidate_skills],
            default=0
        )
        if max_team_val >= req_val:
            covered_weight += weight
            
    return (covered_weight / total_weight) * 100.0 if total_weight > 0 else 100.0

def calculate_availability_violations(
    assignments: List[Dict[str, Any]]
) -> float:
    """
    Availability Violations (%):
    Share of final assignments where the candidate is unavailable at project start or double-booked.
    Each assignment dict must include: {"available": bool} or {"is_violation": bool}.
    """
    if not assignments:
        return 0.0
    violations = 0
    for a in assignments:
        is_viol = a.get("is_violation", False) or not a.get("available", True)
        if is_viol:
            violations += 1
    return (violations / len(assignments)) * 100.0

def run_self_test():
    """
    Executes unit test assertions on known ranking vectors to verify exact metric logic.
    """
    print("Running metrics.py self-test...")
    
    # Test 1: Precision@5 and Recall@10
    # True relevant items in pool: 4 (grades >= 2)
    pool = [3, 2, 2, 2, 1, 0, 0, 0, 0, 0]
    ranked = [3, 1, 2, 0, 0, 2, 2, 0, 0, 0]
    # top 5 of ranked: [3, 1, 2, 0, 0] -> relevant at indices 0, 2 (grades 3, 2). Count = 2.
    p5 = precision_at_k(ranked, k=5, binary_threshold=2)
    assert math.isclose(p5, 2.0 / 5.0), f"P@5 failed: expected 0.4, got {p5}"
    
    # top 10 of ranked has all 4 relevant items
    r10 = recall_at_k(ranked, pool, k=10, binary_threshold=2)
    assert math.isclose(r10, 4.0 / 4.0), f"R@10 failed: expected 1.0, got {r10}"
    
    # Test 2: MRR@10
    # First relevant item (>=2) is at rank 1 (grade 3)
    mrr = mrr_at_k(ranked, k=10, binary_threshold=2)
    assert math.isclose(mrr, 1.0), f"MRR failed: expected 1.0, got {mrr}"
    
    # If first relevant item is at rank 3
    ranked_late = [0, 1, 2, 3, 0]
    mrr_late = mrr_at_k(ranked_late, k=10, binary_threshold=2)
    assert math.isclose(mrr_late, 1.0 / 3.0), f"MRR failed: expected 1/3, got {mrr_late}"

    # Test 3: NDCG Calculation
    # Perfect ranking NDCG must be 1.0
    ideal_pool = [3, 2, 1, 0]
    perfect_ndcg = ndcg_at_k(ideal_pool, ideal_pool, k=4)
    assert math.isclose(perfect_ndcg, 1.0), f"Perfect NDCG failed: got {perfect_ndcg}"
    
    # Manual verification of NDCG@3
    # ranked: [2, 3, 0], ideal: [3, 2, 0]
    # DCG@3 = (2^2-1)/log2(2) + (2^3-1)/log2(3) + (2^0-1)/log2(4) = 3/1 + 7/1.5849625 + 0 = 3 + 4.416508 = 7.416508
    # IDCG@3 = (2^3-1)/log2(2) + (2^2-1)/log2(3) + 0 = 7/1 + 3/1.5849625 = 7 + 1.892789 = 8.892789
    # NDCG@3 = 7.416508 / 8.892789 ≈ 0.833989
    test_ranked = [2, 3, 0]
    test_ideal = [3, 2, 0]
    computed_ndcg = ndcg_at_k(test_ranked, test_ideal, k=3)
    expected_ndcg = (3.0 + 7.0 / math.log2(3)) / (7.0 + 3.0 / math.log2(3))
    assert math.isclose(computed_ndcg, expected_ndcg, rel_tol=1e-5), f"NDCG@3 failed: expected {expected_ndcg}, got {computed_ndcg}"

    # Test 4: Team Coverage
    reqs = [
        {"skill_name": "python", "normalized_name": "python", "priority": "Critical", "required_level_value": 3},
        {"skill_name": "fastapi", "normalized_name": "fastapi", "priority": "Required", "required_level_value": 2},
        {"skill_name": "docker", "normalized_name": "docker", "priority": "Preferred", "required_level_value": 2}
    ]
    # Total weights = 1.5 + 1.0 + 0.7 = 3.2
    # Member 1 has Python (4), Member 2 has FastAPI (2), neither has Docker
    team = [
        {"python": 4, "fastapi": 1},
        {"python": 1, "fastapi": 2}
    ]
    cov = calculate_team_coverage(reqs, team)
    expected_cov = ((1.5 + 1.0) / 3.2) * 100.0
    assert math.isclose(cov, expected_cov), f"Team coverage failed: expected {expected_cov}, got {cov}"

    # Test 5: Availability Violations
    assignments = [{"available": True}, {"available": False}, {"available": True}, {"available": True}]
    av_rate = calculate_availability_violations(assignments)
    assert math.isclose(av_rate, 25.0), f"Availability violation failed: expected 25.0, got {av_rate}"

    print("ALL METRICS SELF-TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_self_test()

