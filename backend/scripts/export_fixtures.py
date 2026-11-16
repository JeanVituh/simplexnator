"""Gera as respostas reais da API usadas pelos testes do frontend (frontend/src/test/fixtures).

Uso (na pasta backend, com o ambiente virtual ativo):  python scripts/export_fixtures.py
"""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402

out = pathlib.Path(__file__).resolve().parents[2] / "frontend" / "src" / "test" / "fixtures"
out.mkdir(parents=True, exist_ok=True)
client = TestClient(app)
examples = client.get("/api/examples").json()
(out / "examples.json").write_text(json.dumps(examples, ensure_ascii=False), encoding="utf-8")
for ex in examples:
    if ex["id"] in ("radioterapico", "multipla", "producao-inteira"):
        r = client.post("/api/solve", json={"problem": ex["problem"], "method": "bigm", "integer": "all"})
        assert r.status_code == 200
        (out / f"solve-{ex['id']}.json").write_text(json.dumps(r.json(), ensure_ascii=False), encoding="utf-8")

def prob(name, sense, obj, cons):
    return {"name": name, "sense": sense, "objective": obj, "variables": [{"name": f"x{i+1}"} for i in range(len(obj))],
            "constraints": [{"coefficients": c, "relation": r, "rhs": b} for c, r, b in cons]}


def save(name, body, path="/api/solve"):
    r = client.post(path, json=body)
    assert r.status_code == 200, (name, r.text)
    (out / f"{name}.json").write_text(json.dumps(r.json(), ensure_ascii=False), encoding="utf-8")
    return r.json()


# casos especiais do Branch and Bound
raiz = prob("Ótimo inteiro na raiz", "max", [1, 1], [([1, 0], "<=", 3), ([0, 1], "<=", 2)])
save("solve-raiz-inteira", {"problem": raiz, "method": "bigm", "integer": "all"})
many = prob("Muitos nós", "max", [11, 12, 11], [([5, 6, 9], "<=", 31), ([9, 5, 6], "<=", 32), ([5, 9, 4], "<=", 28)])
save("solve-limite-nos", {"problem": many, "method": "bigm", "integer": "all", "node_limit": 10})
sem = prob("Sem solução inteira", "max", [1, 0], [([2, 2], "=", 3)])
save("solve-sem-inteira", {"problem": sem, "method": "bigm", "integer": "all"})
# consulta sob demanda de um nó (nó 2 do radioterápico)
radio = next(e for e in examples if e["id"] == "radioterapico")["problem"]
full = json.loads((out / "solve-radioterapico.json").read_text(encoding="utf-8"))
n2 = full["integer"]["branch_and_bound"]["nodes"][1]
save("bb-node-radioterapico-2", {"problem": radio, "method": "bigm", **n2["bounds"]}, "/api/bb/node")
print("fixtures geradas em", out)
