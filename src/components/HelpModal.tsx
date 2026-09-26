import React from 'react';
import { X, Sparkles, BookOpen, AlertCircle, HelpCircle, Cpu, CheckCircle } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-800"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">About QuantaRoute AI</h2>
              <p className="text-xs text-slate-400">Technical Brief & Mathematical Framing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-600 leading-relaxed">
          {/* Section A: About */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-600" />
              A. About QuantaRoute AI
            </h3>
            <p className="text-slate-700 text-xs leading-normal">
              QuantaRoute AI is a prototype for dynamic, capacity-aware multi-vehicle delivery routing under changing traffic conditions.
            </p>
          </div>

          {/* Section B: Problem Being Solved */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              B. Problem Being Solved
            </h3>
            <p className="text-slate-700">
              Consumer navigation systems typically optimize one vehicle at a time. Fleet routing also requires coordinated stop assignment, capacity compliance, traffic-aware paths, and re-routing after disruptions.
            </p>
          </div>

          {/* Section C: Algorithm Transparency */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-600" />
              C. Algorithm Transparency
            </h3>
            <p className="text-slate-700 leading-relaxed">
              Greedy Routing, Classical PSO, and Quantum-Inspired PSO will be compared using the same routing score and feasibility constraints.
            </p>
            <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-[11px] leading-relaxed">
              Classical PSO represents each candidate routing plan as a particle with a position and velocity. During optimization, particles update their positions using inertia, personal-best attraction, and global-best attraction. QPSO is not implemented in this module and will use a different, mean-best probability-based update rule.
            </div>
          </div>

          {/* Section D: Quantum-Inspired Clarification */}
          <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-xl p-4">
            <h3 className="text-sm font-bold text-indigo-950 mb-1.5 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              D. Quantum-Inspired Clarification
            </h3>
            <div className="space-y-2 text-indigo-900/90 font-medium">
              <p>
                Quantum-inspired optimization runs on classical hardware. This prototype will use classical routing and optimization algorithms; it does not use quantum hardware or real-time generative AI during route optimization.
              </p>
              <p>
                Quantum-inspired optimization uses probability-based classical computations. It is not quantum computing, does not require quantum hardware, and does not use qubits.
              </p>
            </div>
          </div>

          {/* Section E: Current Prototype Status */}
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4">
            <h3 className="text-sm font-bold text-emerald-950 mb-1.5 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              E. Current Prototype Status
            </h3>
            <p className="text-emerald-900 font-medium leading-relaxed">
              Dijkstra shortest-path routing, Capacity-Aware Greedy Baseline, and continuous Classical Particle Swarm Optimization (PSO) are active and fully operational. Quantum-Inspired PSO (QPSO) is scheduled for the next module.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
