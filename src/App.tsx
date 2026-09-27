/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Header } from './components/Header';
import { ControlPanel } from './components/ControlPanel';
import { RoadNetwork } from './components/RoadNetwork';
import { KpiPanel } from './components/KpiPanel';
import { PathResultCard } from './components/PathResultCard';
import { VehicleCard } from './components/VehicleCard';
import { GreedyResultSummary } from './components/GreedyResultSummary';
import { PsoResultSummary } from './components/PsoResultSummary';
import { QpsoResultSummary } from './components/QpsoResultSummary';
import { AlgorithmComparison } from './components/AlgorithmComparison';
import { HelpModal } from './components/HelpModal';
import { ValidationModal } from './components/ValidationModal';
import { DEFAULT_SEED, getDefaultScenario, getScenarioByPreset } from './data/demoScenario';
import { ScenarioPreset } from './types/domain';
import { PathTestState, PathValidationResult } from './types/pathfinding';
import { PsoPreset, PsoRunResult, QpsoPreset, QpsoRunResult, RoutePlan, RoutePlanValidationResult } from './types/routing';
import {
  AlgorithmName,
  DynamicIncident,
  IncidentType,
  ReroutingResult,
  RoutePlanSnapshot,
  VehicleDynamicState,
} from './types/routing';
import { findShortestPath } from './algorithms/dijkstra';
import { runGreedyRouting } from './algorithms/greedyRouting';
import { runClassicalPso } from './algorithms/classicalPso';
import { runQuantumPso } from './algorithms/quantumPso';
import { validateRoutePlan } from './services/routePlanValidator';
import {
  createInitialSnapshot,
  findCandidateIncidentEdges,
  injectDynamicIncident,
  runDynamicRerouting,
  selectGuidedDemoEdge,
  simulatePartialExecution,
  validateRevisedRoutePlan,
} from './services/dynamicRerouting';
import { runDijkstraUnitTests, validatePathResult } from './utils/pathValidation';
import { runGreedyUnitTests } from './utils/greedyValidationTests';
import { runPsoUnitTests } from './utils/psoValidationTests';
import { runQpsoUnitTests } from './utils/qpsoValidationTests';
import { runReroutingUnitTests } from './utils/reroutingValidationTests';
import { validateScenario } from './utils/scenarioValidation';
import { ReroutingResultSummary } from './components/ReroutingResultSummary';
import { ReroutingResultPanel } from './components/ReroutingResultPanel';
import { AlertOctagon, CheckCircle2 } from 'lucide-react';
import { Edge } from './types/domain';

export default function App() {
  const [activePreset, setActivePreset] = useState<ScenarioPreset>('normal');
  const [seed, setSeed] = useState<number>(DEFAULT_SEED);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);
  const [validationOpen, setValidationOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Algorithm selection & benchmark history state
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>('QPSO');
  const [psoPreset, setPsoPreset] = useState<PsoPreset>('Balanced');
  const [isOptimizingPso, setIsOptimizingPso] = useState<boolean>(false);
  const [isOptimizingQpso, setIsOptimizingQpso] = useState<boolean>(false);

  // Stored benchmark results
  const [greedyPlan, setGreedyPlan] = useState<RoutePlan | null>(null);
  const [greedyValidation, setGreedyValidation] = useState<RoutePlanValidationResult | null>(null);
  const [psoResult, setPsoResult] = useState<PsoRunResult | null>(null);
  const [qpsoResult, setQpsoResult] = useState<QpsoRunResult | null>(null);

  // Active visualized fleet plan mode
  const [activeDisplayMode, setActiveDisplayMode] = useState<'none' | 'greedy' | 'pso' | 'qpso'>('none');

  // Dynamic Incident & Re-routing state
  const [initialSnapshot, setInitialSnapshot] = useState<RoutePlanSnapshot | null>(null);
  const [preIncidentSnapshot, setPreIncidentSnapshot] = useState<RoutePlanSnapshot | null>(null);
  const [incident, setIncident] = useState<DynamicIncident | null>(null);
  const [incidentEdges, setIncidentEdges] = useState<Edge[] | null>(null);
  const [vehicleDynamicStates, setVehicleDynamicStates] = useState<VehicleDynamicState[]>([]);
  const [reroutingResult, setReroutingResult] = useState<ReroutingResult | null>(null);
  const [activePlanView, setActivePlanView] = useState<'initial' | 'pre_incident' | 'revised'>('revised');
  const [isSimulatingExecution, setIsSimulatingExecution] = useState<boolean>(false);
  const [isOptimizingReroute, setIsOptimizingReroute] = useState<boolean>(false);
  const [preIncidentOrigMinutes, setPreIncidentOrigMinutes] = useState<number>(0);
  // null when blocked route makes incident-adjusted time undefined
  const [preIncidentDelayedMinutes, setPreIncidentDelayedMinutes] = useState<number | null>(0);
  const [preIncidentRouteBlocked, setPreIncidentRouteBlocked] = useState<boolean>(false);

  // Path test state
  const [pathTestState, setPathTestState] = useState<PathTestState>({
    selectedCustomerId: 'C01',
    lastPathResult: null,
    status: 'idle',
    runtimeMs: null,
    errorMessage: null,
  });

  const [pathValidationResult, setPathValidationResult] =
    useState<PathValidationResult | null>(null);

  // Generate deterministic scenario based on current state
  const scenario = useMemo(() => {
    return getScenarioByPreset(activePreset, seed);
  }, [activePreset, seed]);

  // Validate scenario against domain criteria
  const validationReport = useMemo(() => {
    return validateScenario(scenario);
  }, [scenario]);

  // Run isolated Dijkstra test suite
  const dijkstraTestResults = useMemo(() => {
    const c01 = scenario.customers.find((c) => c.id === 'C01');
    const c01NodeId = c01 ? c01.nodeId : scenario.customers[0]?.nodeId;
    return runDijkstraUnitTests(
      scenario.nodes,
      scenario.edges,
      scenario.depotNodeId,
      c01NodeId
    );
  }, [scenario]);

  // Run isolated Greedy baseline test suite (5 invariants)
  const greedyTestResults = useMemo(() => {
    return runGreedyUnitTests(scenario);
  }, [scenario]);

  // Run isolated Classical PSO test suite (5 invariants)
  const psoTestResults = useMemo(() => {
    return runPsoUnitTests(scenario);
  }, [scenario]);

  // Run isolated Quantum-Inspired PSO test suite (5 invariants)
  const qpsoTestResults = useMemo(() => {
    return runQpsoUnitTests(scenario);
  }, [scenario]);

  // Run isolated Dynamic Re-routing test suite (5 invariants)
  const reroutingTestResults = useMemo(() => {
    return runReroutingUnitTests(scenario);
  }, [scenario]);

  // Candidate incident edges on active vehicle paths
  const candidateIncidentEdges = useMemo(() => {
    if (vehicleDynamicStates.length === 0) return [];
    return findCandidateIncidentEdges(
      scenario,
      vehicleDynamicStates,
      incidentEdges || scenario.edges
    );
  }, [scenario, vehicleDynamicStates, incidentEdges]);

  const triggerToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Fleet Optimization Runner: Capacity-Aware Greedy Baseline
  const handleRunGreedy = () => {
    const plan = runGreedyRouting(scenario);
    const validation = validateRoutePlan(plan, scenario);
    const snapshot = createInitialSnapshot(plan, scenario);

    setGreedyPlan(plan);
    setGreedyValidation(validation);
    setActiveDisplayMode('greedy');
    setInitialSnapshot(snapshot);
    setVehicleDynamicStates(snapshot.vehicleDynamicStates);
    setPreIncidentSnapshot(null);
    setIncident(null);
    setIncidentEdges(null);
    setReroutingResult(null);

    triggerToast(
      `Greedy baseline completed: 3 vehicle routes serving ${plan.customersServed}/${plan.customerCount} customers (${plan.runtimeMs} ms).`
    );
  };

  // Fleet Optimization Runner: Classical Particle Swarm Optimization
  const handleRunPso = (preset: PsoPreset) => {
    setIsOptimizingPso(true);

    // Yield to browser frame so UI shows the optimizing spinner
    setTimeout(() => {
      try {
        const result = runClassicalPso(scenario, { presetName: preset });
        const snapshot = createInitialSnapshot(result.bestPlan, scenario);
        setPsoResult(result);
        setActiveDisplayMode('pso');
        setInitialSnapshot(snapshot);
        setVehicleDynamicStates(snapshot.vehicleDynamicStates);
        setPreIncidentSnapshot(null);
        setIncident(null);
        setIncidentEdges(null);
        setReroutingResult(null);
        setIsOptimizingPso(false);

        triggerToast(
          `Classical PSO completed: Best score ${result.bestFitness.toFixed(1)} across ${result.candidateEvaluations.toLocaleString()} evaluations (${result.runtimeMs} ms).`
        );
      } catch (err) {
        setIsOptimizingPso(false);
        triggerToast('Error during Classical PSO optimization run.');
      }
    }, 40);
  };

  // Fleet Optimization Runner: Quantum-Inspired Particle Swarm Optimization
  const handleRunQpso = (preset: QpsoPreset) => {
    setIsOptimizingQpso(true);

    // Yield to browser frame so UI shows the optimizing spinner
    setTimeout(() => {
      try {
        const result = runQuantumPso(scenario, { presetName: preset });
        const snapshot = createInitialSnapshot(result.bestPlan, scenario);
        setQpsoResult(result);
        setActiveDisplayMode('qpso');
        setInitialSnapshot(snapshot);
        setVehicleDynamicStates(snapshot.vehicleDynamicStates);
        setPreIncidentSnapshot(null);
        setIncident(null);
        setIncidentEdges(null);
        setReroutingResult(null);
        setIsOptimizingQpso(false);

        triggerToast(
          `Quantum-Inspired PSO completed: Best score ${result.bestFitness.toFixed(1)} across ${result.candidateEvaluations.toLocaleString()} evaluations (${result.runtimeMs} ms).`
        );
      } catch (err) {
        setIsOptimizingQpso(false);
        triggerToast('Error during Quantum-Inspired PSO optimization run.');
      }
    }, 40);
  };

  // Dynamic Route Execution Simulation Handler
  const handleSimulatePartialExecution = (stopsCompleted: number) => {
    // Current base plan
    const currentBasePlan =
      activeDisplayMode === 'qpso'
        ? qpsoResult?.bestPlan || null
        : activeDisplayMode === 'pso'
        ? psoResult?.bestPlan || null
        : activeDisplayMode === 'greedy'
        ? greedyPlan
        : null;

    if (!currentBasePlan) {
      triggerToast('Please run an optimizer first to generate an initial fleet route plan.');
      return;
    }

    setIsSimulatingExecution(true);
    const snap = initialSnapshot || createInitialSnapshot(currentBasePlan, scenario);
    if (!initialSnapshot) setInitialSnapshot(snap);

    const { preIncidentSnapshot: preSnap, vehicleDynamicStates: updatedStates } =
      simulatePartialExecution(snap, scenario, stopsCompleted);

    setPreIncidentSnapshot(preSnap);
    setVehicleDynamicStates(updatedStates);
    setIsSimulatingExecution(false);

    const totalDelivered = updatedStates.reduce((acc, v) => acc + v.deliveredCustomerIds.length, 0);
    triggerToast(
      `Partial execution simulated: ${totalDelivered} customer stop(s) served and locked. Vehicles stationed en route.`
    );
  };

  // Dynamic Traffic Incident Injection Handler (supports both manual and guided incidents)
  const handleInjectIncident = (
    type: IncidentType,
    severity: 1 | 2 | 3,
    targetEdgeId?: string
  ) => {
    if (!preIncidentSnapshot) {
      triggerToast('Please simulate partial execution before injecting traffic incidents.');
      return;
    }

    const {
      incident: newIncident,
      incidentEdges: modEdges,
      affectedVehicleIds,
      originalRemainingTravelMinutes,
      incidentAdjustedRemainingTravelMinutes,
      routeBlockedByIncident,
      updatedVehicleStates,
    } = injectDynamicIncident(
      scenario,
      preIncidentSnapshot,
      vehicleDynamicStates,
      type,
      severity,
      targetEdgeId
    );

    setIncident(newIncident);
    setIncidentEdges(modEdges);
    setVehicleDynamicStates(updatedVehicleStates);
    setPreIncidentOrigMinutes(originalRemainingTravelMinutes);
    setPreIncidentDelayedMinutes(incidentAdjustedRemainingTravelMinutes);
    setPreIncidentRouteBlocked(routeBlockedByIncident);
    setReroutingResult(null); // Reset previous re-route when new incident occurs

    const delayMsg = incidentAdjustedRemainingTravelMinutes === null
      ? 'Route unavailable due to blocked road.'
      : `Traffic delay increased +${(incidentAdjustedRemainingTravelMinutes - originalRemainingTravelMinutes).toFixed(1)} min.`;
    triggerToast(
      `Incident injected on ${newIncident.affectedEdgeIds.join(', ')}: Impacted vehicles [${
        affectedVehicleIds.length > 0 ? affectedVehicleIds.join(', ') : 'None'
      }]. ${delayMsg}`
    );
  };

  // Guided Demo Incident: deterministically selects first pending route edge by vehicle ID order
  const handleInjectGuidedIncident = () => {
    if (!preIncidentSnapshot) {
      triggerToast('Generate an initial fleet plan and simulate progress before injecting a guided incident.');
      return;
    }

    const guided = selectGuidedDemoEdge(
      scenario,
      vehicleDynamicStates,
      incidentEdges || scenario.edges
    );

    if (!guided) {
      triggerToast('No eligible pending route edges found for guided incident. All vehicles may be inactive.');
      return;
    }

    // Guided demo always creates a full road closure (severity 3) for maximum visual impact
    handleInjectIncident('road_closure', 3, guided.edgeId);
    triggerToast(
      `Guided Demo Incident: Road Closure on ${guided.edgeId} affecting vehicles [${guided.affectedVehicleIds.join(', ')}].`
    );
  };

  // Undo Incident: restore pre-incident traffic state without clearing benchmark history
  const handleUndoIncident = () => {
    setIncident(null);
    setIncidentEdges(null);
    setReroutingResult(null);
    setPreIncidentDelayedMinutes(null);
    setPreIncidentRouteBlocked(false);
    // Restore vehicle states to pre-incident (planned/en_route, not rerouting/revised)
    if (preIncidentSnapshot) {
      setVehicleDynamicStates(preIncidentSnapshot.vehicleDynamicStates);
    }
    triggerToast('Incident undone: pre-incident traffic state restored. Benchmark history preserved.');
  };

  // Dynamic Fleet Re-Route Optimizer Handler
  const handleRunDynamicRerouting = (algo: AlgorithmName) => {
    if (!incident || !incidentEdges) {
      triggerToast('Please inject a traffic incident first to trigger dynamic re-routing.');
      return;
    }

    setIsOptimizingReroute(true);

    setTimeout(() => {
      try {
        const result = runDynamicRerouting(
          scenario,
          incidentEdges,
          vehicleDynamicStates,
          incident,
          preIncidentOrigMinutes,
          preIncidentDelayedMinutes,
          algo,
          'Fast Re-route',
          initialSnapshot || undefined,      // pass immutable initial snapshot
          preIncidentSnapshot || undefined    // pass immutable pre-incident snapshot
        );

        setReroutingResult(result);
        if (result.revisedSnapshot) {
          setVehicleDynamicStates(result.revisedSnapshot.vehicleDynamicStates);
        }
        setActivePlanView('revised');
        setIsOptimizingReroute(false);

        const savedMsg = result.delayAvoidedMinutes !== null
          ? `Saved ${result.delayAvoidedMinutes} min delay!`
          : 'Route recovery achieved.';
        triggerToast(
          `Dynamic Re-Route complete (${algo.toUpperCase()}): ${savedMsg} Reassigned ${
            result.routeStabilityChanges
          } stops (${result.reroutingRuntimeMs} ms).`
        );
      } catch (err) {
        setIsOptimizingReroute(false);
        triggerToast('Error during dynamic fleet re-routing.');
      }
    }, 40);
  };

  // Reset Simulation back to clean initial plan
  const handleResetSimulation = () => {
    setPreIncidentSnapshot(null);
    setIncident(null);
    setIncidentEdges(null);
    setReroutingResult(null);
    setActivePlanView('initial');
    if (initialSnapshot) {
      setVehicleDynamicStates(initialSnapshot.vehicleDynamicStates);
    } else {
      setVehicleDynamicStates([]);
    }
    triggerToast('Simulation reset: restored clean initial fleet routing state.');
  };

  // Clear Fleet Routes Overlay (Keeps Benchmark table history intact)
  const handleClearFleetRoutes = () => {
    setActiveDisplayMode('none');
    handleResetSimulation();
    triggerToast('Fleet route overlay cleared. Benchmark comparison history retained.');
  };

  // Dijkstra Shortest Path Runner
  const handleRunPathTest = (customerId: string) => {
    const targetCustomer = scenario.customers.find((c) => c.id === customerId);
    if (!targetCustomer) {
      setPathTestState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: `Customer ${customerId} not found in scenario.`,
      }));
      return;
    }

    // High resolution monotonic timing via performance.now()
    const t0 = performance.now();
    const result = findShortestPath(
      scenario.nodes,
      scenario.edges,
      scenario.depotNodeId,
      targetCustomer.nodeId
    );
    const t1 = performance.now();
    const runtimeMs = Number((t1 - t0).toFixed(3));

    // Validate structural & numerical path invariants
    const validation = validatePathResult(result, scenario.nodes, scenario.edges);
    setPathValidationResult(validation);

    setPathTestState({
      selectedCustomerId: customerId,
      lastPathResult: result,
      status: result.reachable ? 'success' : 'unreachable',
      runtimeMs,
      errorMessage: result.reachable
        ? null
        : `Customer ${customerId} is unreachable from Central Hub.`,
    });

    if (result.reachable) {
      triggerToast(
        `Fastest path found to ${customerId} (${result.travelMinutes.toFixed(2)} min in ${runtimeMs} ms).`
      );
    } else {
      triggerToast(`Notice: No viable road path to customer ${customerId}.`);
    }
  };

  // Clear Path Overlay
  const handleClearPathTest = () => {
    setPathTestState((prev) => ({
      selectedCustomerId: prev.selectedCustomerId,
      lastPathResult: null,
      status: 'idle',
      runtimeMs: null,
      errorMessage: null,
    }));
    setPathValidationResult(null);
    triggerToast('Dijkstra path overlay cleared.');
  };

  const handleReset = () => {
    setActivePreset('normal');
    setSeed(DEFAULT_SEED);
    handleClearPathTest();
    setActiveDisplayMode('none');
    setGreedyPlan(null);
    setGreedyValidation(null);
    setPsoResult(null);
    setQpsoResult(null);
    triggerToast('Scenario reset to initial baseline state (Seed: 26137).');
  };

  const handleLoadDemo = () => {
    setActivePreset('normal');
    setSeed(DEFAULT_SEED);
    handleClearPathTest();
    setActiveDisplayMode('none');
    triggerToast('Default demo scenario loaded successfully.');
  };

  const allDijkstraPassed = dijkstraTestResults.every((t) => t.passed);
  const allGreedyPassed = greedyTestResults.every((t) => t.passed);
  const allPsoPassed = psoTestResults.every((t) => t.passed);
  const allQpsoPassed = qpsoTestResults.every((t) => t.passed);
  const allReroutingPassed = reroutingTestResults.every((t) => t.passed);
  const systemAllPassed =
    validationReport.isValid &&
    allDijkstraPassed &&
    allGreedyPassed &&
    allPsoPassed &&
    allQpsoPassed &&
    allReroutingPassed;

  // Base optimizer plan
  const basePlan =
    activeDisplayMode === 'qpso'
      ? qpsoResult?.bestPlan || null
      : activeDisplayMode === 'pso'
      ? psoResult?.bestPlan || null
      : activeDisplayMode === 'greedy'
      ? greedyPlan
      : null;

  // Active displayed plan considering dynamic re-routing views
  const displayedPlan =
    reroutingResult && activePlanView === 'revised'
      ? reroutingResult.revisedSnapshot?.routePlan || basePlan
      : reroutingResult && activePlanView === 'pre_incident'
      ? preIncidentSnapshot?.routePlan || basePlan
      : basePlan;

  const displayedValidation =
    reroutingResult && activePlanView === 'revised' && reroutingResult.revisedSnapshot
      ? validateRevisedRoutePlan(
          reroutingResult.revisedSnapshot.routePlan,
          scenario,
          incidentEdges || scenario.edges,
          vehicleDynamicStates
        )
      : activeDisplayMode === 'qpso'
      ? qpsoResult?.validatorResult || null
      : activeDisplayMode === 'pso'
      ? psoResult?.validatorResult || null
      : activeDisplayMode === 'greedy'
      ? greedyValidation
      : null;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Header */}
      <Header
        onReset={handleReset}
        onLoadDemo={handleLoadDemo}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenValidation={() => setValidationOpen(true)}
        isValidScenario={systemAllPassed}
      />

      {/* Ephemeral Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-cyan-500/40 text-slate-100 px-4 py-2.5 rounded-xl shadow-2xl text-xs flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Developer Validation Warning Banner */}
      {!systemAllPassed && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <AlertOctagon className="w-4 h-4 shrink-0" />
            <span>
              Validation Warning: One or more domain invariants or algorithm tests failed. Check Scenario Specs for details.
            </span>
            <button
              onClick={() => setValidationOpen(true)}
              className="ml-auto underline hover:text-rose-100 cursor-pointer"
            >
              View Report
            </button>
          </div>
        </div>
      )}

      {/* Main Dashboard Layout */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
        {/* Top Operational Section: 3 Columns on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
          {/* Left Column: Control Panel with Path Test and Optimization (3 cols) */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            <ControlPanel
              currentPreset={activePreset}
              seed={seed}
              customerCount={scenario.customers.length}
              vehicleCount={scenario.vehicles.length}
              depotLabel="Central Hub"
              customers={scenario.customers}
              depotNodeId={scenario.depotNodeId}
              pathTestState={pathTestState}
              onRunPathTest={handleRunPathTest}
              onClearPathTest={handleClearPathTest}
              selectedAlgorithm={selectedAlgorithm}
              onSelectAlgorithm={setSelectedAlgorithm}
              onRunGreedy={handleRunGreedy}
              onRunPso={handleRunPso}
              onRunQpso={handleRunQpso}
              onClearFleetRoutes={handleClearFleetRoutes}
              isGreedyActive={activeDisplayMode === 'greedy'}
              isPsoActive={activeDisplayMode === 'pso'}
              isQpsoActive={activeDisplayMode === 'qpso'}
              isOptimizingPso={isOptimizingPso}
              isOptimizingQpso={isOptimizingQpso}
              psoPreset={psoPreset}
              onChangePsoPreset={setPsoPreset}
              scenario={scenario}
              initialPlan={displayedPlan || basePlan}
              preIncidentSnapshot={preIncidentSnapshot}
              incident={incident}
              vehicleDynamicStates={vehicleDynamicStates}
              candidateIncidentEdges={candidateIncidentEdges}
              onSimulatePartialExecution={handleSimulatePartialExecution}
              onInjectIncident={handleInjectIncident}
              onInjectGuidedIncident={handleInjectGuidedIncident}
              onUndoIncident={handleUndoIncident}
              onRunRerouting={handleRunDynamicRerouting}
              onResetSimulation={handleResetSimulation}
              isSimulatingExecution={isSimulatingExecution}
               isOptimizingReroute={isOptimizingReroute}
              hasRevisedPlan={Boolean(reroutingResult)}
              reroutingResult={reroutingResult}
            />
          </div>

          {/* Central Column: Road Network SVG with Dijkstra & Fleet Route Overlays (6 cols) */}
          <div className="lg:col-span-6 order-1 lg:order-2">
            <RoadNetwork
              nodes={scenario.nodes}
              edges={incidentEdges || scenario.edges}
              customers={scenario.customers}
              vehicles={scenario.vehicles}
              depotNodeId={scenario.depotNodeId}
              pathResult={pathTestState.lastPathResult}
              targetCustomerId={pathTestState.selectedCustomerId}
              routePlan={displayedPlan}
              vehicleDynamicStates={vehicleDynamicStates}
              incident={incident}
              preIncidentPlan={reroutingResult?.preIncidentSnapshot?.routePlan || null}
              activePlanView={activePlanView}
            />
          </div>

          {/* Right Column: Path Result Card & Fleet KPI Panel (3 cols) */}
          <div className="lg:col-span-3 order-3 space-y-4">
            <PathResultCard
              pathTestState={pathTestState}
              validationResult={pathValidationResult}
            />
            <KpiPanel
              totalCustomers={scenario.customers.length}
              routePlan={displayedPlan}
              validationResult={displayedValidation}
            />
          </div>
        </div>

        {/* Dynamic Incident & Re-Routing Summary Dashboard */}
        {reroutingResult && (
          <div className="space-y-4">
            <ReroutingResultSummary
              reroutingResult={reroutingResult}
              incident={incident}
              vehicleDynamicStates={vehicleDynamicStates}
              vehicles={scenario.vehicles}
              customers={scenario.customers}
              onResetSimulation={handleResetSimulation}
              activePlanView={activePlanView}
              onChangePlanView={setActivePlanView}
            />
            <ReroutingResultPanel reroutingResult={reroutingResult} />
          </div>
        )}

        {/* Fleet Plan Detail Cards (Displayed based on active plan mode) */}
        {activeDisplayMode === 'qpso' && qpsoResult && !reroutingResult && (
          <div>
            <QpsoResultSummary
              result={qpsoResult}
              greedyPlan={greedyPlan}
              psoResult={psoResult}
            />
          </div>
        )}

        {activeDisplayMode === 'pso' && psoResult && !reroutingResult && (
          <div>
            <PsoResultSummary result={psoResult} />
          </div>
        )}

        {activeDisplayMode === 'greedy' && greedyPlan && !reroutingResult && (
          <div>
            <GreedyResultSummary plan={greedyPlan} />
          </div>
        )}

        {/* Section 6: Vehicle Status Cards with genuine load and stop data */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
              Fleet Vehicle Status & Load
            </h2>
            <span className="text-xs text-slate-400">
              Capacity: 30 units per vehicle • 3 active units
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scenario.vehicles.map((v) => {
              const route = displayedPlan?.vehicleRoutes.find((r) => r.vehicleId === v.id);
              return <VehicleCard key={v.id} vehicle={v} route={route} />;
            })}
          </div>
        </div>

        {/* Section 5: Bottom Algorithm Comparison Table */}
        <div>
          <AlgorithmComparison
            greedyPlan={greedyPlan}
            psoResult={psoResult}
            qpsoResult={qpsoResult}
          />
        </div>
      </main>

      {/* Footer Info */}
      <footer className="border-t border-slate-200 bg-white/60 py-3 px-4 text-center text-xs text-slate-500">
        <p>
          QuantaRoute AI • Smart India Hackathon Prototype • Capacity-aware fleet route optimization
        </p>
      </footer>

      {/* Modals */}
      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <ValidationModal
        isOpen={validationOpen}
        onClose={() => setValidationOpen(false)}
        report={validationReport}
        dijkstraTests={dijkstraTestResults}
        greedyTests={greedyTestResults}
        psoTests={psoTestResults}
        qpsoTests={qpsoTestResults}
        reroutingTests={reroutingTestResults}
      />
    </div>
  );
}

