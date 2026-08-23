import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase,
  Users,
  Sparkles,
  Search,
  Filter,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Award,
  Target,
  FileCheck2,
  Plus,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  FileText,
  Loader2
} from "lucide-react";
import { apiService } from "../services/api";
import { GlassCard } from "../components/GlassCard";

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const [summaryData, setSummaryData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getDashboardSummary();
      setSummaryData(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load Project Manager Dashboard summary.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "READY_FOR_ASSESSMENT":
      case "SHORTLISTED":
        return "bg-emerald-50 text-emerald-700 border-emerald-300";
      case "RANKING_COMPLETED":
        return "bg-amber-50 text-amber-700 border-amber-300";
      case "MATCHING_COMPLETED":
        return "bg-purple-50 text-purple-700 border-purple-300";
      case "AVAILABILITY_COMPLETED":
        return "bg-blue-50 text-blue-700 border-blue-300";
      case "REQUIREMENT_REVIEWED":
      case "REQUIREMENT_EXTRACTED":
        return "bg-indigo-50 text-indigo-700 border-indigo-300";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  const filteredProjects = (summaryData?.recent_projects || []).filter((p: any) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      const title = (p.project_name || p.title || "").toLowerCase();
      const domain = (p.domain || "").toLowerCase();
      const idStr = String(p.id);
      if (!title.includes(s) && !domain.includes(s) && !idStr.includes(s)) return false;
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* PAGE HEADER */}
      <div className="mb-6 border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Briefcase className="h-6 w-6 text-blue-600" />
            Project Manager Dashboard
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Centralized orchestration workspace for AI-Based Workforce Skill Matching & Project Staffing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/upload-jd")}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm cursor-pointer transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Create Project / Upload Requirement</span>
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* GLOBAL SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <GlassCard className="p-4 border-l-4 border-l-blue-600">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Total Projects</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900">
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> : summaryData?.total_projects || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Project Requirements</div>
        </GlassCard>

        <GlassCard className="p-4 border-l-4 border-l-indigo-600">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Active Staffing</div>
          <div className="mt-1 text-2xl font-extrabold text-indigo-900">
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-indigo-600" /> : summaryData?.active_projects || 0}
          </div>
          <div className="text-[11px] text-indigo-600 font-medium mt-1">In active workflow</div>
        </GlassCard>

        <GlassCard className="p-4 border-l-4 border-l-emerald-500">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Total Workforce</div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-800">
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-emerald-600" /> : summaryData?.workforce?.total_employees || 0}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            {summaryData?.workforce?.active_employees || 0} Active Employees
          </div>
        </GlassCard>

        <GlassCard className="p-4 border-l-4 border-l-purple-600">
          <div className="text-[11px] font-bold uppercase tracking-wider text-purple-600">Skill Taxonomy</div>
          <div className="mt-1 text-2xl font-extrabold text-purple-900">
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-purple-600" /> : summaryData?.taxonomy?.total_skills || 0}
          </div>
          <div className="text-[11px] text-purple-600 font-medium mt-1">Canonical skills catalog</div>
        </GlassCard>

        <GlassCard className="p-4 border-l-4 border-l-amber-500">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Ready for Assessment</div>
          <div className="mt-1 text-2xl font-extrabold text-amber-900">
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-amber-600" /> : summaryData?.projects_ready_for_assessment || 0}
          </div>
          <div className="text-[11px] text-amber-600 font-medium mt-1">2× Shortlists generated</div>
        </GlassCard>
      </div>

      {/* QUICK WORKFORCE & TAXONOMY SUMMARY BANNER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <GlassCard className="p-5 border-blue-200 bg-blue-50/20 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Employee Master Data</h3>
                <p className="text-xs text-slate-500">Centralized workforce repository containing profiles, skills, and history.</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-[11px] font-extrabold rounded-full">
              {summaryData?.workforce?.total_employees || 0} Employees
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-blue-100 pt-3">
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-700">
              <span>Active: <strong className="text-emerald-700">{summaryData?.workforce?.active_employees || 0}</strong></span>
              <span>Inactive: <strong className="text-slate-500">{summaryData?.workforce?.inactive_employees || 0}</strong></span>
            </div>
            <button
              onClick={() => navigate("/employees")}
              className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              <span>Manage Employees</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </GlassCard>

        <GlassCard className="p-5 border-purple-200 bg-purple-50/20 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Layers className="h-6 w-6 text-purple-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Skill Taxonomy & Proficiency</h3>
                <p className="text-xs text-slate-500">Standardized skill dictionary with numeric levels (1–4).</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-purple-100 text-purple-800 text-[11px] font-extrabold rounded-full">
              {summaryData?.taxonomy?.total_skills || 0} Standard Skills
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-purple-100 pt-3">
            <div className="text-xs font-semibold text-slate-700">
              Levels: Beginner (1) &bull; Intermediate (2) &bull; Advanced (3) &bull; Expert (4)
            </div>
            <button
              onClick={() => navigate("/skills")}
              className="flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-800 cursor-pointer"
            >
              <span>Manage Taxonomy</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </GlassCard>
      </div>

      {/* RECENT PROJECTS & WORKFLOW WORKSPACE TABLE */}
      <GlassCard className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-600" />
              Project Staffing Workspaces
            </h3>
            <p className="text-xs text-slate-500">Select a project to open its dedicated workflow workspace.</p>
          </div>

          {/* Search & Status Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Project Name, ID, Domain..."
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="REQUIREMENT_EXTRACTED">Extracted</option>
              <option value="REQUIREMENT_REVIEWED">Confirmed</option>
              <option value="AVAILABILITY_COMPLETED">Availability Done</option>
              <option value="MATCHING_COMPLETED">Matching Done</option>
              <option value="RANKING_COMPLETED">Ranking Done</option>
              <option value="READY_FOR_ASSESSMENT">Ready for Assessment</option>
            </select>
          </div>
        </div>

        {/* PROJECTS TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-4">Project ID & Name</th>
                <th className="py-3 px-4">Domain</th>
                <th className="py-3 px-4 text-center">Team Size (N)</th>
                <th className="py-3 px-4 text-center">Target Shortlist (2N)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading Project Workspaces...</span>
                  </td>
                </tr>
              ) : filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                    No project requirements found matching specified filter criteria.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{p.project_name || p.title}</div>
                      <div className="text-[11px] font-mono text-slate-400">PROJ-{p.id}</div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      {p.domain}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                      {p.required_team_size} Employees
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-purple-700">
                      {p.target_shortlist} Candidates
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${getStatusBadgeClass(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => navigate(`/project/${p.id}`)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-2xs transition-colors cursor-pointer flex items-center gap-1 mx-auto"
                      >
                        <span>Open Workspace</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};

export default Dashboard;
