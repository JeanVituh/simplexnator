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
print("fixtures geradas em", out)
