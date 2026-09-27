import json
import pytest

from app.services.parity_service import compare_frontend_export


def load_greedy_fixture() -> dict:
    with open("tests/fixtures/frontend_exports/greedy_normal_26137.json", "r") as f:
        return json.load(f)


def load_pso_fixture() -> dict:
    with open("tests/fixtures/frontend_exports/pso_balanced_normal_26137.json", "r") as f:
        return json.load(f)


def load_qpso_fixture() -> dict:
    with open("tests/fixtures/frontend_exports/qpso_balanced_normal_26137.json", "r") as f:
        return json.load(f)


def load_invalid_fixture() -> dict:
    with open("tests/fixtures/frontend_exports/invalid_missing_path_export.json", "r") as f:
        return json.load(f)


class TestParityService:
    def test_temporary_fixture_metrics_match_but_source_unverified(self) -> None:
        raw = load_greedy_fixture()
        result = compare_frontend_export(raw, is_temporary_fixture=True)

        assert result.source_verified is False
        assert result.passed is False
        assert len(result.mismatches) == 0 or all(m.severity == "warning" for m in result.mismatches)
        assert "Parity metrics may match" in result.summary

    def test_valid_verified_fixture_metrics_match_and_passed_true(self) -> None:
        raw = load_greedy_fixture()
        raw["metadata"]["source"] = "QuantaRoute AI Frontend"
        raw["metadata"]["exportKind"] = "frontend_backend_parity"
        raw["metadata"]["sourceVerified"] = True

        result = compare_frontend_export(raw, is_temporary_fixture=False)

        assert result.source_verified is True
        assert result.passed is True
        assert len(result.mismatches) == 0
        assert "match within tolerance" in result.summary

    def test_travel_time_mismatch_detected(self) -> None:
        raw = load_greedy_fixture()
        raw["metadata"]["source"] = "QuantaRoute AI Frontend"
        raw["metadata"]["exportKind"] = "frontend_backend_parity"
        raw["frontendEvaluation"]["totalTravelMinutes"] = 999.0

        result = compare_frontend_export(raw, is_temporary_fixture=False)

        assert result.passed is False
        assert any(m.field == "totalTravelMinutes" and m.severity == "error" for m in result.mismatches)

    def test_routing_score_mismatch_detected(self) -> None:
        raw = load_greedy_fixture()
        raw["metadata"]["source"] = "QuantaRoute AI Frontend"
        raw["metadata"]["exportKind"] = "frontend_backend_parity"
        raw["frontendEvaluation"]["routingScore"] = 999.0

        result = compare_frontend_export(raw, is_temporary_fixture=False)

        assert result.passed is False
        assert any(m.field == "routingScore" and m.severity == "error" for m in result.mismatches)

    def test_penalty_mismatch_detected(self) -> None:
        raw = load_greedy_fixture()
        raw["metadata"]["source"] = "QuantaRoute AI Frontend"
        raw["metadata"]["exportKind"] = "frontend_backend_parity"
        raw["frontendEvaluation"]["penaltyTotal"] = 999.0

        result = compare_frontend_export(raw, is_temporary_fixture=False)

        assert result.passed is False
        assert any(m.field == "penaltyTotal" and m.severity == "error" for m in result.mismatches)

    def test_list_mismatch_detected_order_insensitively(self) -> None:
        raw = load_greedy_fixture()
        raw["metadata"]["source"] = "QuantaRoute AI Frontend"
        raw["metadata"]["exportKind"] = "frontend_backend_parity"
        raw["frontendEvaluation"]["unservedCustomerIds"] = ["C99"]

        result = compare_frontend_export(raw, is_temporary_fixture=False)

        assert result.passed is False
        assert any(m.field == "unservedCustomerIds" and m.severity == "error" for m in result.mismatches)

    def test_boolean_feasibility_mismatch_detected(self) -> None:
        raw = load_greedy_fixture()
        raw["metadata"]["source"] = "QuantaRoute AI Frontend"
        raw["metadata"]["exportKind"] = "frontend_backend_parity"
        raw["frontendEvaluation"]["feasible"] = False

        result = compare_frontend_export(raw, is_temporary_fixture=False)

        assert result.passed is False
        assert any(m.field == "feasible" and m.severity == "error" for m in result.mismatches)

    def test_integer_assignment_mismatch_detected(self) -> None:
        raw = load_greedy_fixture()
        raw["metadata"]["source"] = "QuantaRoute AI Frontend"
        raw["metadata"]["exportKind"] = "frontend_backend_parity"
        raw["frontendEvaluation"]["customersAssigned"] = 99

        result = compare_frontend_export(raw, is_temporary_fixture=False)

        assert result.passed is False
        assert any(m.field == "customersAssigned" and m.severity == "error" for m in result.mismatches)

    def test_warning_mismatch_is_warning_severity_only(self) -> None:
        raw = load_greedy_fixture()
        raw["metadata"]["source"] = "QuantaRoute AI Frontend"
        raw["metadata"]["exportKind"] = "frontend_backend_parity"
        raw["frontendEvaluation"]["warnings"] = ["different warning"]

        result = compare_frontend_export(raw, is_temporary_fixture=False)

        assert result.passed is True
        assert any(m.field == "warnings" and m.severity == "warning" for m in result.mismatches)

    def test_tolerance_boundary_passes(self) -> None:
        raw = load_greedy_fixture()
        raw["metadata"]["source"] = "QuantaRoute AI Frontend"
        raw["metadata"]["exportKind"] = "frontend_backend_parity"
        raw["frontendEvaluation"]["totalTravelMinutes"] = raw["frontendEvaluation"]["totalTravelMinutes"] + 0.5e-8

        result = compare_frontend_export(raw, tolerance=1e-8, is_temporary_fixture=False)

        assert result.passed is True
        assert not any(m.field == "totalTravelMinutes" and m.severity == "error" for m in result.mismatches)

    def test_numeric_beyond_tolerance_fails(self) -> None:
        raw = load_greedy_fixture()
        raw["metadata"]["source"] = "QuantaRoute AI Frontend"
        raw["metadata"]["exportKind"] = "frontend_backend_parity"
        raw["frontendEvaluation"]["totalTravelMinutes"] = raw["frontendEvaluation"]["totalTravelMinutes"] + 2e-8

        result = compare_frontend_export(raw, tolerance=1e-8, is_temporary_fixture=False)

        assert result.passed is False
        assert any(m.field == "totalTravelMinutes" and m.severity == "error" for m in result.mismatches)

    def test_evaluator_is_called_but_does_not_mutate_raw_export(self) -> None:
        raw = load_greedy_fixture()
        raw_edges_before = [e["id"] for e in raw["scenario"]["edges"]]

        result = compare_frontend_export(raw, is_temporary_fixture=True)

        raw_edges_after = [e["id"] for e in raw["scenario"]["edges"]]
        assert raw_edges_before == raw_edges_after
        assert result.backend_evaluation is not None