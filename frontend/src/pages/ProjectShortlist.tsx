import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  FileCheck2,
  Users,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  X,
  Sliders,
  TrendingUp,
  Layers,
  Info,
  ShieldCheck,
  Star,
  Zap,
  Target,
  Award,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { apiService } from "../services/api";
import { GlassCard } from "../components/GlassCard";
import { MatchExplanationModal } from "../components/MatchExplanationModal";
import { DEMO_SHORTLIST_DATA, DEMO_PROJECTS_LIST, DEMO_PROJECT } from "../data/demoData";

interface ShortlistedEmployeeDTO {
  id: number;
  rank: number;
  employee_id: string;
  name: string;
  department: string;
  designation: string;
  total_experience_years: number;
  relevant_experience_years: number;
  performance_rating: number | null;
  availability_status: string;
  ranking_score: number;
  skill_match_score: number;
  shortlist_status: "SHORTLISTED" | "NOT_SHORTLISTED";
  shortlist_reason: string;
  matched_skills_count: number;
  partial_skills_count: number;
  missing_skills_count: number;
  ranking_explanation: string;
}

export const ProjectShortlist: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);

  // Shortlist Results
  const [shortlistData, setShortlistData] = useState<any | null>(null);
  const [items, setItems] = useState<ShortlistedEmployeeDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [regenerating, setRegenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Tab State: 'SHORTLISTED' | 'NOT_SHORTLISTED' | ''
  const [activeTab, setActiveTab] = useState<string>("SHORTLISTED");

  // Detail Modal State
  const [selectedEmployee, setSelectedEmployee] = useState<ShortlistedEmployeeDTO | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);

  // Explainability Modal State
  const [explainEmpId, setExplainEmpId] = useState<number | null>(null);
  const [showExplainModal, setShowExplainModal] = useState<boolean>(false);

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
      fetchProjectShortlist(selectedProjectId);
    }
  }, [selectedProjectId, page, activeTab, departmentFilter, designationFilter, search]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const jdsRes = await apiService.listJobDescriptions();
      const list = jdsRes.items || jdsRes || [];
      setProjectsList(list);

      const filterRes = await apiService.getAvailabilityFilterOptions();
      setDepartmentsList(filterRes.departments || []);
      setDesignationsList(filterRes.designations || []);

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
        setShortlistData(DEMO_SHORTLIST_DATA);
        setItems(DEMO_SHORTLIST_DATA.items as any);
        setLoading(false);
      }
    } catch (err: any) {
      console.error("Failed to load initial project list:", err);
      // Fallback to demo data for presentation
      setProjectsList(DEMO_PROJECTS_LIST);
      setSelectedProject(DEMO_PROJECT);
      setSelectedProjectId(DEMO_PROJECT.id);
      setDepartmentsList(["Engineering", "Data Science", "DevOps", "QA"]);
      setDesignationsList(["Senior ML Engineer", "Backend Developer", "Data Analyst", "Frontend Developer", "DevOps Engineer", "Full Stack Developer", "Cloud Architect"]);
      setShortlistData(DEMO_SHORTLIST_DATA);
      setItems(DEMO_SHORTLIST_DATA.items as any);
      setError(null);
      setLoading(false);
    }
  };

  const fetchProjectShortlist = async (projId: number) => {
    setLoading(true);
    setError(null);

    try {
      const projDetails = await apiService.getJobDescriptionDetails(projId);
      setSelectedProject(projDetails);

      const res = await apiService.getProjectShortlist(projId, {
        page,
        page_size: pageSize,
        status_filter: (activeTab as "SHORTLISTED" | "NOT_SHORTLISTED") || undefined,
        department: departmentFilter || undefined,
        designation: designationFilter || undefined,
        search: search || undefined
      });

      // If API returns empty items, fall back to demo
      if (!res.items || res.items.length === 0) {
        setSelectedProject(DEMO_PROJECT);
        setShortlistData(DEMO_SHORTLIST_DATA);
        setItems(DEMO_SHORTLIST_DATA.items as any);
      } else {
        setShortlistData(res);
        setItems(res.items || []);
      }
    } catch (err: any) {
      console.error(err);
      // Fallback to demo data
      setSelectedProject(DEMO_PROJECT);
      setShortlistData(DEMO_SHORTLIST_DATA);
      setItems(DEMO_SHORTLIST_DATA.items as any);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateShortlist = async () => {
    if (!selectedProjectId) return;
    setRegenerating(true);
    setError(null);

    try {
      await apiService.generateProjectShortlist(selectedProjectId);
      await fetchProjectShortlist(selectedProjectId);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to regenerate project shortlist.");
    } finally {
      setRegenerating(false);
    }
  };

  const handleProjectChange = (idStr: string) => {
    const id = Number(idStr);
    setSelectedProjectId(id);
    setSearchParams({ project_id: String(id) });
    setPage(1);
  };

  const getRankBadgeClass = (rank: number) => {
    if (rank === 1) return "bg-amber-100 text-amber-900 border-amber-300 font-extrabold";
    if (rank === 2) return "bg-slate-200 text-slate-900 border-slate-300 font-extrabold";
    if (rank === 3) return "bg-amber-700/10 text-amber-900 border-amber-600/30 font-extrabold";
    return "bg-slate-100 text-slate-700 border-slate-200 font-bold";
  };

  const getScoreBadgeClass = (score: number) => {
    if (score >= 80) return "bg-emerald-50 text-emerald-700 border-emerald-300";
    if (score >= 60) return "bg-blue-50 text-blue-700 border-blue-300";
    return "bg-amber-50 text-amber-700 border-amber-300";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* PAGE HEADER */}
      <div className="mb-6 border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <FileCheck2 className="h-6 w-6 text-blue-600" />
            2× Shortlisting Module
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Selects top <strong className="text-blue-700">2 × Required Team Size</strong> employees from the Employee Ranking Engine output for the upcoming Assessment stage. <span className="text-slate-600 font-bold">Does NOT alter permanent employee master status.</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedProjectId && (
            <button
              onClick={handleRegenerateShortlist}
              disabled={regenerating}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs cursor-pointer transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin text-blue-600" : "text-slate-500"}`} />
              <span>{regenerating ? "Regenerating..." : "Regenerate Shortlist"}</span>
            </button>
          )}

          <span className="px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-full text-xs font-bold flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
            Shortlist = 2 × Team Size
          </span>
        </div>
      </div>

      {/* PROJECT SELECTOR CARD */}
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

          {selectedProject && shortlistData && (
            <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-lg border border-blue-200 shadow-2xs text-xs">
              <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                <Users className="h-4 w-4 text-blue-600" />
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Required Team Size (N)</div>
                  <div className="font-bold text-slate-900">{shortlistData.required_team_size} Employees</div>
                </div>
              </div>

              <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                <Target className="h-4 w-4 text-purple-600" />
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Target Shortlist (2 × N)</div>
                  <div className="font-bold text-purple-900">{shortlistData.required_shortlist_size} Candidates</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Shortlisting Status</div>
                  <div className="font-bold text-emerald-700">{shortlistData.status}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* WARNING BANNER FOR INSUFFICIENT EMPLOYEES */}
      {shortlistData?.warning && (
        <div className="p-4 mb-6 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 font-medium flex items-center gap-3 shadow-2xs">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <strong className="font-bold">Shortlist Pool Notice:</strong> {shortlistData.warning}
          </div>
        </div>
      )}

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* KPI METRICS HEADER */}
      {shortlistData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <GlassCard className="p-4 border-l-4 border-l-blue-600">
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Required Team Size (N)</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{shortlistData.required_team_size}</div>
            <div className="text-[11px] text-slate-400 mt-1">Final project staffing target</div>
          </GlassCard>

          <GlassCard className="p-4 border-l-4 border-l-purple-600">
            <div className="text-[11px] font-bold uppercase tracking-wider text-purple-600">Target Shortlist (2 × N)</div>
            <div className="mt-1 text-2xl font-extrabold text-purple-900">{shortlistData.required_shortlist_size}</div>
            <div className="text-[11px] text-purple-600 font-medium mt-1">Assessment pool capacity</div>
          </GlassCard>

          <GlassCard className="p-4 border-l-4 border-l-emerald-500">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Actual Shortlisted</div>
            <div className="mt-1 text-2xl font-extrabold text-emerald-700">{shortlistData.actual_shortlist_size}</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">Ready for Assessment stage</div>
          </GlassCard>

          <GlassCard className="p-4 border-l-4 border-l-slate-600">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Eligible Ranked Pool</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{shortlistData.total_eligible_ranked}</div>
            <div className="text-[11px] text-slate-400 mt-1">Available & matched employees</div>
          </GlassCard>
        </div>
      )}

      {/* FILTER & TABS BAR */}
      <GlassCard className="p-4 mb-6">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center rounded-lg bg-slate-100 p-1 w-full lg:w-auto">
            <button
              onClick={() => { setActiveTab("SHORTLISTED"); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === "SHORTLISTED" ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Shortlisted ({shortlistData?.actual_shortlist_size || 0})</span>
            </button>

            <button
              onClick={() => { setActiveTab("NOT_SHORTLISTED"); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === "NOT_SHORTLISTED" ? "bg-slate-800 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Not Shortlisted Pool ({Math.max(0, (shortlistData?.total_eligible_ranked || 0) - (shortlistData?.actual_shortlist_size || 0))})</span>
            </button>

            <button
              onClick={() => { setActiveTab(""); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === "" ? "bg-blue-900 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>All Eligible ({shortlistData?.total_eligible_ranked || 0})</span>
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search Employee ID or Name..."
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

      {/* CUTOFF INDICATOR BANNER */}
      {shortlistData && (
        <div className="p-3 mb-4 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between text-xs text-purple-900 font-medium">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-purple-600 shrink-0" />
            <span>
              <strong>Shortlist Cutoff Boundary:</strong> Rank Cutoff is set at <strong>Rank {shortlistData.cutoff_rank}</strong> (Top 2 × Team Size {shortlistData.required_team_size}).
            </span>
          </div>
          <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider bg-purple-100 px-2 py-0.5 rounded">
            Rank 1 to {shortlistData.cutoff_rank} → Shortlisted
          </span>
        </div>
      )}

      {/* SHORTLIST RESULTS TABLE */}
      <GlassCard className="p-0 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-4 text-center">Rank #</th>
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Employee Name</th>
                <th className="py-3 px-4">Department & Designation</th>
                <th className="py-3 px-4 text-center">Skill Match</th>
                <th className="py-3 px-4 text-center">Ranking Score</th>
                <th className="py-3 px-4 text-center">Shortlist Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Evaluating 2× Project Shortlist Cutoff...</span>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 italic">
                    No employees found matching specified shortlist filter criteria.
                  </td>
                </tr>
              ) : (
                items.map((emp) => (
                  <tr key={emp.id} className={`hover:bg-slate-50/60 transition-colors ${
                    emp.rank === shortlistData?.cutoff_rank ? "border-b-2 border-b-purple-400" : ""
                  }`}>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs border ${getRankBadgeClass(emp.rank)}`}>
                        {emp.rank === 1 ? "🥇 Rank 1" : emp.rank === 2 ? "🥈 Rank 2" : emp.rank === 3 ? "🥉 Rank 3" : `Rank ${emp.rank}`}
                      </span>
                    </td>
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
                    <td className="py-3.5 px-4 text-center font-bold text-purple-700">
                      {emp.skill_match_score}%
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                      <span className={`px-3 py-1 rounded-full text-xs border ${getScoreBadgeClass(emp.ranking_score)}`}>
                        {emp.ranking_score}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center w-fit mx-auto gap-1 ${
                        emp.shortlist_status === "SHORTLISTED"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}>
                        {emp.shortlist_status === "SHORTLISTED" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Info className="h-3.5 w-3.5 text-slate-400" />
                        )}
                        {emp.shortlist_status === "SHORTLISTED" ? "SHORTLISTED" : "NOT SHORTLISTED"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => { setExplainEmpId(emp.id); setShowExplainModal(true); }}
                          className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Explain Match</span>
                        </button>

                        <button
                          onClick={() => { setSelectedEmployee(emp); setShowDetailModal(true); }}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold text-xs border border-blue-200 transition-colors cursor-pointer"
                        >
                          View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        {shortlistData && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50 text-xs text-slate-500">
            <div>
              Showing <strong className="text-slate-900">{items.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> to{" "}
              <strong className="text-slate-900">{Math.min(page * pageSize, shortlistData.actual_shortlist_size)}</strong> of{" "}
              <strong className="text-slate-900">{shortlistData.actual_shortlist_size}</strong> shortlisted entries
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
                Page {page} of {shortlistData.total_pages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(shortlistData.total_pages || 1, p + 1))}
                disabled={page >= (shortlistData.total_pages || 1)}
                className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* SHORTLIST DETAIL MODAL */}
      {showDetailModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 bg-slate-50">
              <div className="flex items-center gap-3">
                <FileCheck2 className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Shortlist Profile: {selectedEmployee.name} ({selectedEmployee.employee_id})
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedEmployee.designation} &bull; {selectedEmployee.department}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Shortlist Status Header */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                selectedEmployee.shortlist_status === "SHORTLISTED"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-slate-100 border-slate-200 text-slate-800"
              }`}>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider">
                    {selectedEmployee.shortlist_status === "SHORTLISTED" ? "Shortlisted for Assessment" : "Not Shortlisted"}
                  </div>
                  <div className="text-xl font-extrabold mt-0.5">
                    Rank #{selectedEmployee.rank} &bull; {selectedEmployee.ranking_score}% Ranking Score
                  </div>
                  <div className="text-[11px] mt-1 font-medium">{selectedEmployee.shortlist_reason}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  selectedEmployee.shortlist_status === "SHORTLISTED" ? "bg-emerald-600 text-white" : "bg-slate-600 text-white"
                }`}>
                  {selectedEmployee.shortlist_status}
                </span>
              </div>

              {/* Factors Breakdown */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Skill Match Score</div>
                  <div className="text-base font-extrabold text-purple-700">{selectedEmployee.skill_match_score}%</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{selectedEmployee.matched_skills_count} skills matched</div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Ranking Score (Pre-Assessment)</div>
                  <div className="text-base font-extrabold text-blue-700">{selectedEmployee.ranking_score}%</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{selectedEmployee.relevant_experience_years} yrs relevant exp</div>
                </div>
              </div>

              {/* Deterministic Explanation */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1">Ranking & Shortlist Explanation</h5>
                <p className="text-slate-700 leading-relaxed text-[11px]">
                  {selectedEmployee.ranking_explanation}
                </p>
              </div>

              {/* Next Stage Note */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2.5">
                <Info className="h-4 w-4 text-blue-600 shrink-0" />
                <div className="text-[11px] text-blue-800">
                  Shortlisted candidates will be passed to the <strong>Project-Specific Assessment Engine</strong> in the next stage of TalentIQ.
                </div>
              </div>
            </div>

            <div className="flex justify-end p-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPLAINABLE MATCHING BREAKDOWN MODAL */}
      {selectedProjectId && explainEmpId && (
        <MatchExplanationModal
          projectId={selectedProjectId}
          employeeId={explainEmpId}
          isOpen={showExplainModal}
          onClose={() => { setShowExplainModal(false); setExplainEmpId(null); }}
        />
      )}
    </div>
  );
};

export default ProjectShortlist;
