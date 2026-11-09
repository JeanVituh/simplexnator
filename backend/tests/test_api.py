from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def body(**kw):
    p = {"name": "t", "sense": "min", "objective": [0.4, 0.5],
         "variables": [{"name": "x1"}, {"name": "x2"}],
         "constraints": [{"coefficients": [0.3, 0.1], "relation": "<=", "rhs": 2.7},
                         {"coefficients": [0.5, 0.5], "relation": "=", "rhs": 6},
                         {"coefficients": [0.6, 0.4], "relation": ">=", "rhs": 6}]}
    return {"problem": p, **kw}


def test_health_and_examples():
    assert client.get("/api/health").json()["status"] == "ok"
    assert len(client.get("/api/examples").json()) >= 6


def test_solve_endpoint_full_payload():
    r = client.post("/api/solve", json=body(method="twophase"))
    assert r.status_code == 200
    d = r.json()
    assert d["relaxation"]["z"]["frac"] == "21/4" and d["relaxation"]["status"] == "optimal"
    assert d["integer"]["branch_and_bound"]["incumbent"]["z"]["frac"] == "53/10"
    assert d["dual"]["strong_duality"]["holds"] is True
    assert d["graph"]["polygon"] and d["graph"]["level_curves"]
    assert d["relaxation"]["iterations"][0]["cells_frac"]


def test_validation_errors():
    b = body(); b["problem"]["objective"] = [1]
    assert client.post("/api/solve", json=b).status_code == 422
    b = body(); b["problem"]["constraints"][0]["coefficients"] = [1]
    assert client.post("/api/solve", json=b).status_code == 422


def test_infeasible_via_api():
    b = body(); b["problem"]["constraints"] = [{"coefficients": [1, 1], "relation": "<=", "rhs": 2}, {"coefficients": [1, 1], "relation": ">=", "rhs": 5}]
    d = client.post("/api/solve", json=b).json()
    assert d["relaxation"]["status"] == "infeasible" and d["integer"]["available"] is False
