import React, { useState } from 'react';
import { Compass, Play, RotateCcw, MapPin, Info, ArrowRight } from 'lucide-react';
import { Customer, Node } from '../types/domain';
import { PathTestState } from '../types/pathfinding';

interface PathTestPanelProps {
  customers: Customer[];
  depotNodeId: string;
  pathTestState: PathTestState;
  onRunPathTest: (customerId: string) => void;
  onClearPathTest: () => void;
}

export const PathTestPanel: React.FC<PathTestPanelProps> = ({
  customers,
  depotNodeId,
  pathTestState,
  onRunPathTest,
  onClearPathTest,
}) => {
  // Sorted customers list by customer ID (C01, C02, ...)
  const sortedCustomers = [...customers].sort((a, b) => a.id.localeCompare(b.id));

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    sortedCustomers[0]?.id || 'C01'
  );

  const selectedCustomer = sortedCustomers.find((c) => c.id === selectedCustomerId);

  const handleRun = () => {
    if (selectedCustomerId) {
      onRunPathTest(selectedCustomerId);
    }
  };

  const hasActivePath = Boolean(pathTestState.lastPathResult);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm text-slate-800">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-600" />
          <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
            Shortest Path Test
          </h2>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200/60">
          Dijkstra Engine
        </span>
      </div>

      <div className="space-y-3">
        {/* Read-only Source Label */}
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">
            Origin Location
          </label>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700">
            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="font-semibold text-slate-800">Source: Central Hub</span>
            <span className="text-[10px] text-slate-400 font-mono ml-auto">Node {depotNodeId}</span>
          </div>
        </div>

        {/* Destination Customer Dropdown */}
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center justify-between">
            <span>Destination Customer</span>
            <span className="text-[10px] text-slate-400">25 Candidates</span>
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 cursor-pointer"
          >
            {sortedCustomers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — Demand {c.demand} — Node {c.nodeId}
              </option>
            ))}
          </select>
        </div>

        {/* Selected Customer Snapshot preview */}
        {selectedCustomer && (
          <div className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-600">
              <span>Target:</span>
              <strong className="text-cyan-700 font-bold">{selectedCustomer.id}</strong>
              <span className="text-slate-400">({selectedCustomer.demand} units)</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
              <span>Grid Node:</span>
              <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 font-semibold">
                {selectedCustomer.nodeId}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={handleRun}
            className="py-2.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer active:scale-[0.98]"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Find Fastest Path</span>
          </button>

          <button
            type="button"
            onClick={onClearPathTest}
            disabled={!hasActivePath}
            className={`py-2.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border ${
              hasActivePath
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 cursor-pointer active:scale-[0.98]'
                : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Path</span>
          </button>
        </div>

        {/* Descriptive Explanatory Note */}
        <div className="flex items-start gap-1.5 text-[11px] text-slate-500 bg-slate-50 rounded-lg p-2 border border-slate-200/60">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>
            Uses Dijkstra’s algorithm with traffic-adjusted travel time as the road cost.
          </span>
        </div>
      </div>
    </div>
  );
};
