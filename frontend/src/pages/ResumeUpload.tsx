import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, AlertTriangle, ArrowRight, ShieldCheck, Plus, Trash2, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { apiService } from "../services/api";
import { GlassCard } from "../components/GlassCard";

export const ResumeUpload: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Step state: 1 = Upload, 2 = Processing, 3 = Review & Edit, 4 = Success
  const [step, setStep] = useState<number>(1);
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);

  // Form data for employee profile review
  const [formData, setFormData] = useState<any>({
    employee_id: "",
    name: "",
    email: "",
    phone: "",
    department: "Engineering",
    designation: "Software Engineer",
    total_experience_years: 3.0,
    technical_summary: "",
    skills: [],
    projects: [],
    certifications: []
  });

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
    if (ext !== "pdf" && ext !== "docx" && ext !== "txt") {
      setError("Invalid file format. Please upload a PDF, DOCX, or TXT employee profile document.");
      return;
    }
    setFile(selectedFile);
  };

  const handleExtractProfile = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setStep(2);

    try {
      const res = await apiService.importEmployeeResume(file);
      const data = res.extracted_data || {};
      setFormData({
        employee_id: data.employee_id || "",
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        department: data.department || "Engineering",
        designation: data.designation || "Software Engineer",
        total_experience_years: data.total_experience_years || 3.0,
        technical_summary: data.technical_summary || "",
        skills: data.skills || [],
        projects: data.projects || [],
        certifications: data.certifications || []
      });
      setDuplicateWarning(res.duplicate_warning || null);
      setStep(3);
    } catch (err: any) {
      setError(err.message || "Unable to extract employee profile from document.");
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);

    if (!formData.name.trim()) {
      setError("Employee Name is required.");
      setSaving(false);
      return;
    }

    try {
      await apiService.createEmployee(formData);
      setStep(4);
    } catch (err: any) {
      setError(err.message || "Failed to save employee profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setError(null);
    setDuplicateWarning(null);
    setStep(1);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* MODULE HEADER */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <FileText className="h-6 w-6 text-red-500" />
            Import Employee Profile
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Upload an individual employee resume or profile document (PDF/DOCX). AI extracts skills, proficiency levels, experience, projects, and certifications into Employee Master Data.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl bg-red-50 p-4 border border-red-200 text-xs font-medium text-red-700 shadow-xs">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
          <div>
            <span className="font-semibold block text-sm mb-0.5">Notice</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* STEP 1: UPLOAD DOCUMENT */}
      {step === 1 && (
        <GlassCard className="p-6">
          <input
            type="file"
            id="emp-profile-upload"
            className="hidden"
            accept=".pdf,.docx,.txt"
            onChange={handleFileChange}
          />

          {file ? (
            <div className="border-2 border-dashed border-red-500 bg-red-50/20 rounded-xl p-8 text-center">
              <FileText className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-900">{file.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB &bull; Ready for extraction</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => setFile(null)}
                  className="text-xs font-semibold text-red-500 hover:underline cursor-pointer"
                >
                  Remove file
                </button>
              </div>
            </div>
          ) : (
            <label
              htmlFor="emp-profile-upload"
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                dragActive ? "border-red-500 bg-red-50/20" : "border-slate-200 hover:border-slate-300 bg-slate-50/30"
              }`}
            >
              <UploadCloud className="h-8 w-8 text-slate-400 mb-2" />
              <span className="text-sm font-semibold text-red-500 hover:underline">Click to browse Employee Profile (PDF / DOCX)</span>
              <span className="text-sm text-slate-500"> or drag and drop</span>
            </label>
          )}

          {file && (
            <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleExtractProfile}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-red-600 cursor-pointer disabled:opacity-50"
              >
                <span>Extract Employee Profile</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </GlassCard>
      )}

      {/* STEP 2: PROCESSING */}
      {step === 2 && (
        <GlassCard className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-red-500" />
          <h3 className="text-base font-bold text-slate-900">AI is Analyzing the Profile Document...</h3>
          <p className="mt-1 text-xs text-slate-500">Extracting skills, proficiency levels, experience, projects, and certifications.</p>
        </GlassCard>
      )}

      {/* STEP 3: REVIEW & EDIT */}
      {step === 3 && (
        <div className="space-y-6">
          {duplicateWarning && (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-start gap-3 text-xs">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block uppercase tracking-wider text-amber-800">Duplicate Employee Record Detected</span>
                <span>An existing employee with email <strong>{duplicateWarning.email}</strong> was found (ID: {duplicateWarning.employee_id}). Saving will update or create a new unique record.</span>
              </div>
            </div>
          )}

          <GlassCard className="p-6">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-red-500" />
              Review & Edit Extracted Employee Profile
            </h3>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-red-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-red-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Designation</label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Total Experience (Years)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.total_experience_years}
                    onChange={(e) => setFormData({ ...formData, total_experience_years: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* Extracted Skills */}
              <div className="pt-2">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  Extracted Skills Matrix ({formData.skills.length})
                </h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                        <th className="py-2 px-3">Skill Name</th>
                        <th className="py-2 px-3">Normalized Alias</th>
                        <th className="py-2 px-3">Proficiency Level</th>
                        <th className="py-2 px-3">Experience</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formData.skills.map((sk: any, i: number) => (
                        <tr key={i}>
                          <td className="py-1.5 px-3 font-bold text-slate-900">{sk.skill_name}</td>
                          <td className="py-1.5 px-3 font-mono text-[11px] text-slate-500">{sk.normalized_skill_name}</td>
                          <td className="py-1.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold text-[11px] border border-purple-200">
                              {sk.proficiency_level || "Intermediate"}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-slate-700">{sk.experience_years ? `${sk.experience_years} yrs` : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                Upload Different Document
              </button>

              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-red-500 px-6 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-600 cursor-pointer disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save to Employee Master Data"}
                <CheckCircle2 className="h-4 w-4" />
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* STEP 4: SUCCESS */}
      {step === 4 && (
        <GlassCard className="p-8 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Employee Record Created Successfully!</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            The profile for <strong>{formData.name}</strong> ({formData.employee_id}) has been added to Employee Master Data.
          </p>
          <div className="pt-4 flex justify-center gap-3">
            <button
              onClick={handleReset}
              className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              Import Another Profile
            </button>
            <button
              onClick={() => navigate("/employees")}
              className="rounded-xl bg-red-500 hover:bg-red-600 px-5 py-2 text-xs font-semibold text-white cursor-pointer"
            >
              View Employee Master Data
            </button>
          </div>
        </GlassCard>
      )}
    </div>
  );
};

export default ResumeUpload;
