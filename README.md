<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/bbe6407b-cdb4-451d-9773-2f354368e5f3

## Run Locally

**Prerequisites:**  Node.js, Python 3.11+

### Frontend

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

### Backend (Python FastAPI)

1. Install Python dependencies:
   `pip install -r requirements.txt`
2. Run the API server:
   `uvicorn app.main:app --reload`
3. Open Swagger UI:
   http://127.0.0.1:8000/docs

## Traffic-Aware Pathfinding API

### Endpoint

**POST /api/v1/path**

### Cost Formula

```
effectiveTravelTime = baseTravelMinutes × congestionMultiplier
```

### Congestion Penalty

```
congestionPenalty = baseTravelMinutes × max(0, congestionMultiplier − 1)
```

### Rules

- Directed edges are respected (fromNodeId → toNodeId only)
- Blocked edges (isBlocked=true) are completely excluded from pathfinding
- Output minimizes effective travel time, not hop count or raw distance
- Physical distance is returned separately but does not determine the path
- Unreachable paths return a safe 200 response with `reachable=false`
- Source equals destination returns zero cost with single node

### Request Example

```bash
curl -X POST http://127.0.0.1:8000/api/v1/path \
  -H "Content-Type: application/json" \
  -d '{
    "sourceNodeId": "n_3_4",
    "destinationNodeId": "n_4_4"
  }'
```

### Response Example (Reachable)

```json
{
  "sourceNodeId": "n_3_4",
  "destinationNodeId": "n_4_4",
  "nodeIds": ["n_3_4", "n_4_4"],
  "edgeIds": ["e_n_3_4_to_n_4_4"],
  "travelMinutes": 2.0,
  "distanceKm": 1.0,
  "reachable": true,
  "visitedNodeCount": 2
}
```

### Response Example (Unreachable)

```json
{
  "sourceNodeId": "n_3_4",
  "destinationNodeId": "n_9_9",
  "nodeIds": [],
  "edgeIds": [],
  "travelMinutes": 0.0,
  "distanceKm": 0.0,
  "reachable": false,
  "visitedNodeCount": 1
}
```

## RoutePlan Evaluation API

### Endpoint

**POST /api/v1/evaluate**

### Objective Formula

```
F = 0.55T + 0.25D + 0.20C + 10000P
```

Where:
- T = total traffic-adjusted travel time across all vehicle routes (minutes)
- D = total physical route distance (km)
- C = total congestion penalty (minutes)
- P = weighted feasibility violation count/penalty

### Penalties (Exact Values)

| Violation | Penalty |
|-----------|---------|
| Each unserved customer | 10,000 |
| Each duplicate-customer assignment | 10,000 |
| Each capacity-violating vehicle | 10,000 |
| Each blocked-edge use (per unique edge ID) | 50,000 |
| Each unreachable vehicle route | 50,000 |
| Each invalid route start or end | 10,000 |
| Each path continuity/unknown-edge violation | 50,000 |

### Initial vs Reroute Behavior

| Aspect | Initial Mode | Reroute Mode |
|--------|-------------|--------------|
| Expected customers | All scenario customers | Eligible customers from context (or all minus locked) |
| Vehicle start | Depot | `routingContext.startNodeByVehicleId` or vehicle current node |
| Available capacity | Full vehicle capacity | `routingContext.remainingCapacityByVehicleId` or capacity - usedCapacity |
| Completed customers | N/A | Locked, excluded from pending optimization |
| `isDynamicReroute` | Must be false | Should be true (warning if false) |

### Evaluator Limitation

> The evaluator validates and scores supplied paths. It does not optimize, repair, or reconstruct paths.

### Request Example

```bash
curl -X POST http://127.0.0.1:8000/api/v1/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": {
      "id": "demo_scenario_001",
      "name": "Demo Scenario",
      "seed": 26137,
      "depotNodeId": "n_3_4",
      "nodes": [
        {"id": "n_3_4", "x": 3, "y": 4, "kind": "depot"},
        {"id": "n_3_5", "x": 3, "y": 5, "kind": "intersection"},
        {"id": "n_4_4", "x": 4, "y": 4, "kind": "customer"},
        {"id": "n_4_5", "x": 4, "y": 5, "kind": "intersection"}
      ],
      "edges": [
        {"id": "e_n_3_4_to_n_3_5", "from": "n_3_4", "to": "n_3_5", "distanceKm": 1.0, "baseTravelMinutes": 2.0, "congestionMultiplier": 1.0, "isBlocked": false},
        {"id": "e_n_3_5_to_n_3_4", "from": "n_3_5", "to": "n_3_4", "distanceKm": 1.0, "baseTravelMinutes": 2.0, "congestionMultiplier": 1.0, "isBlocked": false},
        {"id": "e_n_3_4_to_n_4_4", "from": "n_3_4", "to": "n_4_4", "distanceKm": 1.0, "baseTravelMinutes": 2.0, "congestionMultiplier": 1.0, "isBlocked": false},
        {"id": "e_n_4_4_to_n_3_4", "from": "n_4_4", "to": "n_3_4", "distanceKm": 1.0, "baseTravelMinutes": 2.0, "congestionMultiplier": 1.0, "isBlocked": false}
      ],
      "customers": [
        {"id": "C01", "nodeId": "n_4_4", "demand": 5, "status": "pending"}
      ],
      "vehicles": [
        {"id": "V1", "label": "Vehicle V1", "capacity": 30, "usedCapacity": 0, "currentNodeId": "n_3_4", "assignedCustomerIds": [], "completedCustomerIds": [], "color": "#2563eb", "status": "awaiting_optimization"}
      ],
      "incidents": []
    },
    "routePlan": {
      "algorithm": "greedy",
      "scenarioId": "demo_scenario_001",
      "seed": 26137,
      "depotNodeId": "n_3_4",
      "vehicleRoutes": [
        {
          "vehicleId": "V1",
          "customerIds": ["C01"],
          "fullPathNodeIds": ["n_3_4", "n_4_4", "n_3_4"],
          "fullPathEdgeIds": ["e_n_3_4_to_n_4_4", "e_n_4_4_to_n_3_4"],
          "startNodeId": "n_3_4",
          "endNodeId": "n_3_4",
          "completedCustomerIds": [],
          "pendingCustomerIds": ["C01"],
          "isDynamicReroute": false
        }
      ],
      "mode": "initial"
    }
  }'
```

### Response Example (Feasible)

```json
{
  "validation": {
    "valid": true,
    "capacityCompliant": true,
    "customerCoverageComplete": true,
    "noDuplicateCustomerService": true,
    "allRoutesStartCorrectly": true,
    "allRoutesEndAtDepot": true,
    "noBlockedEdgesUsed": true,
    "allRoutePathsReachable": true,
    "errors": [],
    "warnings": [],
    "violationCounts": {...}
  },
  "vehicleEvaluations": [
    {
      "vehicleId": "V1",
      "customerIds": ["C01"],
      "computedTravelMinutes": 4.0,
      "computedDistanceKm": 2.0,
      "computedCongestionPenalty": 0.0,
      "computedUsedCapacity": 5,
      "computedRemainingCapacity": 25,
      "startsCorrectly": true,
      "endsAtDepot": true,
      "pathReachable": true,
      "blockedEdgeIds": [],
      "unknownEdgeIds": [],
      "continuityErrors": [],
      "warnings": []
    }
  ],
  "totalTravelMinutes": 4.0,
  "totalDistanceKm": 2.0,
  "totalCongestionPenalty": 0.0,
  "routingScore": 2.7,
  "customersAssigned": 1,
  "customersUnserved": 0,
  "penaltyTotal": 0.0,
  "warnings": []
}
```

## Frontend/Backend Parity API

### Endpoint

**POST /api/v1/parity/compare**

### Required Frontend Export Shape

```json
{
  "metadata": {
    "source": "QuantaRoute AI Frontend",
    "exportKind": "frontend_backend_parity",
    "exportedAt": "2026-09-27T12:00:00.000Z",
    "scenarioSeed": 26137,
    "algorithm": "greedy",
    "preset": "normal",
    "optimizerSeed": 26137,
    "appVersion": "1.0.0"
  },
  "scenario": { ... },
  "routePlan": { ... },
  "frontendEvaluation": {
    "totalTravelMinutes": 11.0,
    "totalDistanceKm": 5.5,
    "totalCongestionPenalty": 0.0,
    "routingScore": 7.425,
    "penaltyTotal": 0.0,
    "customersAssigned": 2,
    "customersUnserved": 0,
    "unservedCustomerIds": [],
    "duplicateCustomerIds": [],
    "capacityViolationVehicleIds": [],
    "blockedEdgeViolationIds": [],
    "unreachableVehicleIds": [],
    "pathContinuityViolationVehicleIds": [],
    "feasible": true,
    "warnings": []
  }
}
```

### Metadata Requirements

| Field | Required | Value |
|-------|----------|-------|
| `source` | Yes | Must be exactly `"QuantaRoute AI Frontend"` |
| `exportKind` | Yes | Must be exactly `"frontend_backend_parity"` |
| `exportedAt` | Yes | ISO 8601 datetime |
| `scenarioSeed` | Yes | Integer seed |
| `algorithm` | Yes | `"greedy"`, `"pso"`, or `"qpso"` |
| `preset` | No | e.g., `"normal"`, `"balanced"` |
| `optimizerSeed` | No | Integer |
| `appVersion` | No | String |

### Tolerance Policy

- **Absolute tolerance**: `1e-8` for all numeric comparisons
- No relative tolerance used (avoids division by zero issues)
- Integer and boolean fields: exact match
- List fields: order-insensitive set comparison
- Warning text: normalized comparison, warning severity only

### Verified vs Temporary Sources

| Source | `source` | `exportKind` | `sourceVerified` | Behavior |
|--------|----------|--------------|------------------|----------|
| Genuine frontend export | `"QuantaRoute AI Frontend"` | `"frontend_backend_parity"` | `true` | Full parity check; `passed` requires exact match |
| Temporary stub | `"Temporary Fixture"` | `"temporary_frontend_parity_stub"` | `false` | Comparison runs but `passed` is `false` with warning |

> **Parity must be established from genuine frontend exports before backend optimizers are trusted.**

### Request Example

```bash
curl -X POST http://127.0.0.1:8000/api/v1/parity/compare \
  -H "Content-Type: application/json" \
  -d @tests/fixtures/frontend_exports/greedy_normal_26137.json
```

### Response Example (Verified, Passed)

```json
{
  "sourceVerified": true,
  "passed": true,
  "tolerance": 1e-8,
  "exportMetadata": {
    "source": "QuantaRoute AI Frontend",
    "exportKind": "frontend_backend_parity",
    "exportedAt": "2026-09-27T12:00:00.000Z",
    "scenarioSeed": 26137,
    "algorithm": "greedy",
    "preset": "normal",
    "optimizerSeed": 26137,
    "appVersion": "1.0.0",
    "sourceVerified": true
  },
  "backendEvaluation": { ... },
  "mismatches": [],
  "comparedFields": [
    "totalTravelMinutes",
    "totalDistanceKm",
    "totalCongestionPenalty",
    "routingScore",
    "penaltyTotal",
    "customersAssigned",
    "customersUnserved",
    "unservedCustomerIds",
    "duplicateCustomerIds",
    "capacityViolationVehicleIds",
    "blockedEdgeViolationIds",
    "unreachableVehicleIds",
    "pathContinuityViolationVehicleIds",
    "feasible",
    "warnings"
  ],
  "summary": "Frontend and backend metrics match within tolerance."
}
```

### Response Example (Temporary, Metrics Match)

```json
{
  "sourceVerified": false,
  "passed": false,
  "tolerance": 1e-8,
  "exportMetadata": { ... },
  "backendEvaluation": { ... },
  "mismatches": [],
  "comparedFields": [ ... ],
  "summary": "Parity metrics may match, but frontend source export is not verified."
}
```

### Response Example (Mismatch)

```json
{
  "sourceVerified": true,
  "passed": false,
  "tolerance": 1e-8,
  "exportMetadata": { ... },
  "backendEvaluation": { ... },
  "mismatches": [
    {
      "field": "totalTravelMinutes",
      "frontendValue": 999.0,
      "backendValue": 11.0,
      "difference": 988.0,
      "tolerance": 1e-8,
      "severity": "error",
      "message": "Numeric field 'totalTravelMinutes' differs by 988.0 (tolerance 1e-08)"
    }
  ],
  "comparedFields": [ ... ],
  "summary": "Parity failed with 1 mismatch(es)."
}
```

### Required Export Files for Parity

| File | Run Configuration |
|------|-------------------|
| `greedy_normal_26137.json` | Normal Traffic, seed 26137, Greedy |
| `pso_balanced_normal_26137.json` | Normal Traffic, seed 26137, PSO Balanced |
| `qpso_balanced_normal_26137.json` | Normal Traffic, seed 26137, QPSO Balanced |

### How to Run Parity Tests

```bash
# Run all parity tests
pytest -q tests/test_parity_service.py tests/test_frontend_parity_adapter.py tests/test_parity_api.py

# Run via Swagger
uvicorn app.main:app --reload
# Open http://127.0.0.1:8000/docs
# Find POST /api/v1/parity/compare
```

## Next Development Task

> **Export real Greedy, Classical PSO, and QPSO plans from the frontend, compare each using POST /api/v1/parity/compare, resolve all differences, and only then implement backend Greedy routing.**