import React, { useState, useMemo } from 'react';
import {
  ExperimentRecord,
  InitialRoutingExperimentRecord,
  DynamicReroutingExperimentRecord,
  ExperimentHistory as ExperimentHistoryType,
} from '../types/experiments';
import { CheckCircle2, XCircle, Zap, Cpu, Layers, Search, Filter, Route, ArrowRightLeft } from 'lucide-react';
import { InitialRoutingResultsTable } from './InitialRoutingResultsTable';
import { DynamicReRoutingResultsTable } from './DynamicReRoutingResultsTable';

type FilterType =
  | 'all'
  | 'initial_routing'
  | 'dynamic_rerouting'
  | 'greedy'
  | 'pso'
  | 'qpso'
  | 'feasible'
  | 'infeasible';

const FILTER_OPTIONS: { value: FilterType; label: string; icon?: React.ReactNode }[] = [
  { value: 'all', label: 'All Records' },
  { value: 'initial_routing', label: 'Initial Routing' },
  { value: 'dynamic_rerouting', label: 'Dynamic Re-routing' },
  { value: 'greedy', label: 'Greedy' },
  { value: 'pso', label: 'Classical PSO' },
  { value: 'qpso', label: 'Quantum PSO' },
  { value: 'feasible', label: 'Feasible', icon: <CheckCircle2 className="w-3 h-3 text-emerald-600" /> },
  { value: 'infeasible', label: 'Infeasible', icon: <XCircle className="w-3 h-3 text-rose-600" /> },
];

interface ExperimentHistoryProps {
  history: ExperimentHistoryType;
  onClearHistory: () => void;
}

export const ExperimentHistory: React.FC<ExperimentHistoryProps> = ({
  history,
  onClearHistory,
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    return history.filter((rec) => {
      const matchesFilter = (() => {
        switch (activeFilter) {
          case 'all': return true;
          case 'initial_routing': return rec.runType === 'initial_routing';
          case 'dynamic_rerouting': return rec.runType === 'dynamic_rerouting';
          case 'greedy':
            if (rec.runType === 'initial_routing') return rec.algorithm === 'greedy';
            return rec.initialAlgorithm === 'greedy' || rec.reroutingAlgorithm === 'greedy';
          case 'pso':
            if (rec.runType === 'initial_routing') return rec.algorithm === 'pso';
            return rec.initialAlgorithm === 'pso' || rec.reroutingAlgorithm === 'pso';
          case 'qpso':
            if (rec.runType === 'initial_routing') return rec.algorithm === 'qpso';
            return rec.initialAlgorithm === 'qpso' || rec.reroutingAlgorithm === 'qpso';
          case 'feasible':
            if (rec.runType === 'initial_routing') return rec.feasible;
            return rec.revisedFeasible;
          case 'infeasible':
            if (rec.runType === 'initial_routing') return !rec.feasible;
            return !rec.revisedFeasible;
          default: return true;
        }
      })();

      if (!matchesFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          rec.experimentGroupId.toLowerCase().includes(q) ||
          rec.scenarioName.toLowerCase().includes(q) ||
          (rec.runType === 'initial_routing'
            ? rec.algorithmLabel.toLowerCase().includes(q)
            : `${rec.initialAlgorithmLabel} → ${rec.reroutingAlgorithmLabel}`.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [history, activeFilter, searchQuery]);

  // Group records by experimentGroupId
  const grouped = useMemo(() => {
    const groups = new Map<string, ExperimentRecord[]>();
    const groupOrder: string[] = [];
    for (const rec of filtered) {
      if (!groups.has(rec.experimentGroupId)) {
        groups.set(rec.experimentGroupId, []);
        groupOrder.push(rec.experimentGroupId);
      }
      groups.get(rec.experimentGroupId)!.push(rec);
    }
    return groupOrder.map((gid) => ({ groupId: gid, records: groups.get(gid)! }));
  }, [filtered]);

  const getAlgoIcon = (algo: string) => {
    switch (algo) {
      case 'greedy': return <Layers className="w-3 h-3 text-sky-600" />;
      case 'pso': return <Cpu className="w-3 h-3 text-indigo-600" />;
      case 'qpso': return <Zap className="w-3 h-3 text-teal-600" />;
      default: return <Route className="w-3 h-3 text-slate-500" />;
    }
  };

  const getFeasibility = (rec: ExperimentRecord): { feasible: boolean; label: string } => {
    if (rec.runType === 'initial_routing') {
      return { feasible: rec.feasible, label: rec.feasible ? 'Feasible' : 'Infeasible' };
    }
    return { feasible: rec.revisedFeasible, label: rec.revisedFeasible ? 'Feasible' : 'Infeasible' };
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <div className="flex items-center gap-1 text-xs font-medium flex-wrap">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setActiveFilter(opt.value)}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
                  activeFilter === opt.value
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="flex items-center gap-1">
                  {opt.icon}
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search group ID or scenario..."
              className="pl-7 pr-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 w-44"
            />
          </div>
          <button
            onClick={onClearHistory}
            className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-medium hover:bg-rose-100 transition-colors cursor-pointer"
            title="Clear all experiment history (irreversible)"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center">
          <div className="text-slate-500">{filtered.length}</div>
          <div className="font-semibold text-slate-800 text-[10px]">Filtered Records</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center">
          <div className="text-slate-500">{grouped.length}</div>
          <div className="font-semibold text-slate-800 text-[10px]">Experiment Groups</div>
        </div>
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-2 text-center">
          <div className="text-emerald-700 font-semibold">
            {filtered.filter((r) => getFeasibility(r).feasible).length}
          </div>
          <div className="text-[10px] text-emerald-800">Feasible</div>
        </div>
        <div className="bg-rose-50/60 border border-rose-200 rounded-lg p-2 text-center">
          <div className="text-rose-700 font-semibold">
            {filtered.filter((r) => !getFeasibility(r).feasible).length}
          </div>
          <div className="text-[10px] text-rose-800">Infeasible</div>
        </div>
      </div>

      {/* Grouped Records */}
      {grouped.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs">
          No experiment records match the current filter.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ groupId, records }) => (
            <div
              key={groupId}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Group Header */}
              <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-600 font-medium">
                    {groupId.slice(-16)}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">
                    {records.length} record{records.length > 1 ? 's' : ''}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">
                    {new Date(records[0].timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {records.map((rec) => {
                    const { feasible } = getFeasibility(rec);
                    return (
                      <span
                        key={rec.id}
                        title={rec.runType === 'initial_routing' ? rec.algorithmLabel : `${rec.initialAlgorithmLabel} → ${rec.reroutingAlgorithmLabel}`}
                        className="flex items-center gap-0.5 text-xs"
                      >
                        {rec.runType === 'initial_routing'
                          ? getAlgoIcon(rec.algorithm)
                          : <ArrowRightLeft className="w-3 h-3 text-amber-600" />}
                        <span className={feasible ? 'text-emerald-600' : 'text-rose-600'}>
                          {feasible ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Records */}
              <div className="p-3 space-y-4">
                {records
                  .filter((r): r is InitialRoutingExperimentRecord => r.runType === 'initial_routing')
                  .length > 0 && (
                  <InitialRoutingResultsTable
                    groupId={groupId}
                    records={records.filter(
                      (r): r is InitialRoutingExperimentRecord => r.runType === 'initial_routing'
                    )}
                  />
                )}
                {records
                  .filter((r): r is DynamicReroutingExperimentRecord => r.runType === 'dynamic_rerouting')
                  .length > 0 && (
                  <DynamicReRoutingResultsTable
                    groupId={groupId}
                    records={records.filter(
                      (r): r is DynamicReroutingExperimentRecord => r.runType === 'dynamic_rerouting'
                    )}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
