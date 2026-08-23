import React, { useEffect, useRef, useState } from "react";
import { LogOut, User, Settings, ChevronDown, ShieldCheck } from "lucide-react";
import { authService } from "../services/auth";

interface UserMenuProps {
  onLogout: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const email = authService.getUserEmail() || "recruiter@talent_iq.ai";
  
  // Extract initials or use TQ
  const getInitials = (emailStr: string) => {
    if (!emailStr) return "TQ";
    const namePart = emailStr.split("@")[0];
    const parts = namePart.split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return namePart.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(email);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        if (isOpen) setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Open user menu"
        className="flex items-center space-x-2 rounded-full border border-slate-200 bg-white p-1 pr-2.5 text-slate-700 hover:bg-slate-50 transition-all outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-red-500 to-rose-600 text-[11px] font-bold text-white shadow-xs">
          {initials}
        </div>
        <span className="hidden lg:inline text-xs font-semibold text-slate-700 max-w-[100px] truncate">
          {email.split("@")[0]}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-red-500" : ""}`} />
      </button>

      {/* User Menu Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-slate-900/5 border border-slate-100 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* User Info Header */}
          <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
            <p className="text-xs font-bold text-slate-900 truncate">{email}</p>
            <div className="flex items-center space-x-1 mt-0.5 text-[10px] font-medium text-slate-500">
              <ShieldCheck className="h-3 w-3 text-emerald-500" />
              <span>Lead Recruiter</span>
            </div>
          </div>

          <div className="space-y-0.5">
            <button
              type="button"
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
              onClick={() => setIsOpen(false)}
            >
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span>Profile</span>
            </button>

            <button
              type="button"
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
              onClick={() => setIsOpen(false)}
            >
              <Settings className="h-3.5 w-3.5 text-slate-400" />
              <span>Settings</span>
            </button>

            <div className="border-t border-slate-100 my-1"></div>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-all cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 text-red-500" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
