from fastapi import FastAPI

from app.api import evaluation, parity, pathfinding, schemas_demo

app = FastAPI(title="QuantaRoute AI", version="0.1.0")

app.include_router(schemas_demo.app.router)
app.include_router(pathfinding.router)
app.include_router(evaluation.router)
app.include_router(parity.router)