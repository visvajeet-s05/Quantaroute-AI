import React from 'react';
import { RoutePlan } from '../types/routing';
import { 
  Truck, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Milestone, 
  Award, 
  Activity, 
  Package, 
  Info,
  ChevronRight
} from 'lucide-react';

interface GreedyResultSummaryProps {
  plan: RoutePlan | null;
}

export const GreedyResultSummary: React.FC<GreedyResultSummaryProps> = ({ plan }) => {
  if (!plan) return null;

  const totalCapacityUsed = plan.vehicleRoutes.reduce((acc, r) => acc + r.usedCapacity, 0);
  const totalCapacityAvailable = 90; // 3 vehicles * 30

  const vehicleColorMap: Record<string, { bg: string; text: string; border: string }> = {
    V1: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    V2: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    V3: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm text-slate-800 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-cyan-600" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
            Greedy Fleet Plan Summary
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
              plan.isFeasible
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {plan.isFeasible ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Feasible Plan
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Infeasible Violations
              </>
            )}
          </span>
          <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
            {plan.runtimeMs.toFixed(2)} ms
          </span>
        </div>
      </div>

      {/* Primary KPI Mini-Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg">
          <span className="text-[10px] text-slate-400 block font-medium">Assignment</span>
          <span className="text-base font-bold text-slate-900 font-mono">
            {plan.customersServed} / {plan.customerCount}
          </span>
          <span className="text-[10px] text-slate-500 block">
            {plan.unservedCustomerIds.length > 0
              ? `${plan.unservedCustomerIds.length} unserved`
              : '100% coverage'}
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg">
          <span className="text-[10px] text-slate-400 block font-medium">Fleet Capacity</span>
          <span className="text-base font-bold text-slate-900 font-mono">
            {totalCapacityUsed} / {totalCapacityAvailable}
          </span>
          <span className="text-[10px] text-slate-500 block">units allocated</span>
        </div>

        <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg">
          <span className="text-[10px] text-slate-400 block font-medium">Travel Time</span>
          <span className="text-base font-bold text-slate-900 font-mono">
            {plan.totalTravelMinutes.toFixed(1)} min
          </span>
          <span className="text-[10px] text-slate-500 block">
            {plan.totalDistanceKm.toFixed(1)} km physical
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg">
          <span className="text-[10px] text-slate-400 block font-medium">Routing Score (F)</span>
          <span className="text-base font-bold text-cyan-700 font-mono">
            {plan.routingScore.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-500 block">
            +{plan.congestionPenalty.toFixed(1)} delay penalty
          </span>
        </div>
      </div>

      {/* Per-Vehicle Stop Sequences */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Per-Vehicle Dispatched Routes
        </h3>
        <div className="space-y-2">
          {plan.vehicleRoutes.map((route) => {
            const theme = vehicleColorMap[route.vehicleId] || vehicleColorMap.V1;
            return (
              <div
                key={route.vehicleId}
                className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border ${theme.bg} ${theme.text} ${theme.border}`}
                    >
                      {route.vehicleLabel}
                    </span>
                    <span className="text-slate-600 font-medium">
                      Load: <strong className="text-slate-900">{route.usedCapacity} / 30</strong> units
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      ({route.customerIds.length} stops)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                    <span>{route.travelMinutes.toFixed(1)} min</span>
                    <span>•</span>
                    <span>{route.distanceKm.toFixed(1)} km</span>
                  </div>
                </div>

                {/* Stop Sequence Chain */}
                <div className="flex items-center gap-1 overflow-x-auto py-1 text-[11px] font-mono text-slate-600 scrollbar-thin">
                  <span className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 font-bold shrink-0">
                    Depot
                  </span>
                  {route.customerIds.map((cId) => (
                    <React.Fragment key={cId}>
                      <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-800 font-bold shrink-0">
                        {cId}
                      </span>
                    </React.Fragment>
                  ))}
                  {route.customerIds.length > 0 && (
                    <>
                      <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 font-bold shrink-0">
                        Depot
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Warnings & Diagnostics */}
      {plan.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900 space-y-1">
          <div className="font-semibold flex items-center gap-1.5 text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Route Planning Notes:
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-amber-800/90 pl-1">
            {plan.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Plain Language Explanation required by prompt */}
      <div className="flex items-start gap-2 bg-blue-50/70 border border-blue-100 rounded-lg p-2.5 text-[11px] text-blue-900 leading-relaxed">
        <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
        <span>
          Greedy Routing assigns the nearest reachable customer that fits the remaining vehicle capacity. It is fast, but it makes local decisions and may not produce the best overall fleet plan.
        </span>
      </div>
    </div>
  );
};
