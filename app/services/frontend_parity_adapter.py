from __future__ import annotations

from datetime import datetime
from typing import Any

from app.schemas.parity import (
    FrontendEvaluationSchema,
    FrontendParityExportSchema,
    FrontendParityMetadataSchema,
)
from app.schemas.routing import RoutePlanSchema, RoutingContextSchema, VehicleRouteSchema
from app.schemas.scenario import (
    CustomerSchema,
    EdgeSchema,
    IncidentSchema,
    NodeSchema,
    ScenarioSchema,
    VehicleSchema,
)


class ParityAdapterError(ValueError):
    pass


def _strip_display_only_fields(raw_dict: dict, allowed_keys: set[str]) -> dict:
    return {k: v for k, v in raw_dict.items() if k in allowed_keys}


def adapt_node(raw: dict) -> NodeSchema:
    allowed = {"id", "x", "y", "kind"}
    return NodeSchema(**_strip_display_only_fields(raw, allowed))


def adapt_edge(raw: dict) -> EdgeSchema:
    allowed = {
        "id",
        "from",
        "to",
        "distanceKm",
        "baseTravelMinutes",
        "congestionMultiplier",
        "isBlocked",
    }
    stripped = _strip_display_only_fields(raw, allowed)
    # Map frontend 'from' to schema's 'from_' field (alias 'from')
    if "from" in stripped:
        stripped["from_"] = stripped.pop("from")
    # 'to' maps directly to schema's 'to' field
    return EdgeSchema(**stripped)


def adapt_customer(raw: dict) -> CustomerSchema:
    allowed = {"id", "nodeId", "demand", "status"}
    return CustomerSchema(**_strip_display_only_fields(raw, allowed))


def adapt_vehicle(raw: dict) -> VehicleSchema:
    allowed = {
        "id",
        "label",
        "capacity",
        "usedCapacity",
        "currentNodeId",
        "assignedCustomerIds",
        "completedCustomerIds",
        "color",
        "status",
    }
    return VehicleSchema(**_strip_display_only_fields(raw, allowed))


def adapt_incident(raw: dict) -> IncidentSchema:
    allowed = {
        "id",
        "affectedEdgeIds",
        "type",
        "severity",
        "active",
    }
    return IncidentSchema(**_strip_display_only_fields(raw, allowed))


def adapt_scenario(raw: dict) -> ScenarioSchema:
    required_scenario_keys = {"id", "name", "seed", "depotNodeId", "nodes", "edges", "customers", "vehicles"}
    missing = required_scenario_keys - set(raw.keys())
    if missing:
        raise ParityAdapterError(f"Scenario missing required keys: {missing}")

    return ScenarioSchema(
        id=raw["id"],
        name=raw["name"],
        seed=raw["seed"],
        depotNodeId=raw["depotNodeId"],
        nodes=[adapt_node(n) for n in raw["nodes"]],
        edges=[adapt_edge(e) for e in raw["edges"]],
        customers=[adapt_customer(c) for c in raw["customers"]],
        vehicles=[adapt_vehicle(v) for v in raw["vehicles"]],
        incidents=[adapt_incident(i) for i in raw.get("incidents", [])],
    )


def adapt_routing_context(raw: dict | None) -> RoutingContextSchema | None:
    if not raw:
        return None
    allowed = {
        "mode",
        "depotNodeId",
        "startNodeByVehicleId",
        "remainingCapacityByVehicleId",
        "lockedCustomerIds",
        "eligibleCustomerIds",
    }
    stripped = {k: v for k, v in raw.items() if k in allowed}
    return RoutingContextSchema(**stripped)


def adapt_vehicle_route(raw: dict) -> VehicleRouteSchema:
    route_dict = dict(raw)
    nodes = route_dict.get("fullPathNodeIds", [])
    if "startNodeId" not in route_dict and nodes:
        route_dict["startNodeId"] = nodes[0]
    if "endNodeId" not in route_dict and nodes:
        route_dict["endNodeId"] = nodes[-1]
    if "completedCustomerIds" not in route_dict:
        route_dict["completedCustomerIds"] = []
    if "pendingCustomerIds" not in route_dict:
        route_dict["pendingCustomerIds"] = list(route_dict.get("customerIds", []))
    if "isDynamicReroute" not in route_dict:
        route_dict["isDynamicReroute"] = False

    required_route_keys = {
        "vehicleId",
        "customerIds",
        "fullPathNodeIds",
        "fullPathEdgeIds",
        "startNodeId",
        "endNodeId",
    }
    missing = required_route_keys - set(route_dict.keys())
    if missing:
        raise ParityAdapterError(f"Vehicle route missing required keys: {missing}")

    allowed = {
        "vehicleId",
        "customerIds",
        "fullPathNodeIds",
        "fullPathEdgeIds",
        "startNodeId",
        "endNodeId",
        "completedCustomerIds",
        "pendingCustomerIds",
        "isDynamicReroute",
        "declaredUsedCapacity",
        "declaredTravelMinutes",
        "declaredDistanceKm",
    }
    stripped = {k: v for k, v in route_dict.items() if k in allowed}
    return VehicleRouteSchema(**stripped)


def adapt_route_plan(raw: dict) -> RoutePlanSchema:
    required_plan_keys = {"algorithm", "scenarioId", "seed", "depotNodeId", "vehicleRoutes"}
    missing = required_plan_keys - set(raw.keys())
    if missing:
        raise ParityAdapterError(f"RoutePlan missing required keys: {missing}")

    return RoutePlanSchema(
        algorithm=raw["algorithm"],
        scenarioId=raw["scenarioId"],
        seed=raw["seed"],
        depotNodeId=raw["depotNodeId"],
        vehicleRoutes=[adapt_vehicle_route(r) for r in raw["vehicleRoutes"]],
        mode=raw.get("mode", "initial"),
        routingContext=adapt_routing_context(raw.get("routingContext")),
    )


def adapt_frontend_evaluation(raw: dict) -> FrontendEvaluationSchema:
    required_eval_keys = {
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
    }
    missing = required_eval_keys - set(raw.keys())
    if missing:
        raise ParityAdapterError(f"Frontend evaluation missing required keys: {missing}")

    return FrontendEvaluationSchema(**raw)


def adapt_metadata(raw: dict) -> FrontendParityMetadataSchema:
    required_meta_keys = {"source", "exportKind", "exportedAt", "scenarioSeed", "algorithm"}
    missing = required_meta_keys - set(raw.keys())
    if missing:
        raise ParityAdapterError(f"Metadata missing required keys: {missing}")

    return FrontendParityMetadataSchema(**raw)


def adapt_frontend_export(raw_export: dict) -> FrontendParityExportSchema:
    if "metadata" not in raw_export:
        raise ParityAdapterError("Export missing 'metadata' key")
    if "scenario" not in raw_export:
        raise ParityAdapterError("Export missing 'scenario' key")
    if "routePlan" not in raw_export:
        raise ParityAdapterError("Export missing 'routePlan' key")
    if "frontendEvaluation" not in raw_export:
        raise ParityAdapterError("Export missing 'frontendEvaluation' key")

    metadata = adapt_metadata(raw_export["metadata"])
    scenario = adapt_scenario(raw_export["scenario"])
    route_plan = adapt_route_plan(raw_export["routePlan"])
    frontend_evaluation = adapt_frontend_evaluation(raw_export["frontendEvaluation"])

    return FrontendParityExportSchema(
        metadata=metadata,
        scenario=scenario,
        routePlan=route_plan,
        frontendEvaluation=frontend_evaluation,
    )


def is_source_verified(metadata: FrontendParityMetadataSchema, is_temporary_fixture: bool = False) -> bool:
    if is_temporary_fixture:
        return False
    return (
        metadata.source == "QuantaRoute AI Frontend"
        and metadata.export_kind == "frontend_backend_parity"
    )