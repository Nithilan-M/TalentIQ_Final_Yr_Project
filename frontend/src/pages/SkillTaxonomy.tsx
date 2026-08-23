import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  Layers,
  Tag,
  Info,
  Sliders,
  Check
} from "lucide-react";
import { apiService } from "../services/api";
import { GlassCard } from "../components/GlassCard";

interface SkillItem {
  id: number;
  name: string;
  normalized_name: string;
  category: string;
  description: string;
  aliases: string[];
  status: string;
  employee_usage_count: number;
  project_usage_count: number;
  total_usage_count: number;
}

interface ProficiencyLevelDef {
  level_value: number;
  name: string;
  description: string;
}

export const SkillTaxonomy: React.FC = () => {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [proficiencyLevels, setProficiencyLevels] = useState<ProficiencyLevelDef[]>([]);
  
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  // Filters State
  const [search, setSearch] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Add/Edit Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingSkillId, setEditingSkillId] = useState<number | null>(null);
  const [formData, setFormData] = useState<any>({
    name: "",
    normalized_name: "",
    category: "Programming Languages",
    description: "",
    aliasesInput: "",
    status: "Active"
  });
  const [formSaving, setFormSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Guide Toggle State
  const [showProficiencyGuide, setShowProficiencyGuide] = useState<boolean>(true);

  useEffect(() => {
    fetchMeta();
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [page, search, categoryFilter, statusFilter]);

  const fetchMeta = async () => {
    try {
      const catRes = await apiService.getSkillCategories();
      setCategories(catRes.categories || []);

      const profRes = await apiService.getProficiencyLevels();
      setProficiencyLevels(profRes.levels || []);
    } catch (err) {
      console.error("Failed to fetch taxonomy metadata:", err);
    }
  };

  const fetchSkills = async () => {
    setLoading(true);
    try {
      const res = await apiService.listSkills({
        page,
        page_size: pageSize,
        search,
        category: categoryFilter,
        status: statusFilter
      });
      setSkills(res.items || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      console.error("Failed to fetch skills:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingSkillId(null);
    setFormError(null);
    setFormData({
      name: "",
      normalized_name: "",
      category: categories[0] || "Programming Languages",
      description: "",
      aliasesInput: "",
      status: "Active"
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (sk: SkillItem) => {
    setEditingSkillId(sk.id);
    setFormError(null);
    setFormData({
      name: sk.name,
      normalized_name: sk.normalized_name,
      category: sk.category,
      description: sk.description,
      aliasesInput: (sk.aliases || []).join(", "),
      status: sk.status
    });
    setShowModal(true);
  };

  const handleSaveSkill = async () => {
    setFormSaving(true);
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError("Canonical Skill Name is required.");
      setFormSaving(false);
      return;
    }

    const aliases = formData.aliasesInput
      .split(",")
      .map((a: string) => a.trim())
      .filter((a: string) => a.length > 0);

    const payload = {
      name: formData.name.trim(),
      normalized_name: formData.normalized_name.trim() || undefined,
      category: formData.category,
      description: formData.description.trim(),
      aliases,
      status: formData.status
    };

    try {
      if (editingSkillId) {
        await apiService.updateSkill(editingSkillId, payload);
      } else {
        await apiService.createSkill(payload);
      }
      setShowModal(false);
      fetchMeta();
      fetchSkills();
    } catch (err: any) {
      setFormError(err.message || "Failed to save skill taxonomy record.");
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeactivate = async (id: number, name: string) => {
    if (!window.confirm(`Deactivate canonical skill '${name}'? Existing references will be preserved, but it will be hidden from new selections.`)) return;
    try {
      await apiService.deactivateSkill(id);
      fetchSkills();
    } catch (err: any) {
      alert(err.message || "Failed to deactivate skill.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* PAGE HEADER */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Sparkles className="h-6 w-6 text-purple-600" />
            Skill Taxonomy & Proficiency Scale
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Centralized organizational skill vocabulary. Establishes standardized canonical skills, categories, aliases, and fixed numeric proficiency levels (1–4) shared by Employee Master Data and Project Requirements.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowProficiencyGuide(!showProficiencyGuide)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5 text-purple-500" />
            <span>{showProficiencyGuide ? "Hide Proficiency Scale" : "View Proficiency Scale"}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm cursor-pointer transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Canonical Skill</span>
          </button>
        </div>
      </div>

      {/* PROFICIENCY SCALE GUIDE CARD */}
      {showProficiencyGuide && (
        <GlassCard className="p-5 mb-6 border-purple-200 bg-purple-50/30">
          <div className="flex items-center justify-between border-b border-purple-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-purple-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-900">
                Standardized 4-Level Skill Proficiency Scale
              </h3>
            </div>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
              Fixed Integer Ordinal Scale (Level 1 – 4)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {proficiencyLevels.map((lvl) => (
              <div key={lvl.level_value} className="bg-white p-3 rounded-lg border border-purple-100 shadow-2xs text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900">{lvl.name}</span>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-white font-bold text-[10px]">
                    {lvl.level_value}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">{lvl.description}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* SEARCH AND FILTER BAR */}
      <GlassCard className="p-4 mb-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by Skill Name, Normalized Alias, or Aliases..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500"
              >
                <option value="">All Categories</option>
                {categories.map((cat, i) => (
                  <option key={i} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            {(search || categoryFilter || statusFilter) && (
              <button
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("");
                  setStatusFilter("");
                  setPage(1);
                }}
                className="text-xs font-semibold text-purple-600 hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </GlassCard>

      {/* SKILL TAXONOMY TABLE */}
      <GlassCard className="p-0 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-4">Canonical Skill Name</th>
                <th className="py-3 px-4">Normalized Alias</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Recognized Aliases</th>
                <th className="py-3 px-4 text-center">Workforce Usage</th>
                <th className="py-3 px-4 text-center">Project Usage</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-purple-600" />
                    <span>Loading Skill Taxonomy...</span>
                  </td>
                </tr>
              ) : skills.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 italic">
                    No canonical skill records found matching criteria.
                  </td>
                </tr>
              ) : (
                skills.map((sk) => (
                  <tr key={sk.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {sk.name}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-purple-600">
                      {sk.normalized_name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {sk.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {sk.aliases?.map((alias, ai) => (
                          <span key={ai} className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-mono text-[10px] border border-purple-100">
                            {alias}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">
                      {sk.employee_usage_count} emp
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">
                      {sk.project_usage_count} proj
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        sk.status === "Active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}>
                        {sk.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(sk)}
                          className="p-1 text-slate-500 hover:text-blue-500 transition-colors cursor-pointer"
                          title="Edit Canonical Skill"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {sk.status === "Active" && (
                          <button
                            onClick={() => handleDeactivate(sk.id, sk.name)}
                            className="p-1 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                            title="Deactivate Skill"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* SERVER-SIDE PAGINATION FOOTER */}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50 text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-900">{skills.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> to{" "}
            <strong className="text-slate-900">{Math.min(page * pageSize, totalCount)}</strong> of{" "}
            <strong className="text-slate-900">{totalCount}</strong> skills
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
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </GlassCard>

      {/* ADD/EDIT SKILL MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                {editingSkillId ? "Edit Canonical Skill" : "Add Canonical Skill"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 font-semibold">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Canonical Skill Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Amazon Web Services"
                  className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-purple-500 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Normalized Alias</label>
                <input
                  type="text"
                  value={formData.normalized_name}
                  onChange={(e) => setFormData({ ...formData, normalized_name: e.target.value })}
                  placeholder="e.g. AWS (leave blank for auto)"
                  className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-purple-500 font-medium"
                >
                  {categories.map((cat, i) => (
                    <option key={i} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Recognized Aliases (Comma-Separated)</label>
                <input
                  type="text"
                  value={formData.aliasesInput}
                  onChange={(e) => setFormData({ ...formData, aliasesInput: e.target.value })}
                  placeholder="AWS, Amazon Web Services, AWS Cloud"
                  className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Technical scope or domain notes..."
                  rows={3}
                  className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full rounded border border-slate-200 p-2 text-xs outline-none focus:border-purple-500"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSkill}
                disabled={formSaving}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
              >
                {formSaving ? "Saving..." : "Save Canonical Skill"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillTaxonomy;
