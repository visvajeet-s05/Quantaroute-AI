/**
 * Local persistence utilities for capstone checklists.
 * Browser-only, namespaced localStorage with safe malformed-data handling.
 * Used by ScreenshotChecklist and FinalReadinessPanel.
 */

import { ChecklistItem, ChecklistCategory } from '../types/capstone';

const SCREENSHOT_KEY = 'quantaroute.capstoneScreenshotChecklist.v1';
const READINESS_KEY = 'quantaroute.capstoneReadinessChecklist.v1';

function safeJSONParse<T>(json: string): T | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed === null || typeof parsed !== 'object') return null;
    return parsed as T;
  } catch {
    return null;
  }
}

export function getScreenshotChecklistKey(): string {
  return SCREENSHOT_KEY;
}

export function getReadinessChecklistKey(): string {
  return READINESS_KEY;
}

export function loadScreenshotChecklist(): ChecklistItem[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [];
  }
  const raw = localStorage.getItem(SCREENSHOT_KEY);
  if (!raw) return [];
  const parsed = safeJSONParse<{ items: ChecklistItem[] }>(raw);
  if (!parsed || !Array.isArray(parsed.items)) return [];
  return parsed.items;
}

export function saveScreenshotChecklist(items: ChecklistItem[]): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }
  try {
    localStorage.setItem(SCREENSHOT_KEY, JSON.stringify({ items, updatedAt: new Date().toISOString() }));
    return true;
  } catch (e) {
    console.error('Failed to save screenshot checklist:', e);
    return false;
  }
}

export function loadReadinessChecklist(): ChecklistCategory[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [];
  }
  const raw = localStorage.getItem(READINESS_KEY);
  if (!raw) return [];
  const parsed = safeJSONParse<{ categories: ChecklistCategory[] }>(raw);
  if (!parsed || !Array.isArray(parsed.categories)) return [];
  return parsed.categories;
}

export function saveReadinessChecklist(categories: ChecklistCategory[]): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }
  try {
    localStorage.setItem(READINESS_KEY, JSON.stringify({ categories, updatedAt: new Date().toISOString() }));
    return true;
  } catch (e) {
    console.error('Failed to save readiness checklist:', e);
    return false;
  }
}
