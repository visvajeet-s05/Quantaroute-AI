import React, { useState } from 'react';
import { 
  Sliders, 
  Cpu, 
  AlertTriangle, 
  MapPin, 
  Truck, 
  Users, 
  Hash, 
  Info,
  Play,
  RotateCcw,
  Zap,
  Loader2
} from 'lucide-react';
import { Customer, Scenario, ScenarioPreset } from '../types/domain';
import { PathTestState } from '../types/pathfinding';
import {
  AlgorithmName,
   DynamicIncident,
   IncidentType,
   PsoPreset,
   QpsoPreset,
   ReroutingResult,
   RoutePlan,
   RoutePlanSnapshot,
   VehicleDynamicState,
} from '../types/routing';
import { PathTestPanel } from './PathTestPanel';
import { DynamicReroutingPanel } from './DynamicReroutingPanel';

interface ControlPanelProps {
  currentPreset: ScenarioPreset;
  seed: number;
  customerCount: number;
  vehicleCount: number;
  depotLabel: string;
  customers: Customer[];
  depotNodeId: string;
  pathTestState: PathTestState;
  onRunPathTest: (customerId: string) => void;
  onClearPathTest: () => void;
  selectedAlgorithm: string;
  onSelectAlgorithm: (algo: string) => void;
  onRunGreedy: () => void;
  onRunPso: (preset: PsoPreset) => void;
  onRunQpso: (preset: QpsoPreset) => void;
  onClearFleetRoutes: () => void;
  isGreedyActive: boolean;
  isPsoActive: boolean;
  isQpsoActive: boolean;
  isOptimizingPso: boolean;
  isOptimizingQpso: boolean;
  psoPreset: PsoPreset;
  onChangePsoPreset: (preset: PsoPreset) => void;
  scenario: Scenario;
  initialPlan: RoutePlan | null;
  preIncidentSnapshot: RoutePlanSnapshot | null;
  incident: DynamicIncident | null;
  vehicleDynamicStates: VehicleDynamicState[];
  candidateIncidentEdges: { edgeId: string; label: string; affectedVehicleIds: string[] }[];
  reroutingResult: ReroutingResult | null;
  onSimulatePartialExecution: (stopsPerVehicle: number) => void;
  onInjectIncident: (type: IncidentType, severity: 1 | 2 | 3, targetEdgeId?: string) => void;
  onInjectGuidedIncident: () => void;
  onUndoIncident: () => void;
  onRunRerouting: (algo: AlgorithmName) => void;
  onResetSimulation: () => void;
  isSimulatingExecution: boolean;
  isOptimizingReroute: boolean;
  hasRevisedPlan: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  currentPreset,
  seed,
  customerCount,
  vehicleCount,
  depotLabel,
  customers,
  depotNodeId,
  pathTestState,
  onRunPathTest,
  onClearPathTest,
  selectedAlgorithm,
  onSelectAlgorithm,
  onRunGreedy,
  onRunPso,
  onRunQpso,
  onClearFleetRoutes,
  isGreedyActive,
  isPsoActive,
  isQpsoActive,
  isOptimizingPso,
  isOptimizingQpso,
  psoPreset,
  onChangePsoPreset,
  scenario,
  initialPlan,
  preIncidentSnapshot,
  incident,
  vehicleDynamicStates,
  candidateIncidentEdges,
  reroutingResult,
  onSimulatePartialExecution,
  onInjectIncident,
  onInjectGuidedIncident,
  onUndoIncident,
  onRunRerouting,
  onResetSimulation,
  isSimulatingExecution,
  isOptimizingReroute,
  hasRevisedPlan,
}) => {

  const isAnyOptimizing = isOptimizingPso || isOptimizingQpso;

  const handleTriggerOptimization = () => {
    if (selectedAlgorithm === 'Greedy') {
      onRunGreedy();
    } else if (selectedAlgorithm === 'PSO') {
      onRunPso(psoPreset);
    } else if (selectedAlgorithm === 'QPSO') {
      onRunQpso(psoPreset as QpsoPreset);
    }
  };

  return (
    <div className="flex flex-col gap-4 text-slate-800">
      {/* 1. Dijkstra Shortest Path Test Panel */}
      <PathTestPanel
        customers={customers}
        depotNodeId={depotNodeId}
        pathTestState={pathTestState}
        onRunPathTest={onRunPathTest}
        onClearPathTest={onClearPathTest}
      />

      {/* A. Scenario Configuration */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <Sliders className="w-4 h-4 text-cyan-600" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
            Scenario Configuration
          </h2>
        </div>

        {/* Preset Selector */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">
              Active Scenario
            </label>
            <select
              disabled
              value={currentPreset}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 cursor-not-allowed"
              title="Scenario switching locked for initial baseline evaluation"
            >
              <option value="normal">Normal Traffic (Default)</option>
              <option value="peak">Peak Traffic (Module 2)</option>
              <option value="closure">Road Closure Demo (Module 2)</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Baseline deterministic delivery graph (Seed: {seed})
            </p>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
            <div className="bg-slate-50/80 border border-slate-100 rounded-lg p-2.5 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Customers</span>
                <span className="font-bold text-slate-900">{customerCount} Stops</span>
              </div>
            </div>

            <div className="bg-slate-50/80 border border-slate-100 rounded-lg p-2.5 flex items-center gap-2">
              <Truck className="w-4 h-4 text-purple-600 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Fleet Size</span>
                <span className="font-bold text-slate-900">{vehicleCount} Vehicles</span>
              </div>
            </div>

            <div className="bg-slate-50/80 border border-slate-100 rounded-lg p-2.5 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Depot Node</span>
                <span className="font-bold text-slate-900">{depotLabel}</span>
              </div>
            </div>

            <div className="bg-slate-50/80 border border-slate-100 rounded-lg p-2.5 flex items-center gap-2">
              <Hash className="w-4 h-4 text-amber-500 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">PRNG Seed</span>
                <span className="font-bold font-mono text-slate-900">{seed}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* B. Optimization Controls */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <Cpu className="w-4 h-4 text-indigo-600" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
            Optimization Controls
          </h2>
        </div>

        <div className="space-y-3.5">
          {/* Algorithm selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center justify-between">
              <span>Target Algorithm</span>
              <span className="text-[10px] font-normal text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                Classical Optimization
              </span>
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { id: 'Greedy', name: 'Greedy Routing', badge: 'Baseline', color: 'cyan' },
                { id: 'PSO', name: 'Classical PSO', badge: 'Continuous', color: 'indigo' },
                { id: 'QPSO', name: 'Quantum-Inspired PSO', badge: 'Probabilistic', color: 'teal' },
              ].map((algo) => (
                <label
                  key={algo.id}
                  onClick={() => onSelectAlgorithm(algo.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs cursor-pointer transition-all ${
                    selectedAlgorithm === algo.id
                      ? algo.id === 'Greedy'
                        ? 'bg-cyan-50/90 border-cyan-300 text-cyan-950 font-semibold shadow-xs'
                        : algo.id === 'PSO'
                        ? 'bg-indigo-50/90 border-indigo-300 text-indigo-950 font-semibold shadow-xs'
                        : 'bg-teal-50/90 border-teal-300 text-teal-950 font-semibold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="algorithm"
                      value={algo.id}
                      checked={selectedAlgorithm === algo.id}
                      onChange={() => onSelectAlgorithm(algo.id)}
                      className="text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                    />
                    <span>{algo.name}</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      algo.id === 'Greedy'
                        ? 'bg-cyan-100 text-cyan-800'
                        : algo.id === 'PSO'
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-teal-100 text-teal-800'
                    }`}
                  >
                    {algo.badge}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Parameter Preset Selector (Applies to Classical PSO & QPSO) */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center justify-between">
              <span>Optimization Profile</span>
              <span className="text-[10px] text-slate-400 font-normal">
                {selectedAlgorithm === 'Greedy'
                  ? 'Metaheuristic settings'
                  : 'Equal budget for PSO & QPSO'}
              </span>
            </label>
            <select
              value={psoPreset}
              onChange={(e) => onChangePsoPreset(e.target.value as PsoPreset)}
              disabled={isAnyOptimizing}
              className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-100"
            >
              <option value="Fast Re-route">Fast Re-route (15 particles, 25 iterations - 390 evals)</option>
              <option value="Balanced">Balanced (25 particles, 50 iterations - 1,275 evals)</option>
              <option value="High Quality">High Quality (35 particles, 100 iterations - 3,535 evals)</option>
            </select>
          </div>

          {/* Primary Action Button */}
          <div className="pt-1 space-y-2">
            {selectedAlgorithm === 'Greedy' ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onRunGreedy}
                  disabled={isAnyOptimizing}
                  className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isGreedyActive ? 'Re-run Greedy Baseline' : 'Run Greedy Baseline'}</span>
                </button>

                {isGreedyActive && (
                  <button
                    type="button"
                    onClick={onClearFleetRoutes}
                    className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Clear Fleet Routes</span>
                  </button>
                )}

                <div className="flex items-start gap-1.5 text-[11px] text-cyan-900 bg-cyan-50/80 border border-cyan-200/80 rounded-md p-2">
                  <Info className="w-3.5 h-3.5 shrink-0 text-cyan-600 mt-0.5" />
                  <span>
                    Greedy Baseline generates capacity-aware routes using Dijkstra for every leg across 3 vehicles (cap: 30u).
                  </span>
                </div>
              </div>
            ) : selectedAlgorithm === 'PSO' ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onRunPso(psoPreset)}
                  disabled={isAnyOptimizing}
                  className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer disabled:opacity-75"
                >
                  {isOptimizingPso ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Optimizing Classical PSO…</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isPsoActive ? 'Re-run Classical PSO' : 'Optimize Fleet (Classical PSO)'}</span>
                    </>
                  )}
                </button>

                {isPsoActive && !isAnyOptimizing && (
                  <button
                    type="button"
                    onClick={onClearFleetRoutes}
                    className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Clear Fleet Routes</span>
                  </button>
                )}

                <div className="flex items-start gap-1.5 text-[11px] text-indigo-900 bg-indigo-50/80 border border-indigo-200/80 rounded-md p-2">
                  <Info className="w-3.5 h-3.5 shrink-0 text-indigo-600 mt-0.5" />
                  <span>
                    Classical PSO updates particle velocity using inertia, personal best, and global best attraction with shared capacity repair.
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onRunQpso(psoPreset as QpsoPreset)}
                  disabled={isAnyOptimizing}
                  className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer disabled:opacity-75"
                >
                  {isOptimizingQpso ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Optimizing Quantum-Inspired PSO…</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isQpsoActive ? 'Re-run Quantum-Inspired PSO' : 'Optimize Fleet (Quantum-Inspired PSO)'}</span>
                    </>
                  )}
                </button>

                {isQpsoActive && !isAnyOptimizing && (
                  <button
                    type="button"
                    onClick={onClearFleetRoutes}
                    className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Clear Fleet Routes</span>
                  </button>
                )}

                <div className="flex items-start gap-1.5 text-[11px] text-teal-900 bg-teal-50/80 border border-teal-200/80 rounded-md p-2 leading-relaxed">
                  <Info className="w-3.5 h-3.5 shrink-0 text-teal-600 mt-0.5" />
                  <span>
                    QPSO samples positions probabilistically around local attractors derived from the swarm's personal-best solutions (no velocity vectors). Runs on classical hardware.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* C. Dynamic Incident Simulation & Fleet Re-Route */}
      <DynamicReroutingPanel
        scenario={scenario}
        initialPlan={initialPlan}
        preIncidentSnapshot={preIncidentSnapshot}
        incident={incident}
        vehicleDynamicStates={vehicleDynamicStates}
         candidateIncidentEdges={candidateIncidentEdges}
         reroutingResult={reroutingResult}
         onSimulatePartialExecution={onSimulatePartialExecution}
        onInjectIncident={onInjectIncident}
        onInjectGuidedIncident={onInjectGuidedIncident}
        onUndoIncident={onUndoIncident}
        onRunRerouting={onRunRerouting}
        onResetSimulation={onResetSimulation}
        isSimulatingExecution={isSimulatingExecution}
        isOptimizingReroute={isOptimizingReroute}
        hasRevisedPlan={hasRevisedPlan}
      />
    </div>
  );
};
