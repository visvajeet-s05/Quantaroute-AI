/**
 * Capstone Results Panel
 * QuantaRoute AI — Data-driven results from actual experiment history records.
 */

import React, { useState, useMemo } from 'react';
import { ExperimentHistory, InitialRoutingExperimentRecord, DynamicReroutingExperimentRecord } from '../types/experiments';
import { experimentHistoryToGroups } from '../utils/experimentGroupUtils';
import { BarChart3, Database, Sparkle, Route, ExternalLink, Zap } from 'lucide-react';

interface ResultsPanelProps {
  history: ExperimentHistory;
  onSelectRecord?: (record: InitialRoutingExperimentRecord) => void;
}

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0) return <span className="text-slate-400">No convergence data</span>;
  const points = data
    .map((v, i) => {
      const x = (i / Math.max(1, data.length - 1)) * 100;
      const y = 100 - v;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={100} height={32} className="inline-block">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        points={points}
        className="text-cyan-600"
        transform="scale(1 0.32)"
        style={{ transformOrigin: '0 0' }}
      />
    </svg>
  );
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ history, onSelectRecord }) => {
  const groups = useMemo(() => experimentHistoryToGroups(history), [history]);

  const [selectedGroupId, setSelectedGroupId] = useState(history.length > 0 ? groups[0]?.groupId : '');

  const selectedGroup = useMemo(
    () => groups.find((g) => g.groupId === selectedGroupId),
    [groups, selectedGroupId]
  );

  const initialRecords = useMemo(
    () =>
      selectedGroup?.records.filter((r) => r.runType === 'initial_routing') as InitialRoutingExperimentRecord[] | undefined,
    [selectedGroup]
  );

  const dynamicRecords = useMemo(
    () =>
      selectedGroup?.records.filter((r) => r.runType === 'dynamic_rerouting') as DynamicReroutingExperimentRecord[] | undefined,
    [selectedGroup]
  );

  const bestFeasibleRecord = useMemo(() => {
    if (!initialRecords) return null;
    const feasible = initialRecords.filter((r) => r.feasible);
    if (feasible.length === 0) return null;
    return feasible.reduce((best, curr) =>
      curr.routingScore < best.routingScore ? curr : best
    );
  }, [initialRecords]);

  // Check if we have a complete group (Greedy + PSO + QPSO)
  const hasCompleteGroup = useMemo(() => {
    if (!initialRecords || initialRecords.length < 3) return false;
    const algos = new Set(initialRecords.map((r) => r.algorithm));
    return algos.has('greedy') && algos.has('pso') && algos.has('qpso');
  }, [initialRecords]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Capstone Results</h2>
        <p className="text-xs text-slate-500 mt-0.5">Actual experiment records from local history</p>
      </div>

      {history.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
          <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-600 font-medium">No capstone results available</p>
          <p className="text-xs text-slate-500 mt-1">
            Run a controlled benchmark to generate capstone results.
          </p>
        </div>
      ) : (
        <>
          {/* Group Selector */}
          {groups.length > 1 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Experiment Group</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
              >
                {groups.map((g) => (
                  <option key={g.groupId} value={g.groupId}>
                    {g.label} — {g.records.length} records, {g.feasibleCount} feasible
                  </option>
                ))}
              </select>
            </div>
          )}

          {!selectedGroup ? (
            <div className="text-slate-500">Select an experiment group to view results.</div>
          ) : !hasCompleteGroup ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
              <p>Selected experiment group does not contain a complete initial-routing set (Greedy + PSO + QPSO).</p>
            </div>
          ) : (
            <>
              {/* Initial Routing Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-slate-600" />
                  Initial Routing Results
                </h3>
                <div className="text-xs text-slate-500 mb-1">Lower routing score is better. Infeasible results are excluded from best-score claim.</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Algorithm</th>
                        <th className="px-2 py-1.5 text-left">Preset</th>
                        <th className="px-2 py-1.5 text-right">Score</th>
                        <th className="px-2 py-1.5 text-right">Travel Time</th>
                        <th className="px-2 py-1.5 text-right">Distance</th>
                        <th className="px-2 py-1.5 text-right">Congestion</th>
                        <th className="px-2 py-1.5 text-right">Assigned</th>
                        <th className="px-2 py-1.5 text-right">Unserved</th>
                        <th className="px-2 py-1.5 text-center">Feasible</th>
                        <th className="px-2 py-1.5 text-right">Runtime</th>
                        <th className="px-2 py-1.5 text-right">Evals</th>
                      </tr>
                    </thead>
                    <tbody>
                      {initialRecords!.map((r) => {
                        const isBest = bestFeasibleRecord && r.id === bestFeasibleRecord.id;
                        const feasible = r.feasible;
                        return (
                          <tr
                            key={r.id}
                            className={`${
                              isBest ? 'bg-emerald-50/50 font-medium' : 'bg-white'
                            } ${!feasible ? 'opacity-70' : ''} ${onSelectRecord ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                            onClick={() => onSelectRecord?.(r)}
                          >
                            <td className="px-2 py-1.5">{r.algorithmLabel}</td>
                            <td className="px-2 py-1.5">{r.optimizerPreset}</td>
                            <td className="px-2 py-1.5 text-right font-mono">{r.routingScore.toFixed(2)}</td>
                            <td className="px-2 py-1.5 text-right">{r.totalTravelMinutes.toFixed(2)}</td>
                            <td className="px-2 py-1.5 text-right">{r.totalDistanceKm.toFixed(2)}</td>
                            <td className="px-2 py-1.5 text-right">{r.congestionPenalty.toFixed(4)}</td>
                            <td className="px-2 py-1.5 text-right">{r.customersAssigned}</td>
                            <td className="px-2 py-1.5 text-right">{r.customersUnserved}</td>
                            <td className="px-2 py-1.5 text-center">
                              {feasible ? '✓' : '✗'}
                              {!feasible && <span className="text-rose-600"> (infeasible)</span>}
                            </td>
                            <td className="px-2 py-1.5 text-right">{r.runtimeMs.toFixed(0)} ms</td>
                            <td className="px-2 py-1.5 text-right">{r.candidateEvaluations ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {bestFeasibleRecord && (
                  <div className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded">
                    Lowest measured feasible score: {bestFeasibleRecord.algorithmLabel} = {bestFeasibleRecord.routingScore.toFixed(2)}
                  </div>
                )}
                {initialRecords!.filter((r) => !r.feasible).length > 0 && (
                  <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded">
                    {initialRecords!.filter((r) => !r.feasible).length} infeasible result(s) excluded from score comparison.
                  </div>
                )}
              </div>

              {/* Convergence Summary */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1.5">
                  <Sparkle className="w-3.5 h-3.5 text-slate-600" />
                  Convergence Summary
                </h3>
                <div className="space-y-2">
                  {(initialRecords || []).filter((r) => r.convergenceHistory && r.convergenceHistory.length > 0).map((r) => {
                    const history = r.convergenceHistory!;
                    const first = history[0];
                    const last = history[history.length - 1];
                    const best = Math.min(...history);
                    const scoreChange = last - first;
                    return (
                      <div key={r.id} className="border border-slate-200 rounded-lg p-3 bg-white space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800">{r.algorithmLabel} ({r.optimizerPreset})</span>
                          <span className={scoreChange < 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            {scoreChange < 0 ? '↓' : '↑'} {Math.abs(scoreChange).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span>Converged: {history.length} measurements</span>
                          <span className="font-mono">First: {first.toFixed(2)}</span>
                          <span className="font-mono">Final: {last.toFixed(2)}</span>
                          <span className="font-mono">Best: {best.toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          <Sparkline data={history} />
                        </div>
                      </div>
                    );
                  })}
                  {(initialRecords || []).filter((r) => r.convergenceHistory && r.convergenceHistory.length > 0).length === 0 && (
                    <div className="text-xs text-slate-400">No convergence records available.</div>
                  )}
                </div>
              </div>

              {/* Dynamic Results */}
              {dynamicRecords && dynamicRecords.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1.5">
                    <Route className="w-3.5 h-3.5 text-slate-600" />
                    Dynamic Re-routing Results
                  </h3>
                  <div className="space-y-3">
                    {dynamicRecords.map((r) => (
                      <div key={r.id} className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800">
                            {r.initialAlgorithmLabel} → {r.reroutingAlgorithmLabel}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            r.revisedFeasible
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {r.revisedFeasible ? 'Feasible' : 'Infeasible'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <span className="text-slate-500">Incident:</span>
                          <span className="font-mono text-slate-700">{r.incidentType} on {r.incidentEdgeIds.join(', ')}</span>
                          <span className="text-slate-500">Affected Vehicles:</span>
                          <span className="font-mono text-slate-700">{r.affectedVehicleIds.join(', ') || 'None'}</span>
                          <span className="text-slate-500">Locked Stops:</span>
                          <span className="font-mono text-slate-700">{r.lockedCustomerCount}</span>
                          <span className="text-slate-500">Pending Stops:</span>
                          <span className="font-mono text-slate-700">{r.pendingCustomerCount}</span>
                          <span className="text-slate-500">Re-route Runtime:</span>
                          <span className="font-mono text-slate-700">{r.reroutingRuntimeMs.toFixed(1)} ms</span>
                          {r.originalRemainingTravelMinutes !== null && (
                            <>
                              <span className="text-slate-500">Original Remaining:</span>
                              <span className="font-mono text-slate-700">{r.originalRemainingTravelMinutes.toFixed(2)} min</span>
                            </>
                          )}
                          {r.incidentAdjustedRemainingTravelMinutes !== null && (
                            <>
                              <span className="text-slate-500">Incident-Adjusted Remaining:</span>
                              <span className="font-mono text-slate-700">{r.incidentAdjustedRemainingTravelMinutes.toFixed(2)} min</span>
                            </>
                          )}
                          {r.revisedRemainingTravelMinutes !== null && (
                            <>
                              <span className="text-slate-500">Revised Remaining:</span>
                              <span className="font-mono text-slate-700">{r.revisedRemainingTravelMinutes.toFixed(2)} min</span>
                            </>
                          )}
                          {r.delayAvoidedMinutes !== null && r.revisedRemainingTravelMinutes !== null && (
                            <React.Fragment key="delay">
                              <span className="text-slate-500">Delay Avoided:</span>
                              <span className="font-mono text-emerald-700">{r.delayAvoidedMinutes.toFixed(2)} min</span>
                            </React.Fragment>
                          )}
                        </div>
                        {r.warnings.length > 0 && (
                          <div className="text-xs text-amber-700">
                            Warnings: {r.warnings.join(' | ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Auto-generated Findings */}
          {bestFeasibleRecord && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                Auto-Generated Findings
              </h3>
              {(initialRecords || []).map((r) => {
                if (!r.feasible) {
                  return (
                    <p key={`infeasible-${r.id}`} className="text-xs text-slate-600">
                      {r.algorithmLabel} produced an infeasible plan in this recorded scenario and is excluded from score comparison.
                    </p>
                  );
                }
                return null;
              })}
              <p className="text-xs text-slate-600">
                For the selected scenario experiment group, {bestFeasibleRecord.algorithmLabel} produced the lowest measured feasible routing score of {bestFeasibleRecord.routingScore.toFixed(2)}.
              </p>
              {(dynamicRecords || []).map((r) => (
                <p key={`dynamic-${r.id}`} className="text-xs text-slate-600">
                  After the recorded {r.incidentType}, {r.reroutingAlgorithmLabel} produced a {r.revisedFeasible ? 'feasible' : 'infeasible'} revised plan in {r.reroutingRuntimeMs.toFixed(0)} ms.
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
