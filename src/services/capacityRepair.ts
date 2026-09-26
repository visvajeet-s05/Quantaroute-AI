import { Customer, Edge, Node, Scenario, Vehicle } from '../types/domain';
import { findShortestPath } from '../algorithms/dijkstra';

export interface AssignedCustomerItem {
  customer: Customer;
  priorityKey: number;
}

export type VehicleAssignmentMap = Map<string, AssignedCustomerItem[]>;

/**
 * Shared Deterministic Capacity Repair Routine
 *
 * Used by Classical PSO now and QPSO later to resolve vehicle capacity overflows.
 * 1. Identifies any overloaded vehicle (usedCapacity > capacity).
 * 2. Considers candidate customers in deterministic removal order:
 *    - highest demand first
 *    - then customer ID ascending
 * 3. For each customer considered for relocation:
 *    - identifies other vehicles with sufficient remaining capacity
 *    - estimates added travel time using Dijkstra insertion cost
 *    - selects target vehicle with minimum added travel time (tie-break by vehicle ID)
 * 4. Relocates customer into target vehicle
 * 5. Repeats until all vehicles satisfy capacity or no feasible move remains
 * 6. Never drops any customer (preserves full accounting)
 */
export function repairCapacityAllocations(
  initialAssignments: VehicleAssignmentMap,
  scenario: Scenario,
  travelTimeCache?: Map<string, number>
): {
  repairedAssignments: VehicleAssignmentMap;
  warnings: string[];
  repairedMovesCount: number;
} {
  const warnings: string[] = [];
  let repairedMovesCount = 0;

  // Build deep copy of assignments
  const assignments: VehicleAssignmentMap = new Map();
  scenario.vehicles.forEach((v) => {
    const list = initialAssignments.get(v.id) || [];
    assignments.set(
      v.id,
      list.map((item) => ({ ...item, customer: { ...item.customer } }))
    );
  });

  const vehicleMap = new Map<string, Vehicle>();
  scenario.vehicles.forEach((v) => vehicleMap.set(v.id, v));

  // Helper: compute total demand assigned to vehicle
  const getVehicleLoad = (vId: string): number => {
    const items = assignments.get(vId) || [];
    return items.reduce((sum, item) => sum + item.customer.demand, 0);
  };

  // Helper: memoized travel time between two nodes
  const cache = travelTimeCache || new Map<string, number>();
  const getLegTime = (fromId: string, toId: string): number => {
    if (fromId === toId) return 0;
    const key = `${fromId}->${toId}`;
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const res = findShortestPath(scenario.nodes, scenario.edges, fromId, toId);
    const time = res.reachable ? res.travelMinutes : 999999;
    cache.set(key, time);
    return time;
  };

  // Helper: estimate added travel time of inserting customer into vehicle
  const estimateInsertionCost = (
    vId: string,
    candidate: Customer
  ): { bestAddedTime: number; bestIndex: number } => {
    const items = assignments.get(vId) || [];
    const stopNodeIds = [
      scenario.depotNodeId,
      ...items.map((it) => it.customer.nodeId),
      scenario.depotNodeId,
    ];

    let minAdded = Infinity;
    let bestIdx = items.length;

    for (let k = 0; k < stopNodeIds.length - 1; k++) {
      const u = stopNodeIds[k];
      const v = stopNodeIds[k + 1];
      const origCost = getLegTime(u, v);
      const newCost = getLegTime(u, candidate.nodeId) + getLegTime(candidate.nodeId, v);
      const added = Math.max(0, newCost - origCost);

      if (added < minAdded) {
        minAdded = added;
        bestIdx = k;
      }
    }

    return {
      bestAddedTime: Number.isFinite(minAdded) ? minAdded : 0,
      bestIndex: bestIdx,
    };
  };

  // Repair loop: Continue as long as there is an overloaded vehicle and feasible moves exist
  const MAX_REPAIR_STEPS = 100;
  let step = 0;

  while (step < MAX_REPAIR_STEPS) {
    step++;

    // Find all overloaded vehicles
    const overloadedVehicles: { vId: string; overflow: number }[] = [];
    for (const v of scenario.vehicles) {
      const load = getVehicleLoad(v.id);
      if (load > v.capacity) {
        overloadedVehicles.push({ vId: v.id, overflow: load - v.capacity });
      }
    }

    if (overloadedVehicles.length === 0) {
      break; // All vehicles compliant
    }

    // Sort overloaded vehicles by overflow descending, then vehicle ID
    overloadedVehicles.sort((a, b) => {
      if (b.overflow !== a.overflow) return b.overflow - a.overflow;
      return a.vId.localeCompare(b.vId);
    });

    let moveMade = false;

    for (const ov of overloadedVehicles) {
      const sourceItems = assignments.get(ov.vId) || [];
      if (sourceItems.length === 0) continue;

      // Deterministic candidate removal order: highest demand first, then customer ID ascending
      const candidateList = [...sourceItems].sort((a, b) => {
        if (b.customer.demand !== a.customer.demand) {
          return b.customer.demand - a.customer.demand;
        }
        return a.customer.id.localeCompare(b.customer.id);
      });

      for (const candidateItem of candidateList) {
        const cust = candidateItem.customer;

        // Find candidate target vehicles with enough remaining capacity
        type TargetOption = {
          vId: string;
          addedCost: number;
          insertIndex: number;
        };
        const feasibleTargets: TargetOption[] = [];

        for (const targetV of scenario.vehicles) {
          if (targetV.id === ov.vId) continue;
          const targetLoad = getVehicleLoad(targetV.id);
          const remainingCap = targetV.capacity - targetLoad;

          if (cust.demand <= remainingCap) {
            const { bestAddedTime, bestIndex } = estimateInsertionCost(targetV.id, cust);
            feasibleTargets.push({
              vId: targetV.id,
              addedCost: bestAddedTime,
              insertIndex: bestIndex,
            });
          }
        }

        if (feasibleTargets.length > 0) {
          // Select feasible target vehicle with minimum added travel time; tie-break by vehicle ID
          feasibleTargets.sort((a, b) => {
            const diff = a.addedCost - b.addedCost;
            if (Math.abs(diff) > 1e-4) return diff;
            return a.vId.localeCompare(b.vId);
          });

          const chosen = feasibleTargets[0];

          // Remove from source vehicle
          const srcIdx = sourceItems.findIndex((it) => it.customer.id === cust.id);
          if (srcIdx !== -1) {
            sourceItems.splice(srcIdx, 1);
          }

          // Insert into target vehicle
          const tgtItems = assignments.get(chosen.vId) || [];
          tgtItems.splice(chosen.insertIndex, 0, candidateItem);

          repairedMovesCount++;
          moveMade = true;
          break; // Break candidate loop to re-evaluate overloaded status
        }
      }

      if (moveMade) {
        break; // Break overloaded vehicle loop
      }
    }

    if (!moveMade) {
      // No feasible relocation is possible without violating capacity
      const remainingOverloaded = overloadedVehicles.map((ov) => ov.vId).join(', ');
      warnings.push(
        `Capacity repair stopped: vehicle(s) ${remainingOverloaded} remain overloaded because no other vehicle has sufficient capacity.`
      );
      break;
    }
  }

  return {
    repairedAssignments: assignments,
    warnings,
    repairedMovesCount,
  };
}
