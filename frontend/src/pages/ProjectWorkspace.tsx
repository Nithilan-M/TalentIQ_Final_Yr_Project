import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Briefcase,
  Users,
  Sparkles,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Layers,
  Award,
  Target,
  FileCheck2,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  FileText,
  Loader2,
  Lock,
  ExternalLink
} from "lucide-react";
import { apiService } from "../services/api";
import { GlassCard } from "../components/GlassCard";

export const ProjectWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number(id);

  const [workspaceData, setWorkspaceData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      fetchWorkspace();
    }
  }, [projectId]);

  const fetchWorkspace = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getProjectDashboardWorkspace(projectId);
      setWorkspaceData(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || `Failed to load workspace for Project ID ${projectId}`);
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

  const renderContextualCTA = () => {
    if (!workspaceData) return null;
    const status = workspaceData.status;

    switch (status) {
      case "REQUIREMENT_EXTRACTED":
        return (
          <button
            onClick={() => navigate(`/upload-jd?id=${projectId}`)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            <span>Review Extracted Requirements</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        );
      case "REQUIREMENT_REVIEWED":
      case "DRAFT":
        return (
          <button
            onClick={() => navigate(`/availability?project_id=${projectId}`)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <Clock className="h-4 w-4" />
            <span>Check Employee Availability Engine</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        );
      case "AVAILABILITY_COMPLETED":
        return (
          <button
            onClick={() => navigate(`/matching?project_id=${projectId}`)}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <Target className="h-4 w-4" />
            <span>Run Employee–Project Skill Matching</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        );
      case "MATCHING_COMPLETED":
        return (
          <button
            onClick={() => navigate(`/ranking?project_id=${projectId}`)}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <Award className="h-4 w-4" />
            <span>View Employee Ranking Engine</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        );
      case "RANKING_COMPLETED":
        return (
          <button
            onClick={() => navigate(`/shortlist?project_id=${projectId}`)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <FileCheck2 className="h-4 w-4" />
            <span>Generate 2× Shortlist</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        );
      case "READY_FOR_ASSESSMENT":
      default:
        return (
          <button
            disabled
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg shadow-2xs opacity-90 cursor-default"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Ready for Assessment Stage (Semester 2)</span>
          </button>
        );
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-600" />
        <p className="text-xs font-semibold text-slate-500">Loading Project Staffing Workspace...</p>
      </div>
    );
  }

  if (error || !workspaceData) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center text-xs text-red-700 font-medium">
          <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
          <p>{error || "Project workspace not found."}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-4 px-4 py-2 bg-red-600 text-white font-bold rounded-lg cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const req = workspaceData.requirement;
  const avail = workspaceData.availability;
  const match = workspaceData.matching;
  const rank = workspaceData.ranking;
  const shortlist = workspaceData.shortlist;
  const stepper = workspaceData.workflow_stepper || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* NAVIGATION BACK */}
      <button
        onClick={() => navigate("/dashboard")}
        className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 mb-4 transition-colors cursor-pointer"
      >
        <ChevronLeft className="h-4 w-4" />
        <span>Back to PM Dashboard</span>
      </button>

      {/* PROJECT HEADER CARD */}
      <GlassCard className="p-6 mb-6 border-blue-200 bg-blue-50/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {req.project_name}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${getStatusBadgeClass(workspaceData.status)}`}>
                {workspaceData.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              Project ID: <strong className="font-mono text-slate-800">PROJ-{req.id}</strong> &bull; Domain: <strong className="text-slate-800">{req.domain}</strong> &bull; Duration: <strong className="text-slate-800">{req.start_date || "N/A"} to {req.end_date || "N/A"}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {renderContextualCTA()}
          </div>
        </div>
      </GlassCard>

      {/* INSUFFICIENT WORKFORCE ALERT BANNER */}
      {shortlist.warning && (
        <div className="p-4 mb-6 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 font-medium flex items-center gap-3 shadow-2xs">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <strong className="font-bold">Workforce Allocation Notice:</strong> {shortlist.warning}
          </div>
        </div>
      )}

      {/* WORKFLOW PROGRESS STEPPER */}
      <GlassCard className="p-5 mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
          Semester 1 Staffing Pipeline Stepper
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2">
          {stepper.map((st: any) => (
            <div
              key={st.step}
              className={`p-2.5 rounded-lg border text-center text-[11px] flex flex-col justify-between ${
                st.completed
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : st.pending_semester
                  ? "bg-slate-50 border-slate-200 text-slate-400"
                  : "bg-white border-slate-200 text-slate-600"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono font-bold text-[10px]">Step {st.step}</span>
                {st.completed ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : st.pending_semester ? (
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                )}
              </div>
              <div className="font-bold text-[11px] line-clamp-1">{st.name}</div>
              <div className="text-[9px] mt-1">
                {st.completed ? "Completed" : st.pending_semester ? `Semester ${st.pending_semester}` : "Pending"}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* MODULE SUMMARIES GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 1. Requirement Summary */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-600" />
              Project Requirement Summary
            </h3>
            <button
              onClick={() => navigate(`/upload-jd?id=${projectId}`)}
              className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View Requirement</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Required Team Size (N):</span>
              <strong className="text-slate-900 font-bold">{req.required_team_size} Employees</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Target Shortlist (2 × N):</span>
              <strong className="text-purple-700 font-bold">{req.target_shortlist} Candidates</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Required Roles:</span>
              <span className="font-bold text-slate-800">{req.roles.join(", ") || "General Developer"}</span>
            </div>
            <div className="py-1">
              <span className="text-slate-500 font-medium block mb-1">Required Core Skills:</span>
              <div className="flex flex-wrap gap-1">
                {(req.skills_required || []).map((sk: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold">
                    {sk}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* 2. Availability Summary */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              Employee Availability Summary
            </h3>
            <button
              onClick={() => navigate(`/availability?project_id=${projectId}`)}
              className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Open Availability Engine</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center mb-3">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Total Workforce</div>
              <div className="text-lg font-extrabold text-slate-900">{avail.total_workforce}</div>
            </div>
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="text-[10px] text-emerald-600 uppercase font-bold">Available</div>
              <div className="text-lg font-extrabold text-emerald-800">{avail.available_count}</div>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Unavailable</div>
              <div className="text-lg font-extrabold text-slate-600">{avail.unavailable_count}</div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            <strong className="text-emerald-700 font-bold">{avail.availability_percentage}%</strong> of total workforce is unassigned and available for the project timeframe.
          </p>
        </GlassCard>

        {/* 3. Skill Matching Summary */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-600" />
              Skill Matching Engine Summary
            </h3>
            <button
              onClick={() => navigate(`/matching?project_id=${projectId}`)}
              className="text-xs text-purple-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Open Skill Matching</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center mb-3">
            <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-[10px] text-purple-700 uppercase font-bold">Total Matched</div>
              <div className="text-lg font-extrabold text-purple-900">{match.total_matched} Employees</div>
            </div>
            <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-[10px] text-purple-700 uppercase font-bold">Top Match Score</div>
              <div className="text-lg font-extrabold text-purple-900">{match.top_match_score}%</div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Evaluates Skill Coverage (35%), Proficiency Match (25%), Skill Experience (15%), Role Relevance (10%), Domain Relevance (10%), and Tech Alignment (5%).
          </p>
        </GlassCard>

        {/* 4. Employee Ranking Summary */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              Employee Ranking Engine Summary
            </h3>
            <button
              onClick={() => navigate(`/ranking?project_id=${projectId}`)}
              className="text-xs text-amber-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Open Employee Ranking</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center mb-3">
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="text-[10px] text-amber-800 uppercase font-bold">Total Ranked</div>
              <div className="text-lg font-extrabold text-amber-900">{rank.total_ranked} Employees</div>
            </div>
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="text-[10px] text-amber-800 uppercase font-bold">Top Rank Score</div>
              <div className="text-lg font-extrabold text-amber-900">{rank.top_ranking_score}% ({rank.top_employee_id})</div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Operating in <strong className="text-amber-800 font-bold">PRE_ASSESSMENT Mode</strong> (Semester 1). Skill Match (57.1%), Relevant Experience (21.4%), Performance (14.3%), and Other Factors (7.1%).
          </p>
        </GlassCard>
      </div>

      {/* 5. 2x SHORTLIST SUMMARY CARD */}
      <GlassCard className="p-6 border-blue-200 bg-blue-50/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-blue-200 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-blue-600" />
              2× Shortlisting Module Summary
            </h3>
            <p className="text-xs text-slate-500">
              Reduces the ranked pool to top <strong className="text-blue-700">2 × Team Size</strong> candidates for the Assessment stage.
            </p>
          </div>

          <button
            onClick={() => navigate(`/shortlist?project_id=${projectId}`)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer w-fit"
          >
            <span>Open 2× Shortlist Module</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-3 bg-white border border-slate-200 rounded-xl">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Required Team Size (N)</div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">{shortlist.required_team_size}</div>
          </div>

          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
            <div className="text-[10px] text-purple-600 font-bold uppercase">Target Shortlist (2N)</div>
            <div className="text-xl font-extrabold text-purple-900 mt-0.5">{shortlist.required_shortlist_size}</div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="text-[10px] text-emerald-600 font-bold uppercase">Actual Shortlisted</div>
            <div className="text-xl font-extrabold text-emerald-800 mt-0.5">{shortlist.actual_shortlist_size}</div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="text-[10px] text-blue-600 font-bold uppercase">Rank Cutoff</div>
            <div className="text-xl font-extrabold text-blue-900 mt-0.5">Rank {shortlist.cutoff_rank}</div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default ProjectWorkspace;
