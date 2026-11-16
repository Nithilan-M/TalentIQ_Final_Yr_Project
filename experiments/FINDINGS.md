# TalentIQ Experimental Findings & System Audit

**Date:** 2026-11-14  
**Project:** TalentIQ (AI-Powered Talent Matching & Team Optimization Platform)  
**Target:** Measured, Reproducible Experimental Benchmark for IEEE Paper Submission  

---

## 1. Architectural & Data Findings

### a) Data Storage, Entity Counts, and Data Origin
- **Primary Relational Store (SQLAlchemy ORM):**
  - **Models Definition:** [`backend/database/models.py`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project/TalentIQ/backend/database/models.py)
    - `Candidate` (lines 115–150): The workforce master entity (labeled "Employee" across UI and API services). Attributes include `id`, `name`, `employee_id`, `department`, `designation`, `total_experience_years`, `status`, `current_project`, `assignment_start_date`, `assignment_end_date`, `available_from`, `allocation_percentage`, `performance_rating`, `domain_experience`, and `skills`.
    - `JobDescription` (lines 48–93): Project requirement entity storing `id`, `title`, `project_name`, `description`, `start_date`, `end_date`, `required_team_size`, `roles`, `domain`, `skills_required`, `skills_preferred`, and `technologies`.
    - `ProjectSkillRequirement` (lines 95–113): Relational breakdown of project skills with `required_level`, `required_level_value` (1–4), `priority` (Critical/Required/Preferred), and `experience_required`.
    - `EmployeeSkill` (lines 152–167): Individual employee skills mapped to proficiency levels (`Beginner`, `Intermediate`, `Advanced`, `Expert`), proficiency values (1–4), and years of experience.
    - `SkillTaxonomy` / `Skill` (lines 26–46): Centralized vocabulary of 36 normalized canonical skills.
    - `ProjectShortlist` (lines 332–346): Stores shortlist assignments per project (`job_description_id`, `candidate_id`, `rank_at_shortlisting`, `ranking_score`, `shortlist_status`).
  - **Database Connection:** [`backend/database/connection.py`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project/TalentIQ/backend/database/connection.py#L24-L54)
    - Connects to Supabase PostgreSQL using connection pooling (`aws-1-ap-south-1.pooler.supabase.com:5432/postgres`), with an automatic fallback to local SQLite (`talent_iq.db`) when remote connectivity is unreachable.
- **Measured Counts in Stores:**
  - **Supabase PostgreSQL:**
    - `candidates` (employees): **96**
    - `job_descriptions` (projects): **8** (Project IDs 1–8)
    - `employee_skills`: **288**
    - `project_skill_requirements`: **32**
    - `skill_taxonomy`: **36**
    - `project_shortlists`: **96**
    - `users`: **6**
  - **Local SQLite (`talent_iq.db`):**
    - `candidates`: **0**
    - `job_descriptions`: **1**
    - `skill_taxonomy`: **36**
    - `project_skill_requirements`: **10**
  - **Offline Challenge JSONL / Vector Index Store:**
    - `backend/temp_uploads/challenge_uploaded_candidates.jsonl`: **100,000** raw candidate profiles (487 MB)
    - `backend/temp_uploads/test_candidates.jsonl`: **200** candidate profiles (993 KB)
    - `backend/data/candidates_ids.json`: **22,497** candidate IDs
    - `backend/data/candidates_embeddings.npy`: **22,497** vectors (shape: `(22497, 384)`, 34.55 MB)
    - `backend/data/job_description_criteria.json`: **1** job description ("Senior AI Engineer — Founding Team")
- **Data Origin (Real vs. Synthetic):**
  - **100% Synthetic / Mock Data**.
  - **Evidence:**
    1. [`backend/scripts/generate_mock_data.py`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project/TalentIQ/backend/scripts/generate_mock_data.py#L6-L175): Explicit mock generator creating fictional profiles using random combinations of names, skill pools, companies, universities, degrees, and behavioral signals.
    2. [`backend/services/excel_import.py`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project/TalentIQ/backend/services/excel_import.py#L85-L100): Generates mock templates with dummy employees ("Employee A", "Employee B").
    3. Supabase candidate records are uniformly named with synthetic templates (`Aarav Sharma`, `Vivaan Sharma`, etc.) and synthetic IDs `EMP001`–`EMP096`.
    4. Project records in Supabase (8 projects) are synthesized sample project descriptions created for system validation.

---

### b) Relevance Labels & Ground Truth Status
- **Existence of Ground Truth Labels:** **NONE EXIST.**
- **Details:**
  - There are NO human-annotated or gold-standard relevance labels (grades 0–3 or 0–4) stored in the database, in CSV files, or in JSON/JSONL datasets.
  - The table `ranking_results` has **0** rows.
  - The table `project_shortlists` contains only the system's own predicted ranks and statuses (`rank_at_shortlisting`, `ranking_score`, `shortlist_status`), which are outputs of the pipeline, not external ground truth.
  - In [`backend/scripts/train_ltr.py`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project/TalentIQ/backend/scripts/train_ltr.py#L58-L75), relevance labels are synthesized dynamically via hard-coded heuristic thresholding on `skill_match_score`, `experience_score`, `risk_score`, and `embedding_similarity`.
  - **Conclusion:** As strictly required by Rule 3, no metrics based on true relevance can be reported until a human labelling sheet is annotated.

---

### c) Learning-to-Rank (LTR) Training & Hybrid Score Combination
- **Is LGBMRanker Actually Trained?**
  - **No.** `LGBMRanker` is **NOT** trained in production.
  - In [`backend/scripts/train_ltr.py`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project/TalentIQ/backend/scripts/train_ltr.py#L90), `model.train(X, y)` is invoked **without** query `groups`.
  - In [`backend/learning_to_rank/ltr_model.py`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project/TalentIQ/backend/learning_to_rank/ltr_model.py#L57-L72), when `groups` is `None`, the model falls back to `lightgbm.LGBMRegressor`:
    ```python
    self.model = lgb.LGBMRegressor(
        n_estimators=100,
        learning_rate=0.05,
        random_state=42
    )
    self.model.fit(X, y)
    ```
  - Inspection of the serialized artifact [`backend/data/ltr_model.pkl`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project/TalentIQ/backend/data/ltr_model.pkl) confirms:
    - Tuple structure: `('lightgbm', LGBMRegressor(learning_rate=0.05, random_state=42))`
    - Trained on **1 single job description** (`backend/data/job_description_criteria.json`) on 3,000 retrieved candidates using synthesized rule-based labels.
- **Score Combination Formula:**
  - Implemented in [`backend/ranking/hybrid_ranker.py`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project/TalentIQ/backend/ranking/hybrid_ranker.py#L16-L109):
    1. **Manual Heuristic Score (lines 16–43):**
       $$\text{manual\_score} = \sum_{i} w_i \cdot \text{feature}_i$$
       Weights:
       - `skill_match_score`: 0.25
       - `embedding_similarity`: 0.20 (scaled $\times 100$)
       - `experience_score`: 0.15
       - `career_progression_score`: 0.10
       - `behavioral_score`: 0.10
       - `industry_match`: 0.05
       - `education_tier_score`: 0.05
       - `leadership_score`: 0.04
       - `certification_score`: 0.03
       - `company_quality`: 0.03
    2. **Learned LTR Score Normalization (lines 83–89):**
       $$\text{ltr\_scaled} = \frac{\text{ltr\_raw} - \min(\text{ltr})}{\max(\text{ltr}) - \min(\text{ltr})} \times 100$$
    3. **Hybrid Blending (lines 31, 103):**
       $$\text{blend\_score} = (0.80 \times \text{ltr\_scaled}) + (0.20 \times \text{manual\_score})$$
       (Blending ratio: 80% learned LTR model + 20% manual heuristic).
    4. **Risk Deduction (lines 106–108):**
       $$\text{penalty} = \frac{\text{risk\_score}}{100} \times 30.0$$
       $$\text{final\_score} = \max(0.0, \min(100.0, \text{blend\_score} - \text{penalty}))$$
    5. **Tie-Breaking (line 125):**
       Sorted by $(-\text{final\_score}, \text{candidate\_id})$.

---

### d) Six-Dimension Matching Score: Exact Code Formula & Weights
Implemented in [`backend/services/matching_service.py`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project/TalentIQ/backend/services/matching_service.py#L52-L270), function `calculate_employee_project_match`:

$$\text{overall\_match\_score} = 0.35 D_1 + 0.25 D_2 + 0.15 D_3 + 0.10 D_4 + 0.10 D_5 + 0.05 D_6$$

1. **Dimension 1: Skill Coverage ($D_1$, Weight: 35% / 0.35, lines 199–202):**
   - Formula: $\frac{\sum \text{coverage\_earned}}{\sum \text{requirement\_points}} \times 100$
   - Requirement Priority Weights:
     - `Critical`: 1.5
     - `Required`: 1.0
     - `Preferred`: 0.7
   - Matching Mechanisms:
     1. Exact Canonical Taxonomy ID Match (`emp_skill.skill_id == req.skill_id`)
     2. Normalized Name Match (`emp_skill.normalized_skill_name.lower() == req.normalized_name.lower()`)
     3. Raw Name / Alias Match (`emp_skill.skill_name.lower() == req.original_name.lower()`)
     4. Semantic Cosine Match: BGE embedding cosine similarity $\ge 0.85$ (with negative guard blocking spurious pairs like Java vs. JavaScript, Python vs. Cython).
   - If matched, earns full priority weight $p\_weight$ towards coverage.
2. **Dimension 2: Proficiency Match ($D_2$, Weight: 25% / 0.25, lines 204–208):**
   - Formula: $\frac{\sum (\text{prof\_satisfaction} \times p\_weight)}{\sum \text{requirement\_points}} \times 100$
   - Thresholds:
     - Numeric scale: Beginner = 1, Intermediate = 2, Advanced = 3, Expert = 4
     - If $\text{emp\_prof} \ge \text{req\_prof}$: $\text{prof\_satisfaction} = 1.0$
     - Else: $\text{prof\_satisfaction} = \max\left(0.25, \frac{\text{emp\_prof}}{\text{req\_prof}}\right)$
3. **Dimension 3: Experience Match ($D_3$, Weight: 15% / 0.15, lines 210–214):**
   - Formula: $\frac{\sum (\text{exp\_satisfaction} \times p\_weight)}{\sum \text{requirement\_points}} \times 100$
   - Thresholds:
     - If $\text{req\_exp} \le 0$ or $\text{emp\_exp} \ge \text{req\_exp}$: $\text{exp\_satisfaction} = 1.0$
     - Else: $\text{exp\_satisfaction} = \max\left(0.30, \frac{\text{emp\_exp}}{\text{req\_exp}}\right)$
4. **Dimension 4: Role & Designation Relevance ($D_4$, Weight: 10% / 0.10, lines 216–227):**
   - Base neutral score: $60.0$
   - If candidate designation matches project roles or project title: $100.0$
   - Else if designation contains technical keywords (`developer`, `engineer`, `architect`, `lead`, `analyst`): $80.0$
5. **Dimension 5: Domain Relevance ($D_5$, Weight: 10% / 0.10, lines 228–242):**
   - Base neutral score: $70.0$ (when project domain is unspecified, "general", or "other")
   - If project domain matches candidate `domain_experience` or past project history domains: $100.0$
   - Else if partial domain string match: $85.0$
   - Else (domain mismatch): $50.0$
6. **Dimension 6: Technology Stack Alignment ($D_6$, Weight: 5% / 0.05, lines 243–258):**
   - Formula: $\frac{\text{count of matched technologies}}{\text{total project technologies}} \times 100$ (default $100.0$ if no technologies specified)

---

### e) Availability Validation, Risk Penalties, and Team Optimization
1. **Availability Engine:**
   - **File:** [`backend/services/availability_service.py`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project\TalentIQ/backend/services/availability_service.py#L33-L150)
   - **Rule 1 (Status):** If `candidate.status == "Inactive"` $\rightarrow$ Marked `Unavailable` (`conflict = True`).
   - **Rule 2 (Availability Date):** If `candidate.available_from > project_start` $\rightarrow$ Marked `Unavailable`.
   - **Rule 3 (Current Assignment Overlap):** Checks condition:
     $$\text{assignment\_start} \le \text{project\_end} \quad \text{AND} \quad \text{assignment\_end} \ge \text{project\_start}$$
     *Boundary rule:* Same-day boundary ($\text{assignment\_end} == \text{project\_start}$) is explicitly marked `Unavailable` (same-day project handoff prohibited).
   - **Rule 4 (Project History Overlaps):** Evaluates overlapping dates across all concurrent project records in `candidate.projects`.
   - **Enforcement:** [`backend/services/matching_service.py`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project\TalentIQ/backend/services/matching_service.py#L358-L375) extracts ONLY candidates with `availability_status == "Available"`; unavailable employees are strictly excluded from matching and ranking.
2. **Risk Penalties (Trap Detection):**
   - **File:** [`backend/risk_engine/trap_detector.py`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project\TalentIQ/backend/risk_engine/trap_detector.py#L10-L177)
   - Evaluates 6 profile risk traps:
     1. *Keyword Stuffing / Inflation:* $>25$ skills (+25 risk); senior title with $<2$ yrs total experience (+20 risk); non-technical title claiming advanced ML skills (+30 risk).
     2. *Timeline Inconsistencies:* Overlapping full-time positions $>90$ days (+15 risk per overlap, capped at +30).
     3. *Impossible Career Progression:* Promotion from intern/junior to director/executive in $<18$ months (+25 risk).
     4. *Honeypot Profiles:* Recruiter response rate $<15\%$ and inactive $>120$ days (+20 risk).
     5. *Service Company Trap:* Entire career history spent exclusively in IT body-shopping/consulting firms (+25 risk).
     6. *Title Chaser Trap:* Average tenure across jobs $<18$ months with $\ge 2$ companies (+20 risk).
   - **Penalty Application:** In [`backend/ranking/hybrid_ranker.py`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project\TalentIQ/backend/ranking/hybrid_ranker.py#L106-L108):
     $$\text{penalty} = \frac{\text{risk\_score}}{100.0} \times 30.0$$
     Deducts up to 30.0 points from the blended suitability score.
3. **Team Optimization (2x Shortlist Rule):**
   - **File:** [`backend/services/shortlist_service.py`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project\TalentIQ/backend/services/shortlist_service.py#L21-L143)
   - Dynamic formula: $\text{required\_shortlist\_size} = \text{required\_team\_size} \times 2$.
   - Consumes pre-filtered and pre-ranked available candidates from `rank_available_employees_for_project`:
     - Ranks $1 \dots 2N \rightarrow$ Assigned status `SHORTLISTED`.
     - Ranks $> 2N \rightarrow$ Assigned status `NOT_SHORTLISTED`.
   - Insufficient Pool Fallback: If available candidates $< 2N$, shortlists all available candidates and sets status to `INSUFFICIENT_POOL` with an explicit warning.

---

### f) System Environment & Software Stack Versions
- **Python:** `3.13.7` (tags/v3.13.7:bcee1c3, Aug 14 2025, 14:15:11) [MSC v.1944 64 bit (AMD64)]
- **Embedding Model:** `BAAI/bge-small-en-v1.5` via `sentence-transformers 5.6.0`, embedding dimension 384
- **FAISS:** `faiss-cpu 1.14.3`
- **LightGBM:** `lightgbm 4.6.0`
- **XGBoost:** `xgboost 3.3.0`
- **Scikit-Learn:** `scikit-learn 1.9.0`
- **PyTorch:** `torch 2.12.1`
- **CPU:** AMD64 Family 25 Model 124 Stepping 0, AuthenticAMD (12 logical processors)
- **RAM:** 15.23 GB total physical memory (3.58 GB available physical memory)
- **GPU:** None (CUDA available: `False`, CPU execution only)
- **Operating System:** Windows 11 Pro / Enterprise (Windows-11-10.0.26200-SP0, build 10.0.26200)

---

## 2. Experimental Rig Setup & Critical Protocol Check

### Multi-Agent LLM Latency Inclusion Policy
- **Policy:** The multi-agent LLM module (Ollama / Ornith 9b / Gemini explainability agents) is **EXCLUDED** by default from the end-to-end algorithmic latency benchmark.
- **Reasoning:** In the TalentIQ architecture, core retrieval, scoring, availability validation, and team shortlisting are 100% deterministic mathematical calculations executed in milliseconds on the CPU. The multi-agent debate and explanation services run asynchronously post-ranking for UX narratives. They will be benchmarked and reported separately to avoid distorting algorithmic throughput.

### Project Split Configuration (60 / 20 / 20)
- **Total Projects in Database:** 8 projects
- **Split Breakdown:**
  - **Train (60%, 5 projects):** Projects 1, 2, 4, 5, 6
  - **Validation (20%, 1 project):** Project 3
  - **Test (20%, 2 projects):** Projects 7, 8
- Generated and saved to [`experiments/split.json`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project/TalentIQ/experiments/split.json).

### Evaluation Metric Implementations & Verification
- Metric calculations implemented and validated in [`scripts/metrics.py`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project/TalentIQ/scripts/metrics.py):
  - Precision@5 (binary relevance: grade $\ge 2$)
  - Recall@10 (binary relevance: grade $\ge 2$)
  - NDCG@K ($K \in \{1, 3, 5, 10\}$) using gain $2^{\text{rel}} - 1$ and discount $\log_2(i + 1)$
  - MRR@10 (reciprocal rank of first item with grade $\ge 2$)
  - Team Skill Coverage (%) & Team Coverage (%)
  - Availability Violation Rate (%)
- Self-test suite successfully passes all mathematical edge cases.

---

## 3. Human Labelling Sheet & Ground Truth Block

> [!IMPORTANT]
> **COMPLIANCE WITH RULE 3: STOP ON UNANNOTATED GROUND TRUTH**
> Graded relevance labels (0–3) do **NOT** exist in the repository or database. Fabricating, predicting, or synthesizing relevance labels would violate IEEE peer-review integrity and the explicit instruction:
> *"If graded labels (0-3) do not exist, do NOT invent them. Stop and tell me what labelling is needed (propose a labelling sheet in CSV: project_id, employee_id, grade) and proceed only once it is filled by humans."*

A standardized human labelling template has been generated at [`experiments/labelling_sheet.csv`](file:///c:/Users/nithi/OneDrive/Desktop/REC/Projects/Final_Year_Project/TalentIQ/experiments/labelling_sheet.csv).

### Annotation Protocol Guidelines:
- **Grade 0 (Irrelevant / Unqualified):** Candidate lacks essential core skills, possesses massive proficiency deficit, or has active irreconcilable conflict.
- **Grade 1 (Marginal / Low Suitability):** Matches basic keywords but lacks required seniority, depth, or proficiency.
- **Grade 2 (Relevant / Competent Match):** Meets all required skills and minimum required proficiency/experience levels; strong fit.
- **Grade 3 (Highly Relevant / Ideal Expert):** Exceeds required proficiency, possesses domain alignment, strong track record, and is immediately deployable.

Once human evaluators fill in the `grade` column in `experiments/labelling_sheet.csv`, the quantitative benchmark across M1 (TF-IDF), M2 (BGE-Small + FAISS), and M3 (TalentIQ LTR + Heuristics), as well as ablations (a)–(e), can be executed deterministically.

