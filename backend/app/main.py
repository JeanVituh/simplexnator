"""API FastAPI do Simplexnator."""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .engine.examples import EXAMPLES
from .engine.solver import solve_problem
from .schemas import SolveRequest

app = FastAPI(title="Simplexnator API", version="1.1.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"status": "ok", "limits": {"max_variables": settings.max_variables, "max_constraints": settings.max_constraints,
                                       "bb_node_limit": settings.bb_node_limit}}


@app.get("/api/examples")
def examples():
    return EXAMPLES


@app.post("/api/solve")
def solve(req: SolveRequest):
    try:
        return solve_problem(req.problem.to_lp(), req.method, req.integer, req.node_limit)
    except RuntimeError as e:  # limite de iterações etc.
        raise HTTPException(status_code=422, detail=str(e))
