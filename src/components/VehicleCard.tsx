import React from 'react';
import { Vehicle } from '../types/domain';
import { VehicleRoute } from '../types/routing';
import { Truck, MapPin, Package, Clock, Navigation, CheckCircle2, AlertTriangle } from 'lucide-react';

interface VehicleCardProps {
  vehicle: Vehicle;
  route?: VehicleRoute;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({ vehicle, route }) => {
  // Theme color styles by vehicle ID
  const colorMap: Record<
    string,
    {
      border: string;
      badgeBg: string;
      badgeText: string;
      barFill: string;
      ring: string;
    }
  > = {
    V1: {
      border: 'border-blue-200 hover:border-blue-400',
      badgeBg: 'bg-blue-50',
      badgeText: 'text-blue-700',
      barFill: 'bg-blue-600',
      ring: 'ring-blue-500/20',
    },
    V2: {
      border: 'border-purple-200 hover:border-purple-400',
      badgeBg: 'bg-purple-50',
      badgeText: 'text-purple-700',
      barFill: 'bg-purple-600',
      ring: 'ring-purple-500/20',
    },
    V3: {
      border: 'border-teal-200 hover:border-teal-400',
      badgeBg: 'bg-teal-50',
      badgeText: 'text-teal-700',
      barFill: 'bg-teal-600',
      ring: 'ring-teal-500/20',
    },
  };

  const currentTheme = colorMap[vehicle.id] || colorMap.V1;
  const isRouted = Boolean(route);
  const currentLoad = route ? route.usedCapacity : vehicle.usedCapacity;
  const loadPercentage = (currentLoad / vehicle.capacity) * 100;
  const stopsCount = route ? route.customerIds.length : 0;

  return (
    <div
      className={`bg-white rounded-xl border ${currentTheme.border} p-4 shadow-sm transition-all duration-200 hover:shadow-md flex flex-col justify-between`}
    >
      <div>
        {/* Card Header */}
        <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-xs"
              style={{ backgroundColor: vehicle.color }}
            >
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{vehicle.label}</h3>
              <span className="text-[10px] text-slate-400 font-mono">ID: {vehicle.id}</span>
            </div>
          </div>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${currentTheme.badgeBg} ${currentTheme.badgeText}`}
          >
            Cap: {vehicle.capacity}u
          </span>
        </div>

        {/* Load Capacity Bar */}
        <div className="space-y-1 mb-3.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              Load Allocated
            </span>
            <span className="font-bold text-slate-800 font-mono">
              {currentLoad} / {vehicle.capacity} units
              {route && (
                <span className="text-[10px] font-normal text-slate-400 ml-1">
                  ({route.remainingCapacity}u left)
                </span>
              )}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${currentTheme.barFill}`}
              style={{ width: `${Math.max(0, Math.min(100, loadPercentage))}%` }}
            />
          </div>
        </div>

        {/* Status Properties Grid */}
        <div className="space-y-2 text-xs">
          <div className="flex items-start justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
              <Navigation className="w-3.5 h-3.5 text-slate-400" />
              Assigned Stops
            </span>
            <span className="font-semibold text-slate-800 text-right max-w-[170px] truncate" title={route?.customerIds.join(', ')}>
              {stopsCount > 0 ? (
                <>
                  <strong className="text-slate-900">{stopsCount} stops</strong>
                  <span className="text-[10px] font-normal text-slate-500 block truncate font-mono">
                    {route?.customerIds.join(', ')}
                  </span>
                </>
              ) : (
                'None'
              )}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              Current Location
            </span>
            <span className="font-semibold text-slate-700">Central Hub</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500">Route Status</span>
            {isRouted ? (
              stopsCount > 0 ? (
                route!.feasible ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Planned (Feasible)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    Infeasible
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  Inactive (0 stops)
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Awaiting optimization
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 bg-slate-50/60 -mx-4 -mb-4 p-3 rounded-b-xl">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-400 block">Route Time</span>
            <span className="text-xs font-mono font-bold text-slate-700">
              {route ? `${route.travelMinutes.toFixed(1)} min` : '—'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-400 block">Distance</span>
            <span className="text-xs font-mono font-bold text-slate-700">
              {route ? `${route.distanceKm.toFixed(1)} km` : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

