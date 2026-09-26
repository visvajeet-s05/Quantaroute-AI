import React from 'react';
import { 
  Clock, 
  Milestone, 
  Award, 
  CheckCircle2, 
  ShieldAlert, 
  Timer, 
  Activity, 
  Leaf, 
  Info,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { RoutePlan, RoutePlanValidationResult } from '../types/routing';

interface KpiPanelProps {
  totalCustomers: number;
  routePlan?: RoutePlan | null;
  validationResult?: RoutePlanValidationResult | null;
}

export const KpiPanel: React.FC<KpiPanelProps> = ({
  totalCustomers,
  routePlan,
  validationResult,
}) => {
  const isEvaluated = Boolean(routePlan);

  const kpis = [
    {
      title: 'Total Travel Time',
      value: isEvaluated ? `${routePlan!.totalTravelMinutes.toFixed(1)}` : '—',
      unit: 'minutes',
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Total Distance',
      value: isEvaluated ? `${routePlan!.totalDistanceKm.toFixed(1)}` : '—',
      unit: 'km',
      icon: Milestone,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      title: 'Routing Score',
      value: isEvaluated ? `${routePlan!.routingScore.toFixed(1)}` : '—',
      unit: 'objective cost (F)',
      icon: Award,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
    },
    {
      title: 'Customers Assigned',
      value: isEvaluated
        ? `${routePlan!.customersServed} / ${totalCustomers}`
        : `0 / ${totalCustomers}`,
      unit: 'stops planned',
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Fleet Feasibility',
      value: isEvaluated
        ? routePlan!.isFeasible
          ? 'Feasible'
          : 'Infeasible'
        : 'Not evaluated',
      unit: 'capacity & continuity',
      icon: ShieldAlert,
      color: isEvaluated
        ? routePlan!.isFeasible
          ? 'text-emerald-600'
          : 'text-amber-600'
        : 'text-slate-600',
      bgColor: isEvaluated
        ? routePlan!.isFeasible
          ? 'bg-emerald-50'
          : 'bg-amber-50'
        : 'bg-slate-100',
    },
    {
      title: 'Optimization Runtime',
      value: isEvaluated ? `${routePlan!.runtimeMs.toFixed(2)}` : '—',
      unit: 'milliseconds',
      icon: Timer,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Congestion Exposure',
      value: isEvaluated ? `+${routePlan!.congestionPenalty.toFixed(1)}` : '—',
      unit: 'penalty minutes',
      icon: Activity,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      title: 'Estimated Emissions',
      value: 'Not modelled',
      unit: 'kg CO₂e baseline',
      icon: Leaf,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
    },
  ];

  const getConstraintStatus = (status: boolean | undefined) => {
    if (!isEvaluated || status === undefined) {
      return { label: 'Not evaluated', color: 'bg-slate-100 text-slate-500 border-slate-200' };
    }
    return status
      ? { label: 'Passed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      : { label: 'Failed', color: 'bg-rose-50 text-rose-700 border-rose-200' };
  };

  const constraints = [
    {
      name: 'Capacity compliance',
      ...getConstraintStatus(validationResult?.capacityCompliant),
    },
    {
      name: 'Customer coverage',
      ...getConstraintStatus(validationResult?.customerCoverageComplete),
    },
    {
      name: 'Road availability',
      ...getConstraintStatus(validationResult?.noBlockedEdgesUsed),
    },
    {
      name: 'Duplicate delivery check',
      ...getConstraintStatus(validationResult?.noDuplicateCustomerService),
    },
  ];

  return (
    <div className="flex flex-col gap-4 text-slate-800">
      {/* KPI Cards Grid */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
            Fleet Performance KPIs
          </h2>
          <span
            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
              isEvaluated
                ? routePlan?.algorithm === 'pso'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {isEvaluated
              ? `${routePlan?.algorithm === 'pso' ? 'Classical PSO' : 'Greedy Baseline'} Active`
              : 'Awaiting Optimizer'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {kpis.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div
                key={idx}
                className="bg-slate-50/70 border border-slate-150 rounded-lg p-2.5 flex flex-col justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-[11px] font-medium text-slate-600 truncate mr-1">
                    {kpi.title}
                  </span>
                  <div className={`p-1 rounded-md ${kpi.bgColor}`}>
                    <Icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                  </div>
                </div>
                <div>
                  <div className="text-base font-bold text-slate-800 font-mono tracking-tight">
                    {kpi.value}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {kpi.unit}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Informational note */}
        <div className="mt-3 flex items-start gap-2 bg-blue-50/60 border border-blue-100/80 rounded-lg p-2.5 text-[11px] text-blue-900/80 leading-relaxed">
          <Info className="w-3.5 h-3.5 shrink-0 text-blue-600 mt-0.5" />
          <span>
            {isEvaluated
              ? `Metrics reflect actual road paths, congestion factors, and vehicle capacity constraints computed by ${
                  routePlan?.algorithm === 'pso' ? 'Classical PSO' : 'the Greedy baseline'
                }.`
              : 'Metrics will be calculated from actual road paths and fleet constraints after optimization.'}
          </span>
        </div>
      </div>

      {/* Constraint Status Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
            Constraint Evaluation Status
          </h2>
          <span className="text-[10px] text-slate-400 font-medium">
            {isEvaluated ? 'Evaluated' : 'Pre-Run'}
          </span>
        </div>

        <div className="space-y-2">
          {constraints.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
            >
              <span className="text-slate-700 font-medium">{item.name}</span>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border ${item.color}`}
              >
                {item.label === 'Passed' && <CheckCircle className="w-3 h-3 text-emerald-600" />}
                {item.label === 'Failed' && <XCircle className="w-3 h-3 text-rose-600" />}
                {item.label === 'Not evaluated' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                )}
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

