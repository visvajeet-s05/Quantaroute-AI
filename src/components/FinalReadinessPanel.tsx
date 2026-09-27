/**
 * Capstone Final Readiness Panel
 * QuantaRoute AI — Persistent manual readiness checklist across 4 categories.
 */

import React, { useState } from 'react';
import { ChecklistCategory } from '../types/capstone';
import {
  loadReadinessChecklist,
  saveReadinessChecklist,
} from '../utils/capstoneChecklistStorage';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Package,
  Download,
} from 'lucide-react';

const DEFAULT_CATEGORIES: ChecklistCategory[] = [
  {
    id: 'software',
    label: 'Software',
    critical: true,
    items: [
      { id: 'sw-1', label: 'All validation tests pass', completed: false, note: '', timestamp: null },
      { id: 'sw-2', label: 'TypeScript check passes (tsc --noEmit)', completed: false, note: '', timestamp: null },
      { id: 'sw-3', label: 'App runs locally', completed: false, note: '', timestamp: null },
      { id: 'sw-4', label: 'Dijkstra works', completed: false, note: '', timestamp: null },
      { id: 'sw-5', label: 'Greedy Routing works', completed: false, note: '', timestamp: null },
      { id: 'sw-6', label: 'Classical PSO works', completed: false, note: '', timestamp: null },
      { id: 'sw-7', label: 'QPSO works', completed: false, note: '', timestamp: null },
      { id: 'sw-8', label: 'Dynamic re-routing works', completed: false, note: '', timestamp: null },
      { id: 'sw-9', label: 'CSV/JSON export works', completed: false, note: '', timestamp: null },
    ],
  },
  {
    id: 'benchmark',
    label: 'Benchmark Evidence',
    critical: true,
    items: [
      { id: 'bn-1', label: 'Normal Traffic benchmark complete', completed: false, note: '', timestamp: null },
      { id: 'bn-2', label: 'Peak Traffic benchmark complete', completed: false, note: '', timestamp: null },
      { id: 'bn-3', label: 'Guided closure re-route complete', completed: false, note: '', timestamp: null },
      { id: 'bn-4', label: 'Congestion surge re-route complete', completed: false, note: '', timestamp: null },
      { id: 'bn-5', label: 'Actual result tables saved', completed: false, note: '', timestamp: null },
      { id: 'bn-6', label: 'Screenshots captured', completed: false, note: '', timestamp: null },
    ],
  },
  {
    id: 'documentation',
    label: 'Documentation',
    critical: true,
    items: [
      { id: 'doc-1', label: 'README complete', completed: false, note: '', timestamp: null },
      { id: 'doc-2', label: 'Methodology ready', completed: false, note: '', timestamp: null },
      { id: 'doc-3', label: 'Result tables ready', completed: false, note: '', timestamp: null },
      { id: 'doc-4', label: 'Architecture diagram prepared', completed: false, note: '', timestamp: null },
      { id: 'doc-5', label: 'Limitations stated', completed: false, note: '', timestamp: null },
      { id: 'doc-6', label: 'Report complete', completed: false, note: '', timestamp: null },
      { id: 'doc-7', label: 'PPT complete', completed: false, note: '', timestamp: null },
      { id: 'doc-8', label: 'Demo script rehearsed', completed: false, note: '', timestamp: null },
    ],
  },
  {
    id: 'backup',
    label: 'Backup',
    critical: false,
    items: [
      { id: 'bk-1', label: 'GitHub synced', completed: false, note: '', timestamp: null },
      { id: 'bk-2', label: 'Source ZIP exported', completed: false, note: '', timestamp: null },
      { id: 'bk-3', label: 'Local app tested', completed: false, note: '', timestamp: null },
      { id: 'bk-4', label: 'PPT PDF exported', completed: false, note: '', timestamp: null },
      { id: 'bk-5', label: 'Demo video recorded', completed: false, note: '', timestamp: null },
      { id: 'bk-6', label: 'Copies stored on USB/cloud/secondary device', completed: false, note: '', timestamp: null },
    ],
  },
  {
    id: 'submission',
    label: 'Submission',
    critical: true,
    items: [
      { id: 'sub-1', label: 'Submission requirements checked', completed: false, note: '', timestamp: null },
      { id: 'sub-2', label: 'Supervisor review completed if required', completed: false, note: '', timestamp: null },
      { id: 'sub-3', label: 'Files uploaded', completed: false, note: '', timestamp: null },
      { id: 'sub-4', label: 'Receipt/screenshot saved', completed: false, note: '', timestamp: null },
    ],
  },
];

export const FinalReadinessPanel: React.FC = () => {
  const [categories, setCategories] = useState<ChecklistCategory[]>(() => {
    const loaded = loadReadinessChecklist();
    if (loaded.length > 0) {
      return loaded;
    }
    return DEFAULT_CATEGORIES;
  });

  const toggleItem = (categoryId: string, itemId: string) => {
    const newCategories = categories.map((cat) =>
      cat.id === categoryId
        ? {
            ...cat,
            items: cat.items.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    completed: !item.completed,
                    timestamp: !item.completed ? new Date().toISOString() : null,
                  }
                : item
            ),
          }
        : cat
    );
    setCategories(newCategories);
    saveReadinessChecklist(newCategories);
  };

  const updateNote = (categoryId: string, itemId: string, note: string) => {
    const newCategories = categories.map((cat) =>
      cat.id === categoryId
        ? {
            ...cat,
            items: cat.items.map((item) =>
              item.id === itemId ? { ...item, note } : item
            ),
          }
        : cat
    );
    setCategories(newCategories);
    saveReadinessChecklist(newCategories);
  };

  const handleReset = () => {
    if (!window.confirm('Reset all readiness checklists? This cannot be undone.')) return;
    setCategories(DEFAULT_CATEGORIES);
    saveReadinessChecklist(DEFAULT_CATEGORIES);
  };

  const handleExport = () => {
    const lines: string[] = ['# Capstone Final Readiness Checklist', ''];
    categories.forEach((cat) => {
      lines.push(`## ${cat.label}`, '');
      cat.items.forEach((item) => {
        lines.push(`- [${item.completed ? 'x' : ' '}] ${item.label}`);
        if (item.note) lines.push(`  > ${item.note}`);
        if (item.timestamp) lines.push(`  _${new Date(item.timestamp).toLocaleString()}_`);
      });
      lines.push('');
    });
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'capstone-readiness-checklist.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0);
  const completedItems = categories.reduce(
    (sum, cat) => sum + cat.items.filter((i) => i.completed).length,
    0
  );
  const overallPercentage = Math.round((completedItems / totalItems) * 100);

  const criticalItems = categories
    .filter((c) => c.critical)
    .reduce((sum, cat) => sum + cat.items.length, 0);
  const completedCritical = categories
    .filter((c) => c.critical)
    .reduce((sum, cat) => sum + cat.items.filter((i) => i.completed).length, 0);

  const incompleteCritical = criticalItems - completedCritical;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
          Capstone Final Readiness
        </h2>
        <span className="text-xs text-slate-400">
          {completedItems}/{totalItems} ({overallPercentage}%)
        </span>
      </div>

      <div>
        <div className="w-full bg-slate-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              overallPercentage >= 90
                ? 'bg-emerald-600'
                : overallPercentage >= 50
                ? 'bg-amber-500'
                : 'bg-rose-600'
            }`}
            style={{ width: `${overallPercentage}%` }}
          />
        </div>
      </div>

      {incompleteCritical > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {incompleteCritical} critical checklist item(s) remain incomplete. Review before submission.
          </span>
        </div>
      )}

      <div className="space-y-4">
        {categories.map((cat) => {
          const catCompleted = cat.items.filter((i) => i.completed).length;
          const catTotal = cat.items.length;
          const catPercentage = Math.round((catCompleted / catTotal) * 100);

          return (
            <div key={cat.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-slate-600" />
                  {cat.label}
                </h3>
                <span
                  className={`text-xs font-medium ${
                    cat.critical
                      ? 'text-red-700 bg-red-50 px-1.5 py-0.25 rounded'
                      : 'text-slate-500'
                  }`}
                >
                  {catCompleted}/{catTotal} ({catPercentage}%)
                  {cat.critical && ' • Critical'}
                </span>
              </div>
              <div className="p-2 space-y-1">
                {cat.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-2 p-2 hover:bg-slate-50 rounded">
                    <button
                      onClick={() => toggleItem(cat.id, item.id)}
                      className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        item.completed
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-white border-slate-300 text-transparent hover:border-slate-500'
                      }`}
                    >
                      {item.completed && <CheckCircle2 className="w-3 h-3" />}
                    </button>
                    <div className="flex-1 space-y-1">
                      <span
                        className={`text-xs ${
                          item.completed ? 'text-slate-800 line-through decoration-emerald-500' : 'text-slate-500'
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.timestamp && (
                        <div className="text-[10px] text-emerald-600">
                          Completed: {new Date(item.timestamp).toLocaleString()}
                        </div>
                      )}
                      <textarea
                        value={item.note}
                        onChange={(e) => updateNote(cat.id, item.id, e.target.value)}
                        placeholder="Optional note..."
                        className="w-full text-[10px] border border-slate-200 rounded px-1.5 py-1 resize-y-none"
                        rows={1}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center pt-2">
        <button
          onClick={handleReset}
          className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset All
        </button>
        <button
          onClick={handleExport}
          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs rounded-lg flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Export Checklist
        </button>
      </div>
    </div>
  );
};
