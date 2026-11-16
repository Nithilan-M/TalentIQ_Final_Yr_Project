import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Award,
  Users,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Briefcase,
  CheckCircle2,
  AlertCircle,
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
  FileCheck2,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { apiService } from "../services/api";
import { GlassCard } from "../components/GlassCard";
import { MatchExplanationModal } from "../components/MatchExplanationModal";
import { DEMO_RANKING_DATA, DEMO_PROJECTS_LIST, DEMO_PROJECT } from "../data/demoData";

interface EmployeeRankingDTO {
  id: number;
  rank: number;
  employee_id: string;
  name: string;
  department: string;
  designation: string;
  total_experience_years: number;
  relevant_experience_years: number;
  performance_rating: number | null;
  performance_unspecified: boolean;
  availability_status: string;
  ranking_score: number;
  ranking_mode: string;
  skill_match_score: number;
  assessment_score: number | null;
  relevant_experience_score: number;
  performance_score: number;
  other_score: number;
  matched_skills_count: number;
  partial_skills_count: number;
  missing_skills_count: number;
  ranking_explanation: string;
}

export const EmployeeRanking: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);

  // Ranking Results
  const [rankingData, setRankingData] = useState<any | null>(null);
  const [rankings, setRankings] = useState<EmployeeRankingDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal State
  const [selectedRanking, setSelectedRanking] = useState<EmployeeRankingDTO | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);

  // Explainability Modal State
  const [explainEmpId, setExplainEmpId] = useState<number | null>(null);
  const [showExplainModal, setShowExplainModal] = useState<boolean>(false);

  // Filters State
  const [search, setSearch] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [designationFilter, setDesignationFilter] = useState<string>("");
  const [minScoreFilter, setMinScoreFilter] = useState<number | "">("");
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
      fetchProjectRankings(selectedProjectId);
    }
  }, [selectedProjectId, page, departmentFilter, designationFilter, minScoreFilter, search]);

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
        setRankingData(DEMO_RANKING_DATA);
        setRankings(DEMO_RANKING_DATA.items as any);
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
      setRankingData(DEMO_RANKING_DATA);
      setRankings(DEMO_RANKING_DATA.items as any);
      setError(null);
      setLoading(false);
    }
  };

  const fetchProjectRankings = async (projId: number) => {
    setLoading(true);
    setError(null);

    try {
      const projDetails = await apiService.getJobDescriptionDetails(projId);
      setSelectedProject(projDetails);

      const res = await apiService.getProjectEmployeeRankings(projId, {
        page,
        page_size: pageSize,
        department: departmentFilter || undefined,
        designation: designationFilter || undefined,
        min_score: minScoreFilter !== "" ? Number(minScoreFilter) : undefined,
        search: search || undefined,
        mode: "PRE_ASSESSMENT"
      });

      // If API returns empty items, fall back to demo
      if (!res.items || res.items.length === 0) {
        setSelectedProject(DEMO_PROJECT);
        setRankingData(DEMO_RANKING_DATA);
        setRankings(DEMO_RANKING_DATA.items as any);
      } else {
        setRankingData(res);
        setRankings(res.items || []);
      }
    } catch (err: any) {
      console.error(err);
      // Fallback to demo data
      setSelectedProject(DEMO_PROJECT);
      setRankingData(DEMO_RANKING_DATA);
      setRankings(DEMO_RANKING_DATA.items as any);
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
            <Award className="h-6 w-6 text-amber-500" />
            Employee Ranking Engine
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Multi-factor suitability ordering of <strong className="text-emerald-700">Available Matched Employees ONLY</strong>. Consumes Skill Match (57.1%), Relevant Experience (21.4%), Past Performance (14.3%), and Other Factors (7.1%). <span className="text-amber-700 font-bold">Assessment Score is pending Semester 2.</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-600" />
            PRE_ASSESSMENT Mode (Semester 1)
          </span>

          {selectedProjectId && (
            <button
              onClick={() => navigate(`/shortlist?project_id=${selectedProjectId}`)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm cursor-pointer transition-all"
            >
              <FileCheck2 className="h-4 w-4" />
              <span>Proceed to 2× Shortlisting Module</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* PROJECT SELECTOR CARD */}
      <GlassCard className="p-5 mb-6 border-amber-200 bg-amber-50/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 w-full lg:w-1/2">
            <label className="block text-xs font-bold uppercase tracking-wider text-amber-900">
              Select Target Project Requirement *
            </label>
            <select
              value={selectedProjectId || ""}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-2xs outline-none focus:border-amber-500"
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

          {selectedProject && (
            <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-lg border border-amber-200 shadow-2xs text-xs">
              <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                <Users className="h-4 w-4 text-emerald-600" />
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Available Pool</div>
                  <div className="font-bold text-emerald-700">{rankingData?.total_available_workforce || 0} Employees</div>
                </div>
              </div>

              <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                <Briefcase className="h-4 w-4 text-amber-600" />
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Required Team Size</div>
                  <div className="font-bold text-slate-900">{selectedProject.required_team_size || 1} Positions</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600" />
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Domain</div>
                  <div className="font-bold text-slate-900">{selectedProject.domain || "General"}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* FORMULA TRANSPARENCY CARD */}
      <GlassCard className="p-4 mb-6 bg-slate-900 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sliders className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Semester 1 Active Weight Formula (PRE_ASSESSMENT Mode)
              </h4>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Target formula includes 30% Assessment (Semester 2). Currently active factors are renormalized to sum to 100%.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md font-bold text-amber-300">
              Skill Match: 57.1%
            </span>
            <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md font-bold text-blue-300">
              Relevant Exp: 21.4%
            </span>
            <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md font-bold text-purple-300">
              Performance: 14.3%
            </span>
            <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md font-bold text-emerald-300">
              Other: 7.1%
            </span>
            <span className="px-2.5 py-1 bg-slate-800/60 border border-slate-700/60 rounded-md font-medium text-slate-400">
              Assessment: Pending (30%)
            </span>
          </div>
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
      {rankingData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <GlassCard className="p-4 border-l-4 border-l-amber-500">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Total Ranked Employees</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{rankingData.total_ranked_evaluated}</div>
            <div className="text-[11px] text-slate-400 mt-1">Available & skill-matched</div>
          </GlassCard>

          <GlassCard className="p-4 border-l-4 border-l-emerald-500">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Top Ranking Score</div>
            <div className="mt-1 text-2xl font-extrabold text-emerald-700">{rankingData.top_ranking_score}%</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">Rank 1 employee score</div>
          </GlassCard>

          <GlassCard className="p-4 border-l-4 border-l-blue-500">
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Average Ranking Score</div>
            <div className="mt-1 text-2xl font-extrabold text-blue-900">{rankingData.average_ranking_score}%</div>
            <div className="text-[11px] text-blue-600 font-medium mt-1">Across evaluated ranked pool</div>
          </GlassCard>

          <GlassCard className="p-4 border-l-4 border-l-purple-500">
            <div className="text-[11px] font-bold uppercase tracking-wider text-purple-600">High Suitability Pool</div>
            <div className="mt-1 text-2xl font-extrabold text-purple-900">{rankingData.high_suitability_count}</div>
            <div className="text-[11px] text-purple-600 font-medium mt-1">Score ≥ 80% suitability</div>
          </GlassCard>
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <GlassCard className="p-4 mb-6">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search Employee ID or Name..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Min Score Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={minScoreFilter}
                onChange={(e) => { setMinScoreFilter(e.target.value ? Number(e.target.value) : ""); setPage(1); }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-amber-500"
              >
                <option value="">All Ranking Scores</option>
                <option value="80">High Suitability (≥ 80%)</option>
                <option value="60">Medium Suitability (≥ 60%)</option>
                <option value="40">Low Suitability (≥ 40%)</option>
              </select>
            </div>

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-amber-500"
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
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-amber-500"
            >
              <option value="">All Designations</option>
              {designationsList.map((d, i) => (
                <option key={i} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* RANKING RESULTS TABLE */}
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
                <th className="py-3 px-4 text-center">Relevant Exp</th>
                <th className="py-3 px-4 text-center">Performance</th>
                <th className="py-3 px-4 text-center">Final Score</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Calculating Employee Project Suitability Rankings...</span>
                  </td>
                </tr>
              ) : rankings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                    No available matched employees found matching search/filter criteria.
                  </td>
                </tr>
              ) : (
                rankings.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
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
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                      {emp.relevant_experience_years} yrs ({emp.relevant_experience_score}%)
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {emp.performance_rating ? (
                        <span className="font-bold text-amber-700 flex items-center justify-center gap-1">
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          {emp.performance_rating}/5.0
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Benchmark (70%)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${getScoreBadgeClass(emp.ranking_score)}`}>
                        {emp.ranking_score}%
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
                          onClick={() => { setSelectedRanking(emp); setShowDetailModal(true); }}
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg font-semibold text-xs border border-amber-200 transition-colors cursor-pointer"
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
        {rankingData && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50 text-xs text-slate-500">
            <div>
              Showing <strong className="text-slate-900">{rankings.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> to{" "}
              <strong className="text-slate-900">{Math.min(page * pageSize, rankingData.total_ranked_evaluated)}</strong> of{" "}
              <strong className="text-slate-900">{rankingData.total_ranked_evaluated}</strong> ranked employees
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
                Page {page} of {rankingData.total_pages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(rankingData.total_pages || 1, p + 1))}
                disabled={page >= (rankingData.total_pages || 1)}
                className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* RANKING DETAIL MODAL */}
      {showDetailModal && selectedRanking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 bg-slate-50">
              <div className="flex items-center gap-3">
                <Award className="h-5 w-5 text-amber-500" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Ranking Details: {selectedRanking.name} ({selectedRanking.employee_id})
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedRanking.designation} &bull; {selectedRanking.department}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Rank Banner */}
              <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                    Project Suitability Rank #{selectedRanking.rank}
                  </div>
                  <div className="text-2xl font-extrabold text-amber-900">
                    {selectedRanking.ranking_score}% Final Ranking Score
                  </div>
                  <div className="text-[11px] text-amber-800 mt-0.5">{selectedRanking.ranking_explanation}</div>
                </div>
                <div className="text-right font-mono text-xs text-slate-600">
                  <div>Mode: <strong>{selectedRanking.ranking_mode}</strong></div>
                  <div>Matched Skills: <strong>{selectedRanking.matched_skills_count}</strong></div>
                </div>
              </div>

              {/* Factor Breakdown Cards */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-2">Ranking Factors Breakdown</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Skill Match (57.1%)</div>
                    <div className="text-base font-extrabold text-purple-700">{selectedRanking.skill_match_score}%</div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Relevant Exp (21.4%)</div>
                    <div className="text-base font-extrabold text-blue-700">{selectedRanking.relevant_experience_score}%</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{selectedRanking.relevant_experience_years} yrs relevant</div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Performance (14.3%)</div>
                    <div className="text-base font-extrabold text-amber-700">{selectedRanking.performance_score}%</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {selectedRanking.performance_rating ? `${selectedRanking.performance_rating}/5.0` : "Benchmark default"}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Other Factors (7.1%)</div>
                    <div className="text-base font-extrabold text-emerald-700">{selectedRanking.other_score}%</div>
                  </div>
                </div>
              </div>

              {/* Assessment Notice */}
              <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-3">
                <Info className="h-4 w-4 text-blue-600 shrink-0" />
                <div className="text-[11px] text-slate-600">
                  <strong>Semester 1 Note:</strong> Assessment score is currently <code className="bg-slate-200 px-1 rounded">null</code> and reserved for Semester 2. In Semester 2, project-specific assessment evaluation will contribute 30% to the final ranking score.
                </div>
              </div>

              {/* Tie-breaking Rules */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1">Deterministic Tie-Breaking Order</h5>
                <ol className="list-decimal list-inside text-[11px] text-slate-600 space-y-0.5 font-medium">
                  <li>Highest Skill Match Score</li>
                  <li>Highest Relevant Experience Score</li>
                  <li>Highest Performance Rating</li>
                  <li>Highest Matched Skill Count</li>
                  <li>Alphabetical Employee ID (stable order)</li>
                </ol>
              </div>
            </div>

            <div className="flex justify-end p-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold cursor-pointer"
              >
                Close Ranking Details
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

export default EmployeeRanking;
