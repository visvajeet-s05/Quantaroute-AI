import React, { useState, useCallback } from 'react';
import {
  Play,
  Trash2,
  Download,
  FileText,
  Database,
  BarChart3,
  CheckCircle2,
  XCircle,
  Loader2,
  Layers,
  Copy,
} from 'lucide-react';
import {
  ExperimentRecord,
  ExperimentHistory,
  ExperimentRunProgress,
} from '../types/experiments';
import { BENCHMARK_PRESETS } from '../services/benchmarkPresets';
import { runBenchmark, runFastRerouteDemo } from '../services/experimentManager';
import { generateCSVExport, generateJSONExport, triggerDownload } from '../utils/experimentExport';
import { loadExperimentHistory, saveExperimentHistory, clearExperimentHistory, StorageLoadResult } from '../utils/experimentStorage';
import { ExperimentHistory as ExperimentHistoryComponent } from './ExperimentHistory';

interface ExperimentManagerProps {
  onRecordsAdded?: () => void;
}

export const ExperimentManager: React.FC<ExperimentManagerProps> = ({ onRecordsAdded }) => {
  const [history, setHistory] = useState<ExperimentHistory>(() => {
    const loaded = loadExperimentHistory();
    if (loaded.ok) return loaded.history;
    return [];
  });

  const [storageWarning, setStorageWarning] = useState<string | null>(
    (() => {
      const loaded = loadExperimentHistory();
      if (loaded.ok) return null;
      return (loaded as { error: string }).error;
    })()
  );

  const [selectedPreset, setSelectedPreset] = useState<string>(BENCHMARK_PRESETS[0].id);
  const [progress, setProgress] = useState<ExperimentRunProgress | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const currentPreset = BENCHMARK_PRESETS.find((p) => p.id === selectedPreset) || BENCHMARK_PRESETS[0];

  const updateHistory = useCallback((newHistory: ExperimentHistory) => {
    setHistory(newHistory);
    saveExperimentHistory(newHistory);
    setStorageWarning(null);
    onRecordsAdded?.();
  }, [onRecordsAdded]);

  const handleRunBenchmark = useCallback(async () => {
    const preset = currentPreset;
    if (progress?.isRunning) return;

    setHistory((prev) => prev);
    const startingGroupId = `bench-${Date.now()}`;

    const onProgress = (p: ExperimentRunProgress) => {
      setProgress(p);
    };

    try {
      let records: ExperimentRecord[];

      if (preset.isDynamicDemo) {
        records = await runFastRerouteDemo(onProgress);
      } else {
        records = await runBenchmark(preset, onProgress);
      }

      const newHistory = [...history, ...records];
      updateHistory(newHistory);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setProgress({
        step: `Error: ${errorMsg}`,
        stepIndex: 0,
        totalSteps: 1,
        isRunning: false,
        groupId: startingGroupId,
        error: errorMsg,
      });
    } finally {
      setTimeout(() => {
        setProgress((prev) => (prev ? { ...prev, isRunning: false } : null));
      }, 100);
    }
  }, [currentPreset, history, updateHistory, progress]);

  const handleClearHistory = () => {
    if (typeof window !== 'undefined' && window.confirm('Clear all experiment history? This cannot be undone.')) {
      clearExperimentHistory();
      setHistory([]);
      setStorageWarning(null);
      onRecordsAdded?.();
    }
  };

  const handleExportCSV = () => {
    const { content, filename } = generateCSVExport(history);
    if (content && filename) {
      triggerDownload(content, 'text/csv;charset=utf-8;', filename);
    }
  };

  const handleExportJSON = () => {
    const { content, filename } = generateJSONExport(history);
    triggerDownload(content, 'application/json;charset=utf-8;', filename);
  };

  const handleReloadStorage = () => {
    const loaded = loadExperimentHistory();
    if (loaded.ok) {
      setHistory(loaded.history);
      setStorageWarning(null);
    } else {
       setStorageWarning((loaded as { error: string }).error);
    }
  };

  const feasibleCount = history.filter((r) =>
    r.runType === 'initial_routing' ? r.feasible : r.revisedFeasible
  ).length;
  const infeasibleCount = history.filter((r) =>
    r.runType === 'initial_routing' ? !r.feasible : !r.revisedFeasible
  ).length;

  return (
    <div className="space-y-4">
      {/* Storage Warning */}
      {storageWarning && (
        <div className="bg-rose-50/80 border border-rose-200 text-rose-900 rounded-xl p-3 text-xs">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-600" />
            <span className="font-semibold">Storage Warning</span>
          </div>
          <div className="mt-1">{storageWarning}</div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleReloadStorage}
              className="px-2.5 py-1 bg-rose-600 text-white rounded text-xs font-medium hover:bg-rose-700 cursor-pointer"
            >
              Reload / Clear Bad Data
            </button>
          </div>
        </div>
      )}

      {/* Header + Preset Selector */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-cyan-600" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
            Controlled Experiments
          </h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Benchmark Preset
            </label>
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              disabled={progress?.isRunning}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-100"
            >
              {BENCHMARK_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed">
            {currentPreset.description}
          </p>
        </div>
      </div>

      {/* Configuration Display (Read-Only) */}
      <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-4 space-y-2.5 text-xs">
        <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1">
          <Layers className="w-3 h-3" />
          Benchmark Configuration (Read-Only)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
          <div>
            <span className="text-slate-500">Scenario Preset:</span>
            <strong className="text-slate-800 ml-1">{currentPreset.scenarioPreset}</strong>
          </div>
          <div>
            <span className="text-slate-500">Scenario Seed:</span>
            <strong className="text-slate-800 ml-1 font-mono">{currentPreset.scenarioSeed}</strong>
          </div>
          <div>
            <span className="text-slate-500">Optimizer Seed:</span>
            <strong className="text-slate-800 ml-1 font-mono">{currentPreset.optimizerSeed}</strong>
          </div>
          <div>
            <span className="text-slate-500">Algorithms:</span>
            <strong className="text-slate-800 ml-1">
              {currentPreset.includeGreedy ? 'Greedy' : ''}
              {currentPreset.includeGreedy && (currentPreset.includePso || currentPreset.includeQpso) ? ', ' : ''}
              {currentPreset.includePso ? 'Classical PSO' : ''}
              {currentPreset.includePso && currentPreset.includeQpso ? ', ' : ''}
              {currentPreset.includeQpso ? 'QPSO' : ''}
              {(!currentPreset.includeGreedy && !currentPreset.includePso && !currentPreset.includeQpso) ? 'None' : ''}
            </strong>
          </div>
          <div>
            <span className="text-slate-500">PSO Preset:</span>
            <strong className="text-slate-800 ml-1">{currentPreset.psoPreset}</strong>
          </div>
          <div>
            <span className="text-slate-500">QPSO Preset:</span>
            <strong className="text-slate-800 ml-1">{currentPreset.qpsoPreset}</strong>
          </div>
          <div>
            <span className="text-slate-500">PSO Budget:</span>
            <strong className="text-slate-800 ml-1 font-mono">Pop {currentPreset.psoPreset === 'Balanced' ? 25 : currentPreset.psoPreset === 'Fast Re-route' ? 15 : 35} · Iter {currentPreset.psoPreset === 'Balanced' ? 50 : currentPreset.psoPreset === 'Fast Re-route' ? 25 : 100} · Evals {currentPreset.psoPreset === 'Balanced' ? 1275 : currentPreset.psoPreset === 'Fast Re-route' ? 390 : 3675}</strong>
          </div>
          <div>
            <span className="text-slate-500">QPSO Budget:</span>
            <strong className="text-slate-800 ml-1 font-mono">Pop {currentPreset.qpsoPreset === 'Balanced' ? 25 : currentPreset.qpsoPreset === 'Fast Re-route' ? 15 : 35} · Iter {currentPreset.qpsoPreset === 'Balanced' ? 50 : currentPreset.qpsoPreset === 'Fast Re-route' ? 25 : 100} · Evals {currentPreset.qpsoPreset === 'Balanced' ? 1275 : currentPreset.qpsoPreset === 'Fast Re-route' ? 390 : 3675}</strong>
          </div>
        </div>

        <div className="pt-1 border-t border-slate-200">
          <span className="text-slate-500">Objective Function:</span>
          <code className="font-mono text-cyan-700 ml-1">
            F = 0.55T + 0.25D + 0.20C + 10000P
          </code>
        </div>
      </div>

      {/* Progress / Completion State */}
      {progress && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {progress.isRunning ? (
                <Loader2 className="w-4 h-4 text-cyan-600 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
              <span className="font-semibold text-slate-800">{progress.step}</span>
            </div>
            {progress.isRunning && (
              <span className="text-slate-500 font-mono">
                Step {progress.stepIndex + 1} of {progress.totalSteps}
              </span>
            )}
          </div>

          {progress.error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-lg p-2 text-[11px]">
              <XCircle className="w-3 h-3 inline mr-1" />
              {progress.error}
            </div>
          )}
        </div>
      )}

      {/* Completion Summary */}
      {!progress?.isRunning && history.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-2 text-xs">
          <h3 className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
            Experiment History Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center">
              <div className="text-slate-500">{history.length}</div>
              <div className="font-semibold text-slate-800 text-[10px]">Total Records</div>
            </div>
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-2 text-center">
              <div className="text-emerald-700 font-semibold">{feasibleCount}</div>
              <div className="text-[10px] text-emerald-800">Feasible</div>
            </div>
            <div className="bg-rose-50/60 border border-rose-200 rounded-lg p-2 text-center">
              <div className="text-rose-700 font-semibold">{infeasibleCount}</div>
              <div className="text-[10px] text-rose-800">Infeasible</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center">
              <div className="text-slate-500">{new Set(history.map((r) => r.experimentGroupId)).size}</div>
              <div className="font-semibold text-slate-800 text-[10px]">Groups</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleRunBenchmark}
          disabled={progress?.isRunning}
          className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
        >
          {progress?.isRunning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              Run Selected Benchmark
            </>
          )}
        </button>

        <button
          onClick={handleClearHistory}
          disabled={progress?.isRunning || history.length === 0}
          className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-medium hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5 inline mr-1" />
          Clear Experiment History
        </button>

        <div className="relative">
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            disabled={progress?.isRunning || history.length === 0}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

          {exportMenuOpen && (
            <div className="absolute right-0 bottom-full mb-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[140px] z-20">
              <button
                onClick={() => { handleExportCSV(); setExportMenuOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
              >
                <FileText className="w-3 h-3" />
                Export CSV
              </button>
              <button
                onClick={() => { handleExportJSON(); setExportMenuOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
              >
                <Database className="w-3 h-3" />
                Export JSON
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleReloadStorage}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
          title="Reload experiment history from localStorage"
        >
          <Copy className="w-3.5 h-3.5 inline mr-1" />
           Reload
        </button>
      </div>

      {/* Experiment History Table */}
      {history.length > 0 && (
        <ExperimentHistoryComponent
          history={history}
          onClearHistory={handleClearHistory}
        />
      )}
    </div>
  );
};
