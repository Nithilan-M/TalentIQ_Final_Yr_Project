import React from "react";
import { FolderGit2 } from "lucide-react";

interface JobDescriptionOption {
  id: number;
  title: string;
}

interface ProjectSelectorProps {
  jds: JobDescriptionOption[];
  activeJdId: string;
  onJdChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  jds,
  activeJdId,
  onJdChange,
}) => {
  if (jds.length === 0) return null;

  const currentJd = jds.find((j) => String(j.id) === activeJdId) || jds[0];

  return (
    <div className="flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-lg px-2.5 py-1 transition-all max-w-[240px] sm:max-w-[260px]">
      <FolderGit2 className="h-3.5 w-3.5 text-red-500 shrink-0" />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 leading-none mb-0.5">
          Project Context
        </span>
        <div className="relative flex items-center">
          <select
            value={activeJdId}
            onChange={onJdChange}
            title={currentJd ? currentJd.title : "Select Active Project"}
            aria-label="Active Project Selector"
            className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer truncate pr-3 appearance-none focus:outline-none"
          >
            {jds.map((jd) => (
              <option key={jd.id} value={jd.id} className="text-slate-900 bg-white py-1">
                {jd.title}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectSelector;
