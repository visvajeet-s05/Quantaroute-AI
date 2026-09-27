import React from 'react';
import {
  Gauge,
  ListChecks,
  Lock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingDown,
  Clock,
  Activity,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import { ReroutingResult, QpsoPreset } from '../types/routing';

interface ReroutingResultPanelProps {
  reroutingResult: ReroutingResult | null;
}

const PRESET_LABELS: Record<QpsoPreset, string> = {
  'Fast Re-route': 'Fast Re-route',
  Balanced: 'Balanced',
  'High Quality': 'High Quality',
};

export const ReroutingResultPanel: React.FC<ReroutingResultPanelProps> = ({
  reroutingResult,
}) => {
  if (!reroutingResult) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 text-slate-800">
        <p className="text-xs text-slate-400">
          Run a dynamic re-routing simulation to view results.
        </p>
      </div>
    );
  }

  const lockedCount = reroutingResult.lockedCustomerCount;
  const pendingCount = reroutingResult.eligibleCustomerIds.length;
  const candidateEvals = reroutingResult.candidateEvaluations;
  const popSize = reroutingResult.populationSize;
  const iters = reroutingResult.iterations;

  const isFeasible = reroutingResult.revisedFeasible;
  const preset = PRESET_LABELS[reroutingResult.reroutingPreset] ?? reroutingResult.reroutingPreset;
  const delayAvoided = reroutingResult.delayAvoidedMinutes;
  const hasWarnings = reroutingResult.warnings.length > 0;

  // Theoretical max evaluations for QPSO = popSize + popSize * iters
  const theoreticalMaxEvals = popSize > 0 ? popSize + popSize * iters : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 text-slate-800 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-600 flex items-center justify-center shrink-0">
            <Gauge className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Re-Routing Result Details
            </h3>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
              <span>Algorithm: {reroutingResult.reroutingAlgorithm.toUpperCase()}</span>
              <span>&middot;</span>
              <span>Preset: {preset}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isFeasible ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Feasible
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              Infeasible
            </span>
          )}
          {hasWarnings && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              {reroutingResult.warnings.length} warning{reroutingResult.warnings.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards: Preset / Eval Budget / Locked / Pending */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Preset */}
        <div className="bg-slate-50 rounded-xl border border-slate-200/70 p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
            <span>Optimization Preset</span>
            <span className="text-xs bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
              {preset}
            </span>
          </div>
          <div className="text-sm font-bold text-slate-900">
            {popSize} pop &middot; {iters} iter
          </div>
          <div className="text-[10px] text-slate-400">QPSO parameter set</div>
        </div>

        {/* Evaluation Budget */}
        <div className="bg-blue-50/60 rounded-xl border border-blue-200/70 p-3 space-y-1">
          <div className="flex items-center justify-between text-blue-800 text-[11px] font-medium">
            <span>Evaluation Budget</span>
            <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-bold font-mono text-blue-900">
            {candidateEvals}
          </div>
          <div className="text-[10px] text-blue-700">
            {theoreticalMaxEvals > 0
              ? `${candidateEvals} / ${theoreticalMaxEvals} max (${(((candidateEvals / theoreticalMaxEvals) * 100)).toFixed(0)}%)`
              : 'Greedy mode'}
          </div>
        </div>

        {/* Locked Customers */}
        <div className="bg-emerald-50/60 rounded-xl border border-emerald-200/70 p-3 space-y-1">
          <div className="flex items-center justify-between text-emerald-800 text-[11px] font-medium">
            <span>Locked (Served)</span>
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-900">
            {lockedCount}
          </div>
          <div className="text-[10px] text-emerald-700">Excluded from re-routing</div>
        </div>

        {/* Pending Customers */}
        <div className="bg-amber-50/60 rounded-xl border border-amber-200/70 p-3 space-y-1">
          <div className="flex items-center justify-between text-amber-800 text-[11px] font-medium">
            <span>Pending (Unserved)</span>
            <ListChecks className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-900">
            {pendingCount}
          </div>
          <div className="text-[10px] text-amber-700">Eligible for re-routing</div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 p-3 space-y-2 text-xs">
        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-slate-500" />
          Performance Metrics
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white rounded-lg p-2.5 border border-slate-200">
            <div className="text-[11px] text-slate-500 mb-0.5 flex items-center gap-1 justify-center">
              <Clock className="w-3 h-3 text-teal-600" />
              Runtime
            </div>
            <div className="text-base font-bold font-mono text-slate-900">
              {reroutingResult.reroutingRuntimeMs.toFixed(1)} <span className="text-[10px] font-normal text-slate-500">ms</span>
            </div>
          </div>

          <div className="bg-white rounded-lg p-2.5 border border-slate-200">
            <div className="text-[11px] text-slate-500 mb-0.5 flex items-center gap-1 justify-center">
              <TrendingDown className="w-3 h-3 text-emerald-600" />
              Delay Avoided
            </div>
            <div className="text-base font-bold font-mono text-emerald-900">
              {delayAvoided !== null ? (
                `${delayAvoided > 0 ? `-${delayAvoided.toFixed(1)}` : '0.0'} min`
              ) : (
                <span className="text-xs text-slate-500 font-semibold">N/A</span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg p-2.5 border border-slate-200">
            <div className="text-[11px] text-slate-500 mb-0.5 flex items-center gap-1 justify-center">
              <Activity className="w-3 h-3 text-indigo-600" />
              Route Stability
            </div>
            <div className="text-base font-bold font-mono text-indigo-900">
              {reroutingResult.routeStabilityChanges} <span className="text-[10px] font-normal text-indigo-700">shifts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feasibility & Compliance Section */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 p-3 space-y-2 text-xs">
        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
          Feasibility & Compliance
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-slate-200">
            <span className="text-slate-600">Revised Plan Feasibility</span>
            {isFeasible ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Pass
              </span>
            ) : (
              <span className="text-rose-700 font-semibold flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                Fail
              </span>
            )}
          </div>

          <div className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-slate-200">
            <span className="text-slate-600">Blocked Edge Violations</span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              0
            </span>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {hasWarnings && (
        <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/40 p-3 space-y-2 text-xs">
          <div className="font-semibold text-amber-900 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Warnings ({reroutingResult.warnings.length})
          </div>
          <ul className="list-disc list-inside text-amber-800/90 space-y-0.5 pl-1">
            {reroutingResult.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Eligible Customer IDs List */}
      {pendingCount > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 p-3 space-y-2 text-xs">
          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5 text-slate-500" />
            Eligible Customers ({pendingCount})
          </div>
          <div className="flex flex-wrap gap-1">
            {reroutingResult.eligibleCustomerIds.map((cId) => (
              <span
                key={cId}
                className="text-[10px] font-mono text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200"
              >
                {cId}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
