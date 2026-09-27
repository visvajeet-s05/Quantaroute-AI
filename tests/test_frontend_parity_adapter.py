import json
import pytest

from app.services.frontend_parity_adapter import (
    ParityAdapterError,
    adapt_edge,
    adapt_frontend_export,
    adapt_metadata,
    adapt_route_plan,
    adapt_scenario,
    adapt_vehicle_route,
    is_source_verified,
)


def load_greedy_fixture() -> dict:
    with open("tests/fixtures/frontend_exports/greedy_normal_26137.json", "r") as f:
        return json.load(f)


def load_invalid_fixture() -> dict:
    with open("tests/fixtures/frontend_exports/invalid_missing_path_export.json", "r") as f:
        return json.load(f)


class TestFrontendParityAdapter:
    def test_canonical_frontend_edge_from_to_maps_correctly(self) -> None:
        raw = {"id": "e1", "from": "n1", "to": "n2", "distanceKm": 1.0, "baseTravelMinutes": 2.0, "congestionMultiplier": 1.0, "isBlocked": False}
        edge = adapt_edge(raw)
        assert edge.from_ == "n1"
        assert edge.to == "n2"
        assert edge.id == "e1"

    def test_canonical_backend_edge_field_names_preserve_correctly(self) -> None:
        raw = {"id": "e1", "from": "n1", "to": "n2", "distanceKm": 1.0, "baseTravelMinutes": 2.0, "congestionMultiplier": 1.0, "isBlocked": False}
        edge = adapt_edge(raw)
        assert edge.from_ == "n1"
        assert edge.to == "n2"
        assert edge.id == "e1"

    def test_adapter_does_not_mutate_raw_export(self) -> None:
        raw_export = load_greedy_fixture()
        raw_edges_before = [e["id"] for e in raw_export["scenario"]["edges"]]
        adapt_frontend_export(raw_export)
        raw_edges_after = [e["id"] for e in raw_export["scenario"]["edges"]]
        assert raw_edges_before == raw_edges_after

    def test_missing_required_scenario_field_raises_clear_error(self) -> None:
        raw = load_greedy_fixture()
        del raw["scenario"]["depotNodeId"]
        with pytest.raises(ParityAdapterError, match="Scenario missing required keys: {'depotNodeId'}"):
            adapt_frontend_export(raw)

    def test_missing_fullPathNodeIds_raises_clear_error(self) -> None:
        raw = load_greedy_fixture()
        del raw["routePlan"]["vehicleRoutes"][0]["fullPathNodeIds"]
        with pytest.raises(ParityAdapterError, match="Vehicle route missing required keys: {'fullPathNodeIds'}"):
            adapt_frontend_export(raw)

    def test_missing_fullPathEdgeIds_raises_clear_error(self) -> None:
        raw = load_greedy_fixture()
        del raw["routePlan"]["vehicleRoutes"][0]["fullPathEdgeIds"]
        with pytest.raises(ParityAdapterError, match="Vehicle route missing required keys: {'fullPathEdgeIds'}"):
            adapt_frontend_export(raw)

    def test_display_only_fields_are_safely_ignored(self) -> None:
        raw = load_greedy_fixture()
        raw["scenario"]["nodes"][0]["visualX"] = 100
        raw["scenario"]["nodes"][0]["visualY"] = 200
        raw["scenario"]["edges"][0]["color"] = "#ff0000"
        adapted = adapt_frontend_export(raw)
        assert adapted.scenario.nodes[0].id == "n_0_0"
        assert adapted.scenario.edges[0].id == "e_0_0_to_1_0"

    def test_invalid_customer_data_rejected_by_typed_schemas(self) -> None:
        raw = load_greedy_fixture()
        raw["scenario"]["customers"][0]["demand"] = -1
        with pytest.raises(Exception):
            adapt_frontend_export(raw)

    def test_valid_temporary_fixture_adapts(self) -> None:
        raw = load_greedy_fixture()
        adapted = adapt_frontend_export(raw)
        assert adapted.metadata.source == "Temporary Fixture"
        assert adapted.metadata.export_kind == "temporary_frontend_parity_stub"
        assert adapted.scenario.id == "frontend_parity_greedy_26137"
        assert len(adapted.route_plan.vehicle_routes) == 2

    def test_metadata_verification_true_only_for_exact_genuine_identifiers(self) -> None:
        # Genuine
        genuine_meta = adapt_metadata({
            "source": "QuantaRoute AI Frontend",
            "exportKind": "frontend_backend_parity",
            "exportedAt": "2026-09-27T12:00:00Z",
            "scenarioSeed": 26137,
            "algorithm": "greedy",
        })
        assert is_source_verified(genuine_meta) is True

        # Wrong source
        wrong_source = adapt_metadata({
            "source": "Other",
            "exportKind": "frontend_backend_parity",
            "exportedAt": "2026-09-27T12:00:00Z",
            "scenarioSeed": 26137,
            "algorithm": "greedy",
        })
        assert is_source_verified(wrong_source) is False

        # Wrong exportKind
        wrong_kind = adapt_metadata({
            "source": "QuantaRoute AI Frontend",
            "exportKind": "other",
            "exportedAt": "2026-09-27T12:00:00Z",
            "scenarioSeed": 26137,
            "algorithm": "greedy",
        })
        assert is_source_verified(wrong_kind) is False

        # Temporary fixture
        temp_meta = adapt_metadata({
            "source": "Temporary Fixture",
            "exportKind": "temporary_frontend_parity_stub",
            "exportedAt": "2026-09-27T12:00:00Z",
            "scenarioSeed": 26137,
            "algorithm": "greedy",
        })
        assert is_source_verified(temp_meta, is_temporary_fixture=True) is False