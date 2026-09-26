import { Customer, Edge, Incident, Node, Scenario, ScenarioPreset, Vehicle } from '../types/domain';
import { SeededRandom } from '../utils/seededRandom';

export const DEFAULT_SEED = 26137;
export const GRID_SIZE = 10; // 10x10 city grid

export function generateScenario(
  preset: ScenarioPreset = 'normal',
  seed: number = DEFAULT_SEED
): Scenario {
  const rng = new SeededRandom(seed);

  // 1. Generate 100 Nodes (10 x 10)
  const nodes: Node[] = [];
  const depotX = 3;
  const depotY = 4;
  const depotNodeId = `n_${depotX}_${depotY}`;

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const id = `n_${x}_${y}`;
      nodes.push({
        id,
        x,
        y,
        kind: id === depotNodeId ? 'depot' : 'intersection',
      });
    }
  }

  // 2. Select 25 Distinct Non-Depot Nodes for Customers
  const candidateNodeIds = nodes
    .filter((n) => n.id !== depotNodeId)
    .map((n) => n.id);

  const shuffledCandidates = rng.shuffle(candidateNodeIds);
  const selectedCustomerNodeIds = shuffledCandidates.slice(0, 25);

  // Generate demands between 1 and 6 ensuring sum <= 90
  const rawDemands = selectedCustomerNodeIds.map(() => rng.nextInt(1, 5));
  let currentDemandSum = rawDemands.reduce((sum, d) => sum + d, 0);

  // Distribute slight extra load while staying <= 85 (well below 90 capacity limit)
  for (let i = 0; i < rawDemands.length; i++) {
    if (currentDemandSum < 78 && rawDemands[i] < 6 && rng.next() > 0.4) {
      rawDemands[i] += 1;
      currentDemandSum += 1;
    }
  }

  const customers: Customer[] = selectedCustomerNodeIds.map((nodeId, idx) => {
    // Mark node as customer kind in nodes list
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      node.kind = 'customer';
    }

    const idNumber = String(idx + 1).padStart(2, '0');
    return {
      id: `C${idNumber}`,
      nodeId,
      demand: rawDemands[idx],
      status: 'pending',
    };
  });

  // Sort customers by ID for clean display
  customers.sort((a, b) => a.id.localeCompare(b.id));

  // 3. Generate Directed Edges (Grid streets with bidirectional flow)
  const edges: Edge[] = [];

  const addDirectedPair = (uId: string, vId: string) => {
    // Base physical distance ~ 1.0 km
    const baseDist = Number((0.9 + rng.nextFloat(0, 0.25)).toFixed(2));
    // Base speed ~30-36 km/h -> ~1.7 - 2.1 minutes
    const baseMinutes = Number((1.6 + rng.nextFloat(0, 0.6)).toFixed(1));

    // Determine traffic category based on scenario preset
    const randTraffic = rng.next();
    let congestionMultiplier = 1.0;
    let isBlocked = false;

    if (preset === 'normal') {
      if (randTraffic < 0.72) {
        // Free flow
        congestionMultiplier = Number((1.0 + rng.nextFloat(0, 0.15)).toFixed(2));
      } else if (randTraffic < 0.92) {
        // Moderate traffic
        congestionMultiplier = Number((1.35 + rng.nextFloat(0, 0.35)).toFixed(2));
      } else {
        // Heavy traffic
        congestionMultiplier = Number((1.9 + rng.nextFloat(0, 0.5)).toFixed(2));
      }
    } else if (preset === 'peak') {
      if (randTraffic < 0.40) {
        congestionMultiplier = Number((1.05 + rng.nextFloat(0, 0.15)).toFixed(2));
      } else if (randTraffic < 0.75) {
        congestionMultiplier = Number((1.4 + rng.nextFloat(0, 0.35)).toFixed(2));
      } else {
        congestionMultiplier = Number((2.1 + rng.nextFloat(0, 0.6)).toFixed(2));
      }
    } else if (preset === 'closure') {
      // Road closure preview
      if (randTraffic < 0.65) {
        congestionMultiplier = Number((1.0 + rng.nextFloat(0, 0.15)).toFixed(2));
      } else if (randTraffic < 0.88) {
        congestionMultiplier = Number((1.4 + rng.nextFloat(0, 0.35)).toFixed(2));
      } else {
        congestionMultiplier = Number((2.0 + rng.nextFloat(0, 0.5)).toFixed(2));
      }
    }

    // Edge u -> v
    edges.push({
      id: `e_${uId}_to_${vId}`,
      from: uId,
      to: vId,
      distanceKm: baseDist,
      baseTravelMinutes: baseMinutes,
      congestionMultiplier,
      isBlocked,
    });

    // Edge v -> u (independent traffic condition in opposing direction)
    const opposingRand = rng.next();
    let opposingMultiplier = 1.0;
    if (preset === 'normal') {
      if (opposingRand < 0.72) {
        opposingMultiplier = Number((1.0 + rng.nextFloat(0, 0.15)).toFixed(2));
      } else if (opposingRand < 0.92) {
        opposingMultiplier = Number((1.35 + rng.nextFloat(0, 0.35)).toFixed(2));
      } else {
        opposingMultiplier = Number((1.9 + rng.nextFloat(0, 0.5)).toFixed(2));
      }
    } else {
      opposingMultiplier = congestionMultiplier;
    }

    edges.push({
      id: `e_${vId}_to_${uId}`,
      from: vId,
      to: uId,
      distanceKm: baseDist,
      baseTravelMinutes: baseMinutes,
      congestionMultiplier: opposingMultiplier,
      isBlocked,
    });
  };

  // Connect adjacent grid cells
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const currentId = `n_${x}_${y}`;
      // Horizontal neighbor (x + 1, y)
      if (x < GRID_SIZE - 1) {
        const rightId = `n_${x + 1}_${y}`;
        addDirectedPair(currentId, rightId);
      }
      // Vertical neighbor (x, y + 1)
      if (y < GRID_SIZE - 1) {
        const bottomId = `n_${x}_${y + 1}`;
        addDirectedPair(currentId, bottomId);
      }
    }
  }

  // 4. Vehicles: 3 Vehicles with capacity 30
  const vehicles: Vehicle[] = [
    {
      id: 'V1',
      label: 'Vehicle V1',
      capacity: 30,
      usedCapacity: 0,
      currentNodeId: depotNodeId,
      assignedCustomerIds: [],
      completedCustomerIds: [],
      color: '#2563eb', // Blue
      status: 'awaiting_optimization',
    },
    {
      id: 'V2',
      label: 'Vehicle V2',
      capacity: 30,
      usedCapacity: 0,
      currentNodeId: depotNodeId,
      assignedCustomerIds: [],
      completedCustomerIds: [],
      color: '#9333ea', // Purple
      status: 'awaiting_optimization',
    },
    {
      id: 'V3',
      label: 'Vehicle V3',
      capacity: 30,
      usedCapacity: 0,
      currentNodeId: depotNodeId,
      assignedCustomerIds: [],
      completedCustomerIds: [],
      color: '#0d9488', // Teal
      status: 'awaiting_optimization',
    },
  ];

  // 5. Incidents
  const incidents: Incident[] = [];

  const presetNames: Record<ScenarioPreset, string> = {
    normal: 'Normal Traffic (Default Baseline)',
    peak: 'Peak Traffic Rush Hour',
    closure: 'Arterial Road Closure Demo',
  };

  return {
    id: `scenario_${preset}_${seed}`,
    name: presetNames[preset],
    seed,
    depotNodeId,
    nodes,
    edges,
    customers,
    vehicles,
    incidents,
  };
}
