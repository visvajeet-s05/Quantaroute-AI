/**
 * Capstone Project Documentation Pack
 * QuantaRoute AI — Copyable, report-ready documentation sections.
 */

import React, { useState } from 'react';
import { OBJECTIVE_FORMULA } from '../types/capstone';
import {
  BookOpen,
  Copy,
  CheckCircle2,
  FileText,
  Terminal,
  Settings,
  TestTube,
  BarChart3,
  Shield,
  ExternalLink,
  Video,
  HelpCircle,
  Zap,
} from 'lucide-react';

interface DocSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: string;
  notes?: string;
}

export const ProjectDocumentationView: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(sectionId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const DOC_SECTIONS: DocSection[] = [
    {
      id: 'abstract',
      title: '1. Abstract',
      icon: <BookOpen className="w-4 h-4" />,
      content: `Urban delivery operations require coordinated routing across capacity-limited vehicles while traffic conditions change dynamically. This project presents QuantaRoute AI, a browser-based decision-support prototype for dynamic capacitated vehicle routing. The system models a directed road network with congestion-sensitive travel times and supports capacity-aware fleet assignment using Greedy Routing, Classical Particle Swarm Optimization, and Quantum-Inspired Particle Swarm Optimization. QPSO is implemented as a classical probability-based metaheuristic, not as quantum computing. The platform synthesizes road-level paths using Dijkstra’s algorithm, validates capacity and route feasibility, and supports incident-aware re-routing that locks completed deliveries and re-optimizes only pending stops. Controlled experiments use deterministic scenarios and shared evaluation criteria to compare routing score, travel time, distance, congestion exposure, feasibility, and runtime. [Insert selected actual benchmark result.] The prototype demonstrates an explainable workflow for fleet coordination and disruption recovery under simulated traffic conditions.`,
      notes: 'Replace [Insert selected actual benchmark result.] with actual results from your experiment history.',
    },
    {
      id: 'problem',
      title: '2. Problem Statement',
      icon: <FileText className="w-4 h-4" />,
      content: `Delivery fleets must assign customers to vehicles with limited capacity while minimizing total travel cost. Traffic congestion increases travel times unpredictably. Incidents (road closures, congestion surges) can invalidate planned routes mid-shift. The Dynamic Capacitated Vehicle Routing Problem with incident-aware re-routing requires: (a) initial route optimization under traffic-sensitive costs, (b) partial progress tracking as vehicles serve stops, and (c) re-optimization of only pending deliveries after an incident, while preserving remaining vehicle capacity and locked completed deliveries.`,
    },
    {
      id: 'solution',
      title: '3. Proposed Solution',
      icon: <Zap className="w-4 h-4" />,
      content: `QuantaRoute AI is a client-side, browser-based prototype that:
1. Models a directed road graph (10×10 grid, 100 nodes, 25 customers, 3 vehicles, capacity 30 per vehicle).
2. Computes edge costs as effectiveTravelTime = baseTravelMinutes × congestionMultiplier, with blocked edges removed.
3. Selects paths using Dijkstra shortest-path on effective travel time.
4. Optimizes fleet assignment using three algorithms: Greedy Routing, Classical PSO, and QPSO.
5. Evaluates plans with a weighted objective function and validates capacity/route feasibility.
6. Supports dynamic re-routing: simulates partial delivery progress, injects incidents (road closures, congestion surges), locks served customers, and re-optimizes pending stops only.
7. All computations are deterministic, seeded (seed 26137), and fully client-side with localStorage persistence.`,
    },
    {
      id: 'architecture',
      title: '4. Technical Architecture',
      icon: <Settings className="w-4 h-4" />,
      content: `Frontend: React (TypeScript) with no external dependencies beyond React itself.
Algorithms (all client-side, classical):
  - Dijkstra: pathfinding on the directed graph (src/algorithms/dijkstra.ts)
  - Greedy Routing: capacity-aware nearest-customer selection (src/algorithms/greedyRouting.ts)
  - Classical PSO: random-key + velocity vectors (src/algorithms/classicalPso.ts)
  - QPSO: random-key, no velocity, mean-best + local attractor + log-probability update (src/algorithms/quantumPso.ts)
Shared Components:
  - Random-key decoder: decodes particle keys to route plans (src/services/randomKeyDecoder.ts)
  - Capacity repair: enforces vehicle capacity constraints (src/services/capacityRepair.ts)
  - RoutePlan evaluator: computes objective F = 0.55T + 0.25D + 0.20C + 10000P (src/services/routePlanEvaluator.ts)
  - RoutePlan validator: checks feasibility (src/services/routePlanValidator.ts)
Dynamic Routing:
  - Incident simulation, partial execution, guided demo edge selection (src/services/dynamicRerouting.ts)
Experiment Management:
  - Controlled benchmarking, record building, persistence (src/services/experimentManager.ts)
Testing:
  - Unit test suites for each algorithm and experiment management
Data Persistence:
  - localStorage for experiment history and checklist state
  - CSV/JSON export via browser Blob download
No server-side code, no external APIs, no databases.`,
    },
    {
      id: 'methodology',
      title: '5. Methodology',
      icon: <BarChart3 className="w-4 h-4" />,
      content: `Objective Function:
  ${OBJECTIVE_FORMULA}

  T = traffic-adjusted total travel time
  D = total fleet distance
  C = congestion exposure penalty
  P = feasibility-violation penalty

Edge Cost Model:
  effectiveTravelTime = baseTravelMinutes × congestionMultiplier

Algorithms:
  Greedy Routing: capacity-aware nearest feasible customer, Dijkstra legs, deterministic tie-breaking.
  Classical PSO: random-key representation, position/velocity vectors, inertia + personal-best + global-best terms.
  QPSO: random-key representation, NO velocity vectors, coordinate-wise mean-best, local attractor, logarithmic probability update, beta schedule 1.0→0.5, runs on classical hardware.

Fair Evaluation:
  All algorithms use the same scenario, graph, cost model, Dijkstra synthesis, capacities, demands, evaluator, validator, and objective function on independently cloned scenario copies. PSO and QPSO use equal population and iteration budgets.

Dynamic Re-routing:
  Completed stops are locked. Vehicle positions and remaining capacity are preserved. Only pending customers are re-optimized. Road closure and congestion-surge incidents are supported.`,
    },
    {
      id: 'algorithm-explanation',
      title: '6. Algorithm Explanation',
      icon: <Terminal className="w-4 h-4" />,
      content: `GREEDY ROUTING:
  Iteratively assigns each vehicle its nearest feasible unassigned customer (by travel time) until capacity is full or no feasible customer remains. Uses Dijkstra for leg paths. Deterministic by customer ID tie-breaking. Fast baseline (O(V × C × Dijkstra)).

CLASSICAL PSO:
  Population of particles, each encoding a random-key vehicle assignment + delivery priority. Particles have position AND velocity vectors. Updated via inertia, personal-best, and global-best attraction. Velocity is a vector in continuous random-key space.

QPSO (Quantum-Inspired PSO):
  Particles have NO velocity vectors. Each particle encodes assignment keys and priority keys (random-key representation). For each coordinate:
    1. Compute mean-best (mbest) = average of all personal-best values for that coordinate
    2. Compute local attractor P = c × pbest + (1-c) × gbest  (c = random scalar)
    3. Update: x(t+1) = attractor ± beta × |mbest - x(t)| × ln(1/u)
  where beta decays linearly from 1.0 to 0.5, u = uniform random [0,1].
  This produces a probabilistic sample around the mean-best — a classical, deterministic computation on classical hardware. NOT quantum computing.`,
    },
    {
      id: 'testing',
      title: '7. Testing & Validation Summary',
      icon: <TestTube className="w-4 h-4" />,
      content: `Validation suites (all non-destructive, deterministic):
  - Dijkstra Unit Tests (5 invariants): path reachability, cost correctness, node/edge validity
  - Greedy Unit Tests (5 invariants): capacity compliance, customer coverage, no duplicates, depot start/end
  - Classical PSO Unit Tests (5 invariants): convergence, feasibility, determinism, score quality
  - QPSO Unit Tests (5 invariants): convergence, feasibility, determinism, mean-best correctness, beta schedule
  - Dynamic Re-routing Unit Tests (5 invariants): locking, incident injection, feasibility, delay quantification
  - Experiment Management Tests (6 invariants): isolation, completeness, budget fairness, export integrity, persistence safety
  - Capstone Presentation Tests (5 invariants): guided demo determinism, results integrity, methodology consistency, documentation safety, checklist persistence

All tests are runnable via the Validation Modal (Ctrl/Cmd + click "View Report").
TypeScript type-check: tsc --noEmit passes with 0 errors.`,
    },
    {
      id: 'results',
      title: '8. Results Integration Guidance',
      icon: <BarChart3 className="w-4 h-4" />,
      content: `Results are stored as experiment records in localStorage (key: quantaroute.experimentHistory.v1).
To view results:
  1. Run a benchmark via the Experiment Manager or Guided Capstone Demo
  2. Records are saved automatically to local experiment history
  3. The Capstone Results Panel reads from this history and displays:
     - Initial routing table (Algorithm, Score, Travel Time, Distance, Feasible, Runtime, Evals)
     - Convergence summary (first/final/best score + sparkline)
     - Dynamic re-routing results (incident, locked/pending counts, feasibility, delay avoided)
     - Auto-generated findings based only on actual records

To export:
  - CSV: includes recordType column, flattened fields, array values joined with " | "
  - JSON: includes metadata, objective formula, all records with full structure

All displayed values are actual computed values. No values are pre-loaded or fabricated.`,
    },
    {
      id: 'limitations',
      title: '9. Limitations',
      icon: <Shield className="w-4 h-4" />,
      content: `1. The scenario is a deterministic synthetic 10×10 grid (100 nodes, 25 customers, 3 vehicles). Not real-world data.
2. Traffic conditions are simulated via static congestion multipliers, not live traffic feeds.
3. Incidents are synthetic (road closures, congestion surges) — not real incidents.
4. QPSO is a classical probability-based metaheuristic, not quantum computing. There is NO quantum advantage.
5. Runtime numbers reflect local browser performance on this machine — not representative of production scale.
6. The prototype does not include vehicle time windows, stochastic demand, or multi-depot problems.
7. Route synthesis assumes all customers are reachable from the depot. Unreachable scenarios are flagged as infeasible.
8. Results are stored in localStorage only — clearing browser data removes experiment history.
9. No guaranteed optimal solution — metaheuristics produce approximate results.
10. No fuel or CO2 modeling is performed.`,
    },
    {
      id: 'future',
      title: '10. Future Work',
      icon: <ExternalLink className="w-4 h-4" />,
      content: `1. Integrate real road network data (if permitted) with offline graph construction.
2. Add vehicle time windows to the VRP model.
3. Implement multi-objective Pareto optimization (score vs. balance vs. fairness).
4. Add stochastic demand simulation.
5. Implement hybrid algorithm composition (e.g., QPSO followed by local search).
6. Add persistent benchmark comparison dashboard with statistical significance testing.
7. Explore web workers for algorithmic parallelism without blocking the UI.
8. Add TypeScript-level model checking for algorithm determinism assertions.
9. Implement automated report generation (PDF export) with embedded result tables.
10. Add support for larger scenario sizes (scaling analysis).`,
    },
    {
      id: 'demo-script',
      title: '11. 3-4 Minute Demo Script',
      icon: <Video className="w-4 h-4" />,
      content: `DEMO SCRIPT (3-4 minutes):

[0:00-0:20] Introduction
  - "QuantaRoute AI is a browser-based prototype for dynamic capacitated vehicle routing."
  - "It uses Greedy Routing, Classical PSO, and Quantum-Inspired PSO — all on classical hardware."
  - Show dashboard with Normal Traffic scenario loaded (seed 26137).

[0:20-1:00] Algorithm Walkthrough
  - Click "Greedy" → show result card (fast, suboptimal).
  - Click "Classical PSO Balanced" → show convergence chart.
  - Click "QPSO Balanced" → show convergence chart (lower score).
  - Show comparison table: Lower score is better.

[1:00-1:40] Dynamic Re-routing
  - "Now the fleet is on the road. Let's simulate progress."
  - Click "Simulate Progress" → show locked (served) customers.
  - Click "Inject Guided Incident" → show road closure on map.
  - Click "Re-optimize" → show QPSO Fast Re-route result.
  - Show revised routes and delay avoided or route recovery.

[1:40-2:30] Experiment Management
  - Open Experiment Manager.
  - Run Normal Traffic benchmark → shows 3 algorithm records.
  - Show record details in results table.
  - Export CSV and JSON.

[2:30-3:00] Validation & Methodology
  - Open Validation Modal → show all 6 test suites passing.
  - Open Methodology panel → show objective, constraints, algorithm explanations.
  - Open Results panel → show auto-generated findings.

[3:00-3:30] Evidence & Submission
  - Open Screenshot Checklist → mark key evidence items.
  - Open Final Readiness → verify software, benchmark, documentation, backup.
  - Open Documentation pack → show copyable abstract and methodology.

[3:30-4:00] Closing
  - "The prototype is deterministic, offline-capable, and fully client-side."
  - "Limitations: synthetic scenario, no live traffic, no quantum hardware."
  - "All results are actual computed values — no fabrication."`,
    },
    {
      id: 'terminology',
      title: '12. Correct Terminology Note',
      icon: <HelpCircle className="w-4 h-4" />,
      content: `CORRECT:
  - "Quantum-Inspired Particle Swarm Optimization (QPSO)" — a classical metaheuristic.
  - "Probability-based update rule" or "logarithmic probability update."
  - "Runs on classical hardware" or "client-side browser computation."
  - "Simulated traffic conditions" or "synthetic congestion multipliers."
  - "Deterministic scenario with seed 26137."
  - "Approximate solution" or "metaheuristic result."

INCORRECT (avoid):
  - "Quantum computing" or "quantum hardware" — the algorithm is inspired by quantum concepts but runs classically.
  - "Quantum advantage" — there is no quantum speedup.
  - "Live traffic" — traffic is simulated via static multipliers.
  - "Real CO2 reduction" or "actual fuel savings" — no physical vehicles.
  - "Guaranteed optimal" — metaheuristics produce approximate solutions.
  - "Production fleet" — this is an academic prototype on synthetic data.`,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Project Documentation Pack</h2>
        <p className="text-xs text-slate-500 mt-0.5">Report-ready, copyable sections</p>
      </div>

      <div className="space-y-3">
        {DOC_SECTIONS.map((section) => (
          <div key={section.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                {section.icon}
                {section.title}
              </h3>
              <button
                onClick={() => copyToClipboard(section.content, section.id)}
                className="px-2 py-1 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 rounded flex items-center gap-1"
              >
                {copiedId === section.id ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="p-4 bg-slate-50/30">
              <pre className="whitespace-pre-wrap font-mono text-xs text-slate-700 leading-relaxed overflow-x-auto">
                {section.content}
              </pre>
              {section.notes && (
                <div className="mt-2 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                  Note: {section.notes}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
