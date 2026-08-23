import React, { useState, useEffect } from "react";
import {
  Users,
  UserCheck,
  UserX,
  Search,
  Filter,
  Plus,
  FileSpreadsheet,
  Download,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  UploadCloud,
  FileText,
  Loader2,
  Calendar,
  Briefcase,
  Award,
  Sparkles,
  RefreshCw,
  Star,
  Layers,
  Building,
  Clock
} from "lucide-react";
import { apiService } from "../services/api";
import { GlassCard } from "../components/GlassCard";

interface EmployeeListItem {
  id: number;
  employee_id: string;
  name: string;
  email: string;
  designation: string;
  department: string;
  total_experience_years: number | null;
  current_project: string;
  available_from: string;
  skills_count: number;
  certifications_count: number;
  performance_rating: number | null;
  status: string;
}

interface EmployeeStats {
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
  departments: string[];
}

export const EmployeeMaster: React.FC = () => {
  // Stats & List State
  const [stats, setStats] = useState<EmployeeStats>({
    total_employees: 0,
    active_employees: 0,
    inactive_employees: 0,
    departments: []
  });
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  // Filters State
  const [search, setSearch] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Profile Drawer State
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [profileData, setProfileData] = useState<any | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);

  // Manual Add/Edit Modal State
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [editingEmpId, setEditingEmpId] = useState<number | null>(null);
  const [formData, setFormData] = useState<any>({
    employee_id: "",
    name: "",
    email: "",
    phone: "",
    department: "Engineering",
    designation: "",
    total_experience_years: "",
    status: "Active",
    current_project: "",
    assignment_start_date: "",
    assignment_end_date: "",
    available_from: "",
    allocation_percentage: 100,
    performance_rating: "",
    performance_review_period: "2025-Q4",
    performance_notes: "",
    skills: [],
    projects: [],
    certifications: []
  });
  const [formSaving, setFormSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Excel Import Modal State
  const [showExcelModal, setShowExcelModal] = useState<boolean>(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [validatingExcel, setValidatingExcel] = useState<boolean>(false);
  const [excelPreview, setExcelPreview] = useState<any | null>(null);
  const [importingExcel, setImportingExcel] = useState<boolean>(false);
  const [excelSuccessMsg, setExcelSuccessMsg] = useState<string | null>(null);
  const [excelErrorMsg, setExcelErrorMsg] = useState<string | null>(null);
  const [updateExisting, setUpdateExisting] = useState<boolean>(true);

  // Load stats and employees
  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [page, search, departmentFilter, statusFilter]);

  const fetchStats = async () => {
    try {
      const res = await apiService.getEmployeeStats();
      setStats(res);
    } catch (err) {
      console.error("Failed to load employee stats:", err);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await apiService.listEmployees({
        page,
        page_size: pageSize,
        search,
        department: departmentFilter,
        status: statusFilter
      });
      setEmployees(res.items || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      console.error("Failed to load employees:", err);
    } finally {
      setLoading(false);
    }
  };

  // Open Profile Drawer
  const handleViewProfile = async (id: number) => {
    setSelectedEmpId(id);
    setLoadingProfile(true);
    try {
      const res = await apiService.getEmployeeDetails(id);
      setProfileData(res);
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Open Add/Edit Modal
  const handleOpenAddModal = () => {
    setEditingEmpId(null);
    setFormError(null);
    setFormData({
      employee_id: "",
      name: "",
      email: "",
      phone: "",
      department: "Engineering",
      designation: "",
      total_experience_years: "",
      status: "Active",
      current_project: "",
      assignment_start_date: "",
      assignment_end_date: "",
      available_from: "",
      allocation_percentage: 100,
      performance_rating: "",
      performance_review_period: "2025-Q4",
      performance_notes: "",
      skills: [{ skill_name: "Python", proficiency_level: "Intermediate", experience_years: 2.0, source: "Manual Entry" }],
      projects: [],
      certifications: []
    });
    setShowFormModal(true);
  };

  const handleOpenEditModal = async (id: number) => {
    setEditingEmpId(id);
    setFormError(null);
    try {
      const details = await apiService.getEmployeeDetails(id);
      setFormData({
        employee_id: details.employee_id || "",
        name: details.name || "",
        email: details.email || "",
        phone: details.phone || "",
        department: details.department || "Engineering",
        designation: details.designation || "",
        total_experience_years: details.total_experience_years !== null ? details.total_experience_years : "",
        status: details.status || "Active",
        current_project: details.current_project || "",
        assignment_start_date: details.assignment_start_date || "",
        assignment_end_date: details.assignment_end_date || "",
        available_from: details.available_from || "",
        allocation_percentage: details.allocation_percentage || 100,
        performance_rating: details.performance_rating !== null ? details.performance_rating : "",
        performance_review_period: details.performance_review_period || "2025-Q4",
        performance_notes: details.performance_notes || "",
        skills: details.skills || [],
        projects: details.projects || [],
        certifications: details.certifications || []
      });
      setShowFormModal(true);
    } catch (err: any) {
      alert("Failed to load employee details for editing.");
    }
  };

  const handleSaveEmployee = async () => {
    setFormSaving(true);
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError("Employee Name is required.");
      setFormSaving(false);
      return;
    }

    const payload = {
      ...formData,
      name: formData.name.trim(),
      total_experience_years: formData.total_experience_years === "" ? null : parseFloat(formData.total_experience_years),
      performance_rating: formData.performance_rating === "" ? null : parseFloat(formData.performance_rating),
      allocation_percentage: formData.allocation_percentage === "" ? 100 : parseInt(formData.allocation_percentage),
      skills: formData.skills.filter((s: any) => s.skill_name && s.skill_name.trim())
    };

    try {
      if (editingEmpId) {
        await apiService.updateEmployee(editingEmpId, payload);
      } else {
        await apiService.createEmployee(payload);
      }
      setShowFormModal(false);
      fetchStats();
      fetchEmployees();
    } catch (err: any) {
      setFormError(err.message || "Failed to save employee profile.");
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeactivate = async (id: number, name: string) => {
    if (!window.confirm(`Deactivate employee '${name}'? The record will be set to Inactive.`)) return;
    try {
      await apiService.deactivateEmployee(id);
      fetchStats();
      fetchEmployees();
    } catch (err: any) {
      alert(err.message || "Failed to deactivate employee.");
    }
  };

  // Excel Upload & Validation
  const handleDownloadTemplate = async () => {
    try {
      const blob = await apiService.downloadExcelTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "TalentIQ_Employee_Import_Template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert("Failed to download template.");
    }
  };

  const handleExcelUploadAndValidate = async () => {
    if (!excelFile) return;
    setValidatingExcel(true);
    setExcelErrorMsg(null);
    setExcelSuccessMsg(null);
    setExcelPreview(null);

    try {
      const res = await apiService.importExcel(excelFile);
      setExcelPreview(res);
    } catch (err: any) {
      setExcelErrorMsg(err.message || "Failed to validate Excel import file.");
    } finally {
      setValidatingExcel(false);
    }
  };

  const handleConfirmExcelImport = async () => {
    if (!excelPreview || !excelPreview.valid_data) return;
    setImportingExcel(true);
    setExcelErrorMsg(null);

    try {
      const res = await apiService.confirmExcelImport(excelPreview.valid_data, updateExisting);
      setExcelSuccessMsg(res.message);
      setExcelPreview(null);
      setExcelFile(null);
      fetchStats();
      fetchEmployees();
    } catch (err: any) {
      setExcelErrorMsg(err.message || "Failed to confirm Excel import.");
    } finally {
      setImportingExcel(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* HEADER TITLE */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Users className="h-6 w-6 text-red-500" />
            Employee Master Data
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Centralized organizational workforce repository. Manage employee profiles, skills, current project assignments, availability dates, and performance records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
            title="Download standard 5-sheet Excel import template"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Download Excel Template</span>
          </button>

          <button
            onClick={() => {
              setExcelFile(null);
              setExcelPreview(null);
              setExcelErrorMsg(null);
              setExcelSuccessMsg(null);
              setShowExcelModal(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 px-3 py-1.5 text-xs font-semibold shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Bulk Excel Import</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 rounded-lg bg-red-500 hover:bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm cursor-pointer transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-4 flex items-center justify-between border-slate-200">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Workforce</span>
            <span className="text-2xl font-extrabold text-slate-900 mt-0.5 block">{stats.total_employees}</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
            <Users className="h-5 w-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center justify-between border-slate-200">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active Employees</span>
            <span className="text-2xl font-extrabold text-emerald-600 mt-0.5 block">{stats.active_employees}</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
            <UserCheck className="h-5 w-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center justify-between border-slate-200">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Inactive Employees</span>
            <span className="text-2xl font-extrabold text-amber-600 mt-0.5 block">{stats.inactive_employees}</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 border border-amber-100 text-amber-600">
            <UserX className="h-5 w-5" />
          </div>
        </GlassCard>
      </div>

      {/* SEARCH AND FILTERS BAR */}
      <GlassCard className="p-4 mb-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by Employee ID, Name, or Skill..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Department Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-red-500"
              >
                <option value="">All Departments</option>
                {stats.departments.map((dept, i) => (
                  <option key={i} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-red-500"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            {(search || departmentFilter || statusFilter) && (
              <button
                onClick={() => {
                  setSearch("");
                  setDepartmentFilter("");
                  setStatusFilter("");
                  setPage(1);
                }}
                className="text-xs font-semibold text-red-500 hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </GlassCard>

      {/* EMPLOYEE MASTER TABLE */}
      <GlassCard className="p-0 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Designation</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Experience</th>
                <th className="py-3 px-4">Current Project</th>
                <th className="py-3 px-4">Available From</th>
                <th className="py-3 px-4 text-center">Skills</th>
                <th className="py-3 px-4 text-center">Rating</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-red-500" />
                    <span>Loading Employee Master Data...</span>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 italic">
                    No employee records found matching criteria.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-red-600">
                      {emp.employee_id}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {emp.name}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {emp.designation || "-"}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {emp.department || "-"}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {emp.total_experience_years !== null ? `${emp.total_experience_years} yrs` : "-"}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {emp.current_project ? (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-medium text-[11px] border border-slate-200">
                          {emp.current_project}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {emp.available_from || "-"}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">
                      {emp.skills_count}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {emp.performance_rating !== null ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {emp.performance_rating}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        emp.status === "Active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleViewProfile(emp.id)}
                          className="p-1 text-slate-500 hover:text-red-500 transition-colors cursor-pointer"
                          title="View Employee Profile"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(emp.id)}
                          className="p-1 text-slate-500 hover:text-blue-500 transition-colors cursor-pointer"
                          title="Edit Employee Profile"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {emp.status === "Active" && (
                          <button
                            onClick={() => handleDeactivate(emp.id, emp.name)}
                            className="p-1 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                            title="Deactivate Employee"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* SERVER-SIDE PAGINATION FOOTER */}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50 text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-900">{employees.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> to{" "}
            <strong className="text-slate-900">{Math.min(page * pageSize, totalCount)}</strong> of{" "}
            <strong className="text-slate-900">{totalCount}</strong> employees
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <span className="font-semibold text-slate-700">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </GlassCard>

      {/* PROFILE DRAWER (MODAL) */}
      {selectedEmpId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-200 p-4 bg-slate-50 sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500 text-white font-bold text-sm">
                  {profileData?.employee_id?.slice(0, 3) || "EMP"}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{profileData?.name || "Loading..."}</h3>
                  <p className="text-xs font-mono text-slate-500">ID: {profileData?.employee_id} &bull; {profileData?.designation}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedEmpId(null);
                  setProfileData(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 space-y-6 flex-1">
              {loadingProfile || !profileData ? (
                <div className="py-20 text-center text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-red-500" />
                  <span>Loading Employee Profile...</span>
                </div>
              ) : (
                <>
                  {/* SECTION 1: BASIC INFORMATION */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5 mb-3 flex items-center gap-1.5">
                      <Building className="h-4 w-4 text-red-500" />
                      Basic Information
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Department</span>
                        <span className="font-semibold text-slate-900">{profileData.department || "-"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email</span>
                        <span className="font-medium text-slate-800">{profileData.email || "-"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Experience</span>
                        <span className="font-semibold text-slate-900">{profileData.total_experience_years !== null ? `${profileData.total_experience_years} years` : "-"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phone</span>
                        <span className="font-medium text-slate-800">{profileData.phone || "-"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
                        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${profileData.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{profileData.status}</span>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: CURRENT ASSIGNMENT & AVAILABILITY */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5 mb-3 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-blue-500" />
                      Current Assignment & Availability Data
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Project</span>
                        <span className="font-bold text-slate-900">{profileData.current_project || "None (Unassigned)"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assignment Dates</span>
                        <span className="font-medium text-slate-800">{profileData.assignment_start_date ? `${profileData.assignment_start_date} – ${profileData.assignment_end_date || 'Ongoing'}` : "-"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Allocation %</span>
                        <span className="font-semibold text-slate-900">{profileData.allocation_percentage}%</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Available From</span>
                        <span className="font-mono font-bold text-blue-600">{profileData.available_from || "-"}</span>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: SKILLS MATRIX */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5 mb-3 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      Employee Skill Matrix
                    </h4>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                            <th className="py-2 px-3">Skill Name</th>
                            <th className="py-2 px-3">Normalized Alias</th>
                            <th className="py-2 px-3">Proficiency Level</th>
                            <th className="py-2 px-3">Experience</th>
                            <th className="py-2 px-3">Source</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {profileData.skills?.map((sk: any, i: number) => (
                            <tr key={i}>
                              <td className="py-2 px-3 font-bold text-slate-900">{sk.skill_name}</td>
                              <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{sk.normalized_skill_name}</td>
                              <td className="py-2 px-3">
                                {sk.proficiency_level ? (
                                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                    {sk.proficiency_level}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Not specified</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-slate-700">{sk.experience_years ? `${sk.experience_years} yrs` : "-"}</td>
                              <td className="py-2 px-3 text-slate-500">{sk.source || "Manual Entry"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* SECTION 4: PROJECT HISTORY */}
                  {profileData.projects && profileData.projects.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5 mb-3 flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-emerald-500" />
                        Project History
                      </h4>
                      <div className="space-y-2">
                        {profileData.projects.map((p: any, i: number) => (
                          <div key={i} className="p-3 rounded-lg border border-slate-200 bg-white text-xs">
                            <div className="flex justify-between items-start font-bold text-slate-900">
                              <span>{p.title}</span>
                              <span className="font-mono text-[10px] text-slate-400">{p.start_date} – {p.end_date || 'Present'}</span>
                            </div>
                            <p className="text-slate-600 mt-1">{p.role ? `Role: ${p.role}` : ""} &bull; Domain: {p.domain || "General"}</p>
                            {p.technologies && p.technologies.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {p.technologies.map((t: string, ti: number) => (
                                  <span key={ti} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SECTION 5: CERTIFICATIONS */}
                  {profileData.certifications && profileData.certifications.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5 mb-3 flex items-center gap-1.5">
                        <Award className="h-4 w-4 text-amber-500" />
                        Certifications
                      </h4>
                      <div className="space-y-2">
                        {profileData.certifications.map((c: any, i: number) => (
                          <div key={i} className="flex justify-between items-center p-2.5 rounded-lg border border-slate-200 bg-white text-xs">
                            <div>
                              <span className="font-bold text-slate-900 block">{c.name}</span>
                              <span className="text-slate-500 text-[11px]">{c.issuing_organization} &bull; Issued: {c.issue_date || c.year || "N/A"}</span>
                            </div>
                            {c.credential_id && (
                              <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">{c.credential_id}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SECTION 6: PERFORMANCE INFORMATION */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5 mb-3 flex items-center gap-1.5">
                      <Star className="h-4 w-4 text-amber-500" />
                      Approved Performance Information
                    </h4>
                    <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-900">Rating: {profileData.performance_rating || "N/A"} / 5.0</span>
                        <span className="text-amber-700 font-medium">Review Period: {profileData.performance_review_period || "N/A"}</span>
                      </div>
                      <p className="text-amber-800 mt-1">{profileData.performance_notes || "No manager evaluation notes recorded."}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MANUAL ADD/EDIT EMPLOYEE MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-red-500" />
                {editingEmpId ? "Edit Employee Profile" : "Add New Employee"}
              </h3>
              <button onClick={() => setShowFormModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 font-semibold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    placeholder="e.g. EMP011 (leave blank for auto)"
                    className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Employee Name"
                    className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="e.g. Engineering, AI/ML"
                    className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Designation / Role</label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Senior Backend Developer"
                    className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="emp@company.com"
                    className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Total Experience (Years)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.total_experience_years}
                    onChange={(e) => setFormData({ ...formData, total_experience_years: e.target.value })}
                    placeholder="e.g. 4.5"
                    className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* Current Assignment & Dates */}
              <div className="border-t border-slate-200 pt-3">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-2">Current Project & Availability</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Current Project Name</label>
                    <input
                      type="text"
                      value={formData.current_project}
                      onChange={(e) => setFormData({ ...formData, current_project: e.target.value })}
                      placeholder="e.g. Banking API Migration"
                      className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">Available From (YYYY-MM-DD)</label>
                    <input
                      type="text"
                      value={formData.available_from}
                      onChange={(e) => setFormData({ ...formData, available_from: e.target.value })}
                      placeholder="2026-10-01"
                      className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">Assignment Start Date</label>
                    <input
                      type="text"
                      value={formData.assignment_start_date}
                      onChange={(e) => setFormData({ ...formData, assignment_start_date: e.target.value })}
                      placeholder="2026-05-01"
                      className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">Assignment End Date</label>
                    <input
                      type="text"
                      value={formData.assignment_end_date}
                      onChange={(e) => setFormData({ ...formData, assignment_end_date: e.target.value })}
                      placeholder="2026-09-30"
                      className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* Performance */}
              <div className="border-t border-slate-200 pt-3">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-2">Performance Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Performance Rating (0.0 – 5.0)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={formData.performance_rating}
                      onChange={(e) => setFormData({ ...formData, performance_rating: e.target.value })}
                      placeholder="4.5"
                      className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">Review Period</label>
                    <input
                      type="text"
                      value={formData.performance_review_period}
                      onChange={(e) => setFormData({ ...formData, performance_review_period: e.target.value })}
                      placeholder="2025-Q4"
                      className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-red-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={() => setShowFormModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEmployee}
                disabled={formSaving}
                className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
              >
                {formSaving ? "Saving..." : "Save Employee Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK EXCEL IMPORT MODAL */}
      {showExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                Bulk Employee Data Import (Excel)
              </h3>
              <button onClick={() => setShowExcelModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              {excelSuccessMsg && (
                <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold block">Import Completed</span>
                    <span>{excelSuccessMsg}</span>
                  </div>
                </div>
              )}

              {excelErrorMsg && (
                <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Import Validation Error</span>
                    <span>{excelErrorMsg}</span>
                  </div>
                </div>
              )}

              {/* STEP 1: UPLOAD FILE */}
              {!excelPreview && !excelSuccessMsg && (
                <div>
                  <p className="text-slate-600 mb-3 leading-relaxed">
                    Upload a 5-sheet Excel workbook (.xlsx) containing Employees, Skills, Project History, Current Assignments, and Certifications. Download the standard template if you haven't formatted your file yet.
                  </p>

                  <div className="flex items-center gap-3 mb-4">
                    <button
                      onClick={handleDownloadTemplate}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer shadow-2xs"
                    >
                      <Download className="h-4 w-4 text-slate-500" />
                      <span>Download Standard Excel Template</span>
                    </button>
                  </div>

                  <input
                    type="file"
                    id="excel-file-input"
                    className="hidden"
                    accept=".xlsx"
                    onChange={(e) => e.target.files?.[0] && setExcelFile(e.target.files[0])}
                  />

                  {excelFile ? (
                    <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/40 rounded-xl p-6 text-center">
                      <FileSpreadsheet className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                      <p className="font-bold text-slate-900">{excelFile.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{(excelFile.size / 1024).toFixed(1)} KB &bull; Ready for validation</p>
                      <button
                        onClick={() => setExcelFile(null)}
                        className="mt-2 text-xs font-semibold text-red-500 hover:underline cursor-pointer"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="excel-file-input"
                      className="border-2 border-dashed border-slate-200 hover:border-slate-300 bg-slate-50/50 rounded-xl p-8 text-center cursor-pointer block"
                    >
                      <UploadCloud className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                      <span className="font-semibold text-red-500 hover:underline">Click to browse Excel file (.xlsx)</span>
                      <span className="text-slate-500"> or drag and drop</span>
                    </label>
                  )}
                </div>
              )}

              {/* STEP 2: PREVIEW & VALIDATION RESULTS */}
              {excelPreview && (
                <div className="space-y-4">
                  {/* Summary KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Employees</span>
                      <span className="text-lg font-bold text-slate-900">{excelPreview.total_employees}</span>
                    </div>

                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Valid Records</span>
                      <span className="text-lg font-bold text-emerald-800">{excelPreview.valid_employees}</span>
                    </div>

                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 block">Invalid Records</span>
                      <span className="text-lg font-bold text-red-800">{excelPreview.invalid_employees}</span>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Warnings</span>
                      <span className="text-lg font-bold text-amber-800">{excelPreview.warnings_count}</span>
                    </div>
                  </div>

                  {/* Duplicate employee info */}
                  {excelPreview.existing_employees > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-blue-900">
                      <div>
                        <span className="font-bold">{excelPreview.existing_employees} existing employee ID(s) detected in database.</span>
                        <span className="block text-[11px]">Select option below to update or skip existing records.</span>
                      </div>
                      <label className="flex items-center gap-1.5 font-semibold text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={updateExisting}
                          onChange={(e) => setUpdateExisting(e.target.checked)}
                          className="rounded border-slate-300 text-red-500 focus:ring-red-500"
                        />
                        <span>Update Existing Employees</span>
                      </label>
                    </div>
                  )}

                  {/* ERROR ROW TABLE */}
                  {excelPreview.errors && excelPreview.errors.length > 0 && (
                    <div>
                      <h4 className="font-bold text-red-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        Validation Error Rows ({excelPreview.errors.length})
                      </h4>
                      <div className="overflow-x-auto rounded-lg border border-red-200 max-h-48 overflow-y-auto">
                        <table className="w-full text-left text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-red-50 border-b border-red-200 text-red-800 uppercase tracking-wider font-semibold">
                              <th className="py-2 px-3">Sheet</th>
                              <th className="py-2 px-3">Row</th>
                              <th className="py-2 px-3">Employee ID</th>
                              <th className="py-2 px-3">Field</th>
                              <th className="py-2 px-3">Problem</th>
                              <th className="py-2 px-3">Allowed Format</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-100 bg-white">
                            {excelPreview.errors.map((err: any, i: number) => (
                              <tr key={i}>
                                <td className="py-1.5 px-3 font-semibold text-slate-700">{err.sheet}</td>
                                <td className="py-1.5 px-3 font-mono font-bold text-slate-900">Row {err.row}</td>
                                <td className="py-1.5 px-3 font-mono text-red-600">{err.employee_id || "-"}</td>
                                <td className="py-1.5 px-3 font-medium text-slate-800">{err.field}</td>
                                <td className="py-1.5 px-3 text-red-700 font-medium">{err.problem}</td>
                                <td className="py-1.5 px-3 text-slate-500">{err.allowed}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={() => setShowExcelModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-semibold cursor-pointer"
              >
                Close
              </button>

              {!excelPreview && excelFile && (
                <button
                  onClick={handleExcelUploadAndValidate}
                  disabled={validatingExcel}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {validatingExcel ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Validating Excel Sheets...</span>
                    </>
                  ) : (
                    <>
                      <span>Validate & Preview</span>
                    </>
                  )}
                </button>
              )}

              {excelPreview && excelPreview.valid_employees > 0 && (
                <button
                  onClick={handleConfirmExcelImport}
                  disabled={importingExcel}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {importingExcel ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Importing Workforce Data...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Import {excelPreview.valid_employees} Employee(s)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeMaster;
