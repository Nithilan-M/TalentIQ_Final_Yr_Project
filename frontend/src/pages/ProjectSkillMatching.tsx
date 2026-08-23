import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Sparkles,
  Target,
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
  Award,
  Layers,
  Info,
  ShieldCheck,
  ArrowRight
} from "lucide-react";
import { apiService } from "../services/api";
import { GlassCard } from "../components/GlassCard";
import { MatchExplanationModal } from "../components/MatchExplanationModal";

interface SkillItemMatch {
  skill_name: string;
  normalized_name?: string;
  priority: string;
  required_level: string;
  required_level_value: number;
  employee_level?: string;
  employee_level_value?: number;
  required_experience: string;
  employee_experience_years?: number;
  proficiency_satisfaction_percent?: number;
  match_type: string;
}

interface EmployeeMatchDTO {
  id: number;
  employee_id: string;
  name: string;
  department: string;
  designation: string;
  total_experience_years: number;
  availability_status: string;
  overall_match_score: number;
  skill_coverage: number;
  proficiency_match: number;
  experience_match: number;
  role_relevance: number;
  domain_relevance: number;
  technology_relevance: number;
  matched_skills: SkillItemMatch[];
  partial_skills: SkillItemMatch[];
  missing_skills: SkillItemMatch[];
  matched_skills_count: number;
  partial_skills_count: number;
  missing_skills_count: number;
  explanation: string;
}

export const ProjectSkillMatching: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);

  // Matching Results
  const [matchData, setMatchData] = useState<any | null>(null);
  const [matches, setMatches] = useState<EmployeeMatchDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal State
  const [selectedMatch, setSelectedMatch] = useState<EmployeeMatchDTO | null>(null);
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
      fetchProjectMatches(selectedProjectId);
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
        setLoading(false);
      }
    } catch (err: any) {
      console.error("Failed to load initial project list:", err);
      setError("Failed to load project requirements. Ensure backend service is running.");
      setLoading(false);
    }
  };

  const fetchProjectMatches = async (projId: number) => {
    setLoading(true);
    setError(null);

    try {
      const projDetails = await apiService.getJobDescriptionDetails(projId);
      setSelectedProject(projDetails);

      const res = await apiService.getProjectSkillMatches(projId, {
        page,
        page_size: pageSize,
        department: departmentFilter || undefined,
        designation: designationFilter || undefined,
        min_score: minScoreFilter !== "" ? Number(minScoreFilter) : undefined,
        search: search || undefined
      });

      setMatchData(res);
      setMatches(res.items || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to calculate skill matches for available employees.");
      setMatchData(null);
      setMatches([]);
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
            <Target className="h-6 w-6 text-purple-600" />
            Employee–Project Skill Matching Engine
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Hybrid suitability evaluation of <strong className="text-emerald-700">Available Employees ONLY</strong>. Evaluates Skill Coverage (35%), Proficiency Match (25%), Skill Experience (15%), Role Relevance (10%), Domain Relevance (10%), and Technology Alignment (5%).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-full text-xs font-bold flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-purple-600" />
            Centralized Skill Taxonomy + FAISS BGE
          </span>

          {selectedProjectId && (
            <button
              onClick={() => navigate(`/ranking?project_id=${selectedProjectId}`)}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm cursor-pointer transition-all"
            >
              <Award className="h-4 w-4" />
              <span>Proceed to Employee Ranking Engine</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* PROJECT SELECTOR CARD */}
      <GlassCard className="p-5 mb-6 border-purple-200 bg-purple-50/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 w-full lg:w-1/2">
            <label className="block text-xs font-bold uppercase tracking-wider text-purple-900">
              Select Target Project Requirement *
            </label>
            <select
              value={selectedProjectId || ""}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full rounded-lg border border-purple-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-2xs outline-none focus:border-purple-500"
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
            <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-lg border border-purple-200 shadow-2xs text-xs">
              <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                <Users className="h-4 w-4 text-emerald-600" />
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Available Pool</div>
                  <div className="font-bold text-emerald-700">{matchData?.total_available_workforce || 0} Employees</div>
                </div>
              </div>

              <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                <Briefcase className="h-4 w-4 text-purple-600" />
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

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* KPI METRICS HEADER */}
      {matchData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <GlassCard className="p-4 border-l-4 border-l-emerald-500">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Available Workforce</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{matchData.total_available_workforce}</div>
            <div className="text-[11px] text-slate-400 mt-1">Evaluated by Availability Engine</div>
          </GlassCard>

          <GlassCard className="p-4 border-l-4 border-l-purple-600">
            <div className="text-[11px] font-bold uppercase tracking-wider text-purple-600">Average Match Score</div>
            <div className="mt-1 text-2xl font-extrabold text-purple-900">{matchData.average_match_score}%</div>
            <div className="text-[11px] text-purple-600 font-medium mt-1">Across evaluated available pool</div>
          </GlassCard>

          <GlassCard className="p-4 border-l-4 border-l-emerald-600">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">High Potential Matches</div>
            <div className="mt-1 text-2xl font-extrabold text-emerald-800">{matchData.high_potential_count}</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">Score ≥ 80% suitability</div>
          </GlassCard>

          <GlassCard className="p-4 border-l-4 border-l-blue-500">
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Evaluated Matches</div>
            <div className="mt-1 text-2xl font-extrabold text-blue-900">{matchData.total_matched_evaluated}</div>
            <div className="text-[11px] text-blue-600 font-medium mt-1">Matching criteria satisfied</div>
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
              placeholder="Search Employee ID, Name, or Skill..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Min Score Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={minScoreFilter}
                onChange={(e) => { setMinScoreFilter(e.target.value ? Number(e.target.value) : ""); setPage(1); }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500"
              >
                <option value="">All Match Scores</option>
                <option value="80">High Match (≥ 80%)</option>
                <option value="60">Medium Match (≥ 60%)</option>
                <option value="40">Low Match (≥ 40%)</option>
              </select>
            </div>

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500"
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
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500"
            >
              <option value="">All Designations</option>
              {designationsList.map((d, i) => (
                <option key={i} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* MATCH RESULTS TABLE */}
      <GlassCard className="p-0 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Employee Name</th>
                <th className="py-3 px-4">Department & Designation</th>
                <th className="py-3 px-4 text-center">Match Score</th>
                <th className="py-3 px-4 text-center">Skill Coverage</th>
                <th className="py-3 px-4">Skills Breakdown</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-purple-600" />
                    <span>Calculating Employee–Project Skill Suitability Scores...</span>
                  </td>
                </tr>
              ) : matches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                    No available employees match the specified search/filter criteria.
                  </td>
                </tr>
              ) : (
                matches.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {emp.employee_id}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {emp.name}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{emp.designation}</div>
                      <div className="text-[11px] text-slate-500">{emp.department} &bull; {emp.total_experience_years} yrs exp</div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${getScoreBadgeClass(emp.overall_match_score)}`}>
                        {emp.overall_match_score}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                      {emp.skill_coverage}%
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200">
                          ✓ {emp.matched_skills_count} Matched
                        </span>
                        {emp.partial_skills_count > 0 && (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold text-[10px] border border-amber-200">
                            ⚠ {emp.partial_skills_count} Partial
                          </span>
                        )}
                        {emp.missing_skills_count > 0 && (
                          <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-semibold text-[10px] border border-red-200">
                            ✗ {emp.missing_skills_count} Missing
                          </span>
                        )}
                      </div>
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
                          onClick={() => { setSelectedMatch(emp); setShowDetailModal(true); }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs border border-slate-200 transition-colors cursor-pointer"
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
        {matchData && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50 text-xs text-slate-500">
            <div>
              Showing <strong className="text-slate-900">{matches.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> to{" "}
              <strong className="text-slate-900">{Math.min(page * pageSize, matchData.total_matched_evaluated)}</strong> of{" "}
              <strong className="text-slate-900">{matchData.total_matched_evaluated}</strong> available matches
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
                Page {page} of {matchData.total_pages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(matchData.total_pages || 1, p + 1))}
                disabled={page >= (matchData.total_pages || 1)}
                className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* MATCH DETAIL MODAL */}
      {showDetailModal && selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 bg-slate-50">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-purple-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Match Details: {selectedMatch.name} ({selectedMatch.employee_id})
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedMatch.designation} &bull; {selectedMatch.department}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Overall Score Header */}
              <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-xl">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Employee-Project Match Score</div>
                  <div className="text-2xl font-extrabold text-purple-900">{selectedMatch.overall_match_score}% Suitability</div>
                  <div className="text-[11px] text-purple-700 mt-0.5">{selectedMatch.explanation}</div>
                </div>
                <div className="text-right font-mono text-xs text-slate-600">
                  <div>Coverage: <strong>{selectedMatch.skill_coverage}%</strong></div>
                  <div>Proficiency: <strong>{selectedMatch.proficiency_match}%</strong></div>
                  <div>Role Rel: <strong>{selectedMatch.role_relevance}%</strong></div>
                </div>
              </div>

              {/* Required Skills Comparison Table */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-2">Required Skills vs Employee Skill Profile</h4>
                <table className="w-full text-left text-xs border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2 px-3">Required Skill</th>
                      <th className="py-2 px-3">Priority</th>
                      <th className="py-2 px-3">Required Level</th>
                      <th className="py-2 px-3">Employee Level</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedMatch.matched_skills?.map((s, i) => (
                      <tr key={`m-${i}`} className="bg-emerald-50/30">
                        <td className="py-2 px-3 font-bold text-slate-900">{s.skill_name}</td>
                        <td className="py-2 px-3"><span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px] font-bold">{s.priority}</span></td>
                        <td className="py-2 px-3">{s.required_level}</td>
                        <td className="py-2 px-3 font-bold text-emerald-800">{s.employee_level}</td>
                        <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">✓ Matched ({s.match_type})</span></td>
                      </tr>
                    ))}
                    {selectedMatch.partial_skills?.map((s, i) => (
                      <tr key={`p-${i}`} className="bg-amber-50/30">
                        <td className="py-2 px-3 font-bold text-slate-900">{s.skill_name}</td>
                        <td className="py-2 px-3"><span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px] font-bold">{s.priority}</span></td>
                        <td className="py-2 px-3">{s.required_level}</td>
                        <td className="py-2 px-3 font-bold text-amber-800">{s.employee_level}</td>
                        <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">⚠ Partial</span></td>
                      </tr>
                    ))}
                    {selectedMatch.missing_skills?.map((s, i) => (
                      <tr key={`x-${i}`} className="bg-red-50/30">
                        <td className="py-2 px-3 font-bold text-slate-900">{s.skill_name}</td>
                        <td className="py-2 px-3"><span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px] font-bold">{s.priority}</span></td>
                        <td className="py-2 px-3">{s.required_level}</td>
                        <td className="py-2 px-3 italic text-slate-400">None</td>
                        <td className="py-2 px-3"><span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[10px]">✗ Missing</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Dimensions Breakdown Grid */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-2">Detailed Matching Sub-Scores</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Skill Coverage (35%)</div>
                    <div className="text-base font-extrabold text-slate-900">{selectedMatch.skill_coverage}%</div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Proficiency Match (25%)</div>
                    <div className="text-base font-extrabold text-slate-900">{selectedMatch.proficiency_match}%</div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Experience Match (15%)</div>
                    <div className="text-base font-extrabold text-slate-900">{selectedMatch.experience_match}%</div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Role Relevance (10%)</div>
                    <div className="text-base font-extrabold text-slate-900">{selectedMatch.role_relevance}%</div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Domain Relevance (10%)</div>
                    <div className="text-base font-extrabold text-slate-900">{selectedMatch.domain_relevance}%</div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Tech Alignment (5%)</div>
                    <div className="text-base font-extrabold text-slate-900">{selectedMatch.technology_relevance}%</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end p-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold cursor-pointer"
              >
                Close Match Details
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

export default ProjectSkillMatching;
