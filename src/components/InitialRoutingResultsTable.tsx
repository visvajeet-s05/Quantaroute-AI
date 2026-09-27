import React from 'react';
import { InitialRoutingExperimentRecord } from '../types/experiments';
import { CheckCircle2, XCircle, Hash } from 'lucide-react';

interface InitialRoutingResultsTableProps {
  groupId: string;
  records: InitialRoutingExperimentRecord[];
  onSelectRecord?: (record: InitialRoutingExperimentRecord) => void;
}

export const InitialRoutingResultsTable: React.FC<InitialRoutingResultsTableProps> = ({
  groupId,
  records,
  onSelectRecord,
}) => {
  if (records.length === 0) {
    return <div className="text-xs text-slate-400">No initial routing records for this group.</div>;
  }

  const feasibleRecords = records.filter((r) => r.feasible);
  const bestRecord =
    feasibleRecords.length > 0
      ? feasibleRecords.reduce((best, r) =>
          r.routingScore < best.routingScore ? r : best
        )
      : null;

  const columns = [
    { key: 'algorithm', label: 'Algorithm' },
    { key: 'optimizerPreset', label: 'Preset' },
    { key: 'routingScore', label: 'Score', align: 'right' as const, mono: true },
    { key: 'totalTravelMinutes', label: 'Travel Time', align: 'right' as const, mono: true, unit: 'min' },
    { key: 'totalDistanceKm', label: 'Distance', align: 'right' as const, mono: true, unit: 'km' },
    { key: 'congestionPenalty', label: 'Congestion', align: 'right' as const, mono: true },
    { key: 'customersAssigned', label: 'Assigned', align: 'right' as const },
    { key: 'customersUnserved', label: 'Unserved', align: 'right' as const },
    { key: 'feasible', label: 'Feasible', align: 'center' as const },
    { key: 'runtimeMs', label: 'Runtime', align: 'right' as const, mono: true, unit: 'ms' },
    { key: 'candidateEvaluations', label: 'Evaluations', align: 'right' as const, mono: true },
  ];

  function formatValue(rec: InitialRoutingExperimentRecord, col: typeof columns[number]): React.ReactNode {
    const val = (rec as Record<string, unknown>)[col.key];
    if (val === null || val === undefined) return '—';
    if (col.key === 'algorithm') {
      return rec.algorithmLabel;
    }
    if (col.key === 'optimizerPreset') {
      return rec.optimizerPreset;
    }
    if (col.key === 'feasible') {
      return (
        <span className="inline-flex items-center justify-center w-5 h-5">
          {rec.feasible ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-600" />
          )}
        </span>
      );
    }
    if (col.mono) {
      const num = typeof val === 'number' ? val : parseFloat(String(val));
      if (isNaN(num)) return '—';
      const formatted = col.unit ? `${num.toFixed(col.key === 'routingScore' || col.key === 'runtimeMs' ? 2 : 1)}` : String(num);
      const unitStr = col.unit ? ` ${col.unit}` : '';
      return <span className="font-mono">{formatted}{unitStr}</span>;
    }
    return String(val);
  }

  const bestScore = bestRecord?.routingScore ?? null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Experiment Group: {groupId.slice(-12)} — Initial Routing Comparison
        </h4>
        {bestRecord && (
          <span className="text-[10px] text-slate-500 italic">
            Lowest measured feasible score in this experiment group: {bestScore?.toFixed(2)}
          </span>
        )}
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
            {records.map((rec) => {
              const isBest = bestRecord && rec.id === bestRecord.id;
              return (
                <tr 
                  key={rec.id} 
                  className={`${isBest ? 'bg-amber-50/30' : ''} ${onSelectRecord ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                  onClick={() => onSelectRecord?.(rec)}
                >
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
                      {isBest && col.key === 'routingScore' ? (
                        <span className="font-mono font-semibold text-amber-800">
                          {rec.routingScore.toFixed(2)} <span className="text-[10px] text-slate-500">(best)</span>
                        </span>
                      ) : (
                        formatValue(rec, col)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
