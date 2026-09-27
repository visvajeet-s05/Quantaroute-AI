/**
 * Benchmark Presets for Controlled Experiment Workflow
 * QuantaRoute AI — Capstone
 */

import { BenchmarkPreset } from '../types/experiments';

export const BENCHMARK_PRESETS: BenchmarkPreset[] = [
  {
    id: 'normal_traffic_benchmark',
    label: 'Normal Traffic Benchmark',
    description:
      'Deterministic Normal Traffic scenario (seed 26137). Runs Greedy Routing, Classical PSO Balanced, and QPSO Balanced on cloned scenario copies to compare optimization quality.',
    scenarioPreset: 'normal',
    trafficProfile: 'normal',
    scenarioSeed: 26137,
    optimizerSeed: 26137,
    includeGreedy: true,
    includePso: true,
    includeQpso: true,
    psoPreset: 'Balanced',
    qpsoPreset: 'Balanced',
    isDynamicDemo: false,
  },
  {
    id: 'peak_traffic_benchmark',
    label: 'Peak Traffic Benchmark',
    description:
      'Deterministic Peak Traffic scenario (seed 26137). Runs Greedy Routing, Classical PSO Balanced, and QPSO Balanced on cloned scenario copies to compare route robustness under congestion.',
    scenarioPreset: 'peak',
    trafficProfile: 'peak',
    scenarioSeed: 26137,
    optimizerSeed: 26137,
    includeGreedy: true,
    includePso: true,
    includeQpso: true,
    psoPreset: 'Balanced',
    qpsoPreset: 'Balanced',
    isDynamicDemo: false,
  },
  {
    id: 'fast_reroute_demo',
    label: 'Fast Re-route Demonstration',
    description:
      'QPSO Balanced initial planning on Normal Traffic (seed 26137), then one stop simulated per vehicle, guided demo incident injected, and QPSO Fast Re-route applied. Records initial and dynamic re-routing metrics separately.',
    scenarioPreset: 'normal',
    trafficProfile: 'normal',
    scenarioSeed: 26137,
    optimizerSeed: 26137,
    includeGreedy: false,
    includePso: false,
    includeQpso: true,
    psoPreset: 'Balanced',
    qpsoPreset: 'Balanced',
    isDynamicDemo: true,
  },
];

export function getBenchmarkPreset(id: string): BenchmarkPreset | undefined {
  return BENCHMARK_PRESETS.find((p) => p.id === id);
}
