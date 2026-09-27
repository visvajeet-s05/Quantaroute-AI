/**
 * Local persistence utilities for experiment history.
 * Browser-only, namespaced localStorage with safe malformed-data handling.
 */

import { ExperimentHistory, ExperimentRecord } from '../types/experiments';

const STORAGE_KEY = 'quantaroute.experimentHistory.v1';

export type StorageLoadResult =
  | { ok: true; history: ExperimentHistory }
  | { ok: false; error: string };

function safeJSONParse<T>(json: string): T | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed === null || typeof parsed !== 'object') return null;
    if (Array.isArray(parsed)) return parsed as T;
    if (parsed.records && Array.isArray(parsed.records)) return parsed.records as T;
    return null;
  } catch {
    return null;
  }
}

export function loadExperimentHistory(): StorageLoadResult {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return { ok: true, history: [] };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null || raw === '') {
      return { ok: true, history: [] };
    }

    const parsed = safeJSONParse<ExperimentRecord[]>(raw);
    if (parsed === null) {
      return {
        ok: false,
        error: `Malformed data in localStorage key "${STORAGE_KEY}". History could not be parsed. Safe to clear.`,
      };
    }

    const validRecords: ExperimentRecord[] = [];
    for (const rec of parsed) {
      if (
        typeof rec === 'object' &&
        rec !== null &&
        typeof rec.id === 'string' &&
        typeof rec.runType === 'string' &&
        typeof rec.timestamp === 'string' &&
        typeof rec.experimentGroupId === 'string'
      ) {
        validRecords.push(rec);
      }
    }

    if (validRecords.length !== parsed.length) {
      return {
        ok: false,
        error: `${parsed.length - validRecords.length} malformed record(s) detected and skipped during load.`,
      };
    }

    return { ok: true, history: validRecords };
  } catch (e) {
    return {
      ok: false,
      error: `Failed to load experiment history: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export function saveExperimentHistory(history: ExperimentHistory): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }

  try {
    const raw = JSON.stringify(history);
    localStorage.setItem(STORAGE_KEY, raw);
    return true;
  } catch (e) {
    console.error('Failed to save experiment history:', e);
    return false;
  }
}

export function clearExperimentHistory(): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (e) {
    console.error('Failed to clear experiment history:', e);
    return false;
  }
}

export function appendExperimentRecord(record: ExperimentRecord): boolean {
  const current = loadExperimentHistory();
  if (!current.ok) {
    return false;
  }
  const updated = [...current.history, record];
  return saveExperimentHistory(updated);
}

export function getStorageKey(): string {
  return STORAGE_KEY;
}
