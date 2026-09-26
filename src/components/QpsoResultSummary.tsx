import React from 'react';
import { PsoRunResult, QpsoRunResult, RoutePlan } from '../types/routing';
import { 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Milestone, 
  Award, 
  Activity, 
  Info,
  ChevronRight,
  TrendingDown,
  Layers,
  Hash,
  Timer,
  Scale
} from 'lucide-react';

interface QpsoResultSummaryProps {
  result: QpsoRunResult | null;
  greedyPlan?: RoutePlan | null;
  psoResult?: PsoRunResult | null;
}

export const QpsoResultSummary: React.FC<QpsoResultSummaryProps> = ({
  result,
  greedyPlan,
  psoResult,
}) => {
  if (!result) return null;

  const plan = result.bestPlan;
  const totalCapacityUsed = plan.vehicleRoutes.reduce((acc, r) => acc + r.usedCapacity, 0);
  const totalCapacityAvailable = 90; // 3 vehicles * 30

  const vehicleColorMap: Record<string, { bg: string; text: string; border: string }> = {
    V1: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    V2: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    V3: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  };

  // Sparkline calculation for convergence
  const history = result.convergenceHistory;
  const minVal = Math.min(...history);
  const maxVal = Math.max(...history);
  const valRange = maxVal - minVal > 1e-4 ? maxVal - minVal : 1;

  const chartWidth = 520;
  const chartHeight = 90;
  const paddingX = 14;
  const paddingY = 14;

  const points = history.map((val, idx) => {
    const x = paddingX + (idx / Math.max(1, history.length - 1)) * (chartWidth - 2 * paddingX);
    const y =
      chartHeight -
      paddingY -
      ((val - minVal) / valRange) * (chartHeight - 2 * paddingY);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const sparklinePolyline = points.join(' ');
  const firstVal = history[0];
  const finalVal = history[history.length - 1];

  // Objective score comparisons against baselines (only if both are feasible)
  const calcImprovement = (baselineScore: number, qpsoScore: number, feasible: boolean) => {
    if (!feasible || !plan.isFeasible) return 'Not comparable';
    const pct = ((baselineScore - qpsoScore) / baselineScore) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  };

  const greedyImprovement = greedyPlan
    ? calcImprovement(greedyPlan.routingScore, plan.routingScore, greedyPlan.isFeasible)
    : null;

  const psoImprovement = psoResult?.bestPlan
    ? calcImprovement(psoResult.bestPlan.routingScore, plan.routingScore, psoResult.bestPlan.isFeasible)
    : null;

  return (
    <div className="bg-white rounded-xl border border-teal-300/80 p-4 shadow-sm text-slate-800 space-y-4">
      {/* Title & Status Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
            Quantum-Inspired PSO Fleet Plan
          </h2>
          <span className="text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full">
            {result.config.presetName || 'Balanced'} Profile
          </span>
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
                Feasible Allocation
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Infeasible Violations
              </>
            )}
          </span>
          <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            {result.runtimeMs.toFixed(2)} ms
          </span>
        </div>
      </div>

      {/* Metaheuristic Execution Budget Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs bg-teal-50/50 p-2.5 rounded-lg border border-teal-100">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-500 block">Population</span>
            <span className="font-bold text-slate-900 font-mono">
              {result.populationSize} particles
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Timer className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-500 block">Iterations</span>
            <span className="font-bold text-slate-900 font-mono">
              {result.iterationsCompleted} steps
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-500 block">Candidate Evals</span>
            <span className="font-bold text-slate-900 font-mono">
              {result.candidateEvaluations.toLocaleString()} plans
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Scale className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-500 block">Beta Schedule</span>
            <span className="font-bold text-slate-900 font-mono">
              β: {result.betaStart.toFixed(2)} → {result.betaEnd.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Hash className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-500 block">PRNG Run Seed</span>
            <span className="font-bold text-slate-900 font-mono">{result.seed}</span>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
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
          <span className="text-base font-bold text-teal-700 font-mono">
            {plan.routingScore.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-500 block">
            +{plan.congestionPenalty.toFixed(1)} delay penalty
          </span>
        </div>
      </div>

      {/* Measured Benchmark Comparisons (if other algorithms were executed) */}
      {(greedyImprovement || psoImprovement) && (
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-teal-600" />
            Measured Score Delta:
          </span>
          <div className="flex items-center gap-4 text-xs font-mono">
            {greedyImprovement && (
              <span>
                vs. Greedy Baseline:{' '}
                <strong
                  className={
                    greedyImprovement.startsWith('+')
                      ? 'text-emerald-700'
                      : greedyImprovement === 'Not comparable'
                      ? 'text-slate-500'
                      : 'text-amber-700'
                  }
                >
                  {greedyImprovement}
                </strong>
              </span>
            )}
            {psoImprovement && (
              <span>
                vs. Classical PSO:{' '}
                <strong
                  className={
                    psoImprovement.startsWith('+')
                      ? 'text-emerald-700'
                      : psoImprovement === 'Not comparable'
                      ? 'text-slate-500'
                      : 'text-amber-700'
                  }
                >
                  {psoImprovement}
                </strong>
              </span>
            )}
          </div>
        </div>
      )}

      {/* QPSO Convergence Sparkline Chart */}
      <div className="bg-slate-900 rounded-xl p-3.5 text-white space-y-2 border border-slate-800">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            <TrendingDown className="w-4 h-4 text-teal-400" />
            <span>QPSO Best-So-Far Convergence</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-3">
            <span>
              Init: <strong className="text-slate-200">{firstVal.toFixed(1)}</strong>
            </span>
            <span>
              Final: <strong className="text-teal-400">{finalVal.toFixed(1)}</strong>
            </span>
            <span className="text-emerald-400">
              (-{Math.max(0, firstVal - finalVal).toFixed(1)} pts)
            </span>
          </div>
        </div>

        {/* SVG Sparkline */}
        <div className="w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-20 overflow-visible"
            aria-label={`QPSO Best-So-Far Convergence. Initial score: ${firstVal.toFixed(1)}, final best score: ${finalVal.toFixed(1)} across ${history.length - 1} iterations.`}
          >
            {/* Grid line */}
            <line
              x1={paddingX}
              y1={chartHeight - paddingY}
              x2={chartWidth - paddingX}
              y2={chartHeight - paddingY}
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {/* Area fill */}
            <polygon
              points={`${paddingX},${chartHeight - paddingY} ${sparklinePolyline} ${chartWidth - paddingX},${chartHeight - paddingY}`}
              fill="rgba(20, 184, 166, 0.18)"
            />
            {/* Line */}
            <polyline
              points={sparklinePolyline}
              fill="none"
              stroke="#2dd4bf"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* End Point Dot */}
            {points.length > 0 && (
              <circle
                cx={points[points.length - 1].split(',')[0]}
                cy={points[points.length - 1].split(',')[1]}
                r="3.5"
                fill="#2dd4bf"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            )}
          </svg>
        </div>

        {/* Accessible fallback text */}
        <p className="sr-only">
          QPSO Best-So-Far Convergence: Initial score {firstVal.toFixed(2)}, final best score {finalVal.toFixed(2)}, best achieved {minVal.toFixed(2)} after {history.length - 1} iterations.
        </p>
      </div>

      {/* Per-Vehicle Dispatched Routes */}
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

      {/* Exact Mathematical Formulation Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-700 space-y-1.5 font-mono">
        <div className="font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
          <span>QPSO Mathematical Formulation</span>
        </div>
        <div className="bg-white p-2 rounded border border-slate-200 space-y-1 text-slate-800">
          <div>mbest_j = (1 / Np) * Σ_i pbest_ij</div>
          <div>p_ij = φ_ij * pbest_ij + (1 - φ_ij) * gbest_j</div>
          <div>x_ij(t + 1) = p_ij ± β(t) * |mbest_j - x_ij(t)| * ln(1 / u_ij)</div>
        </div>
        <div className="text-[10px] text-slate-500 font-sans">
          Where φ_ij and u_ij are independently sampled from Uniform(0,1), and the ± sign is sampled independently.
        </div>
      </div>

      {/* Plain Language Explanation required verbatim by prompt */}
      <div className="flex items-start gap-2 bg-teal-50/70 border border-teal-200/80 rounded-lg p-3 text-[11px] text-teal-950 leading-relaxed">
        <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <span>
          Quantum-Inspired Particle Swarm Optimization (QPSO) is a classical metaheuristic. Unlike Classical PSO, QPSO does not update particles with velocity vectors. Instead, it computes a mean-best position from the swarm’s personal best solutions and samples new particle positions probabilistically around local attractors. This application does not use quantum hardware, qubits, quantum gates, or runtime generative AI.
        </span>
      </div>
    </div>
  );
};
