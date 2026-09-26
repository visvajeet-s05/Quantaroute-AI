import { Scenario } from '../types/domain';
import { QpsoParticle, QpsoPreset, QpsoRunConfig, QpsoRunResult } from '../types/routing';
import { decodeRandomKeyParticleToRoutePlan } from '../services/randomKeyDecoder';
import { validateRoutePlan } from '../services/routePlanValidator';
import { SeededRandom } from '../utils/seededRandom';

export const QPSO_PRESETS: Record<QpsoPreset, Omit<QpsoRunConfig, 'seed' | 'presetName'>> = {
  'Fast Re-route': {
    populationSize: 15,
    iterations: 25,
    betaStart: 1.0,
    betaEnd: 0.5,
  },
  'Balanced': {
    populationSize: 25,
    iterations: 50,
    betaStart: 1.0,
    betaEnd: 0.5,
  },
  'High Quality': {
    populationSize: 35,
    iterations: 100,
    betaStart: 1.0,
    betaEnd: 0.5,
  },
};

export const DEFAULT_QPSO_SEED = 26137;

/**
 * Calculates coordinate-wise Mean-Best (mbest) vector across all particles' personal bests.
 * Mean-best formula:
 * mbest_j = (1 / Np) * Σ_i pbest_ij
 */
export function calculateMeanBest(
  particles: { personalBestAssignmentKeys: number[]; personalBestPriorityKeys: number[] }[],
  dimensionLength: number
): { mbestAssignment: number[]; mbestPriority: number[] } {
  const populationSize = particles.length;
  const mbestAssignment = new Array(dimensionLength).fill(0);
  const mbestPriority = new Array(dimensionLength).fill(0);

  if (populationSize === 0) {
    return { mbestAssignment, mbestPriority };
  }

  for (let i = 0; i < populationSize; i++) {
    const p = particles[i];
    for (let j = 0; j < dimensionLength; j++) {
      mbestAssignment[j] += p.personalBestAssignmentKeys[j] ?? 0;
      mbestPriority[j] += p.personalBestPriorityKeys[j] ?? 0;
    }
  }

  for (let j = 0; j < dimensionLength; j++) {
    mbestAssignment[j] /= populationSize;
    mbestPriority[j] /= populationSize;
  }

  return { mbestAssignment, mbestPriority };
}

/**
 * Single QPSO probabilistic coordinate update:
 * p_ij = φ_ij * pbest_ij + (1 - φ_ij) * gbest_j
 * x_ij(t + 1) = p_ij ± β(t) * |mbest_j - x_ij(t)| * ln(1 / u_ij)
 */
export function qpsoCoordinateUpdate(
  currentX: number,
  pbestX: number,
  gbestX: number,
  mbestX: number,
  beta: number,
  phi: number,
  u: number,
  sign: 1 | -1
): number {
  const attractor = phi * pbestX + (1 - phi) * gbestX;
  const safeU = Math.max(1e-12, Math.min(0.999999999, u));
  const distanceToMean = Math.abs(mbestX - currentX);
  const stepMagnitude = beta * distanceToMean * Math.log(1 / safeU);
  const rawNext = attractor + sign * stepMagnitude;
  return Math.max(0, Math.min(1, rawNext));
}

/**
 * Executes genuine Quantum-Inspired Particle Swarm Optimization (QPSO).
 *
 * Distinctive Properties:
 * 1. Zero velocity vectors (particles do not have or use velocity).
 * 2. Probabilistic sampling around local attractors based on mean-best personal bests.
 * 3. Logarithmic step: beta(t) * |mbest_j - x_ij(t)| * ln(1 / u).
 * 4. Continuous random keys decoded via shared decoder & shared capacity repair.
 */
export function runQuantumPso(
  scenario: Scenario,
  userConfig?: Partial<QpsoRunConfig>
): QpsoRunResult {
  const t0 = performance.now();

  const presetName: QpsoPreset = userConfig?.presetName || 'Balanced';
  const baseConfig = QPSO_PRESETS[presetName] || QPSO_PRESETS['Balanced'];

  const config: QpsoRunConfig = {
    ...baseConfig,
    ...userConfig,
    presetName,
    seed: userConfig?.seed ?? DEFAULT_QPSO_SEED,
  };

  const numCustomers = scenario.customers.length;
  const numParticles = config.populationSize;
  const maxIterations = config.iterations;

  // Deterministic seeded random stream derived from scenario seed + algorithm tag 'qpso' + run seed
  // 'QPSO' ascii: 0x5150534f
  const streamSeed = (scenario.seed ^ 0x5150534f ^ config.seed) >>> 0;
  const rng = new SeededRandom(streamSeed);

  // Shared travel time cache across decoding passes to maximize speed
  const travelTimeCache = new Map<string, number>();

  // 1. Initialize Particles (NO VELOCITIES)
  const particles: QpsoParticle[] = [];
  let gbestAssignmentKeys: number[] = [];
  let gbestPriorityKeys: number[] = [];
  let gbestPlan = decodeRandomKeyParticleToRoutePlan(
    new Array(numCustomers).fill(0),
    new Array(numCustomers).fill(0),
    scenario,
    'qpso',
    0,
    travelTimeCache
  );
  let gbestFitness = Infinity;

  for (let i = 0; i < numParticles; i++) {
    const assignmentKeys = new Array(numCustomers);
    const priorityKeys = new Array(numCustomers);

    for (let j = 0; j < numCustomers; j++) {
      assignmentKeys[j] = rng.nextFloat(0, 1);
      priorityKeys[j] = rng.nextFloat(0, 1);
    }

    const plan = decodeRandomKeyParticleToRoutePlan(
      assignmentKeys,
      priorityKeys,
      scenario,
      'qpso',
      0,
      travelTimeCache
    );
    const fitness = plan.routingScore;

    particles.push({
      assignmentKeys,
      priorityKeys,
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

  // 2. QPSO Main Iteration Loop
  for (let t = 0; t < maxIterations; t++) {
    // Linear beta schedule: beta(t) = betaStart - ((betaStart - betaEnd) * t / max(1, iterations - 1))
    const beta =
      maxIterations <= 1
        ? config.betaEnd
        : config.betaStart -
          ((config.betaStart - config.betaEnd) * t) / (maxIterations - 1);

    // Calculate coordinate-wise Mean-Best vectors from all particles' personal bests
    const { mbestAssignment, mbestPriority } = calculateMeanBest(particles, numCustomers);

    // Update each particle probabilistically
    for (let i = 0; i < numParticles; i++) {
      const p = particles[i];

      for (let j = 0; j < numCustomers; j++) {
        // --- Assignment Key Update ---
        const phiAssign = rng.next();
        const uAssign = rng.next();
        const signAssign: 1 | -1 = rng.next() < 0.5 ? 1 : -1;

        p.assignmentKeys[j] = qpsoCoordinateUpdate(
          p.assignmentKeys[j],
          p.personalBestAssignmentKeys[j],
          gbestAssignmentKeys[j],
          mbestAssignment[j],
          beta,
          phiAssign,
          uAssign,
          signAssign
        );

        // --- Priority Key Update ---
        const phiPrio = rng.next();
        const uPrio = rng.next();
        const signPrio: 1 | -1 = rng.next() < 0.5 ? 1 : -1;

        p.priorityKeys[j] = qpsoCoordinateUpdate(
          p.priorityKeys[j],
          p.personalBestPriorityKeys[j],
          gbestPriorityKeys[j],
          mbestPriority[j],
          beta,
          phiPrio,
          uPrio,
          signPrio
        );
      }

      // Decode and evaluate the updated QPSO particle
      const updatedPlan = decodeRandomKeyParticleToRoutePlan(
        p.assignmentKeys,
        p.priorityKeys,
        scenario,
        'qpso',
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
    betaStart: config.betaStart,
    betaEnd: config.betaEnd,
    validatorResult,
    config,
  };
}
