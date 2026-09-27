import json
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def load_greedy_fixture() -> dict:
    with open("tests/fixtures/frontend_exports/greedy_normal_26137.json", "r") as f:
        return json.load(f)


def load_invalid_fixture() -> dict:
    with open("tests/fixtures/frontend_exports/invalid_missing_path_export.json", "r") as f:
        return json.load(f)


class TestParityAPI:
    def test_temporary_fixture_comparison_returns_200_and_source_verified_false(self) -> None:
        raw = load_greedy_fixture()
        response = client.post("/api/v1/parity/compare", json=raw)

        assert response.status_code == 200
        data = response.json()
        assert data["sourceVerified"] is False

    def test_verified_fixture_returns_200_and_passed_true(self) -> None:
        raw = load_greedy_fixture()
        raw["metadata"]["source"] = "QuantaRoute AI Frontend"
        raw["metadata"]["exportKind"] = "frontend_backend_parity"
        raw["metadata"]["sourceVerified"] = True

        response = client.post("/api/v1/parity/compare", json=raw)

        assert response.status_code == 200
        data = response.json()
        assert data["sourceVerified"] is True
        assert data["passed"] is True

    def test_invalid_missing_path_fixture_returns_200_with_error(self) -> None:
        raw = load_invalid_fixture()
        response = client.post("/api/v1/parity/compare", json=raw)

        assert response.status_code == 200
        data = response.json()
        assert data["sourceVerified"] is False
        assert data["passed"] is False
        assert len(data["mismatches"]) > 0
        assert any("fullPathNodeIds" in m["message"] or "fullPathEdgeIds" in m["message"] for m in data["mismatches"])

    def test_mismatch_export_returns_200_and_passed_false(self) -> None:
        raw = load_greedy_fixture()
        raw["metadata"]["source"] = "QuantaRoute AI Frontend"
        raw["metadata"]["exportKind"] = "frontend_backend_parity"
        raw["frontendEvaluation"]["totalTravelMinutes"] = 999.0

        response = client.post("/api/v1/parity/compare", json=raw)

        assert response.status_code == 200
        data = response.json()
        assert data["sourceVerified"] is True
        assert data["passed"] is False

    def test_docs_endpoint_returns_200(self) -> None:
        response = client.get("/docs")
        assert response.status_code == 200

    def test_openapi_schema_contains_parity_endpoint(self) -> None:
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()
        assert "/api/v1/parity/compare" in schema["paths"]
        assert "post" in schema["paths"]["/api/v1/parity/compare"]