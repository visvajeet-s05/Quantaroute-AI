import React from 'react';
import { X, CheckCircle2, XCircle, ShieldCheck, Hash, Calendar, Users, Truck, Route, Clock, Zap, Cpu, Sparkles, BarChart3 } from 'lucide-react';
import { ScenarioValidationReport } from '../types/domain';
import { DijkstraUnitTestResult } from '../types/pathfinding';
import { GreedyUnitTestResult, PsoUnitTestResult, QpsoUnitTestResult, ReroutingUnitTestResult } from '../types/routing';
import { ExperimentUnitTestResult } from '../types/experiments';
import { CapstoneUnitTestResult } from '../types/capstone';

interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ScenarioValidationReport;
  dijkstraTests?: DijkstraUnitTestResult[];
  greedyTests?: GreedyUnitTestResult[];
  psoTests?: PsoUnitTestResult[];
  qpsoTests?: QpsoUnitTestResult[];
  reroutingTests?: ReroutingUnitTestResult[];
  experimentTests?: ExperimentUnitTestResult[];
  capstoneTests?: CapstoneUnitTestResult[];
}

export const ValidationModal: React.FC<ValidationModalProps> = ({
  isOpen,
  onClose,
  report,
  dijkstraTests = [],
  greedyTests = [],
  psoTests = [],
  qpsoTests = [],
  reroutingTests = [],
  experimentTests = [],
  capstoneTests = [],
}) => {
  if (!isOpen) return null;

  const allDijkstraPassed = dijkstraTests.length > 0 && dijkstraTests.every((t) => t.passed);
  const allGreedyPassed = greedyTests.length === 0 || greedyTests.every((t) => t.passed);
  const allPsoPassed = psoTests.length === 0 || psoTests.every((t) => t.passed);
  const allQpsoPassed = qpsoTests.length === 0 || qpsoTests.every((t) => t.passed);
  const allReroutingPassed = reroutingTests.length === 0 || reroutingTests.every((t) => t.passed);
  const allExperimentPassed = experimentTests.length === 0 || experimentTests.every((t) => t.passed);
  const allCapstonePassed = capstoneTests.length === 0 || capstoneTests.every((t) => t.passed);
  const overallValid =
    report.isValid &&
    (dijkstraTests.length === 0 || allDijkstraPassed) &&
    allGreedyPassed &&
    allPsoPassed &&
    allQpsoPassed &&
    allReroutingPassed &&
    allExperimentPassed &&
    allCapstonePassed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-800"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                overallValid
                  ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                  : 'bg-rose-500/20 border border-rose-400/40 text-rose-300'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Scenario & Algorithm Specs</h2>
              <p className="text-xs text-slate-400">Automated Integrity, Domain Constraints, Pathfinding & Dynamic Re-Routing Tests</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Summary Banner */}
        <div
          className={`px-6 py-3 border-b flex items-center justify-between ${
            overallValid
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            {overallValid ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>All Domain Invariants & Pathfinding Unit Tests Passed</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Verification Issue Detected</span>
              </>
            )}
          </div>
          <div className="text-[11px] font-mono text-slate-600">
            PRNG Seed: <strong>{report.seed}</strong>
          </div>
        </div>

        {/* Content Details */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-center">
              <span className="text-[10px] text-slate-400 block font-medium">Customers</span>
              <span className="text-sm font-bold text-slate-800">{report.totalCustomers}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-center">
              <span className="text-[10px] text-slate-400 block font-medium">Total Demand</span>
              <span className="text-sm font-bold text-slate-800">{report.totalDemand}u</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-center">
              <span className="text-[10px] text-slate-400 block font-medium">Fleet Capacity</span>
              <span className="text-sm font-bold text-slate-800">{report.maxFleetCapacity}u</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-center">
              <span className="text-[10px] text-slate-400 block font-medium">Vehicles</span>
              <span className="text-sm font-bold text-slate-800">{report.totalVehicles}</span>
            </div>
          </div>

          {/* Section 1: Pathfinding Checks (Dijkstra Shortest-Path Engine) */}
          {dijkstraTests.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <Route className="w-3.5 h-3.5 text-cyan-600" />
                  Pathfinding Checks (Dijkstra Engine)
                </h4>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">
                  Temporary / Non-destructive Test Suite
                </span>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {dijkstraTests.map((t) => (
                  <div key={t.id} className="p-3 bg-white space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                          <span>{t.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {t.runtimeMs.toFixed(3)} ms
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">{t.summary}</div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                          t.passed
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {t.passed ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Pass
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Fail
                          </>
                        )}
                      </span>
                    </div>

                    {/* Expandable test detail assertions */}
                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-[11px] font-mono text-slate-500 space-y-0.5">
                      {t.details.map((d, dIdx) => (
                        <div key={dIdx} className="leading-tight">
                          • {d}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Greedy Routing Baseline Unit Tests */}
          {greedyTests.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-600" />
                  Greedy Baseline Verification Tests (5 Invariants)
                </h4>
                <span className="text-[11px] font-medium text-slate-500 font-mono">
                  {greedyTests.filter((t) => t.passed).length}/{greedyTests.length} Passed
                </span>
              </div>

              <div className="space-y-2">
                {greedyTests.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-800 flex items-center gap-2">
                          <span>{t.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono font-normal">
                            ({t.runtimeMs} ms)
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">{t.summary}</div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                          t.passed
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {t.passed ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Pass
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Fail
                          </>
                        )}
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-[11px] font-mono text-slate-500 space-y-0.5">
                      {t.details.map((d, dIdx) => (
                        <div key={dIdx} className="leading-tight">
                          • {d}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Classical PSO Checks (5 Invariants) */}
          {psoTests.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                  Classical PSO Checks (5 Invariants)
                </h4>
                <span className="text-[11px] font-medium text-slate-500 font-mono">
                  {psoTests.filter((t) => t.passed).length}/{psoTests.length} Passed
                </span>
              </div>

              <div className="space-y-2">
                {psoTests.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-800 flex items-center gap-2">
                          <span>{t.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono font-normal">
                            ({t.runtimeMs} ms)
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">{t.summary}</div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                          t.passed
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {t.passed ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Pass
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Fail
                          </>
                        )}
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-[11px] font-mono text-slate-500 space-y-0.5">
                      {t.details.map((d, dIdx) => (
                        <div key={dIdx} className="leading-tight">
                          • {d}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Quantum-Inspired PSO Baseline Verification Tests */}
          {qpsoTests.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  Quantum-Inspired PSO Engine Verification
                </h4>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                    allQpsoPassed
                      ? 'bg-teal-50 text-teal-700 border-teal-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {qpsoTests.filter((t) => t.passed).length}/{qpsoTests.length} Passed
                </span>
              </div>

              <div className="space-y-2">
                {qpsoTests.map((t, idx) => (
                  <div
                    key={t.id || `qpso_test_${idx}`}
                    className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-800 flex items-center gap-2">
                          <span>{t.name}</span>
                          {t.runtimeMs !== undefined && (
                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                              ({t.runtimeMs} ms)
                            </span>
                          )}
                        </div>
                        {t.summary && (
                          <div className="text-[11px] text-slate-600 mt-0.5">{t.summary}</div>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                          t.passed
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {t.passed ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Pass
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Fail
                          </>
                        )}
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-[11px] font-mono text-slate-500">
                      • {t.details}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 5: Dynamic Incident & Re-Routing Verification Tests */}
          {reroutingTests.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                   Dynamic Re-routing Tests (6 Invariants)
                </h4>
                <span className="text-[11px] text-slate-500 font-mono">
                  {reroutingTests.filter((t) => t.passed).length}/{reroutingTests.length} Passed
                </span>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {reroutingTests.map((t, idx) => (
                  <div key={t.id || idx} className="p-3 space-y-1.5 hover:bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs">
                        <span>{idx + 1}.</span>
                        <span>{t.name}</span>
                        {t.runtimeMs !== undefined && (
                          <span className="text-[10px] text-slate-400 font-mono font-normal">
                            ({t.runtimeMs} ms)
                          </span>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                          t.passed
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {t.passed ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Pass
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Fail
                          </>
                        )}
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-[11px] font-mono text-slate-500">
                      • {t.details}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

           {/* Section 6: Experiment Management Verification Tests */}
           {experimentTests.length > 0 && (
             <div className="space-y-2">
               <div className="flex items-center justify-between">
                 <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                   <BarChart3 className="w-3.5 h-3.5 text-cyan-600" />
                   Experiment Management Checks (6 Invariants)
                 </h4>
                 <span className="text-[11px] font-mono">
                   {experimentTests.filter((t) => t.passed).length}/{experimentTests.length} Passed
                 </span>
               </div>

               <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                 {experimentTests.map((t) => (
                   <div key={t.id} className="p-3 hover:bg-slate-50/50 space-y-1.5">
                     <div className="flex items-start justify-between gap-3">
                       <div>
                         <div className="font-semibold text-slate-800 flex items-center gap-2">
                           <span>{t.id.split('-')[1]}.</span>
                           <span>{t.name}</span>
                           <span className="text-[10px] text-slate-400 font-mono font-normal">
                             ({t.runtimeMs.toFixed(0)} ms)
                           </span>
                         </div>
                         <div className="text-[11px] text-slate-600 mt-0.5">{t.summary}</div>
                       </div>
                       <span
                         className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                           t.passed
                             ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                             : 'bg-rose-50 text-rose-700 border border-rose-200'
                         }`}
                       >
                         {t.passed ? (
                           <>
                             <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                             Pass
                           </>
                         ) : (
                           <>
                             <XCircle className="w-3 h-3 text-rose-600" />
                             Fail
                           </>
                         )}
                       </span>
                     </div>

                     <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-[11px] font-mono text-slate-500">
                       • {t.details}
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           )}

           {/* Section 6: Scenario Domain Invariants */}
           <div className="space-y-2">
             <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
               <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
               Scenario Invariant Checks
             </h4>
             <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
              {report.checks.map((check, idx) => (
                <div key={idx} className="p-3 flex items-start justify-between gap-3 bg-white">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <span>{idx + 1}.</span>
                      <span>{check.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">{check.detail}</div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                      check.passed
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {check.passed ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Pass
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 text-rose-600" />
                        Fail
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

         {/* Section 8: Capstone Presentation Checks */}
         {capstoneTests.length > 0 && (
           <div className="space-y-2">
             <div className="flex items-center justify-between">
               <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                 <BarChart3 className="w-3.5 h-3.5 text-cyan-600" />
                 Capstone Presentation Checks (5 Invariants)
               </h4>
               <span className="text-[11px] font-mono">
                 {capstoneTests.filter((t) => t.passed).length}/{capstoneTests.length} Passed
               </span>
             </div>

             <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
               {capstoneTests.map((t) => (
                 <div key={t.id} className="p-3 hover:bg-slate-50/50 space-y-1.5">
                   <div className="flex items-start justify-between gap-3">
                     <div>
                       <div className="font-semibold text-slate-800 flex items-center gap-2">
                         <span>{t.id.split('-')[1]}.</span>
                         <span>{t.name}</span>
                       </div>
                       <div className="text-[11px] text-slate-600 mt-0.5">{t.summary}</div>
                     </div>
                     <span
                       className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                         t.passed
                           ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                           : 'bg-rose-50 text-rose-700 border border-rose-200'
                       }`}
                     >
                       {t.passed ? (
                         <>
                           <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                           Pass
                         </>
                       ) : (
                         <>
                           <XCircle className="w-3 h-3 text-rose-600" />
                           Fail
                         </>
                       )}
                     </span>
                   </div>

                   <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-[11px] font-mono text-slate-500">
                     • {t.details}
                   </div>
                 </div>
               ))}
             </div>
           </div>
         )}

         {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

