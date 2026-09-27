import React from 'react';
import { DynamicReroutingExperimentRecord } from '../types/experiments';
import { CheckCircle2, XCircle, Zap, TrendingDown, ArrowRightLeft } from 'lucide-react';

interface DynamicReRoutingResultsTableProps {
  groupId: string;
  records: DynamicReroutingExperimentRecord[];
}

export const DynamicReRoutingResultsTable: React.FC<DynamicReRoutingResultsTableProps> = ({
  groupId,
  records,
}) => {
  if (records.length === 0) {
    return <div className="text-xs text-slate-400">No dynamic re-routing records for this group.</div>;
  }

  const columns = [
    { key: 'initialAlgorithm', label: 'Initial Algo' },
    { key: 'reroutingAlgorithm', label: 'Re-route Algo' },
    { key: 'incidentType', label: 'Incident' },
    { key: 'affectedVehicleIds', label: 'Affected Veh.', align: 'right' as const },
    { key: 'completedCustomerCount', label: 'Completed', align: 'right' as const },
    { key: 'lockedCustomerCount', label: 'Locked', align: 'right' as const },
    { key: 'pendingCustomerCount', label: 'Pending', align: 'right' as const },
    { key: 'reroutingRuntimeMs', label: 'Re-Route Runtime', align: 'right' as const, mono: true, unit: 'ms' },
    { key: 'incidentAdjustedRemainingTravelMinutes', label: 'Incident Time', align: 'right' as const, mono: true, unit: 'min' },
    { key: 'revisedRemainingTravelMinutes', label: 'Revised Time', align: 'right' as const, mono: true, unit: 'min' },
    { key: 'delayAvoidedMinutes', label: 'Delay Avoided', align: 'right' as const, mono: true, unit: 'min' },
    { key: 'revisedFeasible', label: 'Feasible', align: 'center' as const },
  ];

  function formatTime(val: number | null, unit: string): React.ReactNode {
    if (val === null || val === undefined) return '—';
    return <span className="font-mono">{val.toFixed(1)} {unit}</span>;
  }

  function formatDelay(val: number | null): React.ReactNode {
    if (val === null || val === undefined) {
      return (
        <span className="text-xs text-slate-500 italic" title="Route recovery achieved; direct delay comparison unavailable">
          Recovery
        </span>
      );
    }
    return <span className="font-mono">{val > 0 ? `-${val.toFixed(1)} min` : `${val.toFixed(1)} min`}</span>;
  }

  function formatValue(rec: DynamicReroutingExperimentRecord, col: typeof columns[number]): React.ReactNode {
    const val = (rec as Record<string, unknown>)[col.key];
    if (val === null || val === undefined) {
      if (['incidentAdjustedRemainingTravelMinutes', 'revisedRemainingTravelMinutes', 'delayAvoidedMinutes'].includes(col.key)) {
        return '—';
      }
      return '—';
    }
    switch (col.key) {
      case 'initialAlgorithm':
        return rec.initialAlgorithmLabel;
      case 'reroutingAlgorithm':
        return rec.reroutingAlgorithmLabel;
      case 'affectedVehicleIds':
        return Array.isArray(val) ? val.join(', ') || '—' : String(val);
      case 'incidentType':
        return rec.incidentType === 'road_closure' ? 'Road Closure' : 'Congestion Surge';
      case 'reroutingRuntimeMs':
        return <span className="font-mono">{(val as number).toFixed(1)} {col.unit}</span>;
      case 'incidentAdjustedRemainingTravelMinutes':
        return val === null || val === undefined
          ? <span className="text-xs text-slate-500">Blocked</span>
          : formatTime(val as number, col.unit || '');
      case 'revisedRemainingTravelMinutes':
        return val === null || val === undefined
          ? '—'
          : formatTime(val as number, col.unit || '');
      case 'delayAvoidedMinutes':
        return formatDelay(val as number | null);
      case 'revisedFeasible':
        return (
          <span className="inline-flex items-center justify-center w-5 h-5">
            {rec.revisedFeasible ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600" />
            )}
          </span>
        );
      default:
        if (col.mono) return <span className="font-mono">{val as number} {col.unit || ''}</span>;
        return String(val);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Experiment Group: {groupId.slice(-12)} — Dynamic Re-Routing Results
        </h4>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Zap className="w-3 h-3 text-amber-600" />
          <span>{records.length} record(s)</span>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="min-w-full text-[11px]">
          <thead className="bg-slate-50/80">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-2 py-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {records.map((rec) => (
              <tr key={rec.id}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-2 py-1.5 ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    }`}
                  >
                    {formatValue(rec, col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      <div className="text-[10px] text-slate-500 bg-slate-50/60 border border-slate-200 rounded-lg p-2 space-y-0.5">
        <div className="flex items-start gap-1">
          <ArrowRightLeft className="w-3 h-3 shrink-0 mt-0.5" />
          <span>
            "Route recovery achieved; direct delay comparison unavailable" shown when incident-adjusted
            time is null (original continuation was blocked).
          </span>
        </div>
        <div className="flex items-start gap-1">
          <TrendingDown className="w-3 h-3 shrink-0 mt-0.5" />
          <span>Negative delay-avoided values represent minutes saved versus incident-continued travel.</span>
        </div>
      </div>
    </div>
  );
};
