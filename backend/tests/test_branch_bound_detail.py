"""Branch and Bound detalhado: indicadores, tabela de nós, tableaus por nó, nó incumbente e consulta sob demanda."""
import json
from fractions import Fraction as F

import pytest
from fastapi.testclient import TestClient

from app.engine.examples import EXAMPLES
from app.engine.integer import branch_and_bound
from app.engine.model import LP, Con, Var
from app.engine.simplex import solve_lp
from app.engine.solver import solve_problem
from app.main import app
from app.schemas import ProblemIn

client = TestClient(app)
EX = {e["id"]: e for e in EXAMPLES}


def knap(c, rows, sense="max", rel="<="):
    return LP(sense, [F(v) for v in c], [Var(f"x{i+1}") for i in range(len(c))],
              [Con(f"R{i+1}", [F(a) for a in co], rel, F(b)) for i, (co, b) in enumerate(rows)])


# instâncias encontradas por busca determinística (ver RESULTADOS_DOS_TESTES.md)
PRUNE = knap([6, 3], [([3, 8], 28), ([3, 5], 17), ([8, 2], 33)])
CHILD = knap([12, 7, 11, 13], [([4, 3, 5, 7], 18)])
MANY = knap([11, 12, 11], [([5, 6, 9], 31), ([9, 5, 6], 32), ([5, 9, 4], 28)])


def run(lp, **kw):
    return branch_and_bound(lp, set(range(len(lp.vars))), **kw)


def consistent(bb):
    """Invariantes que valem para qualquer execução."""
    nodes, st = bb["nodes"], bb["stats"]
    by_id = {n["id"]: n for n in nodes}
    assert nodes[0]["parent"] is None and nodes[0]["depth"] == 0 and nodes[0]["constraints"] == []
    explored = [n for n in nodes if n["status"] is not None]
    assert st["explored"] == bb["explored"] == len(explored)
    assert st["explored"] == st["branched"] + st["infeasible"] + st["unbounded"] + st["pruned_bound"] + st["integer_nodes"]
    assert st["pending"] == len(nodes) - len(explored)
    assert st["total_pivots"] == sum(n["pivots"] for n in nodes) and st["max_depth"] == max(n["depth"] for n in explored)
    for n in nodes:
        assert n["note"]
        if n["parent"] is not None:
            p = by_id[n["parent"]]
            assert p["decision"] == "branched" and n["depth"] == p["depth"] + 1
            assert n["constraints"] == p["constraints"] + [n["branch"]]          # restrições acumuladas
            assert n["bound"]["var"] == p["branch_var"] and n["bound"]["value"] in (p["floor"], p["ceil"])
        if n["decision"] == "branched":
            v = F(n["branch_value"]["frac"])
            assert v.denominator != 1 and n["floor"] == v.numerator // v.denominator and n["ceil"] == n["floor"] + 1
            assert len([k for k in nodes if k["parent"] == n["id"]]) == 2 or st["pending"] > 0
        if n["decision"] == "integer":
            assert all(F(q["frac"]).denominator == 1 for q in n["x"])
    return st


def test_otimo_inteiro_na_raiz_nao_inventa_nos():
    lp = knap([1, 1], [([1, 0], 3), ([0, 1], 2)])
    bb = run(lp)
    st = consistent(bb)
    assert bb["explored"] == 1 and len(bb["nodes"]) == 1 and st["root_integral"] and st["final_status"] == "root_integral"
    assert st["branched"] == 0 and st["max_depth"] == 0 and bb["incumbent_node"] == 1 and bb["proven_optimal"]
    assert st["gap"]["frac"] == "0" and st["root_z"]["frac"] == st["incumbent_z"]["frac"] == "5"
    assert bb["incumbent_iterations"] and bb["incumbent_iterations"][-1]["pivot"] is None


def test_radioterapico_minimizacao_indicadores_e_nos():
    out = solve_problem(ProblemIn(**EX["radioterapico"]["problem"]).to_lp(), "bigm", "all", 2000, 150)
    bb = out["integer"]["branch_and_bound"]
    st = consistent(bb)
    assert (st["explored"], st["branched"], st["infeasible"], st["integer_nodes"], st["pruned_bound"], st["max_depth"]) == (3, 1, 1, 1, 0, 1)
    assert st["root_z"]["frac"] == "21/4" and st["incumbent_z"]["frac"] == "53/10" and st["gap"]["frac"] == "1/20"
    assert st["final_status"] == "proven" and st["proven_optimal"] and bb["incumbent_node"] == 2
    root, n2, n3 = bb["nodes"]
    assert (root["branch_var"], root["floor"], root["ceil"], root["branch_value"]["frac"]) == ("x1", 7, 8, "15/2")
    assert n2["constraints"] == ["x1 ≤ 7"] and n3["constraints"] == ["x1 ≥ 8"] and n3["decision"] == "infeasible"
    assert st["total_pivots"] == sum(n["pivots"] for n in bb["nodes"]) > 0


def test_maximizacao_diferenca_entre_continuo_e_inteiro():
    out = solve_problem(ProblemIn(**EX["producao-inteira"]["problem"]).to_lp(), "bigm", "all", 2000, 150)
    st = consistent(out["integer"]["branch_and_bound"])
    assert st["root_z"]["frac"] == "21" and st["incumbent_z"]["frac"] == "20" and st["gap"]["frac"] == "1"
    assert F(st["incumbent_z"]["frac"]) <= F(st["root_z"]["frac"])        # maximização: inteiro ≤ contínuo


def test_podas_por_limite_inviaveis_e_varias_ramificacoes():
    bb = run(PRUNE)
    st = consistent(bb)
    assert st["pruned_bound"] >= 1 and st["infeasible"] >= 1 and st["integer_nodes"] >= 1 and st["max_depth"] >= 3 and st["branched"] >= 3
    best = F(bb["incumbent"]["z"]["frac"])
    for n in bb["nodes"]:
        if n["decision"] == "pruned_bound":
            assert F(n["z"]["frac"]) <= best                                 # relaxação não melhora o incumbente final
    assert bb["proven_optimal"] and bb["status"] == "optimal"
    # o resultado confere com a enumeração exaustiva dos inteiros
    best_enum = max(6 * a + 3 * b for a in range(0, 12) for b in range(0, 12) if 3*a+8*b <= 28 and 3*a+5*b <= 17 and 8*a+2*b <= 33)
    assert best == best_enum


def test_solucao_inteira_encontrada_em_no_filho_profundo():
    bb = run(CHILD)
    consistent(bb)
    inc = bb["nodes"][bb["incumbent_node"] - 1]
    assert inc["depth"] >= 2 and inc["decision"] == "integer" and bb["stats"]["max_depth"] >= 3 and bb["proven_optimal"]


def test_limite_de_nos_nao_comprova_otimalidade():
    bb = run(MANY, node_limit=10)
    st = consistent(bb)
    assert bb["node_limit_hit"] and bb["status"] == "node_limit" and bb["proven_optimal"] is False
    assert st["final_status"] == "node_limit" and st["explored"] == 10 and st["pending"] > 0
    pend = [n for n in bb["nodes"] if n["decision"] == "node_limit"]
    assert len(pend) == st["pending"] and all(n["status"] is None and n["tableau"] is None and n["z"] is None for n in pend)
    full = run(MANY)
    assert full["proven_optimal"] and full["stats"]["explored"] > 10


def test_sem_solucao_inteira_viavel():
    lp = LP("max", [F(1), F(0)], [Var("x1"), Var("x2")], [Con("R1", [F(2), F(2)], "=", F(3))])
    assert solve_lp(lp).status == "optimal"                                     # a relaxação existe...
    bb = run(lp)
    st = consistent(bb)
    assert bb["incumbent"] is None and bb["status"] == "infeasible" and st["final_status"] == "no_integer"
    assert bb["proven_optimal"] is False and bb["incumbent_iterations"] == [] and st["incumbent_z"] is None and st["gap"] is None


def test_tableau_final_de_cada_no_coerente_com_a_solucao_do_no():
    bb = run(MANY, tableau_limit=10)
    assert all(n["tableau"] is not None for n in bb["nodes"][:10]) and sum(n["tableau"] is not None for n in bb["nodes"]) <= 11
    for n in bb["nodes"]:
        t = n["tableau"]
        if not t:
            continue
        assert t["pivot"] is None and t["cells_dec"][0] and t["basis"]
        if n["status"] == "optimal":
            assert [float(v) for v in t["x_dec"]] == pytest.approx([q["value"] for q in n["x"]], abs=1e-4)
            assert F(t["z_frac"]) == F(n["z"]["frac"])
    assert bb["nodes"][bb["incumbent_node"] - 1]["tableau"] is not None     # incumbente sempre recebe o tableau


def test_iteracoes_do_no_incumbente():
    bb = run(CHILD)
    its, inc = bb["incumbent_iterations"], bb["incumbent"]
    node = bb["nodes"][bb["incumbent_node"] - 1]
    assert len(its) == node["pivots"] + 1 and its[-1]["pivot"] is None
    assert all(i["pivot"] and i["entering"] and i["leaving"] and i["ratios_dec"] and i["operations_dec"] for i in its[:-1])
    assert [F(v) for v in its[-1]["x_frac"]] == [F(q["frac"]) for q in inc["x"]] and F(its[-1]["z_frac"]) == F(inc["z"]["frac"])


def test_endpoint_por_no_reproduz_a_relaxacao_do_no():
    prob = EX["radioterapico"]["problem"]
    r = client.post("/api/solve", json={"problem": prob, "method": "bigm", "integer": "all"}).json()
    bb = r["integer"]["branch_and_bound"]
    for n in bb["nodes"]:
        q = client.post("/api/bb/node", json={"problem": prob, "method": "bigm", **n["bounds"]})
        assert q.status_code == 200
        d = q.json()
        assert d["status"] == n["status"] and d["pivots"] == n["pivots"] and len(d["iterations"]) == n["pivots"] + 1
        if n["status"] == "optimal":
            assert d["z"]["frac"] == n["z"]["frac"] and [x["frac"] for x in d["x"]] == [x["frac"] for x in n["x"]]


def test_endpoint_por_no_validacao():
    prob = EX["radioterapico"]["problem"]
    assert client.post("/api/bb/node", json={"problem": prob, "lower": ["0"], "upper": [None, None]}).status_code == 422
    assert client.post("/api/bb/node", json={"problem": prob, "lower": ["abc", "0"], "upper": [None, None]}).status_code == 422
    assert client.post("/api/bb/node", json={"problem": prob, "lower": ["0", "0"], "upper": ["1/0", None]}).status_code == 422


def test_compatibilidade_da_resposta_com_a_versao_anterior():
    out = solve_problem(ProblemIn(**EX["producao-inteira"]["problem"]).to_lp(), "bigm", "all", 2000, 150)
    bb = out["integer"]["branch_and_bound"]
    assert {"status", "nodes", "explored", "node_limit", "node_limit_hit", "incumbent", "proven_optimal"} <= set(bb)
    assert {"id", "parent", "depth", "branch", "status", "z", "x", "decision", "branch_var", "note", "iterations"} <= set(bb["nodes"][0])
    assert {"x", "z", "node"} <= set(bb["incumbent"])


def test_tamanho_da_resposta_continua_limitado():
    prob = {"name": "m", "sense": "max", "objective": [11, 12, 11],
            "variables": [{"name": f"x{i+1}"} for i in range(3)],
            "constraints": [{"coefficients": co, "relation": "<=", "rhs": b} for co, b in [([5, 6, 9], 31), ([9, 5, 6], 32), ([5, 9, 4], 28)]]}
    r = client.post("/api/solve", json={"problem": prob, "method": "bigm", "integer": "all"})
    bb = r.json()["integer"]["branch_and_bound"]
    assert sum(n["tableau"] is not None for n in bb["nodes"]) <= bb["tableau_limit"] + 1
    assert len(r.content) < 1_500_000


def test_resposta_grande_e_comprimida_com_gzip():
    prob = {"name": "sem solução inteira", "sense": "max", "objective": [1] * 6, "variables": [{"name": f"x{i+1}"} for i in range(6)],
            "constraints": [{"coefficients": [3, 6, 9, 12, 15, 18], "relation": "=", "rhs": 100}]}
    body = {"problem": prob, "method": "bigm", "integer": "all", "node_limit": 300}
    r = client.post("/api/solve", json=body, headers={"Accept-Encoding": "gzip", "Origin": "http://localhost:5173"})
    assert r.status_code == 200 and r.headers.get("content-encoding") == "gzip"
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"      # CORS continua valendo com a compressão
    bb = r.json()["integer"]["branch_and_bound"]
    assert bb["stats"]["final_status"] == "node_limit" and bb["stats"]["explored"] == 300 and bb["proven_optimal"] is False
    small = client.get("/api/health", headers={"Accept-Encoding": "gzip"})
    assert small.headers.get("content-encoding") is None                                # respostas pequenas não são comprimidas
