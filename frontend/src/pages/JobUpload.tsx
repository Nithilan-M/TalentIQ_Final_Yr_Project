import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Plus,
  Trash2,
  Calendar,
  Users,
  Layers,
  Sparkles,
  Loader2,
  RefreshCw,
  Award,
  Clock
} from "lucide-react";
import { apiService } from "../services/api";
import { GlassCard } from "../components/GlassCard";

interface ProjectSkill {
  skill_name: string;
  original_name?: string;
  normalized_name?: string;
  normalized_skill_name?: string;
  required_level: string | null;
  priority: string;
  experience_required: string | null;
  is_preferred?: boolean;
  confidence?: number;
}

interface ProjectFormData {
  project_id?: number;
  project_name: string;
  project_description: string;
  start_date: string;
  end_date: string;
  duration_text: string;
  required_team_size: number | "";
  roles: string[];
  role_skill_mapping: Record<string, string[]>;
  domain: string;
  required_experience: string;
  technologies: string[];
  required_skills: ProjectSkill[];
  preferred_skills: ProjectSkill[];
  confidence_scores: Record<string, number>;
}

export const JobUpload: React.FC = () => {
  const navigate = useNavigate();
  // Step state: 1 = Upload, 2 = Processing, 3 = Review & Edit, 4 = Confirmed
  const [step, setStep] = useState<number>(1);
  
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Validation state
  const [validation, setValidation] = useState<{
    is_valid: boolean;
    missing_fields: string[];
    errors: string[];
    warnings: string[];
  } | null>(null);

  // Form data for review/edit
  const [formData, setFormData] = useState<ProjectFormData>({
    project_name: "",
    project_description: "",
    start_date: "",
    end_date: "",
    duration_text: "",
    required_team_size: 1,
    roles: [],
    role_skill_mapping: {},
    domain: "",
    required_experience: "",
    technologies: [],
    required_skills: [],
    preferred_skills: [],
    confidence_scores: {}
  });

  const [rolesInput, setRolesInput] = useState<string>("");
  const [techInput, setTechInput] = useState<string>("");
  const [confirmedProject, setConfirmedProject] = useState<any>(null);

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf") {
      setError("Invalid file format. Please upload a Project Requirement PDF document.");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File size exceeds 10MB limit. Please upload a smaller Project Requirement PDF.");
      return;
    }

    setFile(selectedFile);
  };

  // Step 1 -> 2 -> 3: Upload and Extract
  const handleUploadAndExtract = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setStep(2); // Step 2: AI is analyzing document
    
    try {
      const res = await apiService.uploadProjectRequirement(file);
      const data = res.extracted_data || {};
      
      const parsedRoles = Array.isArray(data.roles) ? data.roles : [];
      const parsedTech = Array.isArray(data.technologies) ? data.technologies : [];
      
      const formatSkillArray = (arr: any[], defaultPrio: string, isPref: boolean) => {
        if (!Array.isArray(arr)) return [];
        return arr.map((s: any) => ({
          skill_name: s.skill_name || s.original_name || s.normalized_name || "",
          original_name: s.original_name || s.skill_name || "",
          normalized_name: s.normalized_name || s.normalized_skill_name || s.skill_name || "",
          normalized_skill_name: s.normalized_skill_name || s.normalized_name || s.skill_name || "",
          required_level: s.required_level || null, // null if not specified (no hallucination)
          priority: s.priority || defaultPrio,
          experience_required: s.experience_required || null,
          is_preferred: isPref,
          confidence: s.confidence || 0.92
        }));
      };

      const parsedReqSkills = formatSkillArray(data.required_skills, "Required", false);
      const parsedPrefSkills = formatSkillArray(data.preferred_skills, "Preferred", true);

      setFormData({
        project_id: res.project_id || res.id,
        project_name: data.project_name || file.name.replace(/\.[^/.]+$/, ""),
        project_description: data.project_description || "",
        start_date: data.start_date || "",
        end_date: data.end_date || "",
        duration_text: data.duration_text || "",
        required_team_size: typeof data.required_team_size === "number" ? data.required_team_size : "",
        roles: parsedRoles,
        role_skill_mapping: data.role_skill_mapping || {},
        domain: data.domain || "",
        required_experience: data.required_experience || "",
        technologies: parsedTech,
        required_skills: parsedReqSkills,
        preferred_skills: parsedPrefSkills,
        confidence_scores: data.confidence_scores || {}
      });

      setRolesInput(parsedRoles.join(", "));
      setTechInput(parsedTech.join(", "));
      setValidation(res.validation || null);
      setStep(3); // Step 3 & 4: Review Requirements
    } catch (err: any) {
      setError(err.message || "Unable to extract project requirements. Please verify that the uploaded PDF contains readable project requirement information.");
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  // Skill row modifiers
  const handleSkillChange = (
    listType: "required_skills" | "preferred_skills",
    index: number,
    field: keyof ProjectSkill,
    value: any
  ) => {
    const list = [...formData[listType]];
    list[index] = { ...list[index], [field]: value };
    setFormData({ ...formData, [listType]: list });
  };

  const handleAddSkill = (listType: "required_skills" | "preferred_skills") => {
    const isPref = listType === "preferred_skills";
    const newSkill: ProjectSkill = {
      skill_name: "",
      normalized_name: "",
      normalized_skill_name: "",
      required_level: null,
      priority: isPref ? "Preferred" : "Required",
      experience_required: null,
      is_preferred: isPref,
      confidence: 1.0
    };
    setFormData({
      ...formData,
      [listType]: [...formData[listType], newSkill]
    });
  };

  const handleRemoveSkill = (listType: "required_skills" | "preferred_skills", index: number) => {
    const updated = formData[listType].filter((_, i) => i !== index);
    setFormData({ ...formData, [listType]: updated });
  };

  // Step 5: Confirm Project
  const handleConfirmProject = async () => {
    setSaving(true);
    setError(null);

    // Validation checks before saving
    if (!formData.project_name.trim()) {
      setError("Project Name is required.");
      setSaving(false);
      return;
    }

    if (!formData.project_description.trim()) {
      setError("Project Description is required.");
      setSaving(false);
      return;
    }

    if (formData.required_team_size === "" || Number(formData.required_team_size) <= 0) {
      setError("Required team size must be a valid positive number.");
      setSaving(false);
      return;
    }

    if (formData.required_skills.length === 0 || !formData.required_skills.some(s => s.skill_name.trim())) {
      setError("At least one required skill must be specified for the project team.");
      setSaving(false);
      return;
    }

    const rolesList = rolesInput.split(",").map(r => r.trim()).filter(Boolean);
    const techList = techInput.split(",").map(t => t.trim()).filter(Boolean);

    const payload = {
      project_id: formData.project_id,
      project_name: formData.project_name.trim(),
      project_description: formData.project_description.trim(),
      start_date: formData.start_date.trim() || null,
      end_date: formData.end_date.trim() || null,
      duration_text: formData.duration_text.trim() || null,
      required_team_size: Number(formData.required_team_size),
      roles: rolesList,
      role_skill_mapping: formData.role_skill_mapping,
      domain: formData.domain.trim() || null,
      required_skills: formData.required_skills.filter(s => s.skill_name.trim()),
      preferred_skills: formData.preferred_skills.filter(s => s.skill_name.trim()),
      required_experience: formData.required_experience.trim() || null,
      technologies: techList,
      confidence_scores: formData.confidence_scores
    };

    try {
      const res = await apiService.confirmProjectRequirement(payload);
      if (res.data && res.data.id) {
        localStorage.setItem("active_jd_id", String(res.data.id));
      }
      setConfirmedProject(res.data || payload);
      setStep(4); // Step 5 Confirmed
    } catch (err: any) {
      setError(err.message || "Failed to save confirmed project requirement. Please review entered fields.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setError(null);
    setValidation(null);
    setFormData({
      project_name: "",
      project_description: "",
      start_date: "",
      end_date: "",
      duration_text: "",
      required_team_size: 1,
      roles: [],
      role_skill_mapping: {},
      domain: "",
      required_experience: "",
      technologies: [],
      required_skills: [],
      preferred_skills: [],
      confidence_scores: {}
    });
    setConfirmedProject(null);
    setStep(1);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Module Title */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Layers className="h-6 w-6 text-red-500" />
            Upload Project Requirement
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Upload an internal Project Requirement PDF. The AI engine extracts required team size, roles, skill levels, and priorities to prepare for workforce matching.
          </p>
        </div>

        {/* Workflow Breadcrumb Steps */}
        <div className="flex items-center gap-1.5 text-[11px] font-semibold shrink-0">
          <span className={`px-2.5 py-1 rounded-full border ${step === 1 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            1. Upload PDF
          </span>
          <span className="text-slate-300">&rarr;</span>
          <span className={`px-2.5 py-1 rounded-full border ${step === 3 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            2. Review Requirements
          </span>
          <span className="text-slate-300">&rarr;</span>
          <span className={`px-2.5 py-1 rounded-full border ${step === 4 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            3. Confirmed
          </span>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl bg-red-50 p-4 border border-red-200 text-xs font-medium text-red-700 shadow-xs">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block text-sm mb-0.5">Extraction Notice</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* STEP 1: UPLOAD PDF FILE */}
      {step === 1 && (
        <GlassCard className="relative overflow-hidden p-6">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <FileText className="h-4.5 w-4.5 text-red-500" />
              <span>Project Requirement Document (PDF)</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Supported format: PDF</span>
          </div>

          <input
            type="file"
            id="pdf-upload"
            className="hidden"
            accept=".pdf"
            onChange={handleFileChange}
          />

          {file ? (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                dragActive 
                  ? "border-red-500 bg-red-50/20" 
                  : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 border border-red-100 text-red-500 mb-3 shadow-xs">
                <FileText className="h-6 w-6" />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-sm font-bold text-slate-900">
                  {file.name}
                </p>
                <p className="text-xs font-medium text-slate-400">
                  File size: {(file.size / 1024).toFixed(1)} KB &bull; Status: Ready for extraction
                </p>
                <div className="pt-3 flex items-center gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-xs font-semibold text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                  >
                    Remove file
                  </button>
                  <span className="text-slate-300">|</span>
                  <label
                    htmlFor="pdf-upload"
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                  >
                    Replace file
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <label
              htmlFor="pdf-upload"
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                dragActive 
                  ? "border-red-500 bg-red-50/20" 
                  : "border-slate-200 hover:border-slate-300 bg-slate-50/30"
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-600 mb-3 shadow-xs">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <span className="text-sm font-semibold text-red-500 hover:text-red-600">
                  Click to browse Project PDF
                </span>
                <span className="text-sm text-slate-600"> or drag and drop</span>
                <p className="mt-1.5 text-xs text-slate-400">
                  Accepts Project Requirement documents in PDF format (Up to 10MB)
                </p>
              </div>
            </label>
          )}

          {file && (
            <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleUploadAndExtract}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-red-600 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>Extract Project Requirements</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </GlassCard>
      )}

      {/* STEP 2: PROCESSING INDICATOR */}
      {step === 2 && (
        <GlassCard className="p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 border border-red-100 text-red-500 mb-4 animate-pulse">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            AI is Analyzing the Project Document...
          </h3>
          <p className="mt-1.5 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Parsing PDF text with PyMuPDF, running Gemini AI requirement extraction, normalizing skills, and validating team allocation parameters.
          </p>
        </GlassCard>
      )}

      {/* STEP 3 & 4: REVIEW & EDIT REQUIREMENT DETAILS */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Validation Alert Callouts */}
          {validation && !validation.is_valid && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-xs">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    Action Required: Missing Information
                  </h4>
                  <p className="mt-1 text-xs text-amber-700">
                    The AI engine extracted available details, but some required fields could not be fully identified from the document. Please review and complete missing entries:
                  </p>
                  <ul className="mt-2 list-disc list-inside text-xs text-amber-800 space-y-0.5 font-medium">
                    {validation.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {validation && validation.is_valid && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 flex items-center gap-3 shadow-xs">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold block">Requirements Extracted Successfully</span>
                <span>Project parameters identified cleanly. Review details, adjust skill priorities or levels, and click Confirm to save.</span>
              </div>
            </div>
          )}

          {/* EDIT FORM CARD */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-red-500" />
                Review & Edit Project Requirements
              </h3>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Step 2 of 3
              </span>
            </div>

            <div className="space-y-6">
              {/* SECTION: PROJECT INFORMATION */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                  Project Information
                </h4>

                {/* Project Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.project_name}
                    onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                    placeholder="e.g. AI Healthcare Management Platform"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                </div>

                {/* Project Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Project Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={formData.project_description}
                    onChange={(e) => setFormData({ ...formData, project_description: e.target.value })}
                    placeholder="Detailed project objective, scope, and deliverables..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  />
                </div>

                {/* Grid: Duration, Team Size, Domain */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      Start Date
                    </label>
                    <input
                      type="text"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      placeholder="YYYY-MM-DD"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      End Date
                    </label>
                    <input
                      type="text"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      placeholder="YYYY-MM-DD"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      Required Team Size <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formData.required_team_size}
                      onChange={(e) => setFormData({ ...formData, required_team_size: e.target.value === "" ? "" : parseInt(e.target.value) || 1 })}
                      placeholder="Number of employees (e.g. 6)"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-red-500"
                    />
                    {formData.required_team_size === "" && (
                      <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">Required team size could not be identified.</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Domain / Industry
                    </label>
                    <input
                      type="text"
                      value={formData.domain}
                      onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                      placeholder="e.g. Healthcare, FinTech"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                {/* Duration text fallback input */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Duration Summary (if specific dates unavailable)
                  </label>
                  <input
                    type="text"
                    value={formData.duration_text}
                    onChange={(e) => setFormData({ ...formData, duration_text: e.target.value })}
                    placeholder="e.g. 6-month project"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* SECTION: ROLES & TECHNOLOGIES */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                  Project Roles & Core Technologies
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Required Project Roles (Comma-separated)
                    </label>
                    <input
                      type="text"
                      value={rolesInput}
                      onChange={(e) => setRolesInput(e.target.value)}
                      placeholder="Backend Developer, ML Engineer, DevOps Engineer"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Technologies & Tools (Comma-separated)
                    </label>
                    <input
                      type="text"
                      value={techInput}
                      onChange={(e) => setTechInput(e.target.value)}
                      placeholder="Python, FastAPI, React, PostgreSQL, Docker, AWS"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                {/* Role-Skill Mapping Display if available */}
                {Object.keys(formData.role_skill_mapping).length > 0 && (
                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                      Extracted Role-Skill Relationships:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(formData.role_skill_mapping).map(([roleName, skills], i) => (
                        <div key={i} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs">
                          <strong className="text-slate-800">{roleName}:</strong>{" "}
                          <span className="text-slate-600">{Array.isArray(skills) ? skills.join(", ") : String(skills)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION: REQUIRED SKILLS (MANDATORY) TABLE */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2.5">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-red-500" />
                      Required Skills (Mandatory for Project) <span className="text-red-500">*</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Essential skills mandatory for internal project team members.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddSkill("required_skills")}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 cursor-pointer shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5 text-red-500" />
                    Add Required Skill
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                        <th className="py-2.5 px-3">Skill Name</th>
                        <th className="py-2.5 px-3">Normalized Alias</th>
                        <th className="py-2.5 px-3">Proficiency Level</th>
                        <th className="py-2.5 px-3">Priority</th>
                        <th className="py-2.5 px-3">Required Experience</th>
                        <th className="py-2.5 px-3 text-center">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formData.required_skills.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                            No required skills added. Click "Add Required Skill" above.
                          </td>
                        </tr>
                      ) : (
                        formData.required_skills.map((skill, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={skill.skill_name}
                                onChange={(e) => handleSkillChange("required_skills", idx, "skill_name", e.target.value)}
                                placeholder="e.g. Amazon Web Services"
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-900 outline-none focus:border-red-500"
                              />
                            </td>
                            <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                              {skill.normalized_name || skill.normalized_skill_name || "-"}
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={skill.required_level || "Not specified"}
                                onChange={(e) => handleSkillChange("required_skills", idx, "required_level", e.target.value === "Not specified" ? null : e.target.value)}
                                className={`w-full rounded border px-2 py-1 text-xs font-medium outline-none focus:border-red-500 ${
                                  !skill.required_level ? 'border-amber-200 bg-amber-50/50 text-amber-800' : 'border-slate-200 bg-white text-slate-700'
                                }`}
                              >
                                <option value="Not specified">Not specified</option>
                                <option value="Beginner">Beginner</option>
                                <option value="Intermediate">Intermediate</option>
                                <option value="Advanced">Advanced</option>
                                <option value="Expert">Expert</option>
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={skill.priority}
                                onChange={(e) => handleSkillChange("required_skills", idx, "priority", e.target.value)}
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-red-500"
                              >
                                <option value="Critical">Critical</option>
                                <option value="Required">Required</option>
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={skill.experience_required || ""}
                                onChange={(e) => handleSkillChange("required_skills", idx, "experience_required", e.target.value || null)}
                                placeholder="e.g. 3+ years"
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-red-500"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveSkill("required_skills", idx)}
                                className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                                title="Remove skill"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION: PREFERRED SKILLS (NICE TO HAVE) TABLE */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2.5">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Award className="h-4 w-4 text-purple-500" />
                      Preferred Skills (Nice-to-Have for Project)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Additional valuable skills that provide bonus matching score.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddSkill("preferred_skills")}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 cursor-pointer shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5 text-purple-500" />
                    Add Preferred Skill
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                        <th className="py-2.5 px-3">Skill Name</th>
                        <th className="py-2.5 px-3">Normalized Alias</th>
                        <th className="py-2.5 px-3">Proficiency Level</th>
                        <th className="py-2.5 px-3">Priority</th>
                        <th className="py-2.5 px-3">Required Experience</th>
                        <th className="py-2.5 px-3 text-center">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formData.preferred_skills.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                            No preferred skills added. Click "Add Preferred Skill" if applicable.
                          </td>
                        </tr>
                      ) : (
                        formData.preferred_skills.map((skill, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={skill.skill_name}
                                onChange={(e) => handleSkillChange("preferred_skills", idx, "skill_name", e.target.value)}
                                placeholder="e.g. Docker"
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-900 outline-none focus:border-purple-500"
                              />
                            </td>
                            <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                              {skill.normalized_name || skill.normalized_skill_name || "-"}
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={skill.required_level || "Not specified"}
                                onChange={(e) => handleSkillChange("preferred_skills", idx, "required_level", e.target.value === "Not specified" ? null : e.target.value)}
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-purple-500"
                              >
                                <option value="Not specified">Not specified</option>
                                <option value="Beginner">Beginner</option>
                                <option value="Intermediate">Intermediate</option>
                                <option value="Advanced">Advanced</option>
                                <option value="Expert">Expert</option>
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold text-[11px] border border-purple-100">
                                Preferred
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={skill.experience_required || ""}
                                onChange={(e) => handleSkillChange("preferred_skills", idx, "experience_required", e.target.value || null)}
                                placeholder="e.g. 1+ years"
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-purple-500"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveSkill("preferred_skills", idx)}
                                className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                                title="Remove skill"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS: SAVE / CONFIRM / CANCEL */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 pt-4 gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                Upload Different Document
              </button>

              <button
                type="button"
                onClick={handleConfirmProject}
                disabled={saving}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-red-500 px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-red-600 cursor-pointer transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving Project Requirements...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Save Project Requirements</span>
                    <CheckCircle2 className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* STEP 4: SUCCESS CONFIRMATION SCREEN */}
      {step === 4 && confirmedProject && (
        <div className="space-y-6">
          {/* Success Banner */}
          <div className="flex items-start gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 shadow-xs">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold">
                Project Requirement Saved Successfully!
              </h3>
              <p className="mt-1 text-xs text-emerald-700 leading-relaxed">
                The structured project requirement object for <strong>"{confirmedProject.project_name}"</strong> has been saved. It is now ready to be consumed by the Availability Engine and Skill Matching Engine.
              </p>
            </div>
          </div>

          {/* CONFIRMED SUMMARY CARD */}
          <GlassCard className="p-6">
            <div className="border-b border-slate-200 pb-4 mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {confirmedProject.project_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Internal Project Allocation &bull; Domain: {confirmedProject.domain || "General"}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider border border-emerald-200">
                Confirmed
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              {confirmedProject.project_description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 rounded-lg bg-slate-50 p-4 border border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Required Team Size</span>
                <span className="text-xs font-bold text-slate-900">{confirmedProject.required_team_size} Employees</span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duration / Dates</span>
                <span className="text-xs font-medium text-slate-900">
                  {confirmedProject.duration_text || (confirmedProject.start_date ? `${confirmedProject.start_date} – ${confirmedProject.end_date || 'TBD'}` : "Not specified")}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Roles</span>
                <span className="text-xs font-semibold text-slate-900">
                  {Array.isArray(confirmedProject.roles) && confirmedProject.roles.length > 0 ? confirmedProject.roles.join(", ") : "General Team"}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Required Skills</span>
                <span className="text-xs font-semibold text-slate-900">
                  {confirmedProject.required_skills?.length || 0} Required &bull; {confirmedProject.preferred_skills?.length || 0} Preferred
                </span>
              </div>
            </div>

            {/* REQUIRED SKILLS DISPLAY */}
            <div className="mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-red-500" />
                Required Skills Matrix (Mandatory)
              </h4>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                      <th className="py-2 px-3">Skill Name</th>
                      <th className="py-2 px-3">Normalized Alias</th>
                      <th className="py-2 px-3">Required Level</th>
                      <th className="py-2 px-3">Priority</th>
                      <th className="py-2 px-3">Experience Required</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {confirmedProject.required_skills?.map((sk: any, idx: number) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {sk.skill_name || sk.original_name}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                          {sk.normalized_name || sk.normalized_skill_name || "-"}
                        </td>
                        <td className="py-2 px-3">
                          {sk.required_level ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              {sk.required_level}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500">
                              Not specified
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                            {sk.priority || "Required"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {sk.experience_required || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PREFERRED SKILLS DISPLAY IF PRESENT */}
            {confirmedProject.preferred_skills && confirmedProject.preferred_skills.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-purple-500" />
                  Preferred Skills (Nice-to-Have)
                </h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                        <th className="py-2 px-3">Skill Name</th>
                        <th className="py-2 px-3">Normalized Alias</th>
                        <th className="py-2 px-3">Required Level</th>
                        <th className="py-2 px-3">Priority</th>
                        <th className="py-2 px-3">Experience</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {confirmedProject.preferred_skills?.map((sk: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {sk.skill_name || sk.original_name}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                            {sk.normalized_name || sk.normalized_skill_name || "-"}
                          </td>
                          <td className="py-2 px-3">
                            {sk.required_level ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                                {sk.required_level}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500">
                                Not specified
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              Preferred
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {sk.experience_required || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* WORKFLOW NAVIGATION FOOTER */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 pt-5 gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Upload Another Project Requirement
              </button>

              <div className="w-full sm:w-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/availability?project_id=${confirmedProject?.id}`)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-xs font-bold text-white shadow-sm cursor-pointer transition-all"
                >
                  <Clock className="h-4 w-4" />
                  <span>Evaluate Workforce Availability Engine</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default JobUpload;
