/**
 * Capstone Screenshot Evidence Checklist
 * QuantaRoute AI — Manual evidence capture tracking with local persistence.
 */

import React, { useState } from 'react';
import {
  ChecklistItem,
} from '../types/capstone';
import {
  loadScreenshotChecklist,
  saveScreenshotChecklist,
} from '../utils/capstoneChecklistStorage';
import {
  ClipboardCheck,
  CheckCircle2,
  RefreshCw,
  FileDown,
  AlertTriangle,
} from 'lucide-react';

const DEFAULT_ITEMS: ChecklistItem[] = [
  { id: '1', label: 'Dashboard overview with Normal Traffic', completed: false, note: '', timestamp: null },
  { id: '2', label: 'Dijkstra shortest-path test and cyan overlay', completed: false, note: '', timestamp: null },
  { id: '3', label: 'Greedy Routing result', completed: false, note: '', timestamp: null },
  { id: '4', label: 'Classical PSO result and convergence chart', completed: false, note: '', timestamp: null },
  { id: '5', label: 'QPSO result and convergence chart', completed: false, note: '', timestamp: null },
  { id: '6', label: 'Benchmark comparison table', completed: false, note: '', timestamp: null },
  { id: '7', label: 'QPSO transparency explanation', completed: false, note: '', timestamp: null },
  { id: '8', label: 'Simulated route progress with locked customers', completed: false, note: '', timestamp: null },
  { id: '9', label: 'Guided road closure', completed: false, note: '', timestamp: null },
  { id: '10', label: 'Revised pending-delivery routes', completed: false, note: '', timestamp: null },
  { id: '11', label: 'Dynamic re-routing result panel', completed: false, note: '', timestamp: null },
  { id: '12', label: 'Validation modal showing passing suites', completed: false, note: '', timestamp: null },
  { id: '13', label: 'Experiment History', completed: false, note: '', timestamp: null },
  { id: '14', label: 'CSV export', completed: false, note: '', timestamp: null },
  { id: '15', label: 'JSON export', completed: false, note: '', timestamp: null },
  { id: '16', label: 'App running locally/offline', completed: false, note: '', timestamp: null },
  { id: '17', label: 'Final PPT title slide', completed: false, note: '', timestamp: null },
  { id: '18', label: 'Demo video backup ready', completed: false, note: '', timestamp: null },
];

function formatTimestamp(ts: string | null): string {
  if (!ts) return 'Not captured';
  return new Date(ts).toLocaleString();
}

export const ScreenshotChecklist: React.FC = () => {
  const [items, setItems] = useState<ChecklistItem[]>(() => {
    const loaded = loadScreenshotChecklist();
    if (loaded.length > 0) {
      return loaded;
    }
    return DEFAULT_ITEMS;
  });

  const toggleItem = (id: string) => {
    const newItems = items.map((i) =>
      i.id === id
        ? {
            ...i,
            completed: !i.completed,
            timestamp: !i.completed ? new Date().toISOString() : null,
          }
        : i
    );
    setItems(newItems);
    saveScreenshotChecklist(newItems);
  };

  const updateNote = (id: string, note: string) => {
    const newItems = items.map((i) => (i.id === id ? { ...i, note } : i));
    setItems(newItems);
    saveScreenshotChecklist(newItems);
  };

  const handleReset = () => {
    if (!window.confirm('Reset all checklist items? This cannot be undone.')) return;
    setItems(DEFAULT_ITEMS);
    saveScreenshotChecklist(DEFAULT_ITEMS);
  };

  const handleExportMarkdown = () => {
    const lines: string[] = ['# Screenshot Evidence Checklist', ''];
    items.forEach((item) => {
      lines.push(`- [${item.completed ? 'x' : ' '}] ${item.label}`);
      if (item.note) lines.push(`  > ${item.note}`);
      if (item.timestamp) lines.push(`  _Captured: ${formatTimestamp(item.timestamp)}_`);
      lines.push('');
    });
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'capstone-screenshot-checklist.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const completedCount = items.filter((i) => i.completed).length;
  const percentage = Math.round((completedCount / items.length) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-wider text-slate-500 uppercase">
          Capstone Evidence Checklist
        </h2>
        <span className="text-xs text-slate-400">
          {completedCount}/{items.length} captured ({percentage}%)
        </span>
      </div>

      <div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-cyan-600 h-2 rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`border rounded-lg p-3 transition-colors ${
              item.completed
                ? 'border-emerald-200 bg-emerald-50/30'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={() => toggleItem(item.id)}
                className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  item.completed
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white border-slate-300 text-transparent hover:border-slate-500'
                }`}
              >
                {item.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">#{item.id}</span>
                  <span
                    className={`font-medium ${
                      item.completed ? 'text-slate-800' : 'text-slate-500'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
                {item.timestamp && (
                  <div className="text-xs text-emerald-600 flex items-center gap-1">
                    <span>✓ Captured</span>
                    <span>{formatTimestamp(item.timestamp)}</span>
                  </div>
                )}
                <textarea
                  value={item.note}
                  onChange={(e) => updateNote(item.id, e.target.value)}
                  placeholder="Optional note (e.g., file path or screenshot name)"
                  className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 resize-y-none"
                  rows={1}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center pt-2">
        <button
          onClick={handleReset}
          className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset Checklist
        </button>
        <button
          onClick={handleExportMarkdown}
          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs rounded-lg flex items-center gap-1.5"
        >
          <FileDown className="w-3.5 h-3.5" />
          Export as Markdown
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Do not automatically mark any evidence as captured. All items require manual confirmation.</span>
      </div>
    </div>
  );
};
