from __future__ import annotations

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.schemas.optimization import (
    OptimizationErrorResponse,
    OptimizationRequest,
    OptimizationResponse,
)
from app.services.greedy_routing_service import (
    UnsupportedOptimizationError,
    optimize_greedy,
)

router = APIRouter(prefix="/api/v1", tags=["Optimization"])


SAMPLE_SCENARIO = {
    "id": "scenario_greedy_demo",
    "name": "Greedy Demo Scenario",
    "seed": 26137,
    "depotNodeId": "n_0_0",
    "nodes": [
        {"id": "n_0_0", "x": 0.0, "y": 0.0, "kind": "depot"},
        {"id": "n_1_0", "x": 1.0, "y": 0.0, "kind": "customer"},
        {"id": "n_2_0", "x": 2.0, "y": 0.0, "kind": "customer"},
    ],
    "edges": [
        {
            "id": "e_0_0_to_1_0",
            "from": "n_0_0",
            "to": "n_1_0",
            "distanceKm": 1.0,
            "baseTravelMinutes": 2.0,
            "congestionMultiplier": 1.0,
            "isBlocked": False,
        },
        {
            "id": "e_1_0_to_0_0",
            "from": "n_1_0",
            "to": "n_0_0",
            "distanceKm": 1.0,
            "baseTravelMinutes": 2.0,
            "congestionMultiplier": 1.0,
            "isBlocked": False,
        },
        {
            "id": "e_1_0_to_2_0",
            "from": "n_1_0",
            "to": "n_2_0",
            "distanceKm": 1.0,
            "baseTravelMinutes": 2.0,
            "congestionMultiplier": 1.0,
            "isBlocked": False,
        },
        {
            "id": "e_2_0_to_0_0",
            "from": "n_2_0",
            "to": "n_0_0",
            "distanceKm": 2.0,
            "baseTravelMinutes": 4.0,
            "congestionMultiplier": 1.0,
            "isBlocked": False,
        },
    ],
    "customers": [
        {"id": "C01", "nodeId": "n_1_0", "demand": 5, "status": "pending"},
        {"id": "C02", "nodeId": "n_2_0", "demand": 4, "status": "pending"},
    ],
    "vehicles": [
        {
            "id": "V1",
            "label": "Vehicle V1",
            "capacity": 10,
            "usedCapacity": 0,
            "currentNodeId": "n_0_0",
            "assignedCustomerIds": [],
            "completedCustomerIds": [],
            "color": "#2563eb",
            "status": "awaiting_optimization",
        }
    ],
    "incidents": [],
}


@router.post(
    "/optimize",
    response_model=OptimizationResponse,
    status_code=status.HTTP_200_OK,
    summary="Optimize fleet routes",
    description=(
        "Constructs a deterministic capacity-aware multi-vehicle route plan. "
        "Vehicles are processed in lexicographic ID order. At each decision point, "
        "the nearest reachable pending customer that fits remaining capacity is selected "
        "using traffic-aware Dijkstra travel time. The endpoint uses the shared evaluator "
        "and does not repair infeasible plans."
    ),
    responses={
        200: {
            "description": "Deterministic capacity-aware route plan optimization and evaluation result",
        },
        400: {
            "model": OptimizationErrorResponse,
            "description": "Unsupported algorithm, mode, or preset request",
            "content": {
                "application/json": {
                    "examples": {
                        "unsupported_algorithm": {
                            "summary": "Unsupported QPSO algorithm",
                            "value": {
                                "error": {
                                    "code": "UNSUPPORTED_ALGORITHM",
                                    "message": "Backend optimizer currently supports only algorithm='greedy'.",
                                    "details": {"requestedAlgorithm": "qpso"},
                                }
                            },
                        },
                        "unsupported_mode": {
                            "summary": "Unsupported reroute mode",
                            "value": {
                                "error": {
                                    "code": "UNSUPPORTED_MODE",
                                    "message": "Backend Greedy optimizer currently supports only mode='initial'.",
                                    "details": {"requestedMode": "reroute"},
                                }
                            },
                        },
                        "unsupported_preset": {
                            "summary": "Unsupported balanced preset",
                            "value": {
                                "error": {
                                    "code": "UNSUPPORTED_PRESET",
                                    "message": "Backend Greedy optimizer currently supports only preset='standard'.",
                                    "details": {"requestedPreset": "balanced"},
                                }
                            },
                        },
                    }
                }
            },
        },
        422: {
            "description": "Validation error in request payload",
        },
    },
)
async def optimize_route_plan(request: OptimizationRequest):
    try:
        response = optimize_greedy(request)
        return response
    except UnsupportedOptimizationError as exc:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        )
