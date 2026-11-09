"""Regressão dos exemplos cadastrados: todos são resolvidos de verdade pelo motor (nada pré-programado)."""
from fractions import Fraction as F
import pytest
from app.engine.examples import EXAMPLES
from app.engine.solver import solve_problem
from app.schemas import ProblemIn

BY_ID = {e["id"]: e for e in EXAMPLES}


def run(eid, method="bigm", integer="all"):
    lp = ProblemIn(**BY_ID[eid]["problem"]).to_lp()
    return solve_problem(lp, method, integer, 2000)


def fr(nums):
    return [n["frac"] for n in nums]


def test_lista_de_exemplos_sem_duplicidade():
    assert [e["id"] for e in EXAMPLES] == ["radioterapico", "producao-inteira", "multipla", "mix3", "binario", "inviavel", "ilimitado"]
    assert len({e["title"] for e in EXAMPLES}) == len(EXAMPLES)
    assert sum("radioter" in e["title"].lower() for e in EXAMPLES) == 1
    assert BY_ID["radioterapico"]["title"] == "Problema Radioterápico"
    for e in EXAMPLES:
        assert "verified" not in e and e["description"] and e["highlights"]


@pytest.mark.parametrize("method", ["bigm", "twophase"])
def test_radioterapico_recalculado_pelo_motor(method):
    o = run("radioterapico", method)
    rel = o["relaxation"]
    assert rel["status"] == "optimal" and fr(rel["x"]) == ["15/2", "9/2"] and rel["z"]["frac"] == "21/4"
    bb = o["integer"]["branch_and_bound"]
    assert bb["proven_optimal"] and fr(bb["incumbent"]["x"]) == ["7", "5"] and bb["incumbent"]["z"]["frac"] == "53/10"
    simple = o["integer"]["rounding"]["simple"]
    assert fr(simple["x"]) == ["8", "5"] and simple["feasible"] is False and simple["violations"]
    assert fr(o["integer"]["rounding"]["neighbor"]["x"]) == ["7", "5"]
    # minimização: o ótimo inteiro nunca é melhor (menor) que o contínuo
    assert F(bb["incumbent"]["z"]["frac"]) >= F(rel["z"]["frac"])
    assert o["dual"]["strong_duality"]["holds"] is True


def test_radioterapico_editavel_muda_o_resultado():
    p = dict(BY_ID["radioterapico"]["problem"])
    p = {**p, "constraints": [dict(c) for c in p["constraints"]]}
    p["constraints"][1]["rhs"] = 7  # outro nível de dose no tumor
    out = solve_problem(ProblemIn(**p).to_lp(), "bigm", "all", 2000)
    assert out["relaxation"]["z"]["frac"] != "21/4"


def test_demais_exemplos():
    pi = run("producao-inteira")
    assert fr(pi["relaxation"]["x"]) == ["3", "3/2"] and pi["relaxation"]["z"]["frac"] == "21"
    assert pi["integer"]["branch_and_bound"]["incumbent"]["z"]["frac"] == "20"
    assert pi["integer"]["rounding"]["neighbor"]["z"]["frac"] == "19"        # piso/teto é pior que o ótimo inteiro
    m = run("multipla")
    assert m["multiple"]["exists"] and m["multiple"]["alternatives"] and all(a["same_objective"] for a in m["multiple"]["alternatives"])
    assert m["graph"]["optimal_segment"]
    x3 = run("mix3")
    assert fr(x3["relaxation"]["x"]) == ["0", "100", "230"] and x3["relaxation"]["z"]["frac"] == "1350" and x3["graph"] is None
    b = run("binario")
    assert b["integer"]["branch_and_bound"]["incumbent"]["z"]["frac"] == "23"
    assert run("inviavel")["relaxation"]["status"] == "infeasible"
    assert run("ilimitado")["relaxation"]["status"] == "unbounded"


@pytest.mark.parametrize("eid", [e["id"] for e in EXAMPLES])
@pytest.mark.parametrize("method", ["bigm", "twophase"])
def test_todos_resolvem_nos_dois_metodos(eid, method):
    a, b = run(eid, "bigm"), run(eid, method)
    assert a["relaxation"]["status"] == b["relaxation"]["status"]
    if a["relaxation"]["z"]:
        assert a["relaxation"]["z"]["frac"] == b["relaxation"]["z"]["frac"]


def test_dual_mostra_todas_as_iteracoes():
    d = run("radioterapico")["dual"]["result"]
    its = d["iterations"]
    assert d["status"] == "optimal" and len(its) == d["pivots"] + 1
    assert all(i["pivot"] is not None for i in its[:-1]) and its[-1]["pivot"] is None      # último passo = condição de parada
    assert all(i["operations_dec"] for i in its[:-1])


def test_arvore_branch_and_bound_consistente():
    for eid in ("radioterapico", "producao-inteira", "binario"):
        bb = run(eid)["integer"]["branch_and_bound"]
        nodes = {n["id"]: n for n in bb["nodes"]}
        assert nodes[1]["parent"] is None and all(n["parent"] in nodes for n in bb["nodes"] if n["parent"])
        inc = bb["incumbent"]
        assert nodes[inc["node"]]["decision"] == "integer" and nodes[inc["node"]]["z"]["frac"] == inc["z"]["frac"]
        sense_max = run(eid)["sense"] == "max"
        best = F(inc["z"]["frac"])
        for n in bb["nodes"]:
            assert n["note"]
            if n["decision"] == "pruned_bound":       # podado: relaxação não melhora o incumbente final
                z = F(n["z"]["frac"])
                assert (z <= best) if sense_max else (z >= best)
            if n["decision"] == "branched":
                kids = [k for k in bb["nodes"] if k["parent"] == n["id"]]
                assert len(kids) == 2 and n["branch_var"]
            if n["decision"] == "integer":
                assert all(F(v["frac"]).denominator == 1 for v in n["x"])
        assert bb["proven_optimal"]
