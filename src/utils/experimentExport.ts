/**
 * Export utilities for experiment history.
 * Browser-only CSV and JSON generation using Blob + URL.createObjectURL.
 */

import { ExperimentRecord } from '../types/experiments';

const DELIMITER = ' | ';

function formatCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return `"${value.map(String).join(DELIMITER)}"`;
  }
  if (typeof value === 'string') {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
  if (typeof value === 'object') {
    return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
  }
  return String(value);
}

function flattenRecord(rec: ExperimentRecord): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: rec.id,
    timestamp: rec.timestamp,
    experimentGroupId: rec.experimentGroupId,
    recordType: rec.runType,
  };

  if (rec.runType === 'initial_routing') {
    return {
      ...base,
      scenarioId: rec.scenarioId,
      scenarioName: rec.scenarioName,
      scenarioSeed: rec.scenarioSeed,
      trafficProfile: rec.trafficProfile,
      algorithm: rec.algorithm,
      algorithmLabel: rec.algorithmLabel,
      optimizerPreset: rec.optimizerPreset,
      optimizerSeed: rec.optimizerSeed,
      populationSize: rec.populationSize,
      iterations: rec.iterations,
      candidateEvaluations: rec.candidateEvaluations,
      runtimeMs: rec.runtimeMs,
      totalTravelMinutes: rec.totalTravelMinutes,
      totalDistanceKm: rec.totalDistanceKm,
      congestionPenalty: rec.congestionPenalty,
      routingScore: rec.routingScore,
      customersAssigned: rec.customersAssigned,
      customersUnserved: rec.customersUnserved,
      customerCount: rec.customerCount,
      vehiclesUsed: rec.vehiclesUsed,
      vehicleCapacityTotal: rec.vehicleCapacityTotal,
      capacityViolationCount: rec.capacityViolationCount,
      duplicateCustomerCount: rec.duplicateCustomerCount,
      blockedEdgeViolationCount: rec.blockedEdgeViolationCount,
      unreachableVehicleCount: rec.unreachableVehicleCount,
      feasible: rec.feasible,
      warnings: rec.warnings,
      convergenceHistory: rec.convergenceHistory,
      error: rec.error,
    };
  }

  return {
    ...base,
    scenarioId: rec.scenarioId,
    scenarioName: rec.scenarioName,
    scenarioSeed: rec.scenarioSeed,
    initialAlgorithm: rec.initialAlgorithm,
    initialAlgorithmLabel: rec.initialAlgorithmLabel,
    initialPreset: rec.initialPreset,
    reroutingAlgorithm: rec.reroutingAlgorithm,
    reroutingAlgorithmLabel: rec.reroutingAlgorithmLabel,
    reroutingPreset: rec.reroutingPreset,
    optimizerSeed: rec.optimizerSeed,
    incidentType: rec.incidentType,
    incidentId: rec.incidentId,
    incidentEdgeIds: rec.incidentEdgeIds,
    incidentSeverity: rec.incidentSeverity,
    affectedVehicleIds: rec.affectedVehicleIds,
    completedCustomerCount: rec.completedCustomerCount,
    lockedCustomerCount: rec.lockedCustomerCount,
    pendingCustomerCount: rec.pendingCustomerCount,
    eligibleCustomerIds: rec.eligibleCustomerIds,
    reroutingRuntimeMs: rec.reroutingRuntimeMs,
    populationSize: rec.populationSize,
    iterations: rec.iterations,
    candidateEvaluations: rec.candidateEvaluations,
    originalRemainingTravelMinutes: rec.originalRemainingTravelMinutes,
    incidentAdjustedRemainingTravelMinutes: rec.incidentAdjustedRemainingTravelMinutes,
    revisedRemainingTravelMinutes: rec.revisedRemainingTravelMinutes,
    delayAvoidedMinutes: rec.delayAvoidedMinutes,
    routeStabilityChanges: rec.routeStabilityChanges,
    revisedRoutingScore: rec.revisedRoutingScore,
    revisedCustomersAssigned: rec.revisedCustomersAssigned,
    revisedCustomersUnserved: rec.revisedCustomersUnserved,
    revisedFeasible: rec.revisedFeasible,
    warnings: rec.warnings,
    error: rec.error,
  };
}

export interface ExportContent {
  content: string;
  mimeType: string;
  filename: string;
}

function generateTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function generateCSVExport(records: ExperimentRecord[]): ExportContent {
  if (records.length === 0) {
    return { content: '', mimeType: 'text/csv', filename: '' };
  }

  const flattened = records.map(flattenRecord);

  const allKeys: string[] = [];
  const keySet = new Set<string>();
  for (const rec of flattened) {
    Object.keys(rec).forEach((k) => {
      if (!keySet.has(k)) {
        keySet.add(k);
        allKeys.push(k);
      }
    });
  }

  const header = allKeys.join(',');
  const rows = flattened.map((rec) =>
    allKeys.map((k) => formatCSVValue(rec[k])).join(',')
  );

  const csvContent = [header, ...rows].join('\n');

  return {
    content: csvContent,
    mimeType: 'text/csv;charset=utf-8;',
    filename: `quantaRoute-experiments-${generateTimestamp()}.csv`,
  };
}

export function generateJSONExport(records: ExperimentRecord[]): ExportContent {
  const exportObj = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    appName: 'QuantaRoute AI',
    objectiveFormula: 'F = 0.55T + 0.25D + 0.20C + 10000P',
    totalRecords: records.length,
    records,
  };

  return {
    content: JSON.stringify(exportObj, null, 2),
    mimeType: 'application/json;charset=utf-8;',
    filename: `quantaRoute-experiments-${generateTimestamp()}.json`,
  };
}

export function triggerDownload(content: string, mimeType: string, filename: string): void {
  if (typeof window === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
    console.error('Export requires browser environment with Blob and URL support.');
    return;
  }

  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Failed to trigger download:', e);
  }
}
