"""API FastAPI do Simplexnator."""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from .config import settings
from .engine.examples import EXAMPLES
from .engine.solver import solve_node, solve_problem
from .schemas import NodeRequest, SolveRequest

app = FastAPI(title="Simplexnator API", version="1.1.0")
app.add_middleware(GZipMiddleware, minimum_size=1024)   # respostas do Branch and Bound podem ter centenas de KiB; o CORS (adicionado depois) fica por fora
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"status": "ok", "limits": {"max_variables": settings.max_variables, "max_constraints": settings.max_constraints,
                                       "bb_node_limit": settings.bb_node_limit, "bb_tableau_limit": settings.bb_tableau_limit}}


@app.get("/api/examples")
def examples():
    return EXAMPLES


@app.post("/api/solve")
def solve(req: SolveRequest):
    try:
        return solve_problem(req.problem.to_lp(), req.method, req.integer, req.node_limit, settings.bb_tableau_limit)
    except RuntimeError as e:  # limite de iterações etc.
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/bb/node")
def bb_node(req: NodeRequest):
    """Iterações completas da relaxação de um nó do Branch and Bound (consulta sob demanda)."""
    lower, upper = req.bounds()
    try:
        return solve_node(req.problem.to_lp(), lower, upper, req.method)
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
