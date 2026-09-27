from fastapi import APIRouter, status

from app.schemas.routing import EvaluateRequest, RoutePlanEvaluationResponse

router = APIRouter(prefix="/api/v1", tags=["Evaluation"])


@router.post(
    "/evaluate",
    response_model=RoutePlanEvaluationResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate multi-vehicle route plan",
    description=(
        "Validates a supplied initial-routing or dynamic re-routing RoutePlan against the directed road graph, "
        "vehicle capacities, customer coverage, blocked-edge rules, route continuity, and depot/current-position rules. "
        "The endpoint does not optimize or repair routes. It calculates metrics from supplied route paths and applies "
        "F = 0.55T + 0.25D + 0.20C + 10000P."
    ),
    responses={
        200: {
            "description": "Route plan evaluation result (feasible or infeasible)",
            "content": {
                "application/json": {
                    "example": {
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
                                    "isDynamicReroute": False,
                                }
                            ],
                            "mode": "initial",
                        },
                        "validation": {
                            "valid": True,
                            "capacityCompliant": True,
                            "customerCoverageComplete": True,
                            "noDuplicateCustomerService": True,
                            "allRoutesStartCorrectly": True,
                            "allRoutesEndAtDepot": True,
                            "noBlockedEdgesUsed": True,
                            "allRoutePathsReachable": True,
                            "errors": [],
                            "warnings": [],
                            "violationCounts": {
                                "unservedCustomers": 0,
                                "duplicateCustomers": 0,
                                "capacityViolations": 0,
                                "blockedEdges": 0,
                                "unreachableVehicles": 0,
                                "invalidStartOrEnd": 0,
                                "pathContinuity": 0,
                            },
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
                                "startsCorrectly": True,
                                "endsAtDepot": True,
                                "pathReachable": True,
                                "blockedEdgeIds": [],
                                "unknownEdgeIds": [],
                                "continuityErrors": [],
                                "warnings": [],
                            }
                        ],
                        "totalTravelMinutes": 4.0,
                        "totalDistanceKm": 2.0,
                        "totalCongestionPenalty": 0.0,
                        "routingScore": 2.7,
                        "customersAssigned": 1,
                        "customersUnserved": 0,
                        "unservedCustomerIds": [],
                        "duplicateCustomerIds": [],
                        "capacityViolationVehicleIds": [],
                        "blockedEdgeViolationIds": [],
                        "unreachableVehicleIds": [],
                        "pathContinuityViolationVehicleIds": [],
                        "penaltyTotal": 0.0,
                        "warnings": [],
                    }
                }
            },
        },
        422: {
            "description": "Validation error in request payload",
        },
    },
)
async def evaluate_route_plan(request: EvaluateRequest) -> RoutePlanEvaluationResponse:
    from app.services.route_plan_evaluator import evaluate_route_plan as evaluate_fn
    return evaluate_fn(request)