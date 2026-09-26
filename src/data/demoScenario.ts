import { Scenario, ScenarioPreset } from '../types/domain';
import { DEFAULT_SEED, generateScenario } from './scenarioGenerator';

export { DEFAULT_SEED } from './scenarioGenerator';

/**
 * Returns the deterministic default demo scenario
 */
export function getDefaultScenario(): Scenario {
  return generateScenario('normal', DEFAULT_SEED);
}

/**
 * Returns scenario by preset with seed
 */
export function getScenarioByPreset(preset: ScenarioPreset, seed: number = DEFAULT_SEED): Scenario {
  return generateScenario(preset, seed);
}
