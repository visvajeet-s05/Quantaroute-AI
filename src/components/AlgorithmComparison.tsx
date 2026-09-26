import React from 'react';
import { Layers, Info, CheckCircle2 } from 'lucide-react';
import { PsoRunResult, QpsoRunResult, RoutePlan } from '../types/routing';

interface AlgorithmComparisonProps {
  greedyPlan?: RoutePlan | null;
  psoResult?: PsoRunResult | null;
  qpsoResult?: QpsoRunResult | null;
}

export const AlgorithmComparison: React.FC<AlgorithmComparisonProps> = ({
  greedyPlan,
  psoResult,
  qpsoResult,
}) => {
  const isGreedyEvaluated = Boolean(greedyPlan);
  const isPsoEvaluated = Boolean(psoResult && psoResult.bestPlan);
  const isQpsoEvaluated = Boolean(qpsoResult && qpsoResult.bestPlan);

  const psoPlan = psoResult?.bestPlan;
  const qpsoPlan = qpsoResult?.bestPlan;

  const algorithms = [
    {
      name: 'Greedy Routing',
      type: 'Heuristic Baseline',
      score: isGreedyEvaluated ? greedyPlan!.routingScore.toFixed(2) : 'Not run',
      travelTime: isGreedyEvaluated ? `${greedyPlan!.totalTravelMinutes.toFixed(1)} min` : 'Not run',
      distance: isGreedyEvaluated ? `${greedyPlan!.totalDistanceKm.toFixed(1)} km` : 'Not run',
      feasible: isGreedyEvaluated ? (greedyPlan!.isFeasible ? 'Feasible' : 'Infeasible') : 'Not run',
      runtime: isGreedyEvaluated ? `${greedyPlan!.runtimeMs.toFixed(2)} ms` : 'Not run',
      status: isGreedyEvaluated ? 'Completed' : 'Waiting for evaluation',
      statusColor: isGreedyEvaluated
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold'
        : 'bg-slate-100 text-slate-600 border-slate-200',
    },
    {
      name: 'Classical PSO',
      type: 'Continuous Metaheuristic',
      score: isPsoEvaluated ? psoPlan!.routingScore.toFixed(2) : 'Not run',
      travelTime: isPsoEvaluated ? `${psoPlan!.totalTravelMinutes.toFixed(1)} min` : 'Not run',
      distance: isPsoEvaluated ? `${psoPlan!.totalDistanceKm.toFixed(1)} km` : 'Not run',
      feasible: isPsoEvaluated ? (psoPlan!.isFeasible ? 'Feasible' : 'Infeasible') : 'Not run',
      runtime: isPsoEvaluated ? `${psoResult!.runtimeMs.toFixed(2)} ms` : 'Not run',
      status: isPsoEvaluated ? 'Completed' : 'Waiting for evaluation',
      statusColor: isPsoEvaluated
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold'
        : 'bg-slate-100 text-slate-600 border-slate-200',
    },
    {
      name: 'Quantum-Inspired PSO',
      type: 'Mean-Best Attractor Metaheuristic',
      score: isQpsoEvaluated ? qpsoPlan!.routingScore.toFixed(2) : 'Not run',
      travelTime: isQpsoEvaluated ? `${qpsoPlan!.totalTravelMinutes.toFixed(1)} min` : 'Not run',
      distance: isQpsoEvaluated ? `${qpsoPlan!.totalDistanceKm.toFixed(1)} km` : 'Not run',
      feasible: isQpsoEvaluated ? (qpsoPlan!.isFeasible ? 'Feasible' : 'Infeasible') : 'Not run',
      runtime: isQpsoEvaluated ? `${qpsoResult!.runtimeMs.toFixed(2)} ms` : 'Not run',
      status: isQpsoEvaluated ? 'Completed' : 'Waiting for evaluation',
      statusColor: isQpsoEvaluated
        ? 'bg-teal-50 text-teal-800 border-teal-300 font-semibold'
        : 'bg-slate-100 text-slate-600 border-slate-200',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm text-slate-800">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-600" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
            Algorithm Benchmark Comparison
          </h2>
        </div>
        <span className="text-xs text-slate-400">
          Standardized objective function & capacity constraints
        </span>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
              <th className="py-2.5 px-3">Algorithm</th>
              <th className="py-2.5 px-3">Routing Score</th>
              <th className="py-2.5 px-3">Total Travel Time</th>
              <th className="py-2.5 px-3">Distance</th>
              <th className="py-2.5 px-3">Feasible</th>
              <th className="py-2.5 px-3">Runtime</th>
              <th className="py-2.5 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {algorithms.map((algo, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="py-3 px-3 font-semibold text-slate-800">
                  <div className="flex flex-col">
                    <span>{algo.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal">{algo.type}</span>
                  </div>
                </td>
                <td className="py-3 px-3 font-mono text-slate-500">{algo.score}</td>
                <td className="py-3 px-3 font-mono text-slate-500">{algo.travelTime}</td>
                <td className="py-3 px-3 font-mono text-slate-500">{algo.distance}</td>
                <td className="py-3 px-3 text-slate-500">{algo.feasible}</td>
                <td className="py-3 px-3 font-mono text-slate-500">{algo.runtime}</td>
                <td className="py-3 px-3 text-right">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[11px] border ${algo.statusColor}`}
                  >
                    {algo.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Information Note below the table required by prompt */}
      <div className="mt-3 flex items-start gap-2 bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 text-[11px] text-slate-600">
        <Info className="w-3.5 h-3.5 shrink-0 text-slate-500 mt-0.5" />
        <span>
          All algorithms will later use the same objective function, traffic graph, vehicle capacities, and feasibility checks for fair comparison.
        </span>
      </div>
    </div>
  );
};
