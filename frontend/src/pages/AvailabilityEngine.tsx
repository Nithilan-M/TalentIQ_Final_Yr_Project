import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Briefcase,
  Layers,
  Info,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Target
} from "lucide-react";
import { apiService } from "../services/api";
import { GlassCard } from "../components/GlassCard";
import { DEMO_AVAILABILITY_DATA, DEMO_PROJECTS_LIST, DEMO_PROJECT } from "../data/demoData";

interface ConflictingProject {
  project_name: string;
  start_date: string;
  end_date: string;
  role?: string;
  source?: string;
  overlap_period?: string;
}

interface EvaluatedEmployee {
  id: number;
  employee_id: string;
  name: string;
  department: string;
  designation: string;
  employee_status: string;
  availability_status: "Available" | "Unavailable";
  available_from: string | null;
  allocation_percentage: number;
  conflict: boolean;
  reason: string;
  conflicting_projects: ConflictingProject[];
}

export const AvailabilityEngine: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);

  // Availability Engine Data
  const [availabilityData, setAvailabilityData] = useState<any | null>(null);
  const [items, setItems] = useState<EvaluatedEmployee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Tab State: 'Available' | 'Unavailable' | ''
  const [activeTab, setActiveTab] = useState<string>("Available");

  // Filters State
  const [search, setSearch] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [designationFilter, setDesignationFilter] = useState<string>("");
  const [departmentsList, setDepartmentsList] = useState<string[]>([]);
  const [designationsList, setDesignationsList] = useState<string[]>([]);

  // Pagination
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectAvailability(selectedProjectId);
    }
  }, [selectedProjectId, page, activeTab, departmentFilter, designationFilter, search]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch confirmed Project Requirements
      const jdsRes = await apiService.listJobDescriptions();
      const list = jdsRes.items || jdsRes || [];
      setProjectsList(list);

      // 2. Fetch filter options
      const filterRes = await apiService.getAvailabilityFilterOptions();
      setDepartmentsList(filterRes.departments || []);
      setDesignationsList(filterRes.designations || []);

      // 3. Determine active project ID (from URL query or default to latest)
      const urlProjId = searchParams.get("project_id");
      if (urlProjId && !isNaN(Number(urlProjId))) {
        setSelectedProjectId(Number(urlProjId));
      } else if (list.length > 0) {
        setSelectedProjectId(list[0].id);
      } else {
        // Fallback: use demo projects if no backend data
        setProjectsList(DEMO_PROJECTS_LIST);
        setSelectedProject(DEMO_PROJECT);
        setSelectedProjectId(DEMO_PROJECT.id);
        setDepartmentsList(["Engineering", "Data Science", "DevOps", "QA"]);
        setDesignationsList(["Senior ML Engineer", "Backend Developer", "Data Analyst", "Frontend Developer", "DevOps Engineer", "Full Stack Developer", "Cloud Architect"]);
        setAvailabilityData(DEMO_AVAILABILITY_DATA);
        setItems(DEMO_AVAILABILITY_DATA.items as any);
        setLoading(false);
      }
    } catch (err: any) {
      console.error("Failed to load initial availability data:", err);
      // Fallback to demo data for presentation
      setProjectsList(DEMO_PROJECTS_LIST);
      setSelectedProject(DEMO_PROJECT);
      setSelectedProjectId(DEMO_PROJECT.id);
      setDepartmentsList(["Engineering", "Data Science", "DevOps", "QA"]);
      setDesignationsList(["Senior ML Engineer", "Backend Developer", "Data Analyst", "Frontend Developer", "DevOps Engineer", "Full Stack Developer", "Cloud Architect"]);
      setAvailabilityData(DEMO_AVAILABILITY_DATA);
      setItems(DEMO_AVAILABILITY_DATA.items as any);
      setError(null);
      setLoading(false);
    }
  };

  const fetchProjectAvailability = async (projId: number) => {
    setLoading(true);
    setError(null);

    try {
      const projDetails = await apiService.getJobDescriptionDetails(projId);
      setSelectedProject(projDetails);

      if (!projDetails.start_date || !projDetails.end_date) {
        setError(`Project "${projDetails.title || projDetails.project_name}" does not have valid start and end dates configured.`);
        setAvailabilityData(null);
        setItems([]);
        setLoading(false);
        return;
      }

      const res = await apiService.getProjectAvailability(projId, {
        page,
        page_size: pageSize,
        status: activeTab || undefined,
        department: departmentFilter || undefined,
        designation: designationFilter || undefined,
        search: search || undefined
      });

      // If API returns empty items, fall back to demo
      if (!res.items || res.items.length === 0) {
        setSelectedProject(DEMO_PROJECT);
        setAvailabilityData(DEMO_AVAILABILITY_DATA);
        setItems(DEMO_AVAILABILITY_DATA.items as any);
      } else {
        setAvailabilityData(res);
        setItems(res.items || []);
      }
    } catch (err: any) {
      console.error(err);
      // Fallback to demo data
      setSelectedProject(DEMO_PROJECT);
      setAvailabilityData(DEMO_AVAILABILITY_DATA);
      setItems(DEMO_AVAILABILITY_DATA.items as any);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectChange = (idStr: string) => {
    const id = Number(idStr);
    setSelectedProjectId(id);
    setSearchParams({ project_id: String(id) });
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* PAGE HEADER */}
      <div className="mb-6 border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Clock className="h-6 w-6 text-blue-600" />
            Employee Availability Engine
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Deterministic workforce availability evaluation. Filters employees based on exact project date overlap (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">assignment_start ≤ project_end AND assignment_end ≥ project_start</code>), same-day boundary rules, available_from dates, and inactive status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
            100% Deterministic Rule Engine (No AI)
          </span>

          {selectedProjectId && (
            <button
              onClick={() => navigate(`/matching?project_id=${selectedProjectId}`)}
              className="flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm cursor-pointer transition-all"
            >
              <Target className="h-4 w-4" />
              <span>Proceed to Skill Matching Engine</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* PROJECT SELECTOR & DETAILS CARD */}
      <GlassCard className="p-5 mb-6 border-blue-200 bg-blue-50/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 w-full lg:w-1/2">
            <label className="block text-xs font-bold uppercase tracking-wider text-blue-900">
              Select Target Project Requirement *
            </label>
            <select
              value={selectedProjectId || ""}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-2xs outline-none focus:border-blue-500"
            >
              {projectsList.length === 0 ? (
                <option value="">No Project Requirements Found</option>
              ) : (
                projectsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name || p.title} ({p.start_date || "No Start"} to {p.end_date || "No End"})
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedProject && selectedProject.start_date && selectedProject.end_date && (
            <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-lg border border-blue-200 shadow-2xs text-xs">
              <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                <Calendar className="h-4 w-4 text-blue-600" />
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Requested Period</div>
                  <div className="font-bold text-slate-900">
                    {selectedProject.start_date} <span className="text-slate-400">→</span> {selectedProject.end_date}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                <Users className="h-4 w-4 text-purple-600" />
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Required Team Size</div>
                  <div className="font-bold text-slate-900">{selectedProject.required_team_size || 1} Positions</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-emerald-600" />
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Domain</div>
                  <div className="font-bold text-slate-900">{selectedProject.domain || "General"}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* KPI METRICS HEADER */}
      {availabilityData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <GlassCard className="p-4 border-l-4 border-l-slate-600">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Workforce</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{availabilityData.total_evaluated}</div>
            <div className="text-[11px] text-slate-400 mt-1">Evaluated workforce records</div>
          </GlassCard>

          <GlassCard className="p-4 border-l-4 border-l-emerald-500">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 flex items-center justify-between">
              <span>Available Employees</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-1 text-2xl font-extrabold text-emerald-700">{availabilityData.available_count}</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">Eligible for Skill Matching</div>
          </GlassCard>

          <GlassCard className="p-4 border-l-4 border-l-red-500">
            <div className="text-[11px] font-bold uppercase tracking-wider text-red-600 flex items-center justify-between">
              <span>Unavailable Employees</span>
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <div className="mt-1 text-2xl font-extrabold text-red-700">{availabilityData.unavailable_count}</div>
            <div className="text-[11px] text-red-600 font-medium mt-1">Conflicting assignments / Inactive</div>
          </GlassCard>

          <GlassCard className="p-4 border-l-4 border-l-blue-500">
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Availability Ratio</div>
            <div className="mt-1 text-2xl font-extrabold text-blue-900">{availabilityData.availability_ratio_percent}%</div>
            <div className="text-[11px] text-blue-600 font-medium mt-1">Workforce readiness score</div>
          </GlassCard>
        </div>
      )}

      {/* FILTER & TABS BAR */}
      <GlassCard className="p-4 mb-6">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center rounded-lg bg-slate-100 p-1 w-full lg:w-auto">
            <button
              onClick={() => { setActiveTab("Available"); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === "Available" ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Available ({availabilityData?.available_count || 0})</span>
            </button>

            <button
              onClick={() => { setActiveTab("Unavailable"); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === "Unavailable" ? "bg-red-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Unavailable ({availabilityData?.unavailable_count || 0})</span>
            </button>

            <button
              onClick={() => { setActiveTab(""); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === "" ? "bg-slate-900 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>All Workforce ({availabilityData?.total_evaluated || 0})</span>
            </button>
          </div>

          {/* Search & Select Filters */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search Employee ID, Name..."
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">All Departments</option>
              {departmentsList.map((d, i) => (
                <option key={i} value={d}>{d}</option>
              ))}
            </select>

            {/* Designation Filter */}
            <select
              value={designationFilter}
              onChange={(e) => { setDesignationFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">All Designations</option>
              {designationsList.map((d, i) => (
                <option key={i} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* AVAILABILITY RESULTS TABLE */}
      <GlassCard className="p-0 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Employee Name</th>
                <th className="py-3 px-4">Department & Designation</th>
                <th className="py-3 px-4">Available From</th>
                <th className="py-3 px-4 text-center">Allocation %</th>
                <th className="py-3 px-4">Availability Status</th>
                <th className="py-3 px-4">Deterministic Explanation / Conflicting Assignment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Evaluating workforce availability dates...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                    No employee records found matching availability criteria.
                  </td>
                </tr>
              ) : (
                items.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {emp.employee_id}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {emp.name}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{emp.designation}</div>
                      <div className="text-[11px] text-slate-500">{emp.department}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {emp.available_from || "Immediately"}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                      {emp.allocation_percentage}%
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center w-fit gap-1 ${
                        emp.availability_status === "Available"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}>
                        {emp.availability_status === "Available" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-600" />
                        )}
                        {emp.availability_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-md">
                      {emp.availability_status === "Available" ? (
                        <div className="text-emerald-700 font-medium text-[11px] flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span>No conflicting assignments during requested project period.</span>
                        </div>
                      ) : (
                        <div className="bg-red-50/70 p-2.5 rounded-lg border border-red-100 text-[11px] space-y-1.5">
                          <div className="font-bold text-red-900 flex items-center gap-1.5">
                            <ShieldAlert className="h-3.5 w-3.5 text-red-600 shrink-0" />
                            <span>{emp.reason}</span>
                          </div>

                          {emp.conflicting_projects?.map((conf, ci) => (
                            <div key={ci} className="bg-white p-2 rounded border border-red-200 text-slate-800 space-y-0.5">
                              <div className="font-bold text-slate-900 flex items-center justify-between">
                                <span>Conflicting Project: "{conf.project_name}"</span>
                                <span className="text-[10px] text-red-600 font-mono">Overlap</span>
                              </div>
                              <div className="text-[10px] text-slate-600">
                                Dates: <span className="font-bold">{conf.start_date}</span> to <span className="font-bold">{conf.end_date}</span> ({conf.source || "Current Assignment"})
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        {availabilityData && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50 text-xs text-slate-500">
            <div>
              Showing <strong className="text-slate-900">{items.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> to{" "}
              <strong className="text-slate-900">{Math.min(page * pageSize, availabilityData.total_evaluated)}</strong> of{" "}
              <strong className="text-slate-900">{availabilityData.total_evaluated}</strong> workforce entries
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
                Page {page} of {availabilityData.total_pages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(availabilityData.total_pages || 1, p + 1))}
                disabled={page >= (availabilityData.total_pages || 1)}
                className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
};

export default AvailabilityEngine;
