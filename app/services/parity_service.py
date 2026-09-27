from __future__ import annotations

from datetime import datetime
from typing import Any

from app.schemas.parity import (
    FrontendEvaluationSchema,
    FrontendParityExportSchema,
    FrontendParityMetadataSchema,
    ParityComparisonResponse,
    ParityMismatchSchema,
)
from app.schemas.routing import EvaluateRequest
from app.services.frontend_parity_adapter import (
    ParityAdapterError,
    adapt_frontend_export,
    is_source_verified,
)
from app.services.route_plan_evaluator import evaluate_route_plan


TOLERANCE = 1e-8


def _compare_numeric(
    field: str,
    frontend_val: float,
    backend_val: float,
    tolerance: float,
) -> ParityMismatchSchema | None:
    diff = abs(frontend_val - backend_val)
    if diff <= tolerance:
        return None
    return ParityMismatchSchema(
        field=field,
        frontendValue=frontend_val,
        backendValue=backend_val,
        difference=diff,
        tolerance=tolerance,
        severity="error",
        message=f"Numeric field '{field}' differs by {diff} (tolerance {tolerance})",
    )


def _compare_integer(
    field: str,
    frontend_val: int,
    backend_val: int,
) -> ParityMismatchSchema | None:
    if frontend_val == backend_val:
        return None
    return ParityMismatchSchema(
        field=field,
        frontendValue=frontend_val,
        backendValue=backend_val,
        difference=float(abs(frontend_val - backend_val)),
        tolerance=0.0,
        severity="error",
        message=f"Integer field '{field}' differs: frontend={frontend_val}, backend={backend_val}",
    )


def _compare_list(
    field: str,
    frontend_val: list[str],
    backend_val: list[str],
) -> ParityMismatchSchema | None:
    frontend_set = set(frontend_val)
    backend_set = set(backend_val)
    if frontend_set == backend_set:
        return None
    return ParityMismatchSchema(
        field=field,
        frontendValue=sorted(frontend_val),
        backendValue=sorted(backend_val),
        difference=None,
        tolerance=None,
        severity="error",
        message=f"List field '{field}' differs: frontend={sorted(frontend_val)}, backend={sorted(backend_val)}",
    )


def _compare_boolean(
    field: str,
    frontend_val: bool,
    backend_val: bool,
) -> ParityMismatchSchema | None:
    if frontend_val == backend_val:
        return None
    return ParityMismatchSchema(
        field=field,
        frontendValue=frontend_val,
        backendValue=backend_val,
        difference=None,
        tolerance=None,
        severity="error",
        message=f"Boolean field '{field}' differs: frontend={frontend_val}, backend={backend_val}",
    )


def _compare_warnings(
    frontend_warnings: list[str],
    backend_warnings: list[str],
) -> list[ParityMismatchSchema]:
    frontend_norm = {w.strip().lower() for w in frontend_warnings}
    backend_norm = {w.strip().lower() for w in backend_warnings}
    mismatches = []
    if frontend_norm != backend_norm:
        mismatches.append(
            ParityMismatchSchema(
                field="warnings",
                frontendValue=frontend_warnings,
                backendValue=backend_warnings,
                difference=None,
                tolerance=None,
                severity="warning",
                message=f"Warning text differs (normalized): frontend={sorted(frontend_norm)}, backend={sorted(backend_norm)}",
            )
        )
    return mismatches


def compare_frontend_export(
    raw_export: dict[str, Any],
    tolerance: float = TOLERANCE,
    is_temporary_fixture: bool = False,
) -> ParityComparisonResponse:
    try:
        adapted = adapt_frontend_export(raw_export)
    except ParityAdapterError as e:
        return ParityComparisonResponse(
            sourceVerified=False,
            passed=False,
            tolerance=tolerance,
            exportMetadata=FrontendParityMetadataSchema(
                source="Unknown",
                exportKind="unknown",
                exportedAt=datetime.now(),
                scenarioSeed=0,
                algorithm="greedy",
            ),
            backendEvaluation=None,
            mismatches=[
                ParityMismatchSchema(
                    field="adapter",
                    frontendValue=None,
                    backendValue=None,
                    difference=None,
                    tolerance=None,
                    severity="error",
                    message=str(e),
                )
            ],
            comparedFields=[],
            summary=f"Adapter error: {e}",
        )

    source_verified = is_source_verified(adapted.metadata, is_temporary_fixture)

    request = EvaluateRequest(scenario=adapted.scenario, routePlan=adapted.route_plan)
    backend_eval = evaluate_route_plan(request)

    mismatches: list[ParityMismatchSchema] = []
    compared: list[str] = []

    fe = adapted.frontend_evaluation
    be = backend_eval

    # Numeric fields
    for field, fe_val, be_val in [
        ("totalTravelMinutes", fe.total_travel_minutes, be.total_travel_minutes),
        ("totalDistanceKm", fe.total_distance_km, be.total_distance_km),
        ("totalCongestionPenalty", fe.total_congestion_penalty, be.total_congestion_penalty),
        ("routingScore", fe.routing_score, be.routing_score),
        ("penaltyTotal", fe.penalty_total, be.penalty_total),
    ]:
        compared.append(field)
        if m := _compare_numeric(field, fe_val, be_val, tolerance):
            mismatches.append(m)

    # Integer fields
    for field, fe_val, be_val in [
        ("customersAssigned", fe.customers_assigned, be.customers_assigned),
        ("customersUnserved", fe.customers_unserved, be.customers_unserved),
    ]:
        compared.append(field)
        if m := _compare_integer(field, fe_val, be_val):
            mismatches.append(m)

    # List fields (order-insensitive)
    for field, fe_val, be_val in [
        ("unservedCustomerIds", fe.unserved_customer_ids, be.unserved_customer_ids),
        ("duplicateCustomerIds", fe.duplicate_customer_ids, be.duplicate_customer_ids),
        ("capacityViolationVehicleIds", fe.capacity_violation_vehicle_ids, be.capacity_violation_vehicle_ids),
        ("blockedEdgeViolationIds", fe.blocked_edge_violation_ids, be.blocked_edge_violation_ids),
        ("unreachableVehicleIds", fe.unreachable_vehicle_ids, be.unreachable_vehicle_ids),
        ("pathContinuityViolationVehicleIds", fe.path_continuity_violation_vehicle_ids, be.path_continuity_violation_vehicle_ids),
    ]:
        compared.append(field)
        if m := _compare_list(field, fe_val, be_val):
            mismatches.append(m)

    # Boolean feasibility
    compared.append("feasible")
    if m := _compare_boolean("feasible", fe.feasible, be.validation.valid):
        mismatches.append(m)

    # Warnings (warning severity only)
    compared.append("warnings")
    mismatches.extend(_compare_warnings(fe.warnings, be.warnings))

    # Determine passed
    error_count = sum(1 for m in mismatches if m.severity == "error")
    passed = error_count == 0 and source_verified

    # Summary
    if passed:
        summary = "Frontend and backend metrics match within tolerance."
    elif not source_verified:
        summary = "Parity metrics may match, but frontend source export is not verified."
    else:
        summary = f"Parity failed with {error_count} mismatch(es)."

    return ParityComparisonResponse(
        sourceVerified=source_verified,
        passed=passed,
        tolerance=tolerance,
        exportMetadata=adapted.metadata,
        backendEvaluation=be,
        mismatches=mismatches,
        comparedFields=compared,
        summary=summary,
    )