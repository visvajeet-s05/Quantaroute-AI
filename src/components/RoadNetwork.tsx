import React, { useState } from 'react';
import { Customer, Edge, Node, Vehicle } from '../types/domain';
import { PathResult } from '../types/pathfinding';
import { DynamicIncident, RoutePlan, VehicleDynamicState } from '../types/routing';
import { Warehouse, Info, ZoomIn, ZoomOut, RotateCcw, AlertTriangle, Route, Truck, CheckCircle2, Zap } from 'lucide-react';

interface RoadNetworkProps {
  nodes: Node[];
  edges: Edge[];
  customers: Customer[];
  vehicles: Vehicle[];
  depotNodeId: string;
  pathResult?: PathResult | null;
  targetCustomerId?: string | null;
  routePlan?: RoutePlan | null;
  vehicleDynamicStates?: VehicleDynamicState[] | null;
  incident?: DynamicIncident | null;
}

export const RoadNetwork: React.FC<RoadNetworkProps> = ({
  nodes,
  edges,
  customers,
  vehicles,
  depotNodeId,
  pathResult,
  targetCustomerId,
  routePlan,
  vehicleDynamicStates,
  incident,
}) => {
  const [hoveredCustomer, setHoveredCustomer] = useState<Customer | null>(null);
  const [hoveredVehicle, setHoveredVehicle] = useState<Vehicle | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // SVG Dimension constants
  const PADDING = 60;
  const CELL_SIZE = 80;
  const SVG_WIDTH = 840;
  const SVG_HEIGHT = 840;

  // Node to pixel mapper
  const getNodePos = (x: number, y: number) => ({
    cx: PADDING + x * CELL_SIZE,
    cy: PADDING + y * CELL_SIZE,
  });

  const nodeMap = new Map<string, Node>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const customerMap = new Map<string, Customer>();
  customers.forEach((c) => customerMap.set(c.nodeId, c));

  const depotNode = nodeMap.get(depotNodeId);
  const depotPos = depotNode ? getNodePos(depotNode.x, depotNode.y) : { cx: 300, cy: 380 };

  // Map customer assignment to vehicle info
  const customerVehicleMap = new Map<
    string,
    { vehicleId: string; color: string; label: string; stopIndex: number }
  >();
  const unservedCustomerSet = new Set<string>();

  if (routePlan) {
    routePlan.vehicleRoutes.forEach((vr) => {
      const vDef = vehicles.find((v) => v.id === vr.vehicleId);
      const color =
        vDef?.color ||
        (vr.vehicleId === 'V1' ? '#2563eb' : vr.vehicleId === 'V2' ? '#9333ea' : '#0d9488');
      vr.customerIds.forEach((cId, idx) => {
        customerVehicleMap.set(cId, {
          vehicleId: vr.vehicleId,
          color,
          label: vr.vehicleLabel,
          stopIndex: idx + 1,
        });
      });
    });

    routePlan.unservedCustomerIds.forEach((id) => unservedCustomerSet.add(id));
  }

  // Dynamic Incident & Served Customers tracking
  const deliveredCustomerSet = new Set<string>();
  const vehicleDynamicStateMap = new Map<string, VehicleDynamicState>();
  if (vehicleDynamicStates) {
    vehicleDynamicStates.forEach((vs) => {
      vehicleDynamicStateMap.set(vs.vehicleId, vs);
      vs.deliveredCustomerIds.forEach((cId) => deliveredCustomerSet.add(cId));
    });
  }

  const incidentAffectedEdgeSet = new Set<string>();
  if (incident?.active && incident.affectedEdgeIds) {
    incident.affectedEdgeIds.forEach((eId) => incidentAffectedEdgeSet.add(eId));
  }

  // Color mapper for traffic multiplier
  const getTrafficColor = (edge: Edge) => {
    if (edge.isBlocked) return '#ef4444'; // Red (blocked)
    if (edge.congestionMultiplier >= 1.8) return '#f97316'; // Orange (heavy)
    if (edge.congestionMultiplier >= 1.3) return '#eab308'; // Yellow (moderate)
    return '#10b981'; // Green (free flow)
  };

  const getTrafficLabel = (edge: Edge) => {
    if (edge.isBlocked) return 'Blocked (Incident)';
    if (edge.congestionMultiplier >= 1.8) return 'Heavy Congestion';
    if (edge.congestionMultiplier >= 1.3) return 'Moderate Congestion';
    return 'Free Flow';
  };

  // Group directed edge pairs to draw dual parallel lanes
  const processedPairs = new Set<string>();
  const edgePairs: { forward: Edge; reverse?: Edge; u: Node; v: Node }[] = [];

  edges.forEach((edge) => {
    const pairKey = [edge.from, edge.to].sort().join('--');
    if (!processedPairs.has(pairKey)) {
      processedPairs.add(pairKey);
      const u = nodeMap.get(edge.from);
      const v = nodeMap.get(edge.to);
      const reverseEdge = edges.find((e) => e.from === edge.to && e.to === edge.from);
      if (u && v) {
        edgePairs.push({
          forward: edge,
          reverse: reverseEdge,
          u,
          v,
        });
      }
    }
  });

  // Calculate vehicle marker offsets around depot so all 3 are distinct
  // V1 (Blue, top-left of depot), V2 (Purple, top-right), V3 (Teal, bottom-left)
  const vehicleOffsets: Record<string, { dx: number; dy: number }> = {
    V1: { dx: -18, dy: -18 },
    V2: { dx: 18, dy: -18 },
    V3: { dx: 0, dy: 22 },
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col relative text-slate-100">
      {/* Network Header Bar */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-xs z-10">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></div>
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase">
            Synthetic City Road Network (10×10 Grid)
          </h2>
          <span className="text-xs text-slate-400 ml-2 hidden md:inline">
            Directed graph • 100 intersections • {edges.length} directed segments
          </span>
        </div>

        {/* View zoom controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.85, z - 0.1))}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono text-slate-400 w-10 text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={() => setZoomLevel((z) => Math.min(1.35, z + 0.1))}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(1)}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Container */}
      <div className="relative overflow-auto bg-slate-950 flex-1 flex items-center justify-center p-3 select-none min-h-[580px]">
        {/* Subtle City Grid Background Texture */}
        <div
          className="transition-transform duration-200 ease-out origin-center"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full max-w-[760px] h-auto rounded-lg shadow-2xl bg-radial from-slate-900 via-slate-950 to-slate-950 border border-slate-800/80"
          >
            <defs>
              {/* Grid Background Pattern */}
              <pattern id="city-blocks" width="40" height="40" patternUnits="userSpaceOnUse">
                <rect width="40" height="40" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.4" />
                <circle cx="20" cy="20" r="0.8" fill="#334155" fillOpacity="0.3" />
              </pattern>

              {/* Glow filter for Depot */}
              <filter id="depot-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              {/* Glow filter for Dijkstra Shortest Path */}
              <filter id="path-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Background city zoning tiles */}
            <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#city-blocks)" />

            {/* Road casing (dark street foundation) */}
            <g id="road-casing">
              {edgePairs.map((pair, idx) => {
                const p1 = getNodePos(pair.u.x, pair.u.y);
                const p2 = getNodePos(pair.v.x, pair.v.y);
                return (
                  <line
                    key={`casing-${idx}`}
                    x1={p1.cx}
                    y1={p1.cy}
                    x2={p2.cx}
                    y2={p2.cy}
                    stroke="#1e293b"
                    strokeWidth="9"
                    strokeLinecap="round"
                  />
                );
              })}
            </g>

            {/* Directed dual traffic lanes */}
            <g id="traffic-lanes">
              {edgePairs.map((pair, idx) => {
                const p1 = getNodePos(pair.u.x, pair.u.y);
                const p2 = getNodePos(pair.v.x, pair.v.y);

                const dx = p2.cx - p1.cx;
                const dy = p2.cy - p1.cy;
                const len = Math.sqrt(dx * dx + dy * dy);
                // Perpendicular normal vector for lane separation
                const nx = (-dy / len) * 2.2;
                const ny = (dx / len) * 2.2;

                const colorFwd = getTrafficColor(pair.forward);
                const colorRev = pair.reverse ? getTrafficColor(pair.reverse) : colorFwd;

                return (
                  <g key={`lanes-${idx}`}>
                    {/* Forward Lane (u -> v) */}
                    <line
                      x1={p1.cx + nx}
                      y1={p1.cy + ny}
                      x2={p2.cx + nx}
                      y2={p2.cy + ny}
                      stroke={colorFwd}
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      className="cursor-pointer transition-all hover:stroke-white"
                      onMouseEnter={(e) => {
                        setHoveredEdge(pair.forward);
                        setTooltipPos({ x: e.clientX, y: e.clientY });
                      }}
                      onMouseLeave={() => setHoveredEdge(null)}
                    />

                    {/* Reverse Lane (v -> u) */}
                    {pair.reverse && (
                      <line
                        x1={p1.cx - nx}
                        y1={p1.cy - ny}
                        x2={p2.cx - nx}
                        y2={p2.cy - ny}
                        stroke={colorRev}
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        className="cursor-pointer transition-all hover:stroke-white"
                        onMouseEnter={(e) => {
                          setHoveredEdge(pair.reverse!);
                          setTooltipPos({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseLeave={() => setHoveredEdge(null)}
                      />
                    )}
                  </g>
                );
              })}
            </g>

            {/* Incident Edge Highlight Overlay */}
            {incident && incident.active && incident.affectedEdgeIds.length > 0 && (
              <g id="incident-edges">
                {incident.affectedEdgeIds.map((edgeId) => {
                  const edge = edges.find((e) => e.id === edgeId);
                  if (!edge) return null;
                  const u = nodeMap.get(edge.from);
                  const v = nodeMap.get(edge.to);
                  if (!u || !v) return null;

                  const p1 = getNodePos(u.x, u.y);
                  const p2 = getNodePos(v.x, v.y);
                  const midX = (p1.cx + p2.cx) / 2;
                  const midY = (p1.cy + p2.cy) / 2;

                  return (
                    <g key={`incident-edge-${edgeId}`}>
                      {/* Bold pulsing alert glow */}
                      <line
                        x1={p1.cx}
                        y1={p1.cy}
                        x2={p2.cx}
                        y2={p2.cy}
                        stroke="#ef4444"
                        strokeWidth="14"
                        strokeLinecap="round"
                        strokeOpacity="0.4"
                        className="animate-pulse"
                      />
                      {/* Hazard striped core */}
                      <line
                        x1={p1.cx}
                        y1={p1.cy}
                        x2={p2.cx}
                        y2={p2.cy}
                        stroke={edge.isBlocked ? '#dc2626' : '#f97316'}
                        strokeWidth="5"
                        strokeDasharray="8 4"
                        strokeLinecap="round"
                      />
                      {/* Warning Icon Badge at midpoint */}
                      <g transform={`translate(${midX}, ${midY})`}>
                        <circle r="11" fill="#7f1d1d" stroke="#fca5a5" strokeWidth="1.5" />
                        <text
                          y="3"
                          textAnchor="middle"
                          fill="#fef08a"
                          fontSize="9"
                          fontWeight="bold"
                        >
                          ⚠
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Dijkstra Shortest Path Overlay (highlighted street path) */}
            {pathResult && pathResult.reachable && pathResult.nodeIds.length > 1 && (
              <g id="dijkstra-shortest-path" className="pointer-events-none">
                {/* Glow casing line */}
                <polyline
                  points={pathResult.nodeIds
                    .map((id) => {
                      const n = nodeMap.get(id);
                      if (!n) return '';
                      const p = getNodePos(n.x, n.y);
                      return `${p.cx},${p.cy}`;
                    })
                    .filter(Boolean)
                    .join(' ')}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity="0.65"
                  filter="url(#path-glow)"
                />
                {/* Crisp white-cyan core line */}
                <polyline
                  points={pathResult.nodeIds
                    .map((id) => {
                      const n = nodeMap.get(id);
                      if (!n) return '';
                      const p = getNodePos(n.x, n.y);
                      return `${p.cx},${p.cy}`;
                    })
                    .filter(Boolean)
                    .join(' ')}
                  fill="none"
                  stroke="#ecfeff"
                  strokeWidth="3.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Subtle sequence step nodes along the path */}
                {pathResult.nodeIds.map((id, stepIdx) => {
                  if (stepIdx === 0 || stepIdx === pathResult.nodeIds.length - 1) return null;
                  const n = nodeMap.get(id);
                  if (!n) return null;
                  const p = getNodePos(n.x, n.y);
                  return (
                    <circle
                      key={`waypoint-${id}-${stepIdx}`}
                      cx={p.cx}
                      cy={p.cy}
                      r="3.5"
                      fill="#06b6d4"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  );
                })}
              </g>
            )}

            {/* Fleet Routes Overlay (Greedy Multi-Vehicle Routes) */}
            {routePlan && (
              <g id="fleet-routes" className="pointer-events-none">
                {routePlan.vehicleRoutes.map((route, vIdx) => {
                  if (route.fullPathNodeIds.length <= 1) return null;
                  const vDef = vehicles.find((v) => v.id === route.vehicleId);
                  const color =
                    vDef?.color ||
                    (route.vehicleId === 'V1'
                      ? '#2563eb'
                      : route.vehicleId === 'V2'
                      ? '#9333ea'
                      : '#0d9488');

                  // Slight coordinate offset so concurrent overlapping vehicle routes are distinguishable
                  const offset = (vIdx - 1) * 2.8;

                  const pointsStr = route.fullPathNodeIds
                    .map((id) => {
                      const n = nodeMap.get(id);
                      if (!n) return '';
                      const p = getNodePos(n.x, n.y);
                      return `${p.cx + offset},${p.cy + offset}`;
                    })
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <g key={`fleet-route-${route.vehicleId}`}>
                      {/* Route Glow */}
                      <polyline
                        points={pointsStr}
                        fill="none"
                        stroke={color}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeOpacity="0.25"
                      />
                      {/* Solid Core Path */}
                      <polyline
                        points={pointsStr}
                        fill="none"
                        stroke={color}
                        strokeWidth="3.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeOpacity="0.9"
                      />
                    </g>
                  );
                })}
              </g>
            )}

            {/* Intersections (nodes) */}
            <g id="intersections">
              {nodes.map((node) => {
                const pos = getNodePos(node.x, node.y);
                const isCustomer = customerMap.has(node.id);
                const isDepot = node.id === depotNodeId;

                if (isCustomer || isDepot) return null; // Drawn separately with high prominence

                return (
                  <circle
                    key={node.id}
                    cx={pos.cx}
                    cy={pos.cy}
                    r="3.5"
                    fill="#334155"
                    stroke="#0f172a"
                    strokeWidth="1.5"
                  />
                );
              })}
            </g>

            {/* Customer Markers (25 stops) */}
            <g id="customers">
              {customers.map((customer) => {
                const node = nodeMap.get(customer.nodeId);
                if (!node) return null;
                const pos = getNodePos(node.x, node.y);
                const isHovered = hoveredCustomer?.id === customer.id;
                const isTargetDestination = targetCustomerId === customer.id;
                const isUnserved = unservedCustomerSet.has(customer.id);
                const isDelivered = deliveredCustomerSet.has(customer.id);
                const assignedInfo = customerVehicleMap.get(customer.id);

                // Determine border and accent styling
                let ringColor = '#38bdf8';
                let dotColor = '#0284c7';
                let auraColor = '#38bdf8';

                if (isDelivered) {
                  ringColor = '#10b981';
                  dotColor = '#059669';
                  auraColor = '#10b981';
                } else if (isUnserved) {
                  ringColor = '#ef4444';
                  dotColor = '#dc2626';
                  auraColor = '#ef4444';
                } else if (assignedInfo) {
                  ringColor = assignedInfo.color;
                  dotColor = assignedInfo.color;
                  auraColor = assignedInfo.color;
                } else if (isTargetDestination) {
                  ringColor = '#22d3ee';
                  dotColor = '#0891b2';
                  auraColor = '#22d3ee';
                }

                return (
                  <g
                    key={customer.id}
                    className="cursor-pointer transition-transform duration-150"
                    transform={`translate(${pos.cx}, ${pos.cy}) ${isHovered || isTargetDestination ? 'scale(1.25)' : 'scale(1)'}`}
                    onMouseEnter={(e) => {
                      setHoveredCustomer(customer);
                      setTooltipPos({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => setHoveredCustomer(null)}
                  >
                    {/* Destination Highlight Ring when active path targets this customer */}
                    {isTargetDestination && (
                      <>
                        <circle
                          r="18"
                          fill="none"
                          stroke="#22d3ee"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                          className="animate-spin"
                          style={{ animationDuration: '4s' }}
                        />
                        <rect
                          x="-14"
                          y="-22"
                          width="28"
                          height="10"
                          rx="3"
                          fill="#0891b2"
                          stroke="#22d3ee"
                          strokeWidth="0.8"
                        />
                        <text
                          y="-15"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="6.5"
                          fontWeight="800"
                        >
                          TARGET
                        </text>
                      </>
                    )}

                    {/* Served / Completed Badge */}
                    {isDelivered && (
                      <g transform="translate(6, -6)">
                        <circle r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
                        <path
                          d="M -2 0 L -0.5 1.5 L 2 -1"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </g>
                    )}

                    {/* Unserved Warning Badge */}
                    {isUnserved && !isTargetDestination && (
                      <circle
                        r="15"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="1.5"
                        strokeDasharray="3 2"
                        className="animate-pulse"
                      />
                    )}

                    {/* Assigned Vehicle Mini Tag */}
                    {assignedInfo && !isTargetDestination && !isDelivered && (
                      <text
                        y="-12"
                        textAnchor="middle"
                        fill={assignedInfo.color}
                        fontSize="6"
                        fontWeight="800"
                        fontFamily="monospace"
                      >
                        {assignedInfo.vehicleId}
                      </text>
                    )}

                    {/* Pulsing subtle aura */}
                    <circle
                      r="12"
                      fill={auraColor}
                      fillOpacity={isHovered || isTargetDestination ? 0.4 : 0.15}
                      className={isHovered || isTargetDestination || isUnserved ? 'animate-ping' : ''}
                    />
                    {/* Background badge circle */}
                    <circle
                      r="9"
                      fill="#0f172a"
                      stroke={ringColor}
                      strokeWidth={isUnserved ? '2.5' : assignedInfo ? '2.5' : isTargetDestination ? '2.5' : '2'}
                    />
                    {/* Customer demand indicator ring */}
                    <circle
                      r="6.5"
                      fill={dotColor}
                    />
                    {/* Number text */}
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#ffffff"
                      fontSize="7.5"
                      fontWeight="700"
                      fontFamily="monospace"
                    >
                      {customer.id.replace('C', '')}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Central Hub Depot Marker */}
            <g
              id="depot"
              transform={`translate(${depotPos.cx}, ${depotPos.cy})`}
              filter="url(#depot-glow)"
              className="cursor-pointer"
            >
              {/* Active path origin pulse ring */}
              {pathResult && pathResult.reachable && (
                <circle
                  r="28"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="1.8"
                  strokeDasharray="4 2"
                  className="animate-pulse"
                />
              )}
              {/* Outer boundary ring */}
              <circle r="22" fill="#0284c7" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 2" />
              {/* Main Depot Square */}
              <rect
                x="-14"
                y="-14"
                width="28"
                height="28"
                rx="6"
                fill="#0f172a"
                stroke="#38bdf8"
                strokeWidth="2.5"
              />
              {/* Inner Depot Core */}
              <rect
                x="-8"
                y="-8"
                width="16"
                height="16"
                rx="3"
                fill="#0284c7"
              />
              {/* Label */}
              <text
                y="31"
                textAnchor="middle"
                fill="#e0f2fe"
                fontSize="10"
                fontWeight="800"
                letterSpacing="0.05em"
                className="drop-shadow-md"
              >
                CENTRAL HUB
              </text>
            </g>

            {/* Vehicle Markers (V1, V2, V3) stationed at Depot or En Route */}
            <g id="vehicles">
              {vehicles.map((v) => {
                const vs = vehicleDynamicStateMap.get(v.id);
                const isEnRoute = vs && vs.currentNodeId !== depotNodeId;
                const enRouteNode = isEnRoute ? nodeMap.get(vs.currentNodeId) : null;
                const enRoutePos = enRouteNode ? getNodePos(enRouteNode.x, enRouteNode.y) : null;

                const offset = vehicleOffsets[v.id] || { dx: 0, dy: 0 };
                const basePos = enRoutePos || depotPos;
                const vx = basePos.cx + (isEnRoute ? offset.dx * 0.7 : offset.dx);
                const vy = basePos.cy + (isEnRoute ? offset.dy * 0.7 - 8 : offset.dy);
                const isHovered = hoveredVehicle?.id === v.id;

                return (
                  <g
                    key={v.id}
                    transform={`translate(${vx}, ${vy}) ${isHovered ? 'scale(1.2)' : 'scale(1)'}`}
                    className="cursor-pointer transition-transform"
                    onMouseEnter={(e) => {
                      setHoveredVehicle(v);
                      setTooltipPos({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => setHoveredVehicle(null)}
                  >
                    {/* Shadow / halo */}
                    <circle r="9" fill={v.color} fillOpacity={isEnRoute ? 0.6 : 0.4} />

                    {/* En route beacon ring */}
                    {isEnRoute && (
                      <circle
                        r="14"
                        fill="none"
                        stroke={v.color}
                        strokeWidth="1.5"
                        strokeDasharray="3 2"
                        className="animate-spin"
                        style={{ animationDuration: '6s' }}
                      />
                    )}

                    {/* Vehicle body */}
                    <circle
                      r="7.5"
                      fill={v.color}
                      stroke="#ffffff"
                      strokeWidth="1.8"
                    />

                    {/* Vehicle label ID */}
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#ffffff"
                      fontSize="6.5"
                      fontWeight="bold"
                    >
                      {v.id}
                    </text>

                    {/* Small en-route tag */}
                    {isEnRoute && (
                      <rect
                        x="-10"
                        y="9"
                        width="20"
                        height="7"
                        rx="2"
                        fill="#0f172a"
                        stroke={v.color}
                        strokeWidth="0.8"
                      />
                    )}
                    {isEnRoute && (
                      <text
                        y="14.5"
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="5"
                        fontWeight="bold"
                      >
                        EN ROUTE
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Message Overlay: Fleet plan, Unreachable warning, Path summary, or Optimization prompt */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none z-10 w-11/12 max-w-xl">
          {routePlan ? (
            <div className="bg-slate-900/90 backdrop-blur-md border border-cyan-500/60 rounded-lg px-4 py-2 shadow-2xl text-center flex items-center justify-center gap-2 text-cyan-200">
              <Truck className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-xs font-semibold">
                {routePlan.algorithm === 'pso' ? 'Classical PSO' : 'Greedy'} Fleet Plan: 3 Vehicles •{' '}
                <span className="text-white">
                  {routePlan.customersServed}/{routePlan.customerCount}
                </span>{' '}
                Assigned • Score:{' '}
                <span className="text-white font-mono">{routePlan.routingScore.toFixed(1)}</span> (
                <span className="text-white">{routePlan.totalTravelMinutes.toFixed(1)} min</span> •{' '}
                <span className="text-white">{routePlan.totalDistanceKm.toFixed(1)} km</span>)
              </span>
            </div>
          ) : pathResult && !pathResult.reachable ? (
            <div className="bg-amber-950/95 backdrop-blur-md border border-amber-500/60 rounded-lg px-4 py-2.5 shadow-2xl text-center flex items-center justify-center gap-2.5 text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-semibold">
                No feasible road path is available to the selected customer under current road conditions.
              </span>
            </div>
          ) : pathResult && pathResult.reachable ? (
            <div className="bg-slate-900/90 backdrop-blur-md border border-cyan-500/50 rounded-lg px-4 py-2 shadow-2xl text-center flex items-center justify-center gap-2 text-cyan-200">
              <Route className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-xs font-semibold">
                Dijkstra Shortest Path: Central Hub → Customer {targetCustomerId} (
                <span className="text-white">{pathResult.travelMinutes.toFixed(2)} min</span> •{' '}
                <span className="text-white">{pathResult.distanceKm.toFixed(2)} km</span>)
              </span>
            </div>
          ) : (
            <div className="bg-slate-900/90 backdrop-blur-md border border-cyan-500/30 rounded-lg px-4 py-2.5 shadow-xl text-center flex items-center justify-center gap-2.5">
              <Info className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-xs text-slate-200 font-medium">
                Select an algorithm and run optimization to generate coordinated fleet routes.
              </span>
            </div>
          )}
        </div>

        {/* Floating Tooltip for Customers */}
        {hoveredCustomer && (
          <div
            className="fixed pointer-events-none z-50 bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs shadow-2xl backdrop-blur-md"
            style={{
              left: `${tooltipPos.x + 14}px`,
              top: `${tooltipPos.y + 14}px`,
            }}
          >
            <div className="font-bold text-cyan-400 flex items-center justify-between gap-3">
              <span>Customer {hoveredCustomer.id}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                Node {hoveredCustomer.nodeId}
              </span>
            </div>
            <div className="mt-1 text-slate-300 space-y-0.5 text-[11px]">
              <div>
                Demand: <strong className="text-white">{hoveredCustomer.demand} units</strong>
              </div>
              {deliveredCustomerSet.has(hoveredCustomer.id) ? (
                <div className="text-emerald-400 font-semibold flex items-center gap-1">
                  <span>Status: Delivered & Locked</span>
                </div>
              ) : customerVehicleMap.has(hoveredCustomer.id) ? (
                <div className="text-cyan-300 font-medium">
                  Assigned to: {customerVehicleMap.get(hoveredCustomer.id)?.label} (Stop #
                  {customerVehicleMap.get(hoveredCustomer.id)?.stopIndex})
                </div>
              ) : unservedCustomerSet.has(hoveredCustomer.id) ? (
                <div className="text-rose-400 font-semibold">
                  Status: Unserved (Capacity/Routing Constraint)
                </div>
              ) : (
                <div>
                  Status:{' '}
                  <span className="text-amber-400 font-medium capitalize">
                    {hoveredCustomer.status}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Floating Tooltip for Vehicles */}
        {hoveredVehicle && (() => {
          const vs = vehicleDynamicStateMap.get(hoveredVehicle.id);
          const isImpacted = incident?.affectedVehicleIds.includes(hoveredVehicle.id);

          return (
            <div
              className="fixed pointer-events-none z-50 bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs shadow-2xl backdrop-blur-md"
              style={{
                left: `${tooltipPos.x + 14}px`,
                top: `${tooltipPos.y + 14}px`,
              }}
            >
              <div className="font-bold flex items-center gap-2" style={{ color: hoveredVehicle.color }}>
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hoveredVehicle.color }} />
                <span>{hoveredVehicle.label}</span>
              </div>
              <div className="mt-1 text-slate-300 space-y-0.5 text-[11px]">
                <div>Capacity: <strong className="text-white">{hoveredVehicle.capacity} units</strong></div>
                {vs ? (
                  <>
                    <div>
                      Location:{' '}
                      <strong className="text-cyan-300">
                        {vs.currentNodeId === depotNodeId ? 'Central Hub' : `Customer Node ${vs.currentNodeId}`}
                      </strong>
                    </div>
                    <div>
                      Remaining Capacity:{' '}
                      <strong className="text-white">
                        {vs.remainingCapacity} / {hoveredVehicle.capacity} units
                      </strong>
                    </div>
                    <div>
                      Delivered Stops:{' '}
                      <strong className="text-emerald-400">
                        {vs.deliveredCustomerIds.length > 0 ? vs.deliveredCustomerIds.join(', ') : 'None'}
                      </strong>
                    </div>
                    <div>
                      Pending Stops:{' '}
                      <strong className="text-slate-200">
                        {vs.pendingCustomerIds.length > 0 ? vs.pendingCustomerIds.join(', ') : 'None'}
                      </strong>
                    </div>
                    <div>
                      Status:{' '}
                      <span
                        className={`font-semibold ${
                          vs.executionState === 'revised'
                            ? 'text-teal-400'
                            : isImpacted
                            ? 'text-amber-400'
                            : 'text-cyan-400'
                        }`}
                      >
                        {vs.executionState === 'revised'
                          ? 'Re-Routed'
                          : isImpacted
                          ? 'Impacted by Incident'
                          : vs.executionState === 'en_route'
                          ? 'En Route'
                          : vs.executionState}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>Current Load: <strong className="text-white">{hoveredVehicle.usedCapacity} / {hoveredVehicle.capacity}</strong></div>
                    <div>Status: <span className="text-amber-400 font-medium">Awaiting optimization</span></div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* Floating Tooltip for Edges */}
        {hoveredEdge && (
          <div
            className="fixed pointer-events-none z-50 bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs shadow-2xl backdrop-blur-md"
            style={{
              left: `${tooltipPos.x + 14}px`,
              top: `${tooltipPos.y + 14}px`,
            }}
          >
            <div className="font-semibold text-slate-200">
              Street Segment {hoveredEdge.from} → {hoveredEdge.to}
            </div>
            <div className="mt-1 text-slate-300 space-y-0.5 text-[11px]">
              <div>Length: <strong className="text-white">{hoveredEdge.distanceKm} km</strong></div>
              <div>Base Travel Time: <strong className="text-white">{hoveredEdge.baseTravelMinutes} min</strong></div>
              <div>
                Traffic State:{' '}
                <span
                  className="font-medium"
                  style={{ color: getTrafficColor(hoveredEdge) }}
                >
                  {getTrafficLabel(hoveredEdge)} ({hoveredEdge.congestionMultiplier}x)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Network Legend */}
      <div className="px-4 py-3 bg-slate-900/95 border-t border-slate-800 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
        {/* Node & Vehicle Legend */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-sky-900 border border-cyan-400 flex items-center justify-center">
              <Warehouse className="w-2.5 h-2.5 text-cyan-300" />
            </div>
            <span className="text-slate-300 font-medium text-[11px]">Depot</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-sky-500 border border-white text-[8px] flex items-center justify-center font-bold text-white">
              C
            </div>
            <span className="text-slate-300 font-medium text-[11px]">Customer (25)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 ring-1 ring-white/60"></div>
            <span className="text-slate-300 font-medium text-[11px]">Vehicle V1</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-600 ring-1 ring-white/60"></div>
            <span className="text-slate-300 font-medium text-[11px]">Vehicle V2</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-teal-600 ring-1 ring-white/60"></div>
            <span className="text-slate-300 font-medium text-[11px]">Vehicle V3</span>
          </div>
        </div>

        {/* Fleet Route & Traffic Flow Legend */}
        <div className="flex flex-wrap items-center gap-3 pl-2 border-l border-slate-700/60">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1.5 rounded-full bg-blue-500 inline-block shadow-xs"></span>
            <span className="text-[11px] text-blue-300 font-semibold">
              {routePlan?.algorithm === 'pso' ? 'PSO Route V1' : 'Route V1'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1.5 rounded-full bg-purple-500 inline-block shadow-xs"></span>
            <span className="text-[11px] text-purple-300 font-semibold">
              {routePlan?.algorithm === 'pso' ? 'PSO Route V2' : 'Route V2'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1.5 rounded-full bg-teal-500 inline-block shadow-xs"></span>
            <span className="text-[11px] text-teal-300 font-semibold">
              {routePlan?.algorithm === 'pso' ? 'PSO Route V3' : 'Route V3'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border border-rose-500 bg-rose-500/20 text-[8px] flex items-center justify-center text-rose-400 font-bold">!</span>
            <span className="text-[11px] text-rose-400 font-medium">Unserved Customer</span>
          </div>

          {pathResult && (
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-1.5 rounded-full bg-cyan-400 shadow-xs shadow-cyan-400 border border-white inline-block"></span>
              <span className="text-[11px] text-cyan-300 font-semibold">Dijkstra path</span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
            <span className="text-[11px] text-slate-300">Free-flow</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1.5 rounded-full bg-yellow-500 inline-block"></span>
            <span className="text-[11px] text-slate-300">Moderate</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1.5 rounded-full bg-orange-500 inline-block"></span>
            <span className="text-[11px] text-slate-300">Heavy</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1.5 rounded-full bg-rose-500 inline-block"></span>
            <span className="text-[11px] text-slate-400">Future Incident</span>
          </div>
        </div>
      </div>
    </div>
  );
};
