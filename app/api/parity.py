from fastapi import APIRouter, status

from app.schemas.parity import FrontendParityExportSchema, ParityComparisonResponse
from app.services.parity_service import compare_frontend_export

router = APIRouter(prefix="/api/v1/parity", tags=["Parity"])


@router.post(
    "/compare",
    response_model=ParityComparisonResponse,
    status_code=status.HTTP_200_OK,
    summary="Compare frontend RoutePlan metrics with backend evaluation",
    description=(
        "Loads an exported QuantaRoute AI Frontend scenario and RoutePlan, evaluates it using the "
        "backend evaluator, and reports exact/within-tolerance differences. The endpoint does not "
        "optimize, repair, reconstruct paths, or modify the export."
    ),
    responses={
        200: {
            "description": "Parity comparison result (passed or failed)",
            "content": {
                "application/json": {
                    "example": {
                        "sourceVerified": True,
                        "passed": True,
                        "tolerance": 1e-8,
                        "exportMetadata": {
                            "source": "QuantaRoute AI Frontend",
                            "exportKind": "frontend_backend_parity",
                            "exportedAt": "2026-09-27T12:00:00Z",
                            "scenarioSeed": 26137,
                            "algorithm": "greedy",
                            "preset": "normal",
                            "optimizerSeed": 26137,
                            "appVersion": "1.0.0",
                            "sourceVerified": True,
                        },
                        "backendEvaluation": None,
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
                            "warnings",
                        ],
                        "summary": "Frontend and backend metrics match within tolerance.",
                    }
                }
            },
        },
        422: {
            "description": "Validation error in request payload or adapter error",
        },
    },
)
async def compare_parity(request: FrontendParityExportSchema) -> ParityComparisonResponse:
    # The request is already validated by Pydantic as FrontendParityExportSchema
    # Convert to dict for the comparison service using aliases to match frontend field names
    raw_export = request.model_dump(by_alias=True)
    return compare_frontend_export(raw_export)