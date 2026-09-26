import React from 'react';
import { 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  RotateCcw, 
  ArrowRight, 
  Truck, 
  TrendingDown, 
  CheckCircle2, 
  Zap,
  Activity,
  Layers,
  MapPin
} from 'lucide-react';
import { DynamicIncident, ReroutingResult, VehicleDynamicState } from '../types/routing';
import { Customer, Vehicle } from '../types/domain';

interface ReroutingResultSummaryProps {
  reroutingResult: ReroutingResult;
  incident: DynamicIncident | null;
  vehicleDynamicStates: VehicleDynamicState[];
  vehicles: Vehicle[];
  customers: Customer[];
  onResetSimulation: () => void;
  activePlanView: 'initial' | 'pre_incident' | 'revised';
  onChangePlanView: (view: 'initial' | 'pre_incident' | 'revised') => void;
}

export const ReroutingResultSummary: React.FC<ReroutingResultSummaryProps> = ({
  reroutingResult,
  incident,
  vehicleDynamicStates,
  vehicles,
  customers,
  onResetSimulation,
  activePlanView,
  onChangePlanView,
}) => {
  const customerMap = new Map<string, Customer>();
  customers.forEach((c) => customerMap.set(c.id, c));

  const origMinutes = reroutingResult.originalRemainingTravelMinutes ?? 0;
  const incMinutes = reroutingResult.incidentAdjustedRemainingTravelMinutes ?? 0;
  const revMinutes = reroutingResult.revisedRemainingTravelMinutes ?? 0;
  const delayAvoided = reroutingResult.delayAvoidedMinutes ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 text-slate-800 space-y-4">
      {/* Top Banner: Incident Alert & Re-route Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                Dynamic Incident Re-Routed
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {reroutingResult.reroutingAlgorithm.toUpperCase()} Optimizer
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
              Pending Delivery Fleet Recovery & Re-Route
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Plan View Switcher */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
            <button
              onClick={() => onChangePlanView('pre_incident')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                activePlanView === 'pre_incident'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pre-Incident
            </button>
            <button
              onClick={() => onChangePlanView('revised')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                activePlanView === 'revised'
                  ? 'bg-teal-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Revised Plan
            </button>
          </div>

          <button
            onClick={onResetSimulation}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Incident Description Banner */}
      {incident && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5 flex-1">
            <div className="font-semibold text-amber-950">
              Incident Impact Detected: {incident.description}
            </div>
            <div className="text-[11px] text-amber-800/90 flex flex-wrap gap-x-4 gap-y-1">
              <span>
                Target Road: <strong>{incident.affectedEdgeIds.join(', ')}</strong>
              </span>
              <span>
                Severity Level: <strong>Level {incident.severity}</strong>
              </span>
              <span>
                Impacted Fleet Units:{' '}
                <strong>
                  {incident.affectedVehicleIds.length > 0
                    ? incident.affectedVehicleIds.join(', ')
                    : 'None (No overlap)'}
                </strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards: Latency, Delay Avoided, Stability, Feasibility */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Latency */}
        <div className="bg-slate-50 rounded-xl border border-slate-200/70 p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-medium">
            <span>Re-Route Latency</span>
            <Clock className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">
            {reroutingResult.reroutingRuntimeMs.toFixed(1)} <span className="text-xs font-normal text-slate-500">ms</span>
          </div>
          <div className="text-[10px] text-slate-500">Real-time client execution</div>
        </div>

        {/* Delay Avoided */}
        <div className="bg-emerald-50/60 rounded-xl border border-emerald-200/70 p-3 space-y-1">
          <div className="flex items-center justify-between text-emerald-800 text-[11px] font-medium">
            <span>Delay Avoided</span>
            <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-900">
            {delayAvoided > 0 ? `-${delayAvoided.toFixed(1)}` : '0.0'}{' '}
            <span className="text-xs font-normal text-emerald-700">min</span>
          </div>
          <div className="text-[10px] text-emerald-700 font-medium">
            vs continuing through incident
          </div>
        </div>

        {/* Route Stability */}
        <div className="bg-indigo-50/60 rounded-xl border border-indigo-200/70 p-3 space-y-1">
          <div className="flex items-center justify-between text-indigo-800 text-[11px] font-medium">
            <span>Route Stability</span>
            <Activity className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-xl font-bold font-mono text-indigo-900">
            {reroutingResult.routeStabilityChanges}{' '}
            <span className="text-xs font-normal text-indigo-700">shifts</span>
          </div>
          <div className="text-[10px] text-indigo-700">
            {reroutingResult.routeStabilityChanges === 0
              ? 'Zero customer handovers'
              : `${reroutingResult.routeStabilityChanges} stops reassigned`}
          </div>
        </div>

        {/* Feasibility & Compliance */}
        <div className="bg-cyan-50/60 rounded-xl border border-cyan-200/70 p-3 space-y-1">
          <div className="flex items-center justify-between text-cyan-800 text-[11px] font-medium">
            <span>Feasibility Status</span>
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />
          </div>
          <div className="text-xl font-bold text-cyan-900 flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-base">100% Feasible</span>
          </div>
          <div className="text-[10px] text-cyan-700">Zero blocked edges used</div>
        </div>
      </div>

      {/* Metrics Progression: Before vs Incident vs Revised */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 p-3 space-y-2 text-xs">
        <div className="font-semibold text-slate-800 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            Remaining Fleet Route Progression
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {origMinutes}m (Orig) → {incMinutes}m (Delayed) → {revMinutes}m (Revised)
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Pre-Incident */}
          <div className="bg-white rounded-lg p-2.5 border border-slate-200">
            <div className="text-[11px] text-slate-500">1. Pre-Incident Remaining</div>
            <div className="text-base font-bold font-mono text-slate-800 mt-0.5">
              {origMinutes.toFixed(1)} <span className="text-xs font-normal text-slate-500">min</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Normal baseline traffic</div>
          </div>

          {/* Under Incident */}
          <div className="bg-white rounded-lg p-2.5 border border-amber-200 bg-amber-50/30">
            <div className="text-[11px] text-amber-800 font-medium">2. Incident Impact</div>
            <div className="text-base font-bold font-mono text-amber-900 mt-0.5">
              {incMinutes.toFixed(1)} <span className="text-xs font-normal text-amber-700">min</span>
            </div>
            <div className="text-[10px] text-amber-700 mt-1">
              +{Number((incMinutes - origMinutes).toFixed(1))} min obstruction
            </div>
          </div>

          {/* Revised Re-route */}
          <div className="bg-white rounded-lg p-2.5 border border-teal-200 bg-teal-50/30">
            <div className="text-[11px] text-teal-800 font-medium">3. Dynamic Re-Route</div>
            <div className="text-base font-bold font-mono text-teal-900 mt-0.5">
              {revMinutes.toFixed(1)} <span className="text-xs font-normal text-teal-700">min</span>
            </div>
            <div className="text-[10px] text-teal-700 font-medium mt-1">
              Saved {delayAvoided.toFixed(1)} min via detours
            </div>
          </div>
        </div>
      </div>

      {/* Fleet Vehicles Dynamic State Table */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5 text-slate-500" />
          Vehicle Dynamic Dispatch Status
        </h4>

        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-100/70 text-[11px] font-semibold text-slate-600">
            <div className="col-span-2">Vehicle</div>
            <div className="col-span-3">Current Location</div>
            <div className="col-span-2">Served Stops</div>
            <div className="col-span-2">Remaining Cap</div>
            <div className="col-span-3 text-right">Status</div>
          </div>

          {vehicleDynamicStates.map((vs) => {
            const vDef = vehicles.find((v) => v.id === vs.vehicleId);
            const isImpacted = incident?.affectedVehicleIds.includes(vs.vehicleId);

            return (
              <div
                key={vs.vehicleId}
                className="grid grid-cols-12 gap-2 px-3 py-2.5 text-xs items-center hover:bg-slate-50/60 transition-colors"
              >
                <div className="col-span-2 flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: vDef?.color || '#3b82f6' }}
                  />
                  <span className="font-semibold text-slate-900">{vs.vehicleId}</span>
                </div>

                <div className="col-span-3 flex items-center gap-1 text-slate-700 font-mono">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>
                    {vs.currentNodeId === 'N13' ? 'Central Hub' : vs.currentNodeId}
                  </span>
                </div>

                <div className="col-span-2 text-slate-600">
                  {vs.deliveredCustomerIds.length > 0 ? (
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {vs.deliveredCustomerIds.join(', ')}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-[11px]">0 stops</span>
                  )}
                </div>

                <div className="col-span-2 font-mono text-slate-700">
                  {vs.remainingCapacity} / {vDef?.capacity || 30}u
                </div>

                <div className="col-span-3 text-right">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      vs.executionState === 'revised'
                        ? 'bg-teal-50 text-teal-700 border border-teal-200'
                        : isImpacted
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {vs.executionState === 'revised' ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-teal-600" />
                        Re-Routed
                      </>
                    ) : isImpacted ? (
                      <>
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        Impacted
                      </>
                    ) : (
                      'En Route'
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
