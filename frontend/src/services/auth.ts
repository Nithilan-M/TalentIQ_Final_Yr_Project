const BASE_API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const API_URL = `${BASE_API}/api/auth`;

export const authService = {
  async register(email: string, password: string) {
    const response = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Registration failed.");
    }
    
    return response.json();
  },

  async login(email: string, password: string) {
    // FastAPI OAuth2PasswordRequestForm expects Form URL Encoded data
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    let response;
    try {
      response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });
    } catch (netErr: any) {
      console.error("Network login error:", netErr);
      throw new Error("Unable to connect to backend server. Please verify backend (http://127.0.0.1:8000) is running.");
    }

    if (!response.ok) {
      let errorDetail = "Authentication failed.";
      try {
        const errorData = await response.json();
        errorDetail = errorData.detail || errorDetail;
      } catch {}
      throw new Error(errorDetail);
    }

    const data = await response.json();
    if (data.access_token) {
      // Clear any previous user's session data before setting new credentials
      localStorage.removeItem("active_jd_id");
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user_email", data.email);
    }
    return data;
  },

  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user_email");
    localStorage.removeItem("active_jd_id");
  },

  getToken() {
    return localStorage.getItem("token");
  },

  getUserEmail() {
    return localStorage.getItem("user_email");
  },

  isAuthenticated() {
    return !!localStorage.getItem("token");
  }
};
