# Frontend Exports for Backend Parity

This directory contains exported frontend scenario and RoutePlan files used for backend parity verification.

## Export Format

Each export file must be a JSON object with the following root keys:

```json
{
  "metadata": {
    "source": "QuantaRoute AI Frontend",
    "exportKind": "frontend_backend_parity",
    "exportedAt": "2026-09-27T12:00:00.000Z",
    "scenarioSeed": 26137,
    "algorithm": "greedy",
    "preset": "normal",
    "optimizerSeed": 26137,
    "appVersion": "1.0.0"
  },
  "scenario": { ... },
  "routePlan": { ... },
  "frontendEvaluation": { ... }
}
```

### Required Metadata Fields

| Field | Required | Description |
|-------|----------|-------------|
| `source` | Yes | Must be exactly `"QuantaRoute AI Frontend"` |
| `exportKind` | Yes | Must be exactly `"frontend_backend_parity"` |
| `exportedAt` | Yes | ISO 8601 datetime string |
| `scenarioSeed` | Yes | Integer seed used for scenario generation |
| `algorithm` | Yes | Algorithm name: `"greedy"`, `"pso"`, `"qpso"` |
| `preset` | No | Preset name (e.g., `"normal"`, `"balanced"`) |
| `optimizerSeed` | No | Integer seed used for optimizer |
| `appVersion` | No | Frontend application version |

### Required Root Keys

- `metadata` - Export metadata
- `scenario` - Complete scenario object (nodes, edges, customers, vehicles, incidents)
- `routePlan` - Complete route plan with vehicle routes
- `frontendEvaluation` - Frontend-computed evaluation metrics

## How to Export from Frontend

1. Run the frontend application
2. Navigate to the Parity Export page or use the export button in the optimizer results view
3. Select the algorithm and seed to export
4. Save the JSON file to this directory with the naming convention:
   - `greedy_normal_26137.json`
   - `pso_balanced_normal_26137.json`
   - `qpso_balanced_normal_26137.json`

## Important Rules

> **Never edit `frontendEvaluation` values to force parity. Fix code/data-contract differences instead.**

The frontend evaluation is the ground truth. If backend metrics differ, the backend implementation or data contracts need to be corrected.

## Temporary Fixtures

The files currently in this directory are **temporary stubs** marked with:
- `metadata.source = "Temporary Fixture"`
- `metadata.exportKind = "temporary_frontend_parity_stub"`
- `metadata.sourceVerified = false`

When genuine frontend exports are available, replace these stubs with the real exports.

## How to Replace Temporary Stubs

1. Generate real exports from the frontend (see above)
2. Save them with the same filenames in this directory
3. The parity tests will automatically detect `sourceVerified: true`

## Running Parity Tests

```bash
# Run all parity tests
pytest -q tests/test_parity_service.py tests/test_frontend_parity_adapter.py tests/test_parity_api.py

# Run specific test
pytest -q tests/test_parity_service.py::TestParityService::test_temporary_fixture_metrics_match_but_source_unverified
```

## Calling Parity API via Swagger

1. Start backend: `uvicorn app.main:app --reload`
2. Open Swagger: http://127.0.0.1:8000/docs
3. Find `POST /api/v1/parity/compare`
4. Click "Try it out" and paste the JSON export
5. Execute and review the `ParityComparisonResponse`