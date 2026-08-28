import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ChevronDown, Plus, Check, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProjectSelectorProps {
  onOpenNewProjectModal?: () => void;
  collapsed?: boolean;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  onOpenNewProjectModal,
  collapsed = false
}) => {
  const { projects, activeProject, setActiveProject, language } = useApp();
  const isEnglish = language === 'en-US';
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!activeProject) return null;

  if (collapsed) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          title={`${isEnglish ? 'Active Project' : 'Projeto Ativo'}: ${activeProject.name}`}
          className="w-10 h-10 rounded-xl bg-[#0B1628] border border-white/10 hover:border-cyan-400/40 flex items-center justify-center text-cyan-400 transition-all"
        >
          <div
            className="w-5 h-5 rounded-lg flex items-center justify-center font-bold text-xs text-white"
            style={{ backgroundColor: activeProject.iconColor }}
          >
            {activeProject.name.slice(0, 1)}
          </div>
        </button>

        {isOpen && (
          <div className="absolute left-12 top-0 w-64 rounded-2xl bg-[#07111F] border border-white/10 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
            <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-slate-400">
              {isEnglish ? 'BrisaBase Projects' : 'Projetos BrisaBase'}
            </div>
            <div className="space-y-1">
              {projects.map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => {
                    setActiveProject(proj);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors ${
                    activeProject.id === proj.id
                      ? 'bg-[#1677FF]/20 text-cyan-300 font-semibold'
                      : 'text-slate-300 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-md flex items-center justify-center text-[10px] text-white font-bold"
                      style={{ backgroundColor: proj.iconColor }}
                    >
                      {proj.name[0]}
                    </span>
                    <span>{proj.name}</span>
                  </div>
                  {activeProject.id === proj.id && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#0B1628] hover:bg-[#112240] border border-white/10 hover:border-cyan-500/30 transition-all text-left group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-md shrink-0"
            style={{ backgroundColor: activeProject.iconColor }}
          >
            {activeProject.name.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-100 truncate group-hover:text-cyan-300 transition-colors">
                {activeProject.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="truncate text-slate-400">Projeto Ativo</span>
            </div>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-cyan-400' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-[#07111F] border border-white/10 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 backdrop-blur-xl">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center justify-between">
            <span>Seus Projetos ({projects.length})</span>
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/projects');
              }}
              className="text-cyan-400 hover:underline normal-case text-xs font-normal"
            >
              Ver todos
            </button>
          </div>

          <div className="space-y-1 max-h-56 overflow-y-auto my-1">
            {projects.map((proj) => {
              const isSelected = activeProject.id === proj.id;
              return (
                <button
                  key={proj.id}
                  onClick={() => {
                    setActiveProject(proj);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-all ${
                    isSelected
                      ? 'bg-[#1677FF]/20 text-cyan-300 font-semibold border border-[#1677FF]/40'
                      : 'text-slate-300 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-6 h-6 rounded-md flex items-center justify-center text-xs text-white font-bold shrink-0 shadow-sm"
                      style={{ backgroundColor: proj.iconColor }}
                    >
                      {proj.name[0]}
                    </span>
                    <div className="truncate">
                      <div className="font-semibold text-slate-200 truncate">{proj.name}</div>
                      <div className="text-[10px] text-slate-500">{proj.region}</div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-white/[0.08] mt-1">
            <button
              onClick={() => {
                setIsOpen(false);
                if (onOpenNewProjectModal) onOpenNewProjectModal();
                else navigate('/projects');
              }}
              className="w-full flex items-center justify-center gap-2 p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-semibold border border-cyan-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isEnglish ? 'New Project' : 'Novo Projeto'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
