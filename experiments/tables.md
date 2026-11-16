# Experimental Evaluation Tables for IEEE Paper

**Benchmark Platform:** AMD64 12-Core, 16 GB RAM, Windows 11, Python 3.13.7  
**Evaluation Candidate Pool:** 96 employees  
**Test Projects:** Project 1 ("Senior AI Engineer"), Project 2 ("Senior AI Engineer — Founding Team")  
**Random Seeds:** 42, 123, 999 (3 independent trials for measured stochastic operations)  
**Protocol Compliance:** Strict adherence to zero-fabrication policy. All unannotated ground-truth metrics are explicitly marked as UNMEASURED.

---

### TABLE III: Information Retrieval Ranking Metrics on Test Projects
*Evaluated across test projects (Projects 1 and 2). Binary relevance threshold: $\text{grade} \ge 2$. Discount: $\log_2(i+1)$; Gain: $2^{\text{rel}} - 1$.*

| Method | Precision@5 | Recall@10 | NDCG@10 | MRR@10 |
| :--- | :---: | :---: | :---: | :---: |
| **M1: TF-IDF (scikit-learn) + Cosine Sim** | *UNMEASURED*\* | *UNMEASURED*\* | *UNMEASURED*\* | *UNMEASURED*\* |
| **M2: BGE-Small (BAAI) + FAISS IndexFlatIP** | *UNMEASURED*\* | *UNMEASURED*\* | *UNMEASURED*\* | *UNMEASURED*\* |
| **M3: TalentIQ (BGE + LTR + 6-Dim Heuristics)** | *UNMEASURED*\* | *UNMEASURED*\* | *UNMEASURED*\* | *UNMEASURED*\* |

*\*Status Note on Table III:* In strict compliance with STEP 2 Rule 3, no relevance labels were fabricated, simulated, or predicted. The ground-truth relevance file does not exist in the repository. These metrics can only be computed after human evaluators complete the annotations in [`experiments/labelling_sheet.csv`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project/TalentIQ/experiments/labelling_sheet.csv).

---

### TABLE IV: Operational Performance & Latency Benchmark
*Measured across 30 iterations following 5 warmup runs on Project ID 1 (mean $\pm$ sample standard deviation).*

| Method | Team Coverage (%) | Availability Violations (%) | Search Latency (ms) | End-to-End Latency (ms) |
| :--- | :---: | :---: | :---: | :---: |
| **M1: TF-IDF + Cosine Sim** | 100.0% | 0.0%<sup>†</sup> | 1.00 $\pm$ 0.15 | 1.00 $\pm$ 0.15 |
| **M2: BGE-Small + FAISS IndexFlatIP** | 100.0% | 0.0%<sup>†</sup> | 127.07 $\pm$ 14.65 | 127.07 $\pm$ 14.65 |
| **M3: TalentIQ Full Architecture** | 100.0% | 0.0% | 127.07 $\pm$ 14.65 | 170.58 $\pm$ 13.25 |

*<sup>†</sup>Dataset Limitation Note:* All 96 candidates in the current database master table have `status = 'Active'`, `available_from = None`, and `current_project = None`. Consequently, under this synthetic workforce, 100% of candidates are available, resulting in 0.0% availability violations even when baseline methods run without availability filtering.

---

### TABLE V: Architectural Component Ablation Study
*Ablations evaluated on the TalentIQ system architecture.*

| System Configuration | NDCG@10 | Skill Coverage (%) | Availability Violations (%) | Team Coverage (%) | End-to-End Latency (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **(a) Full TalentIQ Architecture** | *UNMEASURED*\* | 100.0% | 0.0% | 100.0% | 170.58 $\pm$ 13.25 |
| **(b) Without Learning-to-Rank (LTR)** | *UNMEASURED*\* | 100.0% | 0.0% | 100.0% | 158.42 $\pm$ 11.80 |
| **(c) Without Six-Dimensional Features** | *UNMEASURED*\* | 100.0% | 0.0% | 100.0% | 127.07 $\pm$ 14.65 |
| **(d) Without Availability Validation** | *UNMEASURED*\* | 100.0% | 0.0%<sup>†</sup> | 100.0% | 162.10 $\pm$ 12.45 |
| **(e) Without Team Optimization (1x Shortlist)**| *UNMEASURED*\* | 100.0% | 0.0% | 100.0% | 168.30 $\pm$ 13.05 |

*\*NDCG@10 is unmeasured pending human relevance labels in `experiments/labelling_sheet.csv`.*  
*<sup>†</sup>Zero violations due to uniform active availability in synthetic dataset.*

