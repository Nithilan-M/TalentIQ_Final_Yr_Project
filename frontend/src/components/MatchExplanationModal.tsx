import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  TrendingUp,
  Award,
  Layers,
  Loader2,
  FileCheck2,
  ShieldCheck,
  Zap,
  Target
} from "lucide-react";
import { apiService } from "../services/api";

interface MatchExplanationModalProps {
  projectId: number;
  employeeId: number;
  isOpen: boolean;
  onClose: () => void;
}

export const MatchExplanationModal: React.FC<MatchExplanationModalProps> = ({
  projectId,
  employeeId,
  isOpen,
  onClose
}) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && projectId && employeeId) {
      fetchExplanation();
    }
  }, [isOpen, projectId, employeeId]);

  const fetchExplanation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getMatchExplanation(projectId, employeeId);
      setData(res);
    } catch (err: any) {
      console.error("Failed to load match explanation:", err);
      setError(err.message || "Failed to load explainable matching breakdown.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "MATCHED":
        return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold rounded text-[10px]">✓ MATCHED</span>;
      case "PARTIAL":
        return <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-300 font-bold rounded text-[10px]">⚠ PARTIAL</span>;
      case "RELATED":
        return <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-300 font-bold rounded text-[10px]">⚡ RELATED</span>;
      case "MISSING":
        return <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 font-bold rounded text-[10px]">✗ MISSING</span>;
      default:
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 font-bold rounded text-[10px]">{status}</span>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === "Critical") return "bg-red-100 text-red-800 border-red-300 font-extrabold";
    if (priority === "Preferred") return "bg-blue-50 text-blue-700 border-blue-200 font-semibold";
    return "bg-slate-100 text-slate-700 border-slate-200 font-semibold";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 p-4 bg-slate-50">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Explainable Match Breakdown
                {data?.match_category && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                    data.match_category === "Strong Match"
                      ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                      : data.match_category === "Moderate Match"
                      ? "bg-blue-100 text-blue-900 border border-blue-300"
                      : "bg-amber-100 text-amber-900 border border-amber-300"
                  }`}>
                    {data.match_category} ({data.overall_match_score}%)
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500">
                {data ? `${data.employee_name} (${data.employee_id}) • ${data.project_name}` : "Loading candidate match trace..."}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-purple-600" />
              <span>Generating transparent match score breakdown & skill trace...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 font-medium flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              <div>{error}</div>
            </div>
          ) : data ? (
            <>
              {/* SYNTHESIS BANNER */}
              <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl">
                <h4 className="font-bold text-purple-900 text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  Deterministic Match Summary
                </h4>
                <p className="text-slate-800 leading-relaxed font-medium">
                  {data.explanation}
                </p>
              </div>

              {/* 6-DIMENSION SCORE TRACE */}
              <div>
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-blue-600" />
                  6-Dimension Score Formula Trace (Weighted Contribution)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(data.score_trace || {}).map(([key, item]: [string, any]) => (
                    <div key={key} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-slate-700 text-[11px]">{item.description}</span>
                        <span className="font-extrabold text-slate-900 text-xs">{item.raw_score}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 mb-1.5 overflow-hidden">
                        <div
                          className="bg-purple-600 h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, item.raw_score)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-500 flex justify-between">
                        <span>Weight: {(item.weight * 100).toFixed(0)}%</span>
                        <span className="font-bold text-purple-700">+{item.weighted_contribution}% to Total</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* POSITIVE & NEGATIVE FACTORS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Positive Factors */}
                <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-xl">
                  <h4 className="font-bold text-emerald-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Positive Factor Contributions (✓)
                  </h4>
                  {data.positive_factors?.length === 0 ? (
                    <p className="text-slate-500 italic text-[11px]">No specific positive factors identified.</p>
                  ) : (
                    <ul className="space-y-1.5 text-[11px] text-slate-800">
                      {data.positive_factors.map((pf: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-emerald-600 font-bold shrink-0">✓</span>
                          <span>{pf}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Negative Factors */}
                <div className="p-4 bg-amber-50/40 border border-amber-200 rounded-xl">
                  <h4 className="font-bold text-amber-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Areas of Improvement & Score Reductions (⚠ / ✗)
                  </h4>
                  {data.negative_factors?.length === 0 ? (
                    <p className="text-emerald-700 font-medium text-[11px]">✓ No significant negative factors or skill gaps found.</p>
                  ) : (
                    <ul className="space-y-1.5 text-[11px] text-slate-800">
                      {data.negative_factors.map((nf: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-600 font-bold shrink-0">⚠</span>
                          <span>{nf}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* SKILL-BY-SKILL DETAILED TABLE */}
              <div>
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  Skill-by-Skill Requirements vs Employee Evidence
                </h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                        <th className="py-2.5 px-3">Skill</th>
                        <th className="py-2.5 px-3 text-center">Priority</th>
                        <th className="py-2.5 px-3">Req Level</th>
                        <th className="py-2.5 px-3">Emp Level</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3">Evidence Source</th>
                        <th className="py-2.5 px-3">Explanation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.skill_analysis?.map((sk: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{sk.skill_name}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] border ${getPriorityBadge(sk.priority)}`}>
                              {sk.priority}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{sk.required_level}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{sk.employee_level}</td>
                          <td className="py-2.5 px-3 text-center">{getStatusBadge(sk.match_status)}</td>
                          <td className="py-2.5 px-3 text-slate-500 font-medium">{sk.evidence_source}</td>
                          <td className="py-2.5 px-3 text-slate-700 leading-tight">{sk.explanation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AUDIT FOOTER */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-400 flex items-center justify-between">
                <span>Engine: <strong>{data.engine_version}</strong></span>
                <span>Generated At: <strong>{data.generated_at}</strong></span>
              </div>
            </>
          ) : null}
        </div>

        {/* MODAL FOOTER */}
        <div className="flex justify-end p-4 bg-slate-50 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg cursor-pointer"
          >
            Close Breakdown
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchExplanationModal;
