import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  X,
  Briefcase,
  Users,
  Sparkles,
  FolderGit2,
  Target,
  BarChart2,
  ChevronDown,
  LogOut,
  FileText,
  FileSpreadsheet,
  Upload,
  Clock,
  Award,
  FileCheck2,
  LayoutDashboard,
} from "lucide-react";
import { authService } from "../services/auth";

interface JobDescriptionOption {
  id: number;
  title: string;
}

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  jds: JobDescriptionOption[];
  activeJdId: string;
  onJdChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onLogout: () => void;
}

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({
  isOpen,
  onClose,
  jds,
  activeJdId,
  onJdChange,
  onLogout,
}) => {
  const location = useLocation();
  const [expandedSection, setExpandedSection] = useState<string | null>("employees");

  const email = authService.getUserEmail() || "recruiter@talent_iq.ai";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-in Drawer */}
      <div className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-250">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500 text-white shadow-xs">
              <Briefcase className="h-4.5 w-4.5" />
            </div>
            <span className="text-base font-bold text-slate-900 tracking-tight">TalentIQ</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          {/* Dashboard */}
          <Link
            to="/"
            onClick={onClose}
            className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              isActive("/") ? "bg-red-50 text-red-600 font-bold" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <LayoutDashboard className="h-4.5 w-4.5 text-red-500" />
            <span>Dashboard</span>
          </Link>

          {/* Employees Group */}
          <div className="rounded-lg border border-slate-100 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection("employees")}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
            >
              <div className="flex items-center space-x-3">
                <Users className="h-4.5 w-4.5 text-slate-500" />
                <span>Employees</span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                  expandedSection === "employees" ? "rotate-180 text-red-500" : ""
                }`}
              />
            </button>
            {expandedSection === "employees" && (
              <div className="bg-slate-50/70 border-t border-slate-100 px-2 py-1.5 space-y-1">
                <Link
                  to="/employees"
                  onClick={onClose}
                  className={`flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive("/employees") ? "bg-white text-red-600 font-bold shadow-2xs" : "text-slate-600 hover:bg-white/80"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Employee Master Data</span>
                </Link>
                <Link
                  to="/import-profile"
                  onClick={onClose}
                  className={`flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive("/import-profile") || isActive("/upload-resume") ? "bg-white text-red-600 font-bold shadow-2xs" : "text-slate-600 hover:bg-white/80"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Import Employee Profile</span>
                </Link>
                <Link
                  to="/employees"
                  onClick={onClose}
                  className="flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium text-slate-600 hover:bg-white/80 transition-all"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Bulk Excel Import</span>
                </Link>
              </div>
            )}
          </div>

          {/* Skills Group */}
          <div className="rounded-lg border border-slate-100 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection("skills")}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
            >
              <div className="flex items-center space-x-3">
                <Sparkles className="h-4.5 w-4.5 text-purple-600" />
                <span>Skills</span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                  expandedSection === "skills" ? "rotate-180 text-purple-600" : ""
                }`}
              />
            </button>
            {expandedSection === "skills" && (
              <div className="bg-slate-50/70 border-t border-slate-100 px-2 py-1.5 space-y-1">
                <Link
                  to="/skills"
                  onClick={onClose}
                  className={`flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive("/skills") ? "bg-white text-purple-600 font-bold shadow-2xs" : "text-slate-600 hover:bg-white/80"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                  <span>Skill Taxonomy</span>
                </Link>
              </div>
            )}
          </div>

          {/* Projects Group */}
          <div className="rounded-lg border border-slate-100 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection("projects")}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
            >
              <div className="flex items-center space-x-3">
                <FolderGit2 className="h-4.5 w-4.5 text-slate-500" />
                <span>Projects</span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                  expandedSection === "projects" ? "rotate-180 text-red-500" : ""
                }`}
              />
            </button>
            {expandedSection === "projects" && (
              <div className="bg-slate-50/70 border-t border-slate-100 px-2 py-1.5 space-y-1">
                <Link
                  to="/upload-jd"
                  onClick={onClose}
                  className={`flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive("/upload-jd") ? "bg-white text-red-600 font-bold shadow-2xs" : "text-slate-600 hover:bg-white/80"
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Project Requirement</span>
                </Link>
              </div>
            )}
          </div>

          {/* Matching Group */}
          <div className="rounded-lg border border-slate-100 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection("matching")}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
            >
              <div className="flex items-center space-x-3">
                <Target className="h-4.5 w-4.5 text-blue-600" />
                <span>Matching & Allocation</span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                  expandedSection === "matching" ? "rotate-180 text-blue-600" : ""
                }`}
              />
            </button>
            {expandedSection === "matching" && (
              <div className="bg-slate-50/70 border-t border-slate-100 px-2 py-1.5 space-y-1">
                <Link
                  to="/availability"
                  onClick={onClose}
                  className={`flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive("/availability") ? "bg-white text-blue-600 font-bold shadow-2xs" : "text-slate-600 hover:bg-white/80"
                  }`}
                >
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                  <span>Availability Engine</span>
                </Link>
                <Link
                  to="/matching"
                  onClick={onClose}
                  className={`flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive("/matching") ? "bg-white text-purple-600 font-bold shadow-2xs" : "text-slate-600 hover:bg-white/80"
                  }`}
                >
                  <Target className="h-3.5 w-3.5 text-purple-600" />
                  <span>Skill Matching</span>
                </Link>
                <Link
                  to="/matching"
                  onClick={onClose}
                  className="flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium text-slate-600 hover:bg-white/80 transition-all"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>Explainable Matching</span>
                </Link>
                <Link
                  to="/ranking"
                  onClick={onClose}
                  className={`flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive("/ranking") ? "bg-white text-amber-600 font-bold shadow-2xs" : "text-slate-600 hover:bg-white/80"
                  }`}
                >
                  <Award className="h-3.5 w-3.5 text-amber-500" />
                  <span>Employee Ranking</span>
                </Link>
                <Link
                  to="/shortlist"
                  onClick={onClose}
                  className={`flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive("/shortlist") ? "bg-white text-blue-600 font-bold shadow-2xs" : "text-slate-600 hover:bg-white/80"
                  }`}
                >
                  <FileCheck2 className="h-3.5 w-3.5 text-blue-600" />
                  <span>2× Shortlisting</span>
                </Link>
              </div>
            )}
          </div>

          {/* Analytics */}
          <Link
            to="/analytics"
            onClick={onClose}
            className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              isActive("/analytics") ? "bg-red-50 text-red-600 font-bold" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <BarChart2 className="h-4.5 w-4.5 text-slate-500" />
            <span>Analytics</span>
          </Link>
        </div>

        {/* Footer with Project Selector and User Logout */}
        <div className="border-t border-slate-200 p-4 space-y-3.5 bg-slate-50/50">
          {jds.length > 0 && (
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Active Project
              </span>
              <select
                value={activeJdId}
                onChange={onJdChange}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              >
                {jds.map((jd) => (
                  <option key={jd.id} value={jd.id}>
                    {jd.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white shrink-0">
                TQ
              </div>
              <span className="text-xs font-semibold text-slate-800 truncate">{email}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-100/60 transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileNavDrawer;
