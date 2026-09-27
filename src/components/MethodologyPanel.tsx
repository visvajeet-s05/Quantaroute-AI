/**
 * Capstone Methodology Panel
 * QuantaRoute AI — Report-ready methodology documentation.
 */

import React from 'react';
import { OBJECTIVE_FORMULA } from '../types/capstone';
import { Target, Network, Navigation, BarChart3, Zap, Database, Shield, Repeat, FileCheck } from 'lucide-react';

export const MethodologyPanel: React.FC = () => {
  return (
    <div className="space-y-6 text-sm text-slate-700">
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Capstone Methodology</h2>
        <p className="text-xs text-slate-500">QuantaRoute AI — Smart India Hackathon Prototype</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        {/* 1. Problem Formulation */}
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Target className="w-4 h-4 text-cyan-600" />
            Problem Formulation
          </h3>
          <p className="text-slate-600 leading-relaxed">
            Dynamic Capacitated Vehicle Routing Problem with traffic-sensitive road costs and incident-aware re-routing.
          </p>
        </div>

        {/* 2. Input Model */}
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Network className="w-4 h-4 text-cyan-600" />
            Input Model
          </h3>
          <ul className="list-disc list-inside text-slate-600 space-y-1 ml-2">
            <li>Directed road graph (10×10 grid, 100 nodes)</li>
            <li>One depot (Central Hub)</li>
            <li>25 customer locations</li>
            <li>Three vehicles</li>
            <li>Capacity: 30 units per vehicle</li>
            <li>Customer demand: 1–6 units</li>
            <li>Congestion multipliers on edges</li>
            <li>Road closure and congestion-surge incidents</li>
          </ul>
        </div>

        {/* 3. Edge Cost Model */}
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Navigation className="w-4 h-4 text-cyan-600" />
            Edge Cost Model
          </h3>
          <div className="bg-slate-50 rounded-lg p-3 font-mono text-sm text-slate-800">
            effectiveTravelTime = baseTravelMinutes × congestionMultiplier
          </div>
          <ul className="list-disc list-inside text-slate-600 space-y-1 ml-2">
            <li>Blocked roads are unavailable (edges removed from pathfinding)</li>
            <li>Dijkstra selects minimum effective travel time paths</li>
            <li>Physical distance is tracked separately for the objective function</li>
          </ul>
        </div>

        {/* 4. Fleet Objective */}
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <BarChart3 className="w-4 h-4 text-cyan-600" />
            Fleet Objective
          </h3>
          <div className="bg-slate-50 rounded-lg p-3 font-mono text-sm text-slate-800">
            {OBJECTIVE_FORMULA}
          </div>
          <ul className="list-disc list-inside text-slate-600 space-y-1 ml-2">
            <li>T = traffic-adjusted total travel time</li>
            <li>D = total fleet distance</li>
            <li>C = congestion exposure penalty</li>
            <li>P = feasibility-violation penalty (per violation)</li>
          </ul>
        </div>

        {/* 5. Constraints */}
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Shield className="w-4 h-4 text-cyan-600" />
            Constraints
          </h3>
          <ul className="list-disc list-inside text-slate-600 space-y-1 ml-2">
            <li>Every customer assigned at most once</li>
            <li>Vehicle capacity must not be exceeded</li>
            <li>Initial routes begin/end at depot</li>
            <li>Re-routing starts from vehicle current node and ends at depot</li>
            <li>Blocked edges cannot be traversed</li>
            <li>Served customers remain locked</li>
            <li>Unserved customers remain visible for reassignment</li>
          </ul>
        </div>

        {/* 6. Algorithms */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Zap className="w-4 h-4 text-cyan-600" />
            Algorithms
          </h3>

          <div className="space-y-2">
            <h4 className="font-medium text-slate-800">Greedy Routing</h4>
            <ul className="list-disc list-inside text-slate-600 space-y-1 ml-2">
              <li>Capacity-aware nearest feasible customer selection</li>
              <li>Dijkstra leg routing between stops</li>
              <li>Deterministic tie-breaking by customer ID</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-slate-800">Classical PSO</h4>
            <ul className="list-disc list-inside text-slate-600 space-y-1 ml-2">
              <li>Random-key vehicle assignment/order representation</li>
              <li>Position and velocity vectors with inertia term</li>
              <li>Personal-best and global-best attraction terms</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-slate-800">Quantum-Inspired PSO (QPSO)</h4>
            <ul className="list-disc list-inside text-slate-600 space-y-1 ml-2">
              <li>Random-key representation</li>
              <li>No velocity vectors</li>
              <li>Coordinate-wise mean-best computation</li>
              <li>Local attractor from personal best and global best</li>
              <li>Logarithmic probability update: step = beta × |mbest − x| × ln(1/u)</li>
              <li>Beta schedule: 1.0 to 0.5 (linear decay)</li>
              <li>Runs on classical hardware — implemented as a probability-based metaheuristic</li>
            </ul>
          </div>
        </div>

        {/* 7. Fair Evaluation */}
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <FileCheck className="w-4 h-4 text-cyan-600" />
            Fair Evaluation
          </h3>
          <p className="text-slate-600 leading-relaxed">
            All algorithms use the same scenario, directed graph, traffic cost model, Dijkstra route synthesis,
            vehicle capacities, customer demands, capacity repair, RoutePlan evaluator, feasibility validator,
            and objective function on independently cloned scenario copies.
          </p>
          <p className="text-slate-600">
            Classical PSO and QPSO use equal population and iteration budgets for direct comparison.
          </p>
        </div>

        {/* 8. Dynamic Re-routing */}
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Repeat className="w-4 h-4 text-cyan-600" />
            Dynamic Re-routing
          </h3>
          <ul className="list-disc list-inside text-slate-600 space-y-1 ml-2">
            <li>Completed stops are locked and excluded from re-optimization</li>
            <li>Vehicle current positions are preserved</li>
            <li>Remaining capacity per vehicle is preserved</li>
            <li>Only pending (unserved) customers are re-optimized</li>
            <li>Road closure and congestion-surge incidents are supported</li>
          </ul>
        </div>

        {/* 9. Reproducibility */}
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Database className="w-4 h-4 text-cyan-600" />
            Reproducibility
          </h3>
          <ul className="list-disc list-inside text-slate-600 space-y-1 ml-2">
            <li>Deterministic scenario seed: 26137</li>
            <li>Seeded random number generation for all stochastic algorithms</li>
            <li>Validation test suites (Dijkstra, Greedy, PSO, QPSO, Re-routing, Experiments)</li>
            <li>CSV/JSON export of experiment records</li>
            <li>Local experiment history (localStorage)</li>
            <li>Client-side, offline-capable application</li>
          </ul>
        </div>

        <div className="border-t border-slate-200 pt-4 text-xs text-slate-500">
          The prototype does not use live traffic APIs, quantum hardware, external services, or authenticated user data.
          All computations are deterministic and reproducible on classical hardware.
        </div>
      </div>
    </div>
  );
};
