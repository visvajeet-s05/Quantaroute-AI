from fastapi import APIRouter, Depends, HTTPException, status

from app.api.schemas_demo import get_scenario_demo
from app.schemas.pathfinding import PathRequest, PathResponse
from app.schemas.scenario import ScenarioSchema
from app.services.pathfinding_service import compute_path

router = APIRouter(prefix="/api/v1", tags=["Pathfinding"])


async def get_current_scenario() -> ScenarioSchema:
    return await get_scenario_demo()


@router.post(
    "/path",
    response_model=PathResponse,
    status_code=status.HTTP_200_OK,
    summary="Compute traffic-aware shortest path",
    description=(
        "Uses directed Dijkstra pathfinding. Edge cost is baseTravelMinutes × congestionMultiplier. "
        "Blocked edges are excluded. The returned path minimizes effective travel time, "
        "while distance and congestion penalty are returned separately."
    ),
    responses={
        200: {
            "description": "Successful path computation (reachable or unreachable)",
            "content": {
                "application/json": {
                    "example": {
                        "sourceNodeId": "n_3_4",
                        "destinationNodeId": "n_4_4",
                        "nodeIds": ["n_3_4", "n_4_4"],
                        "edgeIds": ["e_n_3_4_to_n_4_4"],
                        "travelMinutes": 2.0,
                        "distanceKm": 1.0,
                        "reachable": True,
                        "visitedNodeCount": 2,
                    }
                }
            },
        },
        422: {
            "description": "Validation error in request payload",
        },
    },
)
async def compute_shortest_path(
    request: PathRequest,
    scenario: ScenarioSchema = Depends(get_current_scenario),
) -> PathResponse:
    return compute_path(request, scenario)