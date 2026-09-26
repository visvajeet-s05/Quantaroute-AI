import React, { useState } from 'react';
import {
  AlertTriangle,
  Play,
  RotateCcw,
  Zap,
  Truck,
  CheckCircle2,
  Sliders,
  Layers,
  Flame,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Info
} from 'lucide-react';
import { Customer, Edge, Scenario } from '../types/domain';
import {
  AlgorithmName,
  DynamicIncident,
  IncidentType,
  RoutePlan,
  RoutePlanSnapshot,
  VehicleDynamicState,
} from '../types/routing';

interface DynamicReroutingPanelProps {
  scenario: Scenario;
  initialPlan: RoutePlan | null;
  preIncidentSnapshot: RoutePlanSnapshot | null;
  incident: DynamicIncident | null;
  vehicleDynamicStates: VehicleDynamicState[];
  candidateIncidentEdges: { edgeId: string; label: string; affectedVehicleIds: string[] }[];
  onSimulatePartialExecution: (stopsPerVehicle: number) => void;
  onInjectIncident: (type: IncidentType, severity: 1 | 2 | 3, targetEdgeId?: string) => void;
  onRunRerouting: (algo: AlgorithmName) => void;
  onResetSimulation: () => void;
  isSimulatingExecution: boolean;
  isOptimizingReroute: boolean;
  hasRevisedPlan: boolean;
}

export const DynamicReroutingPanel: React.FC<DynamicReroutingPanelProps> = ({
  scenario,
  initialPlan,
  preIncidentSnapshot,
  incident,
  vehicleDynamicStates,
  candidateIncidentEdges,
  onSimulatePartialExecution,
  onInjectIncident,
  onRunRerouting,
  onResetSimulation,
  isSimulatingExecution,
  isOptimizingReroute,
  hasRevisedPlan,
}) => {
  const [stopsCompleted, setStopsCompleted] = useState<number>(1);
  const [incidentType, setIncidentType] = useState<IncidentType>('road_closure');
  const [incidentSeverity, setIncidentSeverity] = useState<1 | 2 | 3>(3);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>('auto');
  const [rerouteAlgo, setRerouteAlgo] = useState<AlgorithmName>('qpso');

  const hasInitialPlan = Boolean(initialPlan);
  const hasPartialExecution = Boolean(preIncidentSnapshot);
  const hasIncident = Boolean(incident && incident.active);

  // Auto-target edge preview
  const autoTargetEdge = candidateIncidentEdges[0];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm text-slate-800 space-y-4">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-600" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
            Dynamic Incident & Re-Route
          </h2>
        </div>
        {(hasPartialExecution || hasIncident || hasRevisedPlan) && (
          <button
            onClick={onResetSimulation}
            className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Sim</span>
          </button>
        )}
      </div>

      {/* Step Indicator Progression */}
      <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-semibold">
        <div
          className={`py-1 rounded ${
            hasInitialPlan
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-100 text-slate-400'
          }`}
        >
          1. Plan
        </div>
        <div
          className={`py-1 rounded ${
            hasPartialExecution
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : hasInitialPlan
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-slate-100 text-slate-400'
          }`}
        >
          2. Execute
        </div>
        <div
          className={`py-1 rounded ${
            hasIncident
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : hasPartialExecution
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-slate-100 text-slate-400'
          }`}
        >
          3. Incident
        </div>
        <div
          className={`py-1 rounded ${
            hasRevisedPlan
              ? 'bg-teal-50 text-teal-700 border border-teal-200'
              : hasIncident
              ? 'bg-teal-50/70 text-teal-800 border border-teal-200'
              : 'bg-slate-100 text-slate-400'
          }`}
        >
          4. Re-Route
        </div>
      </div>

      {/* Step 2: Route Execution Simulation Controls */}
      <div className="space-y-2 pt-1 border-t border-slate-100">
        <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-blue-600" />
            Route Execution Simulation
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {stopsCompleted} stop{stopsCompleted === 1 ? '' : 's'} / vehicle
          </span>
        </label>

        <div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span>Completed stops per active vehicle</span>
            <span className="font-bold text-slate-700">{stopsCompleted}</span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="1"
            value={stopsCompleted}
            onChange={(e) => setStopsCompleted(Number(e.target.value))}
            disabled={!hasInitialPlan || isOptimizingReroute}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-50"
          />
          <div className="flex justify-between text-[10px] text-slate-400 px-0.5 mt-1 font-mono">
            <span>0 (At Depot)</span>
            <span>1 Stop (En Route)</span>
            <span>2 Stops (Advanced)</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSimulatePartialExecution(stopsCompleted)}
          disabled={!hasInitialPlan || isOptimizingReroute}
          className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>
            {hasPartialExecution ? 'Re-simulate Partial Execution' : 'Simulate Partial Execution'}
          </span>
        </button>

        {!hasInitialPlan && (
          <p className="text-[10px] text-slate-400 italic">
            * Please run Greedy, PSO, or QPSO above to generate an initial fleet plan first.
          </p>
        )}
      </div>

      {/* Step 3: Traffic Incident Injection */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-600" />
            Traffic Incident Injection
          </span>
          {incident && (
            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
              Active Incident
            </span>
          )}
        </label>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">Incident Type</label>
            <select
              value={incidentType}
              onChange={(e) => setIncidentType(e.target.value as IncidentType)}
              disabled={!hasPartialExecution || isOptimizingReroute}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-slate-100"
            >
              <option value="road_closure">Road Closure</option>
              <option value="congestion_surge">Congestion Surge</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-500 block mb-1">Severity</label>
            <select
              value={incidentSeverity}
              onChange={(e) => setIncidentSeverity(Number(e.target.value) as 1 | 2 | 3)}
              disabled={!hasPartialExecution || isOptimizingReroute}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-slate-100"
            >
              <option value={1}>Level 1 (Moderate 2x)</option>
              <option value={2}>Level 2 (Severe 3.5x)</option>
              <option value={3}>Level 3 ({incidentType === 'road_closure' ? 'Full Closure' : '5x Surge'})</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[11px] text-slate-500 block mb-1">Target Road Edge</label>
          <select
            value={selectedEdgeId}
            onChange={(e) => setSelectedEdgeId(e.target.value)}
            disabled={!hasPartialExecution || isOptimizingReroute}
            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-slate-100 truncate"
          >
            <option value="auto">
              Auto-target active route {autoTargetEdge ? `(${autoTargetEdge.edgeId})` : ''}
            </option>
            {candidateIncidentEdges.map((c) => (
              <option key={c.edgeId} value={c.edgeId}>
                {c.label} ({c.affectedVehicleIds.join(', ')})
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() =>
            onInjectIncident(
              incidentType,
              incidentSeverity,
              selectedEdgeId === 'auto' ? undefined : selectedEdgeId
            )
          }
          disabled={!hasPartialExecution || isOptimizingReroute}
          className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>{hasIncident ? 'Re-Inject Traffic Incident' : 'Inject Incident'}</span>
        </button>
      </div>

      {/* Step 4: Fleet Dynamic Re-Route */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-teal-600" />
            Dynamic Fleet Re-Route
          </span>
          <span className="text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded font-medium">
            Fast Re-route (390 evals)
          </span>
        </label>

        <div>
          <label className="text-[11px] text-slate-500 block mb-1">Re-routing Algorithm</label>
          <select
            value={rerouteAlgo}
            onChange={(e) => setRerouteAlgo(e.target.value as AlgorithmName)}
            disabled={!hasIncident || isOptimizingReroute}
            className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-100"
          >
            <option value="qpso">Quantum-Inspired PSO (QPSO Default)</option>
            <option value="pso">Classical PSO</option>
            <option value="greedy">Greedy Nearest Dynamic</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => onRunRerouting(rerouteAlgo)}
          disabled={!hasIncident || isOptimizingReroute}
          className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
        >
          {isOptimizingReroute ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Optimizing Dynamic Detours…</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Trigger Dynamic Re-route</span>
            </>
          )}
        </button>

        <div className="flex items-start gap-1.5 text-[11px] text-teal-900 bg-teal-50/80 border border-teal-200/80 rounded-md p-2">
          <Info className="w-3.5 h-3.5 shrink-0 text-teal-600 mt-0.5" />
          <span>
            Locks served customers, starts each vehicle from its current stop, uses remaining capacity, and avoids blocked roads using Dijkstra detours.
          </span>
        </div>
      </div>
    </div>
  );
};
