"""
Bulk Excel Import Service for Employee Master Data.
Uses openpyxl to generate templates and parse/validate uploaded .xlsx files.
"""

import io
import re
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from sqlalchemy.orm import Session
from backend.database.models import Candidate
from backend.parsers.skill_normalizer import normalize_skill_name
from backend.services.skill_service import lookup_or_normalize_skill

VALID_PROFICIENCY_LEVELS = {"Beginner", "Intermediate", "Advanced", "Expert"}
VALID_SOURCES = {"Resume", "Manual Entry", "Manager Update", "Certification", "System Import"}

# ── Sheet Column Definitions ─────────────────────────────────────────────

EMPLOYEES_COLUMNS = [
    "Employee ID", "Name", "Email", "Department", "Designation",
    "Total Experience Years", "Status", "Performance Rating",
    "Performance Review Period", "Performance Notes"
]

SKILLS_COLUMNS = [
    "Employee ID", "Skill", "Proficiency Level", "Experience Years", "Source"
]

PROJECT_HISTORY_COLUMNS = [
    "Employee ID", "Project Name", "Role", "Start Date", "End Date",
    "Technologies", "Responsibilities", "Domain"
]

CURRENT_ASSIGNMENTS_COLUMNS = [
    "Employee ID", "Project Name", "Assignment Start Date",
    "Assignment End Date", "Allocation Percentage", "Available From"
]

CERTIFICATIONS_COLUMNS = [
    "Employee ID", "Certification Name", "Issuing Organization",
    "Issue Date", "Expiry Date", "Credential ID"
]


# ── Template Generation ──────────────────────────────────────────────────

def generate_excel_template() -> bytes:
    """
    Generate a standardized 5-sheet .xlsx template for bulk employee import.
    Returns the workbook as bytes.
    """
    wb = Workbook()

    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="DC2626", end_color="DC2626", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    thin_border = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin")
    )

    def _create_sheet(wb, title, columns, sample_rows=None):
        ws = wb.create_sheet(title=title)
        for col_idx, col_name in enumerate(columns, 1):
            cell = ws.cell(row=1, column=col_idx, value=col_name)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = thin_border
            ws.column_dimensions[ws.cell(row=1, column=col_idx).column_letter].width = max(18, len(col_name) + 4)
        if sample_rows:
            for row_idx, row_data in enumerate(sample_rows, 2):
                for col_idx, val in enumerate(row_data, 1):
                    cell = ws.cell(row=row_idx, column=col_idx, value=val)
                    cell.border = thin_border
        return ws

    # Remove default sheet
    wb.remove(wb.active)

    # Sheet 1: Employees
    _create_sheet(wb, "Employees", EMPLOYEES_COLUMNS, [
        ["EMP001", "Employee A", "emp.a@company.com", "Engineering", "Backend Developer", 4.0, "Active", 4.5, "2025-Q4", "Excellent performance"],
        ["EMP002", "Employee B", "emp.b@company.com", "AI/ML", "ML Engineer", 3.0, "Active", 4.2, "2025-Q4", "Strong contributor"],
        ["EMP003", "Employee C", "emp.c@company.com", "Frontend", "Frontend Developer", 5.0, "Active", 4.6, "2025-Q4", "Team lead potential"],
    ])

    # Sheet 2: Skills
    _create_sheet(wb, "Skills", SKILLS_COLUMNS, [
        ["EMP001", "Python", "Advanced", 3.0, "Manager Update"],
        ["EMP001", "FastAPI", "Advanced", 2.0, "Resume"],
        ["EMP001", "PostgreSQL", "Intermediate", 2.0, "Resume"],
        ["EMP002", "Python", "Intermediate", 2.0, "Resume"],
        ["EMP002", "TensorFlow", "Advanced", 2.5, "Certification"],
        ["EMP003", "React", "Expert", 4.0, "Manager Update"],
        ["EMP003", "TypeScript", "Advanced", 3.0, "Resume"],
    ])

    # Sheet 3: Project History
    _create_sheet(wb, "Project History", PROJECT_HISTORY_COLUMNS, [
        ["EMP001", "Healthcare API", "Backend Developer", "2024-01-01", "2025-12-31", "Python, FastAPI, PostgreSQL", "API development and database design", "Healthcare"],
        ["EMP002", "Fraud Detection System", "ML Engineer", "2024-06-01", "2025-06-30", "Python, TensorFlow, Scikit-Learn", "Model training and deployment", "FinTech"],
    ])

    # Sheet 4: Current Assignments
    _create_sheet(wb, "Current Assignments", CURRENT_ASSIGNMENTS_COLUMNS, [
        ["EMP001", "Banking API Migration", "2026-05-01", "2026-09-30", 100, "2026-10-01"],
        ["EMP002", "AI Chatbot Platform", "2026-04-01", "2026-11-30", 80, "2026-12-01"],
        ["EMP003", "E-Commerce Dashboard", "2026-06-01", "2026-12-31", 100, "2027-01-01"],
    ])

    # Sheet 5: Certifications
    _create_sheet(wb, "Certifications", CERTIFICATIONS_COLUMNS, [
        ["EMP001", "AWS Certified Cloud Practitioner", "AWS", "2025-03-15", "2028-03-15", "AWS-CCP-001"],
        ["EMP002", "TensorFlow Developer Certificate", "Google", "2025-01-10", "", "TF-DEV-002"],
    ])

    # Save to bytes
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()


# ── Import Validation ────────────────────────────────────────────────────

def validate_excel_import(file_bytes: bytes, db: Session) -> Dict[str, Any]:
    """
    Parse and validate an uploaded .xlsx file for bulk employee import.
    Returns a structured validation result with valid/invalid records and error details.
    """
    try:
        wb = load_workbook(io.BytesIO(file_bytes), data_only=True)
    except Exception as e:
        return {
            "success": False,
            "error": f"Cannot read Excel file: {str(e)}",
            "total_employees": 0,
            "valid_employees": 0,
            "invalid_employees": 0,
            "warnings_count": 0,
            "existing_employees": 0,
            "new_employees": 0,
            "errors": [],
            "warnings": [],
            "valid_data": None,
        }

    errors: List[Dict[str, Any]] = []
    warnings: List[Dict[str, Any]] = []

    # ── Parse Employees Sheet ────────────────────────────────────────
    employees_data = _parse_sheet(wb, "Employees", EMPLOYEES_COLUMNS)
    if employees_data is None:
        errors.append({"sheet": "Employees", "row": 0, "employee_id": "", "field": "Sheet", "value": "", "problem": "Sheet 'Employees' not found or has incorrect columns", "allowed": ", ".join(EMPLOYEES_COLUMNS)})
        return _build_result(0, 0, 0, 0, 0, errors, warnings, None)

    # ── Parse Other Sheets ───────────────────────────────────────────
    skills_data = _parse_sheet(wb, "Skills", SKILLS_COLUMNS) or []
    projects_data = _parse_sheet(wb, "Project History", PROJECT_HISTORY_COLUMNS) or []
    assignments_data = _parse_sheet(wb, "Current Assignments", CURRENT_ASSIGNMENTS_COLUMNS) or []
    certs_data = _parse_sheet(wb, "Certifications", CERTIFICATIONS_COLUMNS) or []

    # ── Validate Employee Records ────────────────────────────────────
    valid_emp_ids = set()
    invalid_emp_ids = set()
    seen_emp_ids = {}
    existing_count = 0
    existing_emp_ids = set()

    for row_idx, emp in enumerate(employees_data, 2):
        emp_id = str(emp.get("Employee ID") or "").strip()
        name = str(emp.get("Name") or "").strip()

        # Required: Employee ID
        if not emp_id:
            errors.append({"sheet": "Employees", "row": row_idx, "employee_id": emp_id, "field": "Employee ID", "value": "", "problem": "Employee ID is required", "allowed": "Non-empty unique identifier (e.g. EMP001)"})
            invalid_emp_ids.add(f"__row_{row_idx}")
            continue

        # Duplicate within file
        if emp_id in seen_emp_ids:
            errors.append({"sheet": "Employees", "row": row_idx, "employee_id": emp_id, "field": "Employee ID", "value": emp_id, "problem": f"Duplicate Employee ID in file (first seen at row {seen_emp_ids[emp_id]})", "allowed": "Unique Employee ID per row"})
            invalid_emp_ids.add(emp_id)
            continue
        seen_emp_ids[emp_id] = row_idx

        # Required: Name
        if not name:
            errors.append({"sheet": "Employees", "row": row_idx, "employee_id": emp_id, "field": "Name", "value": "", "problem": "Employee name is required", "allowed": "Non-empty string"})
            invalid_emp_ids.add(emp_id)
            continue

        # Check if exists in database
        db_existing = db.query(Candidate).filter(Candidate.employee_id == emp_id).first()
        if db_existing:
            existing_count += 1
            existing_emp_ids.add(emp_id)

        # Validate Status
        status = str(emp.get("Status") or "Active").strip()
        if status and status not in {"Active", "Inactive"}:
            errors.append({"sheet": "Employees", "row": row_idx, "employee_id": emp_id, "field": "Status", "value": status, "problem": "Invalid status value", "allowed": "Active / Inactive"})
            invalid_emp_ids.add(emp_id)
            continue

        # Validate Experience
        exp = emp.get("Total Experience Years")
        if exp is not None and exp != "":
            try:
                val = float(exp)
                if val < 0:
                    errors.append({"sheet": "Employees", "row": row_idx, "employee_id": emp_id, "field": "Total Experience Years", "value": str(exp), "problem": "Experience cannot be negative", "allowed": "0 or positive number"})
                    invalid_emp_ids.add(emp_id)
                    continue
            except (ValueError, TypeError):
                errors.append({"sheet": "Employees", "row": row_idx, "employee_id": emp_id, "field": "Total Experience Years", "value": str(exp), "problem": "Invalid number", "allowed": "Numeric value (e.g. 4.5)"})
                invalid_emp_ids.add(emp_id)
                continue

        # Validate Performance Rating
        rating = emp.get("Performance Rating")
        if rating is not None and rating != "":
            try:
                val = float(rating)
                if val < 0 or val > 5:
                    errors.append({"sheet": "Employees", "row": row_idx, "employee_id": emp_id, "field": "Performance Rating", "value": str(rating), "problem": "Rating out of range", "allowed": "0.0 to 5.0"})
                    invalid_emp_ids.add(emp_id)
                    continue
            except (ValueError, TypeError):
                errors.append({"sheet": "Employees", "row": row_idx, "employee_id": emp_id, "field": "Performance Rating", "value": str(rating), "problem": "Invalid number", "allowed": "Numeric value 0.0–5.0"})
                invalid_emp_ids.add(emp_id)
                continue

        valid_emp_ids.add(emp_id)

    # ── Validate Skills Sheet ────────────────────────────────────────
    seen_emp_skills = set()
    for row_idx, sk in enumerate(skills_data, 2):
        emp_id = str(sk.get("Employee ID") or "").strip()
        skill_name = str(sk.get("Skill") or "").strip()
        prof = str(sk.get("Proficiency Level") or "").strip()
        source = str(sk.get("Source") or "").strip()

        if not emp_id:
            errors.append({"sheet": "Skills", "row": row_idx, "employee_id": "", "field": "Employee ID", "value": "", "problem": "Employee ID is required", "allowed": "Valid Employee ID from Employees sheet"})
            continue

        if emp_id not in valid_emp_ids and emp_id not in existing_emp_ids:
            if emp_id not in invalid_emp_ids and f"__row_{row_idx}" not in invalid_emp_ids:
                errors.append({"sheet": "Skills", "row": row_idx, "employee_id": emp_id, "field": "Employee ID", "value": emp_id, "problem": "References non-existent Employee ID", "allowed": "Valid Employee ID from Employees sheet"})
            continue

        if not skill_name:
            errors.append({"sheet": "Skills", "row": row_idx, "employee_id": emp_id, "field": "Skill", "value": "", "problem": "Skill name cannot be empty", "allowed": "Non-empty skill name"})
            continue

        tax_res = lookup_or_normalize_skill(db, skill_name)
        normalized = tax_res["normalized_skill_name"]
        if not tax_res["is_taxonomy_matched"]:
            warnings.append({"sheet": "Skills", "row": row_idx, "employee_id": emp_id, "field": "Skill", "value": skill_name, "problem": f"Skill '{skill_name}' not found in standard Skill Taxonomy", "allowed": "Add to Taxonomy or map to existing skill"})

        dup_key = f"{emp_id}::{normalized}"
        if dup_key in seen_emp_skills:
            warnings.append({"sheet": "Skills", "row": row_idx, "employee_id": emp_id, "field": "Skill", "value": skill_name, "problem": f"Duplicate skill '{normalized}' for employee {emp_id}", "allowed": "One entry per skill per employee"})
            continue
        seen_emp_skills.add(dup_key)

        if prof and prof not in VALID_PROFICIENCY_LEVELS:
            errors.append({"sheet": "Skills", "row": row_idx, "employee_id": emp_id, "field": "Proficiency Level", "value": prof, "problem": "Invalid proficiency level", "allowed": "Beginner / Intermediate / Advanced / Expert"})

        if source and source not in VALID_SOURCES:
            warnings.append({"sheet": "Skills", "row": row_idx, "employee_id": emp_id, "field": "Source", "value": source, "problem": "Unrecognized source", "allowed": "Resume / Manual Entry / Manager Update / Certification / System Import"})

        exp_yrs = sk.get("Experience Years")
        if exp_yrs is not None and exp_yrs != "":
            try:
                val = float(exp_yrs)
                if val < 0:
                    warnings.append({"sheet": "Skills", "row": row_idx, "employee_id": emp_id, "field": "Experience Years", "value": str(exp_yrs), "problem": "Negative experience", "allowed": "0 or positive number"})
            except (ValueError, TypeError):
                warnings.append({"sheet": "Skills", "row": row_idx, "employee_id": emp_id, "field": "Experience Years", "value": str(exp_yrs), "problem": "Invalid number", "allowed": "Numeric value"})

    # ── Validate Current Assignments ─────────────────────────────────
    for row_idx, asn in enumerate(assignments_data, 2):
        emp_id = str(asn.get("Employee ID") or "").strip()
        if not emp_id:
            continue
        if emp_id not in valid_emp_ids and emp_id not in existing_emp_ids:
            errors.append({"sheet": "Current Assignments", "row": row_idx, "employee_id": emp_id, "field": "Employee ID", "value": emp_id, "problem": "References non-existent Employee ID", "allowed": "Valid Employee ID"})
            continue

        for date_field in ["Assignment Start Date", "Assignment End Date", "Available From"]:
            date_val = str(asn.get(date_field) or "").strip()
            if date_val and not _is_valid_date(date_val):
                warnings.append({"sheet": "Current Assignments", "row": row_idx, "employee_id": emp_id, "field": date_field, "value": date_val, "problem": "Invalid date format", "allowed": "YYYY-MM-DD"})

        alloc = asn.get("Allocation Percentage")
        if alloc is not None and alloc != "":
            try:
                val = int(float(str(alloc)))
                if val < 0 or val > 100:
                    errors.append({"sheet": "Current Assignments", "row": row_idx, "employee_id": emp_id, "field": "Allocation Percentage", "value": str(alloc), "problem": "Out of range", "allowed": "0–100"})
            except (ValueError, TypeError):
                errors.append({"sheet": "Current Assignments", "row": row_idx, "employee_id": emp_id, "field": "Allocation Percentage", "value": str(alloc), "problem": "Invalid number", "allowed": "Integer 0–100"})

    # ── Validate Project History Dates ────────────────────────────────
    for row_idx, proj in enumerate(projects_data, 2):
        emp_id = str(proj.get("Employee ID") or "").strip()
        if emp_id and emp_id not in valid_emp_ids and emp_id not in existing_emp_ids:
            errors.append({"sheet": "Project History", "row": row_idx, "employee_id": emp_id, "field": "Employee ID", "value": emp_id, "problem": "References non-existent Employee ID", "allowed": "Valid Employee ID"})
        for date_field in ["Start Date", "End Date"]:
            date_val = str(proj.get(date_field) or "").strip()
            if date_val and not _is_valid_date(date_val):
                warnings.append({"sheet": "Project History", "row": row_idx, "employee_id": emp_id, "field": date_field, "value": date_val, "problem": "Invalid date format", "allowed": "YYYY-MM-DD"})

    # ── Validate Certifications Dates ────────────────────────────────
    for row_idx, cert in enumerate(certs_data, 2):
        emp_id = str(cert.get("Employee ID") or "").strip()
        if emp_id and emp_id not in valid_emp_ids and emp_id not in existing_emp_ids:
            errors.append({"sheet": "Certifications", "row": row_idx, "employee_id": emp_id, "field": "Employee ID", "value": emp_id, "problem": "References non-existent Employee ID", "allowed": "Valid Employee ID"})
        for date_field in ["Issue Date", "Expiry Date"]:
            date_val = str(cert.get(date_field) or "").strip()
            if date_val and not _is_valid_date(date_val):
                warnings.append({"sheet": "Certifications", "row": row_idx, "employee_id": emp_id, "field": date_field, "value": date_val, "problem": "Invalid date format", "allowed": "YYYY-MM-DD"})

    total = len(employees_data)
    valid_count = len(valid_emp_ids)
    invalid_count = len(invalid_emp_ids)
    new_count = valid_count - existing_count

    valid_data = {
        "employees": [e for e in employees_data if str(e.get("Employee ID") or "").strip() in valid_emp_ids],
        "skills": [s for s in skills_data if str(s.get("Employee ID") or "").strip() in valid_emp_ids or str(s.get("Employee ID") or "").strip() in existing_emp_ids],
        "projects": [p for p in projects_data if str(p.get("Employee ID") or "").strip() in valid_emp_ids or str(p.get("Employee ID") or "").strip() in existing_emp_ids],
        "assignments": [a for a in assignments_data if str(a.get("Employee ID") or "").strip() in valid_emp_ids or str(a.get("Employee ID") or "").strip() in existing_emp_ids],
        "certifications": [c for c in certs_data if str(c.get("Employee ID") or "").strip() in valid_emp_ids or str(c.get("Employee ID") or "").strip() in existing_emp_ids],
        "existing_employee_ids": list(existing_emp_ids),
    }

    return _build_result(total, valid_count, invalid_count, existing_count, new_count, errors, warnings, valid_data)


# ── Sheet Parsing Helper ─────────────────────────────────────────────────

def _parse_sheet(wb, sheet_name: str, expected_columns: List[str]) -> Optional[List[Dict[str, Any]]]:
    """Parse a named sheet from a workbook into a list of row dicts."""
    if sheet_name not in wb.sheetnames:
        return None

    ws = wb[sheet_name]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    header = [str(c or "").strip() for c in rows[0]]

    # Validate required columns exist
    for col in expected_columns:
        if col not in header:
            return None

    data = []
    for row in rows[1:]:
        if all(v is None or str(v).strip() == "" for v in row):
            continue  # Skip completely empty rows
        row_dict = {}
        for idx, col_name in enumerate(header):
            if idx < len(row):
                val = row[idx]
                # Convert datetime objects to string
                if isinstance(val, datetime):
                    val = val.strftime("%Y-%m-%d")
                row_dict[col_name] = val
            else:
                row_dict[col_name] = None
        data.append(row_dict)

    return data


# ── Helpers ──────────────────────────────────────────────────────────────

def _is_valid_date(date_str: str) -> bool:
    """Check if a string is a valid YYYY-MM-DD date."""
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def _build_result(total, valid, invalid, existing, new, errors, warnings, valid_data):
    return {
        "success": len([e for e in errors if e.get("sheet") == "Employees"]) == 0 or valid > 0,
        "total_employees": total,
        "valid_employees": valid,
        "invalid_employees": invalid,
        "warnings_count": len(warnings),
        "existing_employees": existing,
        "new_employees": new,
        "errors": errors,
        "warnings": warnings,
        "valid_data": valid_data,
    }
