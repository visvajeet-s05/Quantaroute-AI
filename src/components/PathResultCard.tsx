import React from 'react';
import { PathTestState, PathValidationResult } from '../types/pathfinding';
import { 
  Clock, 
  Milestone, 
  Route, 
  CheckCircle2, 
  XCircle, 
  Timer, 
  ShieldCheck, 
  AlertTriangle,
  MapPin,
  GitBranch
} from 'lucide-react';

interface PathResultCardProps {
  pathTestState: PathTestState;
  validationResult: PathValidationResult | null;
}

export const PathResultCard: React.FC<PathResultCardProps> = ({
  pathTestState,
  validationResult,
}) => {
  const { status, lastPathResult, selectedCustomerId, runtimeMs, errorMessage } = pathTestState;

  // 1. Idle state before running
  if (status === 'idle' || !lastPathResult) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm text-slate-800">
        <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-cyan-600" />
            <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
              Shortest Path Result
            </h2>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-500">
            Status: Not run
          </span>
        </div>

        <div className="text-center py-6 px-4 bg-slate-50/70 border border-dashed border-slate-200 rounded-lg">
          <Route className="w-8 h-8 text-slate-300 mx-auto mb-2 stroke-[1.5]" />
          <p className="text-xs font-medium text-slate-600">
            No single-pair path query active
          </p>
          <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
            Select a destination customer on the left and click &ldquo;Find Fastest Path&rdquo; to test Dijkstra routing.
          </p>
        </div>
      </div>
    );
  }

  // 2. Unreachable state
  if (status === 'unreachable' || !lastPathResult.reachable) {
    return (
      <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm text-slate-800">
        <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-amber-100">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
              Shortest Path Result
            </h2>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            Status: No feasible path
          </span>
        </div>

        <div className="bg-amber-50/80 border border-amber-200/80 rounded-lg p-3 text-xs space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Target Unreachable from Central Hub</span>
          </div>
          <p className="text-amber-800 text-[11px] leading-relaxed">
            No feasible road path is available to customer {selectedCustomerId} under current road conditions. Road closures or network disconnects prevent reachability.
          </p>
          <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-amber-900">
            <span>Visited Nodes: <strong>{lastPathResult.visitedNodeCount}</strong></span>
            <span>Compute Time: <strong>{runtimeMs !== null ? `${runtimeMs.toFixed(3)} ms` : '—'}</strong></span>
          </div>
        </div>
      </div>
    );
  }

  // 3. Success state
  const isValidationPassed = validationResult?.isValid ?? true;

  return (
    <div className="bg-white rounded-xl border border-cyan-200/90 p-4 shadow-sm text-slate-800">
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-cyan-600" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
            Shortest Path Result
          </h2>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Status: Path found
        </span>
      </div>

      {/* Path Origin & Destination Badges */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
          <span className="text-[10px] text-slate-400 block font-medium">Source</span>
          <span className="font-bold text-slate-800 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-rose-500" />
            Central Hub
          </span>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
          <span className="text-[10px] text-slate-400 block font-medium">Destination</span>
          <span className="font-bold text-cyan-700 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-cyan-600" />
            Customer {selectedCustomerId}
          </span>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-cyan-50/60 border border-cyan-100 rounded-lg p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-cyan-800 text-[11px] mb-1">
            <span className="font-semibold">Travel Time</span>
            <Clock className="w-3.5 h-3.5 text-cyan-600" />
          </div>
          <div className="text-base font-bold font-mono text-cyan-950">
            {lastPathResult.travelMinutes.toFixed(2)}{' '}
            <span className="text-[10px] font-normal font-sans text-cyan-700">min</span>
          </div>
        </div>

        <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-800 text-[11px] mb-1">
            <span className="font-semibold">Distance</span>
            <Milestone className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-base font-bold font-mono text-blue-950">
            {lastPathResult.distanceKm.toFixed(2)}{' '}
            <span className="text-[10px] font-normal font-sans text-blue-700">km</span>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-150 rounded-lg p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600 text-[11px] mb-1">
            <span className="font-medium">Segments Used</span>
            <GitBranch className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-sm font-bold font-mono text-slate-800">
            {lastPathResult.edgeIds.length}{' '}
            <span className="text-[10px] font-normal font-sans text-slate-500">roads</span>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-150 rounded-lg p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-600 text-[11px] mb-1">
            <span className="font-medium">Nodes Visited</span>
            <Route className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-sm font-bold font-mono text-slate-800">
            {lastPathResult.visitedNodeCount}{' '}
            <span className="text-[10px] font-normal font-sans text-slate-500">nodes</span>
          </div>
        </div>
      </div>

      {/* Footer Info: Computation Time & Validation Status */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-500 font-mono">
          <Timer className="w-3.5 h-3.5 text-slate-400" />
          <span>Computation:</span>
          <strong className="text-slate-700">
            {runtimeMs !== null ? `${runtimeMs.toFixed(3)} ms` : '—'}
          </strong>
        </div>

        <div className="flex items-center gap-1">
          <ShieldCheck
            className={`w-3.5 h-3.5 ${
              isValidationPassed ? 'text-emerald-600' : 'text-rose-600'
            }`}
          />
          <span className="font-semibold text-slate-600">Validation:</span>
          <span
            className={`font-bold ${
              isValidationPassed ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {isValidationPassed ? 'Passed' : 'Failed'}
          </span>
        </div>
      </div>
    </div>
  );
};
