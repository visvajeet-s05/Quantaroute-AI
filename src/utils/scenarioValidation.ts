import { Scenario, ScenarioValidationReport } from '../types/domain';

export function validateScenario(scenario: Scenario): ScenarioValidationReport {
  const checks: ScenarioValidationReport['checks'] = [];

  // Check 1: 10x10 Grid (100 nodes)
  const nodeCountPassed = scenario.nodes.length === 100;
  checks.push({
    name: 'Grid Node Count',
    passed: nodeCountPassed,
    detail: `Found ${scenario.nodes.length} nodes (expected exactly 100 for 10x10 grid).`,
  });

  // Check 2: Customer Count
  const customerCountPassed = scenario.customers.length === 25;
  checks.push({
    name: 'Customer Count',
    passed: customerCountPassed,
    detail: `Found ${scenario.customers.length} customers (expected exactly 25).`,
  });

  // Check 3: Customer Demands range [1, 6]
  const demandRangePassed = scenario.customers.every(
    (c) => Number.isInteger(c.demand) && c.demand >= 1 && c.demand <= 6
  );
  checks.push({
    name: 'Customer Demand Ranges',
    passed: demandRangePassed,
    detail: demandRangePassed
      ? 'All customer demands are integers between 1 and 6 units.'
      : 'Some customer demands violate the 1-6 units constraint.',
  });

  // Check 4: Total Customer Demand <= 90
  const totalDemand = scenario.customers.reduce((acc, c) => acc + c.demand, 0);
  const maxFleetCapacity = scenario.vehicles.reduce((acc, v) => acc + v.capacity, 0);
  const capacityFeasible = totalDemand <= maxFleetCapacity;
  checks.push({
    name: 'Fleet Capacity Feasibility',
    passed: capacityFeasible,
    detail: `Total customer demand is ${totalDemand} units (Max fleet capacity: ${maxFleetCapacity} units).`,
  });

  // Check 5: Exactly 3 Vehicles with capacity 30
  const vehicleCountPassed =
    scenario.vehicles.length === 3 &&
    scenario.vehicles.every((v) => v.capacity === 30);
  checks.push({
    name: 'Vehicle Fleet Specification',
    passed: vehicleCountPassed,
    detail: `Fleet has ${scenario.vehicles.length} vehicles, each with capacity 30.`,
  });

  // Check 6: Depot node validity
  const depotExists = scenario.nodes.some((n) => n.id === scenario.depotNodeId);
  checks.push({
    name: 'Depot Hub Node',
    passed: depotExists,
    detail: `Depot node "${scenario.depotNodeId}" exists in the network graph.`,
  });

  // Check 7: No customer at depot
  const noCustomerAtDepot = scenario.customers.every(
    (c) => c.nodeId !== scenario.depotNodeId
  );
  checks.push({
    name: 'Depot Exclusivity',
    passed: noCustomerAtDepot,
    detail: noCustomerAtDepot
      ? 'Depot node has zero customer assignments.'
      : 'Error: Customer node collides with depot node.',
  });

  // Check 8: No duplicate customer nodes
  const customerNodes = new Set(scenario.customers.map((c) => c.nodeId));
  const noDuplicates = customerNodes.size === scenario.customers.length;
  checks.push({
    name: 'Unique Customer Node Locations',
    passed: noDuplicates,
    detail: `${customerNodes.size} unique locations for ${scenario.customers.length} customers.`,
  });

  // Check 9: Customer nodes exist in graph
  const allCustomerNodesExist = scenario.customers.every((c) =>
    scenario.nodes.some((n) => n.id === c.nodeId)
  );
  checks.push({
    name: 'Customer Node Mapping Integrity',
    passed: allCustomerNodesExist,
    detail: allCustomerNodesExist
      ? 'All customer node IDs correspond to valid grid intersections.'
      : 'Error: Some customer node IDs are missing from the node list.',
  });

  // Check 10: Directed Edge Network
  const validEdges = scenario.edges.length > 0 && scenario.edges.every(
    (e) => e.distanceKm > 0 && e.baseTravelMinutes > 0 && e.congestionMultiplier >= 1.0
  );
  checks.push({
    name: 'Edge Metric Integrity',
    passed: validEdges,
    detail: `${scenario.edges.length} directed road segments with valid distance, travel times, and congestion factors.`,
  });

  const isValid = checks.every((c) => c.passed);

  return {
    isValid,
    timestamp: new Date().toISOString(),
    seed: scenario.seed,
    totalCustomers: scenario.customers.length,
    totalDemand,
    maxFleetCapacity,
    totalVehicles: scenario.vehicles.length,
    depotNodeId: scenario.depotNodeId,
    checks,
  };
}
