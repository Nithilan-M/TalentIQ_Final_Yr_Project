import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import useTheme from "./hooks/useTheme";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import EmployeeMaster from "./pages/EmployeeMaster";
import SkillTaxonomy from "./pages/SkillTaxonomy";
import AvailabilityEngine from "./pages/AvailabilityEngine";
import ProjectSkillMatching from "./pages/ProjectSkillMatching";
import EmployeeRanking from "./pages/EmployeeRanking";
import ProjectShortlist from "./pages/ProjectShortlist";
import ProjectWorkspace from "./pages/ProjectWorkspace";
import JobUpload from "./pages/JobUpload";
import ResumeUpload from "./pages/ResumeUpload";
import CandidateDetails from "./pages/CandidateDetails";
import CandidateCompare from "./pages/CandidateCompare";
import Analytics from "./pages/Analytics";
import ChallengePanel from "./pages/ChallengePanel";
import { ChallengeProvider } from "./context/ChallengeContext";

export const App: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <Router>
      <ChallengeProvider>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
          <Navbar isDark={isDark} toggleTheme={toggleTheme} />
          
          <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Employee Master Data */}
          <Route
            path="/employees"
            element={
              <ProtectedRoute>
                <EmployeeMaster />
              </ProtectedRoute>
            }
          />

          {/* Skill Taxonomy */}
          <Route
            path="/skills"
            element={
              <ProtectedRoute>
                <SkillTaxonomy />
              </ProtectedRoute>
            }
          />

          {/* Employee Availability Engine */}
          <Route
            path="/availability"
            element={
              <ProtectedRoute>
                <AvailabilityEngine />
              </ProtectedRoute>
            }
          />

          {/* Employee-Project Skill Matching Engine */}
          <Route
            path="/matching"
            element={
              <ProtectedRoute>
                <ProjectSkillMatching />
              </ProtectedRoute>
            }
          />

          {/* Employee Ranking Engine */}
          <Route
            path="/ranking"
            element={
              <ProtectedRoute>
                <EmployeeRanking />
              </ProtectedRoute>
            }
          />

          {/* 2x Shortlisting Module */}
          <Route
            path="/shortlist"
            element={
              <ProtectedRoute>
                <ProjectShortlist />
              </ProtectedRoute>
            }
          />

          {/* Project Workspace Page */}
          <Route
            path="/project/:id"
            element={
              <ProtectedRoute>
                <ProjectWorkspace />
              </ProtectedRoute>
            }
          />

          {/* Import Profile */}
          <Route
            path="/import-profile"
            element={
              <ProtectedRoute>
                <ResumeUpload />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upload-resume"
            element={
              <ProtectedRoute>
                <ResumeUpload />
              </ProtectedRoute>
            }
          />

          {/* Project Requirements & Matching Dashboard */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upload-jd"
            element={
              <ProtectedRoute>
                <JobUpload />
              </ProtectedRoute>
            }
          />

          <Route
            path="/challenge"
            element={
              <ProtectedRoute>
                <ChallengePanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidate/:id"
            element={
              <ProtectedRoute>
                <CandidateDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/compare"
            element={
              <ProtectedRoute>
                <CandidateCompare />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/employees" replace />} />
        </Routes>
      </div>
    </ChallengeProvider>
  </Router>
  );
};

export default App;
