import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Briefcase,
  Users,
  Sparkles,
  FileText,
  Upload,
  Clock,
  Target,
  Award,
  FileCheck2,
  BarChart2,
  FileSpreadsheet,
  LayoutDashboard,
  Menu,
  Bell,
  MoreHorizontal,
  FolderGit2,
} from "lucide-react";
import { authService } from "../services/auth";
import { apiService } from "../services/api";
import NavDropdown, { type DropdownItem } from "./NavDropdown";
import ProjectSelector from "./ProjectSelector";
import UserMenu from "./UserMenu";
import MobileNavDrawer from "./MobileNavDrawer";

interface NavbarProps {
  isDark?: boolean;
  toggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [jds, setJds] = useState<{ id: number; title: string }[]>([]);
  const [activeJdId, setActiveJdId] = useState<string>("");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  useEffect(() => {
    if (authService.isAuthenticated()) {
      fetchJds();
      const savedJd = localStorage.getItem("active_jd_id") || "";
      setActiveJdId(savedJd);
    }
    setIsMobileOpen(false);
    setActiveDropdown(null);
  }, [location.pathname]);

  const fetchJds = async () => {
    try {
      const data = await apiService.listJobDescriptions();
      setJds(data);
      if (data.length > 0 && !localStorage.getItem("active_jd_id")) {
        localStorage.setItem("active_jd_id", String(data[0].id));
        setActiveJdId(String(data[0].id));
      }
    } catch (err) {
      console.error("Failed to load job descriptions:", err);
    }
  };

  const handleJdChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    localStorage.setItem("active_jd_id", val);
    setActiveJdId(val);
    window.location.reload();
  };

  const handleLogout = () => {
    authService.logout();
    navigate("/login");
  };

  const handleToggleDropdown = (id: string) => {
    setActiveDropdown((prev) => (prev === id ? null : id));
  };

  const handleCloseDropdown = () => {
    setActiveDropdown(null);
  };

  const isActive = (path: string) => location.pathname === path;

  // Don't render top bar on login or register routes
  if (location.pathname === "/login" || location.pathname === "/register") {
    return null;
  }

  // Define Grouped Navigation Items
  const employeeItems: DropdownItem[] = [
    { label: "Employee Master Data", path: "/employees", icon: Users },
    { label: "Import Employee Profile", path: "/import-profile", icon: FileText },
    { label: "Bulk Excel Import", path: "/employees", icon: FileSpreadsheet },
  ];

  const skillItems: DropdownItem[] = [
    { label: "Skill Taxonomy", path: "/skills", icon: Sparkles },
  ];

  const projectItems: DropdownItem[] = [
    { label: "Project Requirement", path: "/upload-jd", icon: Upload },
  ];

  const matchingItems: DropdownItem[] = [
    { label: "Availability Engine", path: "/availability", icon: Clock },
    { label: "Skill Matching", path: "/matching", icon: Target },
    { label: "Explainable Matching", path: "/matching", icon: Sparkles },
    { label: "Employee Ranking", path: "/ranking", icon: Award },
    { label: "2× Shortlisting", path: "/shortlist", icon: FileCheck2 },
  ];

  const moreItems: DropdownItem[] = [
    { label: "Analytics", path: "/analytics", icon: BarChart2 },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md transition-all">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
          <div className="flex h-15 items-center justify-between gap-2 sm:gap-4">
            
            {/* 1. LEFT SECTION: Brand Logo + Mobile Hamburger */}
            <div className="flex items-center space-x-3 shrink-0">
              {/* Mobile Hamburger Toggle */}
              {authService.isAuthenticated() && (
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(true)}
                  aria-label="Open navigation menu"
                  className="flex md:hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer outline-none focus:ring-2 focus:ring-red-500/20"
                >
                  <Menu className="h-5 w-5" />
                </button>
              )}

              {/* Logo */}
              <Link
                to="/"
                className="flex items-center space-x-2.5 cursor-pointer group focus:outline-none"
              >
                <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-gradient-to-tr from-red-500 to-rose-600 text-white shadow-sm group-hover:shadow transition-all duration-200">
                  <Briefcase className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[#0F172A] text-base font-extrabold tracking-tight leading-none group-hover:text-red-600 transition-colors">
                    TalentIQ
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase leading-none mt-0.5 hidden sm:inline">
                    Enterprise SaaS
                  </span>
                </div>
              </Link>
            </div>

            {/* 2. CENTER SECTION: Grouped Primary Navigation */}
            {authService.isAuthenticated() && (
              <nav className="hidden md:flex items-center space-x-1 lg:space-x-1.5 flex-1 justify-center max-w-2xl">
                {/* Dashboard Direct Link */}
                <Link
                  to="/"
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                    isActive("/")
                      ? "bg-red-50 text-red-600 font-bold border border-red-100"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent"
                  }`}
                >
                  <LayoutDashboard className={`h-4 w-4 ${isActive("/") ? "text-red-500" : "text-slate-500"}`} />
                  <span>Dashboard</span>
                </Link>

                {/* Employees Dropdown */}
                <NavDropdown
                  id="employees"
                  label="Employees"
                  icon={Users}
                  items={employeeItems}
                  isOpen={activeDropdown === "employees"}
                  onToggle={handleToggleDropdown}
                  onClose={handleCloseDropdown}
                  activePaths={["/employees", "/import-profile", "/upload-resume"]}
                />

                {/* Skills Dropdown */}
                <NavDropdown
                  id="skills"
                  label="Skills"
                  icon={Sparkles}
                  items={skillItems}
                  isOpen={activeDropdown === "skills"}
                  onToggle={handleToggleDropdown}
                  onClose={handleCloseDropdown}
                  activePaths={["/skills"]}
                />

                {/* Projects Dropdown */}
                <NavDropdown
                  id="projects"
                  label="Projects"
                  icon={FolderGit2}
                  items={projectItems}
                  isOpen={activeDropdown === "projects"}
                  onToggle={handleToggleDropdown}
                  onClose={handleCloseDropdown}
                  activePaths={["/upload-jd"]}
                />

                {/* Matching & Allocation Dropdown */}
                <NavDropdown
                  id="matching"
                  label="Matching"
                  icon={Target}
                  items={matchingItems}
                  isOpen={activeDropdown === "matching"}
                  onToggle={handleToggleDropdown}
                  onClose={handleCloseDropdown}
                  activePaths={["/availability", "/matching", "/ranking", "/shortlist"]}
                />

                {/* Analytics Direct Link (Visible on xl screens) */}
                <Link
                  to="/analytics"
                  className={`hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                    isActive("/analytics")
                      ? "bg-red-50 text-red-600 font-bold border border-red-100"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent"
                  }`}
                >
                  <BarChart2 className={`h-4 w-4 ${isActive("/analytics") ? "text-red-500" : "text-slate-500"}`} />
                  <span>Analytics</span>
                </Link>

                {/* More Dropdown (Visible on medium laptop screens 1024px-1279px) */}
                <div className="lg:hidden">
                  <NavDropdown
                    id="more"
                    label="More"
                    icon={MoreHorizontal}
                    items={moreItems}
                    isOpen={activeDropdown === "more"}
                    onToggle={handleToggleDropdown}
                    onClose={handleCloseDropdown}
                    activePaths={["/analytics"]}
                  />
                </div>
              </nav>
            )}

            {/* 3. RIGHT SECTION: Project Context + User Actions */}
            <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
              {authService.isAuthenticated() && (
                <>
                  {/* Active Project Selector */}
                  <div className="hidden sm:block">
                    <ProjectSelector
                      jds={jds}
                      activeJdId={activeJdId}
                      onJdChange={handleJdChange}
                    />
                  </div>

                  {/* Notification Bell Icon */}
                  <button
                    type="button"
                    aria-label="Notifications"
                    className="relative flex h-8.5 w-8.5 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                  >
                    <Bell className="h-4 w-4" />
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                  </button>

                  {/* Compact User Menu Avatar */}
                  <UserMenu onLogout={handleLogout} />
                </>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Responsive Mobile Drawer (< 768px) */}
      {authService.isAuthenticated() && (
        <MobileNavDrawer
          isOpen={isMobileOpen}
          onClose={() => setIsMobileOpen(false)}
          jds={jds}
          activeJdId={activeJdId}
          onJdChange={handleJdChange}
          onLogout={handleLogout}
        />
      )}
    </>
  );
};

export default Navbar;
