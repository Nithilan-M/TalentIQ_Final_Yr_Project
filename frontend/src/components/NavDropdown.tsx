import React, { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";

export interface DropdownItem {
  label: string;
  path: string;
  icon: React.FC<{ className?: string }>;
  description?: string;
  badge?: string;
}

interface NavDropdownProps {
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  items: DropdownItem[];
  isOpen: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
  activePaths: string[];
}

export const NavDropdown: React.FC<NavDropdownProps> = ({
  id,
  label,
  icon: Icon,
  items,
  isOpen,
  onToggle,
  onClose,
  activePaths,
}) => {
  const location = useLocation();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isChildActive = activePaths.some((path) => location.pathname === path);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (isOpen) onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`${label} menu`}
        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer outline-none focus:ring-2 focus:ring-red-500/20 ${
          isChildActive || isOpen
            ? "bg-red-50 text-red-600 font-bold border border-red-100"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent"
        }`}
      >
        <Icon className={`h-4 w-4 ${isChildActive ? "text-red-500" : "text-slate-500"}`} />
        <span>{label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-red-500" : "text-slate-400"
          }`}
        />
      </button>

      {/* Dropdown Menu Container */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-60 rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-slate-900/5 border border-slate-100 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="space-y-0.5">
            {items.map((item) => {
              const ItemIcon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path + item.label}
                  to={item.path}
                  onClick={() => onClose()}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                    isActive
                      ? "bg-slate-100 text-slate-900 font-semibold"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`p-1 rounded-md transition-colors ${
                        isActive
                          ? "bg-red-500 text-white"
                          : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-800"
                      }`}
                    >
                      <ItemIcon className="h-3.5 w-3.5" />
                    </div>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default NavDropdown;
