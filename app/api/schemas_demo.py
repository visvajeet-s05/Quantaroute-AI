from fastapi import APIRouter, FastAPI

from app.schemas.pathfinding import PathRequest, PathResponse, PathValidationResponse
from app.schemas.scenario import ScenarioSchema

app = FastAPI(title="QuantaRoute AI - Schema Demo", version="0.1.0")

router = APIRouter(prefix="/api/v1/schema-demo", tags=["Schema Demo"])


@router.get("/scenario", response_model=ScenarioSchema)
async def get_scenario_demo() -> ScenarioSchema:
    """Return a compact valid scenario for demo purposes."""
    return ScenarioSchema(
        id="demo_scenario_001",
        name="Demo Scenario",
        seed=26137,
        depotNodeId="n_3_4",
        nodes=[
            {"id": "n_3_4", "x": 3, "y": 4, "kind": "depot"},
            {"id": "n_3_5", "x": 3, "y": 5, "kind": "intersection"},
            {"id": "n_4_4", "x": 4, "y": 4, "kind": "customer"},
            {"id": "n_4_5", "x": 4, "y": 5, "kind": "intersection"},
        ],
        edges=[
            {
                "id": "e_n_3_4_to_n_3_5",
                "from": "n_3_4",
                "to": "n_3_5",
                "distanceKm": 1.0,
                "baseTravelMinutes": 2.0,
                "congestionMultiplier": 1.0,
                "isBlocked": False,
            },
            {
                "id": "e_n_3_5_to_n_3_4",
                "from": "n_3_5",
                "to": "n_3_4",
                "distanceKm": 1.0,
                "baseTravelMinutes": 2.0,
                "congestionMultiplier": 1.0,
                "isBlocked": False,
            },
            {
                "id": "e_n_3_4_to_n_4_4",
                "from": "n_3_4",
                "to": "n_4_4",
                "distanceKm": 1.0,
                "baseTravelMinutes": 2.0,
                "congestionMultiplier": 1.0,
                "isBlocked": False,
            },
            {
                "id": "e_n_4_4_to_n_3_4",
                "from": "n_4_4",
                "to": "n_3_4",
                "distanceKm": 1.0,
                "baseTravelMinutes": 2.0,
                "congestionMultiplier": 1.0,
                "isBlocked": False,
            },
        ],
        customers=[
            {"id": "C01", "nodeId": "n_4_4", "demand": 5, "status": "pending"},
        ],
        vehicles=[
            {
                "id": "V1",
                "label": "Vehicle V1",
                "capacity": 30,
                "usedCapacity": 0,
                "currentNodeId": "n_3_4",
                "assignedCustomerIds": [],
                "completedCustomerIds": [],
                "color": "#2563eb",
                "status": "awaiting_optimization",
            },
        ],
        incidents=[],
    )


@router.get("/path-request", response_model=PathRequest)
async def get_path_request_demo() -> PathRequest:
    """Return a compact valid path request for demo purposes."""
    return PathRequest(
        sourceNodeId="n_3_4",
        destinationNodeId="n_4_4",
        algorithm="dijkstra",
    )


@router.get("/path-response", response_model=PathResponse)
async def get_path_response_demo() -> PathResponse:
    """Return a compact valid path response for demo purposes."""
    return PathResponse(
        sourceNodeId="n_3_4",
        destinationNodeId="n_4_4",
        nodeIds=["n_3_4", "n_4_4"],
        edgeIds=["e_n_3_4_to_n_4_4"],
        travelMinutes=2.0,
        distanceKm=1.0,
        reachable=True,
        visitedNodeCount=2,
    )


@router.get("/path-validation", response_model=PathValidationResponse)
async def get_path_validation_demo() -> PathValidationResponse:
    """Return a compact valid path validation response for demo purposes."""
    from app.schemas.pathfinding import PathValidationIssueSchema, PathResponse, PathValidationResponse

    path_resp = PathResponse(
        sourceNodeId="n_3_4",
        destinationNodeId="n_4_4",
        nodeIds=["n_3_4", "n_4_4"],
        edgeIds=["e_n_3_4_to_n_4_4"],
        travelMinutes=2.0,
        distanceKm=1.0,
        reachable=True,
        visitedNodeCount=2,
    )

    return PathValidationResponse(
        isValid=True,
        checks=[
            PathValidationIssueSchema(
                name="Source Node Alignment",
                passed=True,
                detail='Path originates at source node "n_3_4".',
            ),
            PathValidationIssueSchema(
                name="Destination Node Alignment",
                passed=True,
                detail='Path terminates at destination node "n_4_4".',
            ),
            PathValidationIssueSchema(
                name="Topology Length Consistency",
                passed=True,
                detail="2 nodes traversed across 1 edges.",
            ),
        ],
        errors=[],
        pathResponse=path_resp,
    )


app.include_router(router)