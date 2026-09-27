/**
 * Guided Capstone Demo
 * QuantaRoute AI — Capstone Presentation Workflow
 *
 * A deterministic, step-by-step demonstration using REAL application state and
 * REAL algorithm computations. No scores, routes, or metrics are fabricated.
 */

import React, { useState, useCallback, useRef } from 'react';
import { generateScenario } from '../data/scenarioGenerator';
import { runQuantumPso, QPSO_PRESETS } from '../algorithms/quantumPso';
import { runBenchmark } from '../services/experimentManager';
import { BENCHMARK_PRESETS } from '../services/benchmarkPresets';
import {
  createInitialSnapshot,
  simulatePartialExecution,
  selectGuidedDemoEdge,
  injectDynamicIncident,
  runDynamicRerouting,
} from '../services/dynamicRerouting';
import {
  loadExperimentHistory,
  saveExperimentHistory,
  appendExperimentRecord,
} from '../utils/experimentStorage';
import { QpsoRunResult, RoutePlanSnapshot, VehicleDynamicState, DynamicIncident, ReroutingResult } from '../types/routing';
import { Scenario, Edge } from '../types/domain';
import {
  InitialRoutingExperimentRecord,
  ExperimentRecord,
} from '../types/experiments';
import {
  DEFAULT_GUIDED_DEMO_CONFIG,
  DEMO_STEPS,
  DemoStepStatus,
  DemoStepState,
  DemoStepResult,
} from '../types/capstone';
import { buildCapstoneDynamicRecord } from '../services/capstoneRecordBuilder';
import {
  Play,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  AlertCircle,
  BarChart3,
  ChevronRight,
} from 'lucide-react';

type StepStatus = DemoStepStatus;

interface GuidedCapstoneDemoProps {
  onOpenResults: () => void;
  onOpenValidation: () => void;
}

const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  not_started: 'Not Started',
  ready: 'Ready',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  blocked: 'Blocked',
};

const STATUS_COLORS: Record<StepStatus, string> = {
  not_started: 'text-slate-400 bg-slate-100',
  ready: 'text-slate-400 bg-slate-100',
  running: 'text-cyan-700 bg-cyan-100',
  completed: 'text-emerald-700 bg-emerald-100',
  failed: 'text-rose-700 bg-rose-100',
  blocked: 'text-amber-700 bg-amber-100',
};

function generateGroupId(): string {
  return `capstone-demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getStatusIcon(status: StepStatus) {
  switch (status) {
    case 'running':
      return <RefreshCw className="w-4 h-4 animate-spin text-cyan-600" />;
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-rose-600" />;
    case 'blocked':
      return <AlertCircle className="w-4 h-4 text-amber-600" />;
    default:
      return <div className="w-4 h-4 rounded-full bg-slate-300" />;
  }
}

function MetricRow({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 py-1.5 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-mono font-medium text-slate-800">
        {value} {unit}
      </span>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0) return <span className="text-slate-400">No convergence data</span>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / Math.max(1, data.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const width = 120;
  const height = 32;
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        points={points}
        className="text-cyan-600"
        transform={`scale(${width / 100} ${height / 100})`}
      />
    </svg>
  );
}

export const GuidedCapstoneDemo: React.FC<GuidedCapstoneDemoProps> = ({
  onOpenResults,
  onOpenValidation,
}) => {
  const [groupId, setGroupId] = useState<string | null>(null);
  const [stepStates, setStepStates] = useState<DemoStepState[]>(
    DEMO_STEPS.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      status: 'not_started' as DemoStepStatus,
      error: null,
      result: null,
    }))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [demoRecords, setDemoRecords] = useState<ExperimentRecord[]>([]);

  // Internal demo state
  const demoStateRef = useRef<{
    scenario: Scenario | null;
    initialResult: QpsoRunResult | null;
    initialSnapshot: RoutePlanSnapshot | null;
    comparisonRecords: InitialRoutingExperimentRecord[];
    preIncidentSnapshot: RoutePlanSnapshot | null;
    vehicleDynamicStates: VehicleDynamicState[];
    incident: DynamicIncident | null;
    incidentEdges: Edge[] | null;
    preIncidentOrigMinutes: number;
    preIncidentDelayedMinutes: number | null;
    preIncidentRouteBlocked: boolean;
    reroutingResult: ReroutingResult | null;
  }>({
    scenario: null,
    initialResult: null,
    initialSnapshot: null,
    comparisonRecords: [],
    preIncidentSnapshot: null,
    vehicleDynamicStates: [],
    incident: null,
    incidentEdges: null,
    preIncidentOrigMinutes: 0,
    preIncidentDelayedMinutes: null,
    preIncidentRouteBlocked: false,
    reroutingResult: null,
  });

  const updateStep = useCallback((stepId: string, patch: Partial<DemoStepState>) => {
    setStepStates((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s))
    );
  }, []);

  const config = DEFAULT_GUIDED_DEMO_CONFIG;

  async function executeStep1(): Promise<boolean> {
    updateStep('step-1', { status: 'running', error: null, result: null });

    try {
      const scenario = generateScenario(config.scenarioPreset, config.scenarioSeed);
      demoStateRef.current.scenario = scenario;

      const seedOk = scenario.seed === config.scenarioSeed;
      const customerCountOk = scenario.customers.length === 25;
      const vehicleCountOk = scenario.vehicles.length === 3;
      const nodeCountOk = scenario.nodes.length === 100;

      const success = seedOk && customerCountOk && vehicleCountOk && nodeCountOk;

      updateStep('step-1', {
        status: success ? 'completed' : 'failed',
        error: success ? null : 'Scenario does not match expected Normal Traffic / seed 26137 / 25 customers / 3 vehicles',
        result: success ? { scenario, scenarioName: scenario.name, seed: config.scenarioSeed, customerCount: scenario.customers.length, vehicleCount: scenario.vehicles.length } : null,
      });

      return success;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateStep('step-1', { status: 'failed', error: msg });
      return false;
    }
  }

  async function executeStep2(): Promise<boolean> {
    updateStep('step-2', { status: 'running', error: null, result: null });

    try {
      const scenario = demoStateRef.current.scenario;
      if (!scenario) {
        updateStep('step-2', { status: 'blocked', error: 'Step 1 must complete first' });
        return false;
      }

      const qpsoResult = runQuantumPso(scenario, {
        presetName: config.initialPreset,
        seed: config.initialOptimizerSeed,
      });

      const snapshot = createInitialSnapshot(qpsoResult.bestPlan, scenario);

      demoStateRef.current.initialResult = qpsoResult;
      demoStateRef.current.initialSnapshot = snapshot;

      const preset = QPSO_PRESETS[config.initialPreset];
      const plan = qpsoResult.bestPlan;

      updateStep('step-2', {
        status: 'completed',
        error: null,
        result: {
          routingScore: plan.routingScore,
          totalTravelMinutes: plan.totalTravelMinutes,
          totalDistanceKm: plan.totalDistanceKm,
          congestionPenalty: plan.congestionPenalty,
          customersAssigned: plan.customersServed,
          customersUnserved: plan.customerCount - plan.customersServed,
          feasible: plan.isFeasible,
          runtimeMs: qpsoResult.runtimeMs,
          populationSize: qpsoResult.populationSize,
          iterations: qpsoResult.iterationsCompleted,
          candidateEvaluations: qpsoResult.candidateEvaluations,
          betaStart: preset.betaStart,
          betaEnd: preset.betaEnd,
          hasConvergence: qpsoResult.convergenceHistory && qpsoResult.convergenceHistory.length > 0,
          firstConvergenceScore: qpsoResult.convergenceHistory?.[0],
          bestConvergenceScore: Math.min(...qpsoResult.convergenceHistory),
        },
      });

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateStep('step-2', { status: 'failed', error: msg });
      return false;
    }
  }

  async function executeStep3(): Promise<boolean> {
    updateStep('step-3', { status: 'running', error: null, result: null });

    try {
      const scenario = demoStateRef.current.scenario;
      if (!scenario) {
        updateStep('step-3', { status: 'blocked', error: 'Step 1 must complete first' });
        return false;
      }

      const preset = BENCHMARK_PRESETS.find((p) => p.id === 'normal_traffic_benchmark');
      if (!preset) {
        updateStep('step-3', { status: 'failed', error: 'Normal Traffic benchmark preset not found' });
        return false;
      }

      const records = runBenchmark(preset, () => {});

      demoStateRef.current.comparisonRecords = records.filter(
        (r): r is InitialRoutingExperimentRecord => r.runType === 'initial_routing'
      );

      // Save all 3 records to experiment history
      const existingHistory = loadExperimentHistory();
      const currentHistory = existingHistory.ok ? existingHistory.history : [];
      saveExperimentHistory([...currentHistory, ...records]);
      setDemoRecords((prev) => [...prev, ...records]);

      const feasibleRecords = demoStateRef.current.comparisonRecords.filter((r) => r.feasible);
      const lowestScoreRecord = feasibleRecords.reduce(
        (best, curr) => (best === null || curr.routingScore < best.routingScore ? curr : best),
        null as InitialRoutingExperimentRecord | null
      );

      updateStep('step-3', {
        status: 'completed',
        error: null,
        result: {
          groupId: records[0]?.experimentGroupId,
          recordCount: records.length,
          records: demoStateRef.current.comparisonRecords.map((r) => ({
            algorithm: r.algorithm,
            algorithmLabel: r.algorithmLabel,
            routingScore: r.routingScore,
            totalTravelMinutes: r.totalTravelMinutes,
            totalDistanceKm: r.totalDistanceKm,
            feasible: r.feasible,
            runtimeMs: r.runtimeMs,
            candidateEvaluations: r.candidateEvaluations,
            hasConvergence: r.convergenceHistory !== null,
          })),
          lowestScoreRecord: lowestScoreRecord
            ? { algorithm: lowestScoreRecord.algorithmLabel, routingScore: lowestScoreRecord.routingScore }
            : null,
        },
      });

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateStep('step-3', { status: 'failed', error: msg });
      return false;
    }
  }

  async function executeStep4(): Promise<boolean> {
    updateStep('step-4', { status: 'running', error: null, result: null });

    try {
      const scenario = demoStateRef.current.scenario;
      const initialSnapshot = demoStateRef.current.initialSnapshot;
      if (!scenario || !initialSnapshot) {
        updateStep('step-4', { status: 'blocked', error: 'Step 2 must complete first' });
        return false;
      }

      const { preIncidentSnapshot, vehicleDynamicStates } = simulatePartialExecution(
        initialSnapshot,
        scenario,
        config.stopsCompletedPerVehicle
      );

      demoStateRef.current.preIncidentSnapshot = preIncidentSnapshot;
      demoStateRef.current.vehicleDynamicStates = vehicleDynamicStates;

      const totalLocked = vehicleDynamicStates.reduce(
        (sum, vs) => sum + vs.deliveredCustomerIds.length,
        0
      );
      const totalPending = vehicleDynamicStates.reduce(
        (sum, vs) => sum + vs.pendingCustomerIds.length,
        0
      );

      const success = totalLocked > 0 || totalPending > 0;

      updateStep('step-4', {
        status: success ? 'completed' : 'failed',
        error: success ? null : 'No customer stops were simulated',
        result: success ? {
          totalLocked,
          totalPending,
          vehicles: vehicleDynamicStates.map((vs) => ({
            vehicleId: vs.vehicleId,
            currentNodeId: vs.currentNodeId,
            deliveredCount: vs.deliveredCustomerIds.length,
            pendingCount: vs.pendingCustomerIds.length,
            remainingCapacity: vs.remainingCapacity,
            executionState: vs.executionState,
          })),
        } : null,
      });

      return success;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateStep('step-4', { status: 'failed', error: msg });
      return false;
    }
  }

  async function executeStep5(): Promise<boolean> {
    updateStep('step-5', { status: 'running', error: null, result: null });

    try {
      const scenario = demoStateRef.current.scenario;
      const preIncidentSnapshot = demoStateRef.current.preIncidentSnapshot;
      const vehicleDynamicStates = demoStateRef.current.vehicleDynamicStates;
      if (!scenario || !preIncidentSnapshot) {
        updateStep('step-5', { status: 'blocked', error: 'Step 4 must complete first' });
        return false;
      }

      const guided = selectGuidedDemoEdge(scenario, vehicleDynamicStates, scenario.edges);

      if (!guided) {
        updateStep('step-5', { status: 'blocked', error: 'No eligible pending route edges found for guided incident' });
        return false;
      }

      const {
        incident,
        incidentEdges,
        affectedVehicleIds,
        originalRemainingTravelMinutes,
        incidentAdjustedRemainingTravelMinutes,
        routeBlockedByIncident,
        updatedVehicleStates,
      } = injectDynamicIncident(
        scenario,
        preIncidentSnapshot,
        vehicleDynamicStates,
        config.incidentType,
        config.incidentSeverity,
        guided.edgeId
      );

      demoStateRef.current.incident = incident;
      demoStateRef.current.incidentEdges = incidentEdges;
      demoStateRef.current.vehicleDynamicStates = updatedVehicleStates;
      demoStateRef.current.preIncidentOrigMinutes = originalRemainingTravelMinutes;
      demoStateRef.current.preIncidentDelayedMinutes = incidentAdjustedRemainingTravelMinutes;
      demoStateRef.current.preIncidentRouteBlocked = routeBlockedByIncident;

      const success = incident.active && incident.affectedEdgeIds.length > 0;

      updateStep('step-5', {
        status: success ? 'completed' : 'failed',
        error: success ? null : 'Incident was not properly activated',
        result: success ? {
          incidentType: incident.type,
          incidentId: incident.id,
          affectedEdgeIds: incident.affectedEdgeIds,
          affectedVehicleIds,
          incidentSeverity: incident.severity,
          incidentActive: incident.active,
          originalRemainingTravelMinutes,
          incidentAdjustedRemainingTravelMinutes,
          routeBlockedByIncident,
          description: incident.description,
        } : null,
      });

      return success;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateStep('step-5', { status: 'failed', error: msg });
      return false;
    }
  }

  async function executeStep6(): Promise<boolean> {
    updateStep('step-6', { status: 'running', error: null, result: null });

    try {
      const scenario = demoStateRef.current.scenario;
      const incidentEdges = demoStateRef.current.incidentEdges;
      const vehicleDynamicStates = demoStateRef.current.vehicleDynamicStates;
      const incident = demoStateRef.current.incident;
      const initialSnapshot = demoStateRef.current.initialSnapshot;
      const preIncidentSnapshot = demoStateRef.current.preIncidentSnapshot;
      const preIncidentOrigMinutes = demoStateRef.current.preIncidentOrigMinutes;
      const preIncidentDelayedMinutes = demoStateRef.current.preIncidentDelayedMinutes;

      if (!scenario || !incidentEdges || !incident) {
        updateStep('step-6', { status: 'blocked', error: 'Step 5 must complete first' });
        return false;
      }

      const result = runDynamicRerouting(
        scenario,
        incidentEdges,
        vehicleDynamicStates,
        incident,
        preIncidentOrigMinutes,
        preIncidentDelayedMinutes,
        config.reroutingAlgorithm,
        config.reroutingPreset,
        initialSnapshot || undefined,
        preIncidentSnapshot || undefined
      );

      demoStateRef.current.reroutingResult = result;

      // Build and save dynamic record
      if (groupId) {
        const dynamicRecord = buildCapstoneDynamicRecord(
          scenario,
          result,
          config.initialAlgorithm,
          'Quantum-Inspired PSO',
          config.initialPreset,
          groupId
        );
        appendExperimentRecord(dynamicRecord);
        setDemoRecords((prev) => [...prev, dynamicRecord]);
      }

      const success = result.revisedSnapshot !== null && result.revisedSnapshot !== undefined;

      const delayAvoidedValid =
        result.originalRemainingTravelMinutes !== null &&
        result.revisedRemainingTravelMinutes !== null &&
        result.delayAvoidedMinutes !== null;

      updateStep('step-6', {
        status: success ? 'completed' : 'failed',
        error: success ? null : 'Re-routing did not produce a revised snapshot',
        result: success ? {
          reroutingRuntimeMs: result.reroutingRuntimeMs,
          populationSize: result.populationSize,
          iterations: result.iterations,
          candidateEvaluations: result.candidateEvaluations,
          lockedCustomerCount: result.lockedCustomerCount,
          eligibleCustomerIds: result.eligibleCustomerIds,
          pendingCustomerCount: result.eligibleCustomerIds?.length || 0,
          revisedFeasible: result.revisedFeasible,
          revisedRoutingScore: result.revisedSnapshot?.routePlan.routingScore,
          revisedCustomersAssigned: result.revisedSnapshot?.routePlan.customersServed,
          revisedCustomersUnserved: result.revisedSnapshot
            ? result.revisedSnapshot.routePlan.customerCount - result.revisedSnapshot.routePlan.customersServed
            : 0,
          originalRemainingTravelMinutes: result.originalRemainingTravelMinutes,
          incidentAdjustedRemainingTravelMinutes: result.incidentAdjustedRemainingTravelMinutes,
          revisedRemainingTravelMinutes: result.revisedRemainingTravelMinutes,
          delayAvoidedMinutes: delayAvoidedValid ? result.delayAvoidedMinutes : null,
          delayAvoidedValid,
          routeStabilityChanges: result.routeStabilityChanges,
          warnings: result.warnings,
        } : null,
      });

      return success;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateStep('step-6', { status: 'failed', error: msg });
      return false;
    }
  }

  const stepExecutors: Record<string, () => Promise<boolean>> = {
    'step-1': executeStep1,
    'step-2': executeStep2,
    'step-3': executeStep3,
    'step-4': executeStep4,
    'step-5': executeStep5,
    'step-6': executeStep6,
  };

  const getNextExecutableStep = (): number => {
    for (let i = 0; i < stepStates.length; i++) {
      if (stepStates[i].status === 'not_started' || stepStates[i].status === 'blocked') {
        return i;
      }
    }
    return -1;
  };

  const handleStartDemo = () => {
    setStepStates(
      DEMO_STEPS.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        status: 'not_started' as DemoStepStatus,
        error: null,
        result: null,
      }))
    );
    setDemoRecords([]);
    setGlobalError(null);
    const newGroupId = generateGroupId();
    setGroupId(newGroupId);
    demoStateRef.current = {
      scenario: null,
      initialResult: null,
      initialSnapshot: null,
      comparisonRecords: [],
      preIncidentSnapshot: null,
      vehicleDynamicStates: [],
      incident: null,
      incidentEdges: null,
      preIncidentOrigMinutes: 0,
      preIncidentDelayedMinutes: null,
      preIncidentRouteBlocked: false,
      reroutingResult: null,
    };
    setIsRunning(true);

    // Automatically execute Step 1
    executeStep1().finally(() => setIsRunning(false));
  };

  const handleRunNextStep = async () => {
    const nextIdx = getNextExecutableStep();
    if (nextIdx === -1) return;

    // Check if prerequisites are met
    if (nextIdx > 0) {
      const prev = stepStates[nextIdx - 1];
      if (prev.status !== 'completed') {
        setGlobalError(`Previous step must complete successfully before proceeding.`);
        return;
      }
    }

    setIsRunning(true);
    const stepId = stepStates[nextIdx].id;
    try {
      await stepExecutors[stepId]();
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunFullDemo = async () => {
    if (!groupId) {
      handleStartDemo();
    }

    // Small delay to let state update from StartDemo
    await new Promise((r) => setTimeout(r, 50));

    for (let i = 0; i < stepStates.length; i++) {
      const step = stepStates[i];
      if (step.status === 'not_started' || step.status === 'blocked') {
        // Check prerequisite
        if (i > 0) {
          const prev = stepStates[i - 1];
          if (prev.status !== 'completed') {
            updateStep(step.id, { status: 'blocked', error: 'Previous step not completed' });
            setGlobalError(`Step ${i} requires previous step to complete. Stopping.`);
            return;
          }
        }

        setIsRunning(true);
        try {
          const success = await stepExecutors[step.id]();
          if (!success) {
            setGlobalError(`Step "${step.title}" failed. Stopping demo.`);
            setIsRunning(false);
            return;
          }
        } catch (err) {
          setGlobalError(err instanceof Error ? err.message : String(err));
          setIsRunning(false);
          return;
        }
      }
    }
    setIsRunning(false);
  };

  const handleResetDemo = () => {
    setStepStates(
      DEMO_STEPS.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        status: 'not_started' as DemoStepStatus,
        error: null,
        result: null,
      }))
    );
    setDemoRecords([]);
    setGroupId(null);
    setGlobalError(null);
    demoStateRef.current = {
      scenario: null,
      initialResult: null,
      initialSnapshot: null,
      comparisonRecords: [],
      preIncidentSnapshot: null,
      vehicleDynamicStates: [],
      incident: null,
      incidentEdges: null,
      preIncidentOrigMinutes: 0,
      preIncidentDelayedMinutes: null,
      preIncidentRouteBlocked: false,
      reroutingResult: null,
    };
  };

  const renderStepResult = (step: DemoStepState) => {
    const r = step.result as Record<string, any> | null;
    if (!r) return null;

    switch (step.id) {
      case 'step-1':
        return (
          <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
            <MetricRow label="Scenario" value={r.scenarioName} />
            <MetricRow label="Seed" value={r.seed} />
            <MetricRow label="Customers" value={r.customerCount} />
            <MetricRow label="Vehicles" value={r.vehicleCount} />
          </div>
        );

      case 'step-2':
        return (
          <div className="space-y-2 mt-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <MetricRow label="Routing Score" value={r.routingScore.toFixed(2)} />
              <MetricRow label="Total Travel Time" value={r.totalTravelMinutes.toFixed(2)} unit="min" />
              <MetricRow label="Total Distance" value={r.totalDistanceKm.toFixed(2)} unit="km" />
              <MetricRow label="Congestion Penalty" value={r.congestionPenalty.toFixed(4)} />
              <MetricRow label="Customers Assigned" value={r.customersAssigned} />
              <MetricRow label="Customers Unserved" value={r.customersUnserved} />
              <MetricRow label="Feasible" value={r.feasible ? 'Yes' : 'No'} />
              <MetricRow label="Runtime" value={r.runtimeMs.toFixed(1)} unit="ms" />
              <MetricRow label="Population" value={r.populationSize} />
              <MetricRow label="Iterations" value={r.iterations} />
              <MetricRow label="Candidate Evaluations" value={r.candidateEvaluations} />
              <MetricRow label="Beta Schedule" value={`${r.betaStart} → ${r.betaEnd}`} />
            </div>
            {r.hasConvergence && (
              <div className="mt-2">
                <span className="text-xs text-slate-500">Convergence:</span>
                <Sparkline data={[r.firstConvergenceScore, r.bestConvergenceScore]} />
                <span className="text-xs text-slate-500 ml-2">
                  First: {r.firstConvergenceScore.toFixed(2)} | Best: {r.bestConvergenceScore.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        );

      case 'step-3': {
        const records = (r.records as Array<Record<string, any>>) || [];
        if (!records || records.length === 0) return null;
        return (
          <div className="mt-2 space-y-2">
            <div className="text-xs text-slate-500 mb-1">Lower routing score is better.</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Algorithm</th>
                    <th className="px-2 py-1.5 text-right">Score</th>
                    <th className="px-2 py-1.5 text-right">Travel</th>
                    <th className="px-2 py-1.5 text-right">Distance</th>
                    <th className="px-2 py-1.5 text-center">Feasible</th>
                    <th className="px-2 py-1.5 text-right">Runtime</th>
                    <th className="px-2 py-1.5 text-right">Evals</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, i) => {
                    const isBest =
                      r.lowestScoreRecord &&
                      rec.algorithmLabel === r.lowestScoreRecord.algorithm;
                    return (
                      <tr
                        key={i}
                        className={isBest ? 'bg-emerald-50/50 font-medium' : 'bg-white'}
                      >
                        <td className="px-2 py-1.5">{rec.algorithmLabel}</td>
                        <td className="px-2 py-1.5 text-right">{rec.routingScore.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right">{rec.totalTravelMinutes.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right">{rec.totalDistanceKm.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-center">
                          {rec.feasible ? '✓' : '✗'}
                        </td>
                        <td className="px-2 py-1.5 text-right">{rec.runtimeMs.toFixed(0)}</td>
                        <td className="px-2 py-1.5 text-right">{rec.candidateEvaluations}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {r.lowestScoreRecord && (
              <div className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                Lowest measured feasible score: {r.lowestScoreRecord.algorithm} = {r.lowestScoreRecord.routingScore.toFixed(2)}
              </div>
            )}
          </div>
        );
      }

      case 'step-4': {
        const vehicles = r.vehicles as Array<Record<string, any>>;
        return (
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <MetricRow label="Total Locked" value={r.totalLocked} />
              <MetricRow label="Total Pending" value={r.totalPending} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Vehicle</th>
                    <th className="px-2 py-1.5 text-left">Current Node</th>
                    <th className="px-2 py-1.5 text-right">Delivered</th>
                    <th className="px-2 py-1.5 text-right">Pending</th>
                    <th className="px-2 py-1.5 text-right">Capacity Rem.</th>
                    <th className="px-2 py-1.5 text-left">State</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <tr key={String(v.vehicleId)} className="bg-white">
                      <td className="px-2 py-1.5">{v.vehicleId}</td>
                      <td className="px-2 py-1.5">{v.currentNodeId}</td>
                      <td className="px-2 py-1.5 text-right">{v.deliveredCount}</td>
                      <td className="px-2 py-1.5 text-right">{v.pendingCount}</td>
                      <td className="px-2 py-1.5 text-right">{v.remainingCapacity}</td>
                      <td className="px-2 py-1.5">{v.executionState}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case 'step-5':
        return (
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <MetricRow label="Incident Type" value={r.incidentType} />
            <MetricRow label="Incident ID" value={r.incidentId} />
            <MetricRow label="Edge(s)" value={r.affectedEdgeIds.join(', ')} />
            <MetricRow label="Affected Vehicles" value={r.affectedVehicleIds.join(', ') || 'None'} />
            <MetricRow label="Severity" value={r.incidentSeverity} />
            <MetricRow label="Active" value={r.incidentActive ? 'Yes' : 'No'} />
            {r.originalRemainingTravelMinutes !== null && (
              <MetricRow label="Original Remaining" value={r.originalRemainingTravelMinutes.toFixed(2)} unit="min" />
            )}
            {r.incidentAdjustedRemainingTravelMinutes !== null && (
              <MetricRow label="Incident-Adjusted Remaining" value={r.incidentAdjustedRemainingTravelMinutes.toFixed(2)} unit="min" />
            )}
            <MetricRow label="Route Blocked" value={r.routeBlockedByIncident ? 'Yes' : 'No'} />
            <div className="col-span-2 text-xs text-slate-600">{r.description}</div>
          </div>
        );

      case 'step-6':
        return (
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <MetricRow label="Re-routing Runtime" value={r.reroutingRuntimeMs.toFixed(1)} unit="ms" />
              <MetricRow label="Population" value={r.populationSize} />
              <MetricRow label="Iterations" value={r.iterations} />
              <MetricRow label="Candidate Evaluations" value={r.candidateEvaluations} />
              <MetricRow label="Locked Customers" value={r.lockedCustomerCount} />
              <MetricRow label="Pending Customers" value={r.pendingCustomerCount} />
              <MetricRow label="Re-routing Preset" value={config.reroutingPreset} />
              <MetricRow label="Revised Feasible" value={r.revisedFeasible ? 'Yes' : 'No'} />
              {r.originalRemainingTravelMinutes !== null && (
                <MetricRow label="Original Remaining" value={r.originalRemainingTravelMinutes.toFixed(2)} unit="min" />
              )}
              {r.incidentAdjustedRemainingTravelMinutes !== null && r.incidentAdjustedRemainingTravelMinutes !== null && (
                <MetricRow label="Incident-Adjusted Remaining" value={r.incidentAdjustedRemainingTravelMinutes.toFixed(2)} unit="min" />
              )}
              {r.revisedRemainingTravelMinutes !== null && (
                <MetricRow label="Revised Remaining" value={r.revisedRemainingTravelMinutes.toFixed(2)} unit="min" />
              )}
              {r.delayAvoidedValid && r.delayAvoidedMinutes !== null && (
                <MetricRow label="Delay Avoided" value={r.delayAvoidedMinutes.toFixed(2)} unit="min" />
              )}
              {r.delayAvoidedValid === false && (
                <MetricRow label="Delay Avoided" value="Unavailable (route recovery only)" />
              )}
              <MetricRow label="Route Stability Changes" value={r.routeStabilityChanges} />
              {r.revisedRoutingScore !== undefined && r.revisedRoutingScore !== null && (
                <MetricRow label="Revised Routing Score" value={r.revisedRoutingScore.toFixed(2)} />
              )}
              {r.revisedCustomersAssigned !== undefined && (
                <MetricRow label="Revised Customers Assigned" value={r.revisedCustomersAssigned} />
              )}
              {r.revisedCustomersUnserved !== undefined && (
                <MetricRow label="Revised Customers Unserved" value={r.revisedCustomersUnserved} />
              )}
            </div>
            {r.warnings && r.warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                <span className="text-xs font-medium text-amber-800">Warnings:</span>
                <ul className="text-xs text-amber-700 mt-1 space-y-0.5">
                  {r.warnings.map((w: string, i: number) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const completedSteps = stepStates.filter((s) => s.status === 'completed').length;
  const totalSteps = stepStates.length;
  const allCompleted = completedSteps === totalSteps;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
          Guided Capstone Demo
        </h2>
        <span className="text-xs text-slate-400">
          {completedSteps}/{totalSteps} steps completed
        </span>
      </div>

      {/* Demo Configuration Summary */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <span className="text-slate-500">Scenario:</span>
            <span className="font-medium text-slate-800 ml-1">{config.scenarioPreset} / Seed {config.scenarioSeed}</span>
          </div>
          <div>
            <span className="text-slate-500">Initial:</span>
            <span className="font-medium text-slate-800 ml-1">{config.initialAlgorithm.toUpperCase()} / {config.initialPreset}</span>
          </div>
          <div>
            <span className="text-slate-500">Re-route:</span>
            <span className="font-medium text-slate-800 ml-1">{config.reroutingAlgorithm.toUpperCase()} / {config.reroutingPreset}</span>
          </div>
          <div>
            <span className="text-slate-500">QPSO Balanced Budget:</span>
            <span className="font-mono text-slate-700 ml-1">pop 25, iter 50, eval 1275, beta 1.0→0.5</span>
          </div>
          <div>
            <span className="text-slate-500">QPSO Fast Budget:</span>
            <span className="font-mono text-slate-700 ml-1">pop 15, iter 25, eval 390, beta 1.0→0.5</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleStartDemo}
          disabled={isRunning}
          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-xs rounded-lg flex items-center gap-1.5"
        >
          <Play className="w-3.5 h-3.5" />
          Start Guided Demo
        </button>
        <button
          onClick={handleRunNextStep}
          disabled={isRunning || stepStates.every((s) => s.status === 'completed')}
          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 text-xs rounded-lg flex items-center gap-1.5"
        >
          <ChevronRight className="w-3.5 h-3.5" />
          Run Next Step
        </button>
        <button          onClick={handleRunFullDemo}
          disabled={isRunning}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs rounded-lg flex items-center gap-1.5"
        >
          <Play className="w-3.5 h-3.5" />
          Run Full Demo
        </button>
        <button
          onClick={handleResetDemo}
          disabled={isRunning}
          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-700 text-xs rounded-lg flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset
        </button>
        <button
          onClick={onOpenResults}
          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs rounded-lg flex items-center gap-1.5"
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Open Results
        </button>
        <button
          onClick={onOpenValidation}
          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs rounded-lg flex items-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5" />
          Open Validation Checks
        </button>
      </div>

      {globalError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Step List */}
      <div className="space-y-3">
        {stepStates.map((step, idx) => {
          const stepNum = idx + 1;
          const status: DemoStepStatus = step.status;
          return (
            <div
              key={step.id}
              className="border border-slate-200 rounded-xl p-4 bg-white space-y-2"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-500'
                        : status === 'failed'
                        ? 'bg-rose-100 text-rose-700 border-2 border-rose-500'
                        : status === 'running'
                        ? 'bg-cyan-100 text-cyan-700 border-2 border-cyan-500'
                        : status === 'blocked'
                        ? 'bg-amber-100 text-amber-700 border-2 border-amber-500'
                        : 'bg-slate-100 text-slate-500 border-2 border-slate-300'
                    }`}
                  >
                    {stepNum}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                      {step.title}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[status]}`}
                      >
                        {getStatusIcon(status)}
                        {STEP_STATUS_LABELS[status]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                  </div>
                </div>
              </div>

              {step.error && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{step.error}</span>
                </div>
              )}

              {step.result && renderStepResult(step)}
            </div>
          );
        })}
      </div>

      {allCompleted && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm">
          <div className="flex items-center gap-2 text-emerald-800 font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            Demo Complete — All 6 steps finished successfully
          </div>
          <p className="text-xs text-emerald-700 mt-1">
            {demoRecords.length} experiment record(s) saved to local history.
          </p>
        </div>
      )}
    </div>
  );
};
