import React from 'react';
import { RotateCcw, HelpCircle, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react';

interface HeaderProps {
  onReset: () => void;
  onLoadDemo: () => void;
  onOpenHelp: () => void;
  onOpenValidation: () => void;
  isValidScenario: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onReset,
  onLoadDemo,
  onOpenHelp,
  onOpenValidation,
  isValidScenario,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white px-4 lg:px-6 py-3 sticky top-0 z-40 shadow-md">
      <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                QuantaRoute <span className="text-cyan-400">AI</span>
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5"></span>
                Demo Scenario Ready
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Quantum-Inspired Dynamic Fleet Routing{' '}
              <span className="text-slate-600 mx-1">•</span>{' '}
              <span className="text-slate-400 hidden sm:inline">
                Capacity-aware routing under changing traffic conditions
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={onLoadDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition-colors shadow-sm cursor-pointer"
            title="Reload default demo scenario seed"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Load Demo</span>
          </button>

          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition-colors shadow-sm cursor-pointer"
            title="Reset scenario to initial state"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset Scenario</span>
          </button>

          <button
            onClick={onOpenValidation}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors shadow-sm cursor-pointer ${
              isValidScenario
                ? 'text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-700/50'
                : 'text-amber-300 bg-amber-950/40 hover:bg-amber-900/50 border-amber-700/50'
            }`}
            title="View scenario verification checklist"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Scenario Specs</span>
          </button>

          <button
            onClick={onOpenHelp}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/50 rounded-lg border border-cyan-700/50 transition-colors shadow-sm cursor-pointer"
            title="About QuantaRoute AI & Algorithm framing"
          >
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>Help</span>
          </button>
        </div>
      </div>
    </header>
  );
};
