/**
 * Utilities for grouping experiment records into ExperimentGroupResult objects.
 */

import { ExperimentHistory, ExperimentGroupResult, InitialRoutingExperimentRecord, DynamicReroutingExperimentRecord } from '../types/experiments';

export type { ExperimentGroupResult };

export function experimentHistoryToGroups(history: ExperimentHistory): ExperimentGroupResult[] {
  const groups = new Map<string, ExperimentGroupResult>();

  for (const record of history) {
    const groupId = record.experimentGroupId;
    if (!groups.has(groupId)) {
      const records = history.filter((r) => r.experimentGroupId === groupId);
      const initialRecords = records.filter((r) => r.runType === 'initial_routing');
      const dynamicRecords = records.filter((r) => r.runType === 'dynamic_rerouting');
      const totalRuntime = records.reduce((sum, r) => {
        if (r.runType === 'initial_routing') return sum + r.runtimeMs;
        return sum;
      }, 0);
      const feasibleCount = records.filter(
        (r) => r.runType === 'initial_routing' && r.feasible
      ).length;
      const infeasibleCount = records.filter(
        (r) => r.runType === 'initial_routing' && !r.feasible
      ).length;
      const errorCount = records.filter((r) => r.error).length;

      const timestamps = records.map((r) => r.timestamp).sort();
      const startedAt = timestamps[0] || new Date().toISOString();
      const completedAt = timestamps[timestamps.length - 1] || new Date().toISOString();

      const presetId = (initialRecords[0] as InitialRoutingExperimentRecord | undefined)?.optimizerPreset || (dynamicRecords[0] as DynamicReroutingExperimentRecord | undefined)?.reroutingPreset || 'unknown';

      groups.set(groupId, {
        groupId,
        presetId,
        label: `Run ${groupId.slice(0, 8)}`,
        startedAt,
        completedAt,
        totalRuntimeMs: totalRuntime,
        totalRecords: records.length,
        feasibleCount,
        infeasibleCount,
        errorCount,
        records: [...records],
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt)
  );
}
