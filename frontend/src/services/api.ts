import { authService } from "./auth";

const BASE_API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const BASE_URL = `${BASE_API}/api`;

async function request(endpoint: string, options: RequestInit = {}) {
  const token = authService.getToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Set default Content-Type to JSON unless sending FormData (for files)
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    authService.logout();
    if (window.location.pathname !== "/login" && window.location.pathname !== "/register") {
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please log in again.");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }

  // Handle file streaming downloads vs JSON
  const contentType = response.headers.get("content-type");
  if (
    contentType &&
    (contentType.includes("application/pdf") ||
      contentType.includes("text/csv") ||
      contentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") ||
      contentType.includes("application/octet-stream"))
  ) {
    return response.blob();
  }

  return response.json();
}

export const apiService = {
  // Project Requirements
  async uploadProjectRequirement(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return request("/job-description/upload", {
      method: "POST",
      body: formData,
    });
  },

  async confirmProjectRequirement(data: any) {
    return request("/job-description/confirm", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Legacy Job Descriptions aliases
  async uploadJobDescription(file: File) {
    return this.uploadProjectRequirement(file);
  },

  async getLatestJobDescription() {
    return request("/job-description/latest");
  },

  async listJobDescriptions() {
    return request("/job-description/list");
  },

  async getJobDescriptionDetails(id: number) {
    return request(`/job-description/${id}`);
  },

  // ── Skill Taxonomy APIs ───────────────────────────────────────────────

  async listSkills(params: {
    page?: number;
    page_size?: number;
    search?: string;
    category?: string;
    status?: string;
  } = {}) {
    const queryParts: string[] = [];
    if (params.page) queryParts.push(`page=${params.page}`);
    if (params.page_size) queryParts.push(`page_size=${params.page_size}`);
    if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
    if (params.category) queryParts.push(`category=${encodeURIComponent(params.category)}`);
    if (params.status) queryParts.push(`status=${encodeURIComponent(params.status)}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    return request(`/skills${queryString}`);
  },

  async searchSkills(q: string) {
    return request(`/skills/search?q=${encodeURIComponent(q)}`);
  },

  async getSkillCategories() {
    return request("/skills/categories");
  },

  async getProficiencyLevels() {
    return request("/skills/proficiency-levels");
  },

  async getSkillDetails(id: number) {
    return request(`/skills/${id}`);
  },

  async createSkill(data: any) {
    return request("/skills", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateSkill(id: number, data: any) {
    return request(`/skills/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deactivateSkill(id: number) {
    return request(`/skills/${id}`, {
      method: "DELETE",
    });
  },

  // ── Employee Availability Engine APIs ──────────────────────────────────

  async getProjectAvailability(projectId: number, params: {
    page?: number;
    page_size?: number;
    status?: string;
    department?: string;
    designation?: string;
    search?: string;
  } = {}) {
    const queryParts: string[] = [];
    if (params.page) queryParts.push(`page=${params.page}`);
    if (params.page_size) queryParts.push(`page_size=${params.page_size}`);
    if (params.status) queryParts.push(`status=${encodeURIComponent(params.status)}`);
    if (params.department) queryParts.push(`department=${encodeURIComponent(params.department)}`);
    if (params.designation) queryParts.push(`designation=${encodeURIComponent(params.designation)}`);
    if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    return request(`/availability/project/${projectId}${queryString}`);
  },

  async checkDatesAvailability(startDate: string, endDate: string, params: {
    projectName?: string;
    page?: number;
    page_size?: number;
    status?: string;
    department?: string;
    designation?: string;
    search?: string;
  } = {}) {
    const queryParts: string[] = [
      `start_date=${encodeURIComponent(startDate)}`,
      `end_date=${encodeURIComponent(endDate)}`
    ];
    if (params.projectName) queryParts.push(`project_name=${encodeURIComponent(params.projectName)}`);
    if (params.page) queryParts.push(`page=${params.page}`);
    if (params.page_size) queryParts.push(`page_size=${params.page_size}`);
    if (params.status) queryParts.push(`status=${encodeURIComponent(params.status)}`);
    if (params.department) queryParts.push(`department=${encodeURIComponent(params.department)}`);
    if (params.designation) queryParts.push(`designation=${encodeURIComponent(params.designation)}`);
    if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);

    return request(`/availability/check-dates?${queryParts.join("&")}`);
  },

  async getAvailabilityFilterOptions() {
    return request("/availability/departments");
  },

  // ── Employee-Project Skill Matching Engine APIs ────────────────────────

  async getProjectSkillMatches(projectId: number, params: {
    page?: number;
    page_size?: number;
    department?: string;
    designation?: string;
    min_score?: number;
    search?: string;
  } = {}) {
    const queryParts: string[] = [];
    if (params.page) queryParts.push(`page=${params.page}`);
    if (params.page_size) queryParts.push(`page_size=${params.page_size}`);
    if (params.department) queryParts.push(`department=${encodeURIComponent(params.department)}`);
    if (params.designation) queryParts.push(`designation=${encodeURIComponent(params.designation)}`);
    if (params.min_score !== undefined) queryParts.push(`min_score=${params.min_score}`);
    if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    return request(`/project/${projectId}/skill-matches${queryString}`);
  },

  async getEmployeeMatchDetails(projectId: number, employeeId: number) {
    return request(`/project/${projectId}/skill-matches/${employeeId}`);
  },

  async getMatchExplanation(projectId: number, employeeId: number) {
    return request(`/project/${projectId}/employees/${employeeId}/match-explanation`);
  },

  // ── Employee Ranking Engine APIs ───────────────────────────────────────

  async getProjectEmployeeRankings(projectId: number, params: {
    page?: number;
    page_size?: number;
    department?: string;
    designation?: string;
    min_score?: number;
    search?: string;
    mode?: "PRE_ASSESSMENT" | "FINAL";
  } = {}) {
    const queryParts: string[] = [];
    if (params.page) queryParts.push(`page=${params.page}`);
    if (params.page_size) queryParts.push(`page_size=${params.page_size}`);
    if (params.department) queryParts.push(`department=${encodeURIComponent(params.department)}`);
    if (params.designation) queryParts.push(`designation=${encodeURIComponent(params.designation)}`);
    if (params.min_score !== undefined) queryParts.push(`min_score=${params.min_score}`);
    if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
    if (params.mode) queryParts.push(`mode=${encodeURIComponent(params.mode)}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    return request(`/project/${projectId}/ranking${queryString}`);
  },

  async getRankingConfig(projectId: number) {
    return request(`/project/${projectId}/ranking/config`);
  },

  async getEmployeeRankingDetails(projectId: number, employeeId: number, mode: string = "PRE_ASSESSMENT") {
    return request(`/project/${projectId}/ranking/${employeeId}?mode=${encodeURIComponent(mode)}`);
  },

  // ── 2x Shortlisting Module APIs ────────────────────────────────────────

  async generateProjectShortlist(projectId: number) {
    return request(`/project/${projectId}/shortlist/generate`, {
      method: "POST"
    });
  },

  async getProjectShortlist(projectId: number, params: {
    page?: number;
    page_size?: number;
    status_filter?: "SHORTLISTED" | "NOT_SHORTLISTED";
    department?: string;
    designation?: string;
    search?: string;
  } = {}) {
    const queryParts: string[] = [];
    if (params.page) queryParts.push(`page=${params.page}`);
    if (params.page_size) queryParts.push(`page_size=${params.page_size}`);
    if (params.status_filter) queryParts.push(`status_filter=${encodeURIComponent(params.status_filter)}`);
    if (params.department) queryParts.push(`department=${encodeURIComponent(params.department)}`);
    if (params.designation) queryParts.push(`designation=${encodeURIComponent(params.designation)}`);
    if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    return request(`/project/${projectId}/shortlist${queryString}`);
  },

  // ── Project Manager Dashboard APIs ────────────────────────────────────

  async getDashboardSummary() {
    return request("/dashboard/summary");
  },

  async getProjectDashboardWorkspace(projectId: number) {
    return request(`/dashboard/project/${projectId}`);
  },

  // ── Employee Master Data APIs ─────────────────────────────────────────

  async listEmployees(params: {
    page?: number;
    page_size?: number;
    search?: string;
    department?: string;
    designation?: string;
    status?: string;
  } = {}) {
    const queryParts: string[] = [];
    if (params.page) queryParts.push(`page=${params.page}`);
    if (params.page_size) queryParts.push(`page_size=${params.page_size}`);
    if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
    if (params.department) queryParts.push(`department=${encodeURIComponent(params.department)}`);
    if (params.designation) queryParts.push(`designation=${encodeURIComponent(params.designation)}`);
    if (params.status) queryParts.push(`status=${encodeURIComponent(params.status)}`);

    const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    return request(`/employee/list${queryString}`);
  },

  async getEmployeeStats() {
    return request("/employee/stats");
  },

  async getEmployeeDetails(id: number | string) {
    return request(`/employee/${id}`);
  },

  async createEmployee(data: any) {
    return request("/employee", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateEmployee(id: number, data: any) {
    return request(`/employee/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deactivateEmployee(id: number) {
    return request(`/employee/${id}`, {
      method: "DELETE",
    });
  },

  async importEmployeeResume(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return request("/employee/import-resume", {
      method: "POST",
      body: formData,
    });
  },

  async downloadExcelTemplate() {
    return request("/employee/excel-template");
  },

  async importExcel(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return request("/employee/import-excel", {
      method: "POST",
      body: formData,
    });
  },

  async confirmExcelImport(validData: any, updateExisting: boolean = true) {
    return request("/employee/import-excel/confirm", {
      method: "POST",
      body: JSON.stringify({
        valid_data: validData,
        update_existing: updateExisting,
      }),
    });
  },

  // Resumes / Candidates (Legacy compatibility)
  async uploadResumes(jobDescriptionId: number, files: File[]) {
    const formData = new FormData();
    formData.append("job_description_id", String(jobDescriptionId));
    files.forEach((file) => {
      formData.append("files", file);
    });
    return request("/resume/upload-resumes", {
      method: "POST",
      body: formData,
    });
  },

  async listCandidates(jobDescriptionId: number, query?: string) {
    const url = `/candidate/list?job_description_id=${jobDescriptionId}${
      query ? `&query=${encodeURIComponent(query)}` : ""
    }`;
    return request(url);
  },

  async getCandidateDetails(id: number) {
    return request(`/candidate/${id}`);
  },

  async compareCandidates(candidateIds: number[]) {
    return request("/candidate/compare", {
      method: "POST",
      body: JSON.stringify({ candidate_ids: candidateIds }),
    });
  },

  async regenerateInterviewQuestions(candidateId: number) {
    return request(`/candidate/${candidateId}/regenerate-interview`, {
      method: "POST",
    });
  },

  // Analytics
  async getAnalytics(jobDescriptionId: number) {
    return request(`/analytics/?job_description_id=${jobDescriptionId}`);
  },

  // Reports Exports (returns blob)
  async exportCandidatesCSV(jobDescriptionId: number) {
    return request(`/export/csv?job_description_id=${jobDescriptionId}`);
  },

  async exportCandidatePDF(candidateId: number) {
    return request(`/export/pdf?candidate_id=${candidateId}`);
  },

  // Redrob Challenge API methods
  async runChallengePipeline(file?: File) {
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      return request("/challenge/run", {
        method: "POST",
        body: formData,
      });
    }
    return request("/challenge/run", { method: "POST" });
  },

  async runChallengePipelineStream(file: File | undefined, jdFile: File | undefined, onProgress: (update: any) => void) {
    const token = authService.getToken();
    const headers = new Headers();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    
    let body: any = undefined;
    if (file || jdFile) {
      body = new FormData();
      if (file) {
        body.append("file", file);
      }
      if (jdFile) {
        body.append("jd_file", jdFile);
      }
    }

    const response = await fetch(`${BASE_URL}/challenge/run`, {
      method: "POST",
      headers,
      body,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
    }

    if (!response.body) {
      throw new Error("No response body to read stream");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            onProgress(parsed);
          } catch (e) {
            console.error("Failed to parse stream line:", line, e);
          }
        }
      }
    }
  },

  async getChallengeJD() {
    return request("/challenge/jd");
  },

  async validateChallengeSubmission() {
    return request("/challenge/validate");
  },

  async getChallengeAnalytics() {
    return request("/challenge/analytics");
  },

  async exportChallengeXLSX() {
    return request("/challenge/export-xlsx");
  }
};
