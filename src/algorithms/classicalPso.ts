import { Scenario } from '../types/domain';
import { PsoParticle, PsoPreset, PsoRunConfig, PsoRunResult } from '../types/routing';
import { decodeRandomKeyParticleToRoutePlan } from '../services/randomKeyDecoder';
import { validateRoutePlan } from '../services/routePlanValidator';
import { SeededRandom } from '../utils/seededRandom';

export const PSO_PRESETS: Record<PsoPreset, Omit<PsoRunConfig, 'seed' | 'presetName'>> = {
  'Fast Re-route': {
    populationSize: 15,
    iterations: 25,
    inertiaStart: 0.9,
    inertiaEnd: 0.4,
    cognitiveCoefficient: 1.7,
    socialCoefficient: 1.7,
  },
  'Balanced': {
    populationSize: 25,
    iterations: 50,
    inertiaStart: 0.9,
    inertiaEnd: 0.4,
    cognitiveCoefficient: 1.7,
    socialCoefficient: 1.7,
  },
  'High Quality': {
    populationSize: 35,
    iterations: 100,
    inertiaStart: 0.9,
    inertiaEnd: 0.4,
    cognitiveCoefficient: 1.7,
    socialCoefficient: 1.7,
  },
};

export const DEFAULT_PSO_SEED = 26137;

/**
 * Executes Classical Particle Swarm Optimization (PSO) for multi-vehicle routing.
 *
 * Continuous random-key representation:
 * - assignmentKeys (length N): determines vehicle assignment [0, 1]
 * - priorityKeys (length N): determines customer order within vehicle [0, 1]
 * - assignmentVelocity / priorityVelocity: clamped to [-0.5, 0.5]
 *
 * Update rule:
 * v_ij(t+1) = w(t)*v_ij(t) + c1*r1*(pbest_ij - x_ij(t)) + c2*r2*(gbest_j - x_ij(t))
 * x_ij(t+1) = clamp(x_ij(t) + v_ij(t+1), 0, 1)
 */
export function runClassicalPso(
  scenario: Scenario,
  userConfig?: Partial<PsoRunConfig>
): PsoRunResult {
  const t0 = performance.now();

  const presetName: PsoPreset = userConfig?.presetName || 'Balanced';
  const baseConfig = PSO_PRESETS[presetName] || PSO_PRESETS['Balanced'];

  const config: PsoRunConfig = {
    ...baseConfig,
    ...userConfig,
    presetName,
    seed: userConfig?.seed ?? DEFAULT_PSO_SEED,
  };

  const numCustomers = scenario.customers.length;
  const numParticles = config.populationSize;
  const maxIterations = config.iterations;

  // Deterministic seeded random stream derived from scenario seed + algorithm tag + run seed
  // 'PSO' in ascii: 0x50534f
  const streamSeed = (scenario.seed ^ 0x50534f ^ config.seed) >>> 0;
  const rng = new SeededRandom(streamSeed);

  // Shared travel time cache across decoding passes to maximize execution speed
  const travelTimeCache = new Map<string, number>();

  // 1. Initialize Particles
  const particles: PsoParticle[] = [];
  let gbestAssignmentKeys: number[] = [];
  let gbestPriorityKeys: number[] = [];
  let gbestPlan = decodeRandomKeyParticleToRoutePlan(
    new Array(numCustomers).fill(0),
    new Array(numCustomers).fill(0),
    scenario,
    'pso',
    0,
    travelTimeCache
  );
  let gbestFitness = Infinity;

  for (let i = 0; i < numParticles; i++) {
    const assignmentKeys = new Array(numCustomers);
    const priorityKeys = new Array(numCustomers);
    const assignmentVelocity = new Array(numCustomers);
    const priorityVelocity = new Array(numCustomers);

    for (let j = 0; j < numCustomers; j++) {
      assignmentKeys[j] = rng.nextFloat(0, 1);
      priorityKeys[j] = rng.nextFloat(0, 1);
      assignmentVelocity[j] = rng.nextFloat(-0.2, 0.2);
      priorityVelocity[j] = rng.nextFloat(-0.2, 0.2);
    }

    const plan = decodeRandomKeyParticleToRoutePlan(
      assignmentKeys,
      priorityKeys,
      scenario,
      'pso',
      0,
      travelTimeCache
    );
    const fitness = plan.routingScore;

    particles.push({
      assignmentKeys,
      priorityKeys,
      assignmentVelocity,
      priorityVelocity,
      currentPlan: plan,
      currentFitness: fitness,
      personalBestAssignmentKeys: [...assignmentKeys],
      personalBestPriorityKeys: [...priorityKeys],
      personalBestPlan: plan,
      personalBestFitness: fitness,
    });

    if (fitness < gbestFitness) {
      gbestFitness = fitness;
      gbestAssignmentKeys = [...assignmentKeys];
      gbestPriorityKeys = [...priorityKeys];
      gbestPlan = plan;
    }
  }

  // Record initial global best fitness (iteration 0)
  const convergenceHistory: number[] = [Number(gbestFitness.toFixed(4))];

  // 2. PSO Main Iteration Loop
  for (let t = 0; t < maxIterations; t++) {
    // Linearly decreasing inertia weight w(t)
    const inertia =
      maxIterations <= 1
        ? config.inertiaEnd
        : config.inertiaStart -
          ((config.inertiaStart - config.inertiaEnd) * t) / (maxIterations - 1);

    for (let i = 0; i < numParticles; i++) {
      const p = particles[i];

      for (let j = 0; j < numCustomers; j++) {
        // Update Assignment Keys
        const r1Assign = rng.next();
        const r2Assign = rng.next();
        const cognitiveAssign =
          config.cognitiveCoefficient * r1Assign * (p.personalBestAssignmentKeys[j] - p.assignmentKeys[j]);
        const socialAssign =
          config.socialCoefficient * r2Assign * (gbestAssignmentKeys[j] - p.assignmentKeys[j]);

        let vAssign = inertia * p.assignmentVelocity[j] + cognitiveAssign + socialAssign;
        // Bounded velocity clamp [-0.5, 0.5]
        vAssign = Math.max(-0.5, Math.min(0.5, vAssign));
        p.assignmentVelocity[j] = vAssign;

        let xAssign = p.assignmentKeys[j] + vAssign;
        // Position clamp [0, 1]
        xAssign = Math.max(0, Math.min(1, xAssign));
        p.assignmentKeys[j] = xAssign;

        // Update Priority Keys
        const r1Prio = rng.next();
        const r2Prio = rng.next();
        const cognitivePrio =
          config.cognitiveCoefficient * r1Prio * (p.personalBestPriorityKeys[j] - p.priorityKeys[j]);
        const socialPrio =
          config.socialCoefficient * r2Prio * (gbestPriorityKeys[j] - p.priorityKeys[j]);

        let vPrio = inertia * p.priorityVelocity[j] + cognitivePrio + socialPrio;
        // Bounded velocity clamp [-0.5, 0.5]
        vPrio = Math.max(-0.5, Math.min(0.5, vPrio));
        p.priorityVelocity[j] = vPrio;

        let xPrio = p.priorityKeys[j] + vPrio;
        // Position clamp [0, 1]
        xPrio = Math.max(0, Math.min(1, xPrio));
        p.priorityKeys[j] = xPrio;
      }

      // Decode updated particle
      const updatedPlan = decodeRandomKeyParticleToRoutePlan(
        p.assignmentKeys,
        p.priorityKeys,
        scenario,
        'pso',
        0,
        travelTimeCache
      );
      const updatedFitness = updatedPlan.routingScore;

      p.currentPlan = updatedPlan;
      p.currentFitness = updatedFitness;

      // Update personal best
      if (updatedFitness < p.personalBestFitness) {
        p.personalBestFitness = updatedFitness;
        p.personalBestPlan = updatedPlan;
        p.personalBestAssignmentKeys = [...p.assignmentKeys];
        p.personalBestPriorityKeys = [...p.priorityKeys];

        // Update global best
        if (updatedFitness < gbestFitness) {
          gbestFitness = updatedFitness;
          gbestAssignmentKeys = [...p.assignmentKeys];
          gbestPriorityKeys = [...p.priorityKeys];
          gbestPlan = updatedPlan;
        }
      }
    }

    convergenceHistory.push(Number(gbestFitness.toFixed(4)));
  }

  const t1 = performance.now();
  const runtimeMs = Number((t1 - t0).toFixed(3));

  // Attach final runtime to the best plan
  const finalBestPlan: typeof gbestPlan = {
    ...gbestPlan,
    runtimeMs,
  };

  const validatorResult = validateRoutePlan(finalBestPlan, scenario);
  const candidateEvaluations = numParticles * (maxIterations + 1);

  return {
    bestPlan: finalBestPlan,
    bestFitness: gbestFitness,
    convergenceHistory,
    populationSize: numParticles,
    iterationsCompleted: maxIterations,
    candidateEvaluations,
    runtimeMs,
    seed: config.seed,
    validatorResult,
    config,
  };
}
