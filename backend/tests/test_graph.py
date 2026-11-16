"""Dados do gráfico 2D: região viável, vértices, curvas de nível, pontos inteiros, ótimos e segmento de múltiplas soluções."""
import math
from fractions import Fraction as F

from app.engine.examples import EXAMPLES
from app.engine.solver import solve_problem
from app.schemas import ProblemIn

EX = {e["id"]: e for e in EXAMPLES}


def graph(eid_or_problem, integer="all"):
    p = EX[eid_or_problem]["problem"] if isinstance(eid_or_problem, str) else eid_or_problem
    return solve_problem(ProblemIn(**p).to_lp(), "bigm", integer, 2000, 150)["graph"]


def pts(v):
    return {(round(q["x"], 6), round(q["y"], 6)) for q in v}


def area(poly):
    return abs(sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))) / 2


def test_radioterapico_vertices_otimo_e_pontos_inteiros():
    g = graph("radioterapico")
    assert pts(g["vertices"]) == {(7.5, 4.5), (6.0, 6.0)}            # região viável degenerada (restrição de igualdade): um segmento
    assert area(g["polygon"]) < 1e-9
    z = {(round(v["x"], 6), round(v["y"], 6)): v["z"] for v in g["vertices"]}
    assert math.isclose(z[(7.5, 4.5)], 5.25) and math.isclose(z[(6.0, 6.0)], 5.4)
    assert [v for v in g["vertices"] if v["optimal"]] == [{"x": 7.5, "y": 4.5, "z": 5.25, "optimal": True}]
    assert g["optimum"] == {"x": 7.5, "y": 4.5, "z": 5.25}
    assert g["integer_optimum"] == {"x": 7.0, "y": 5.0, "z": 5.3}
    assert [7, 5] in g["integer_points"] and [6, 6] in g["integer_points"] and [8, 5] not in g["integer_points"]   # (8;5) é inviável
    assert g["rounding"]["simple"] == {"x": 8.0, "y": 5.0, "z": 5.7, "feasible": False}
    assert g["rounding"]["neighbor"]["feasible"] is True and (g["rounding"]["neighbor"]["x"], g["rounding"]["neighbor"]["y"]) == (7.0, 5.0)
    assert g["optimal_segment"] is None and g["var_names"] == ["x1", "x2"]


def test_curvas_de_nivel_incluem_a_que_passa_pelo_otimo():
    g = graph("radioterapico")
    opt = [c for c in g["level_curves"] if c["optimal"]]
    assert len(opt) == 1 and math.isclose(opt[0]["z"], 5.25) and len(g["level_curves"]) >= 5
    (x1, y1), (x2, y2) = opt[0]["segment"]
    assert math.isclose(0.4 * x1 + 0.5 * y1, 5.25, abs_tol=1e-9) and math.isclose(0.4 * x2 + 0.5 * y2, 5.25, abs_tol=1e-9)   # o segmento está sobre 0,4x₁ + 0,5x₂ = Z*
    assert (x1, y1) != (x2, y2)                                        # a reta realmente tem extensão no gráfico


def test_regiao_com_area_e_restricoes_desenhadas():
    g = graph("producao-inteira")                                     # max 5x1+4x2; 6x1+4x2≤24; x1+2x2≤6
    assert pts(g["vertices"]) == {(0.0, 0.0), (4.0, 0.0), (3.0, 1.5), (0.0, 3.0)}
    assert math.isclose(area(g["polygon"]), 7.5)                       # quadrilátero (0,0),(4,0),(3;1,5),(0,3): fórmula do cadarço
    labels = {c["label"] for c in g["constraints"]}
    assert {"Matéria-prima", "Horas de máquina"} <= labels and any(c["kind"] == "bound" for c in g["constraints"])
    assert g["optimum"]["z"] == 21 and g["integer_optimum"] == {"x": 4.0, "y": 0.0, "z": 20.0}
    assert all(0 <= x <= 4 + 1e-9 for x, _ in g["integer_points"]) and [4, 0] in g["integer_points"] and [3, 2] not in g["integer_points"]


def test_solucoes_multiplas_segmento_entre_vertices_otimos():
    g = graph("multipla")
    assert g["optimal_segment"] == [[2.0, 3.0], [6.0, 1.0]]
    assert {(v["x"], v["y"]) for v in g["vertices"] if v["optimal"]} == {(2.0, 3.0), (6.0, 1.0)}
    for (x, y) in g["optimal_segment"]:
        assert math.isclose(2 * x + 4 * y, 16)                         # mesmo Z nos dois extremos


def test_regiao_vazia_ilimitada_e_tres_variaveis():
    assert graph("inviavel")["polygon"] == [] and graph("inviavel")["vertices"] == [] and graph("inviavel")["optimum"] is None
    g = graph("ilimitado")
    assert g["optimum"] is None and g["polygon"] and area(g["polygon"]) > 0   # região aberta recortada pela caixa do gráfico
    assert graph("mix3") is None                                      # o gráfico 2D só existe para 2 variáveis


def test_caixa_do_grafico_contem_os_pontos_importantes():
    for eid in ("radioterapico", "producao-inteira", "multipla"):
        g = graph(eid)
        x0, x1, y0, y1 = g["box"]
        for v in g["vertices"]:
            assert x0 <= v["x"] <= x1 and y0 <= v["y"] <= y1
        assert x0 <= g["optimum"]["x"] <= x1 and y0 <= g["optimum"]["y"] <= y1
