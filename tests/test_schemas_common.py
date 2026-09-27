import pytest
from pydantic import Field

from app.schemas.common import (
    AlgorithmName,
    BaseSchema,
    CustomerStatus,
    NodeKind,
    VehicleExecutionState,
)


class TestNodeKind:
    def test_node_kind_values(self) -> None:
        assert NodeKind.intersection == "intersection"
        assert NodeKind.depot == "depot"
        assert NodeKind.customer == "customer"

    def test_node_kind_str_enum(self) -> None:
        assert isinstance(NodeKind.intersection, str)
        assert NodeKind("intersection") == NodeKind.intersection


class TestCustomerStatus:
    def test_customer_status_values(self) -> None:
        assert CustomerStatus.pending == "pending"
        assert CustomerStatus.assigned == "assigned"
        assert CustomerStatus.served == "served"


class TestVehicleExecutionState:
    def test_vehicle_execution_state_values(self) -> None:
        assert VehicleExecutionState.awaiting_optimization == "awaiting_optimization"
        assert VehicleExecutionState.planned == "planned"
        assert VehicleExecutionState.en_route == "en_route"
        assert VehicleExecutionState.rerouting == "rerouting"
        assert VehicleExecutionState.revised == "revised"
        assert VehicleExecutionState.inactive == "inactive"
        assert VehicleExecutionState.infeasible == "infeasible"


class TestAlgorithmName:
    def test_algorithm_name_values(self) -> None:
        assert AlgorithmName.dijkstra == "dijkstra"
        assert AlgorithmName.greedy == "greedy"
        assert AlgorithmName.pso == "pso"
        assert AlgorithmName.qpso == "qpso"


class TestBaseSchema:
    def test_base_schema_forbids_extra_fields(self) -> None:
        class TestModel(BaseSchema):
            name: str

        with pytest.raises(Exception) as exc_info:
            TestModel(name="test", extra_field="not allowed")
        assert "extra" in str(exc_info.value).lower() or "unexpected" in str(exc_info.value).lower()

    def test_base_schema_allows_valid_fields(self) -> None:
        class TestModel(BaseSchema):
            name: str
            value: int = 42

        m = TestModel(name="test")
        assert m.name == "test"
        assert m.value == 42

    def test_base_schema_now_utc_returns_utc_datetime(self) -> None:
        dt = BaseSchema.now_utc()
        assert dt.tzinfo is not None
        assert dt.tzinfo.utcoffset(dt) is not None

    def test_base_schema_populate_by_name(self) -> None:
        class TestModel(BaseSchema):
            camel_case: str = Field(alias="camelCase")

        m = TestModel(camelCase="value")
        assert m.camel_case == "value"
        assert m.model_dump(by_alias=True)["camelCase"] == "value"