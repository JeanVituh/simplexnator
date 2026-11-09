import random
from fractions import Fraction as F
import numpy as np
import pytest
from app.engine.model import Var
from app.engine.simplex import solve_lp
from app.engine.multiple import find_alternatives
from .helpers import lp

RADIO = ([0.3, 0.1], "<=", 2.7), ([0.5, 0.5], "=", 6), ([0.6, 0.4], ">=", 6)
RADIO_GEQ = ([0.3, 0.1], "<=", 2.7), ([0.5, 0.5], ">=", 6), ([0.6, 0.4], ">=", 6)


@pytest.mark.parametrize("method", ["bigm", "twophase"])
@pytest.mark.parametrize("cons", [RADIO, RADIO_GEQ])
def test_radioterapico(method, cons):
    r = solve_lp(lp("min", [0.4, 0.5], list(cons)), method)
    assert r.status == "optimal"
    assert r.x == [F(15, 2), F(9, 2)] and r.z == F(21, 4)


@pytest.mark.parametrize("method", ["bigm", "twophase"])
def test_max_le_standard(method):  # Taha: 3 variáveis
    r = solve_lp(lp("max", [3, 2, 5], [([1, 2, 1], "<=", 430), ([3, 0, 2], "<=", 460), ([1, 4, 0], "<=", 420)]), method)
    assert r.method_used == "standard" and r.z == 1350 and r.x == [0, 100, 230]


def test_mixed_relations_and_negative_rhs():
    # max x1+x2 s.t. -x1 - x2 >= -10 (<=> x1+x2<=10), x1 - x2 = 2, x1 >= 3
    r = solve_lp(lp("max", [1, 1], [([-1, -1], ">=", -10), ([1, -1], "=", 2), ([1, 0], ">=", 3)]))
    assert r.status == "optimal" and r.x == [6, 4] and r.z == 10


@pytest.mark.parametrize("method", ["bigm", "twophase"])
def test_infeasible_and_unbounded(method):
    assert solve_lp(lp("max", [1, 1], [([1, 1], "<=", 2), ([1, 1], ">=", 5)]), method).status == "infeasible"
    assert solve_lp(lp("max", [1, 1], [([1, -1], "<=", 1)]), method).status == "unbounded"
    assert solve_lp(lp("min", [1, 1], [([1, 1], ">=", 1), ([1, 1], "=", 0)]), method).status == "infeasible"


def test_degenerate():
    r = solve_lp(lp("max", [3, 9], [([1, 4], "<=", 8), ([1, 2], "<=", 4)]))
    assert r.status == "optimal" and r.z == 18 and r.degenerate


def test_beale_cycling_example_terminates():
    r = solve_lp(lp("min", [0, 0, 0, F(-3, 4), 20, F(-1, 2), 6][3:], [
        ([F(1, 4), -8, -1, 9], "<=", 0), ([F(1, 2), -12, F(-1, 2), 3], "<=", 0), ([0, 0, 1, 0], "<=", 1)]))
    assert r.status == "optimal" and r.z == F(-5, 4)


def test_bounds_free_and_shifted_variables():
    v = [Var("x1", "continuous", F(2), F(7)), Var("x2", "continuous", None, None)]
    r = solve_lp(lp("max", [1, -1], [([0, 1], ">=", -3)], vars_=v))
    assert r.x == [7, -3] and r.z == 10
    v = [Var("x1", "continuous", None, F(4))]
    r = solve_lp(lp("max", [1], [([1], ">=", -9)], vars_=v))
    assert r.x == [4] and r.z == 4


def test_multiple_solutions_are_generated():
    m = lp("max", [2, 4], [([1, 2], "<=", 8), ([1, 0], "<=", 6), ([0, 1], "<=", 3)])
    r = solve_lp(m)
    alt = find_alternatives(m, r)
    assert alt["exists"] and alt["alternatives"]
    vals = {tuple(p["frac"] for p in a["x"]) for a in alt["alternatives"]} | {("2", "3")}
    assert ("6", "1") in vals and all(a["same_objective"] for a in alt["alternatives"])


def test_no_multiple_when_unique():
    m = lp("max", [3, 2], [([1, 1], "<=", 4), ([1, 3], "<=", 6), ([1, 0], "<=", 3)])
    assert not find_alternatives(m, solve_lp(m))["exists"]


def random_model(rng, n, m):
    x0 = [rng.randint(0, 5) for _ in range(n)]
    cons = []
    for _ in range(m):
        a = [rng.randint(-3, 5) for _ in range(n)]
        base = sum(ai * xi for ai, xi in zip(a, x0))
        rel = rng.choice(["<=", ">=", "="])
        b = base + (rng.randint(0, 4) if rel == "<=" else -rng.randint(0, 4) if rel == ">=" else 0)
        cons.append((a, rel, b))
    cons.append(([1] * n, "<=", 60))
    return rng.choice(["max", "min"]), [rng.randint(-5, 8) for _ in range(n)], cons


@pytest.mark.parametrize("seed", range(60))
@pytest.mark.parametrize("method", ["bigm", "twophase"])
def test_random_against_scipy(seed, method):
    linprog = pytest.importorskip("scipy.optimize").linprog
    rng = random.Random(seed)
    n, m = rng.randint(2, 5), rng.randint(2, 5)
    sense, c, cons = random_model(rng, n, m)
    mine = solve_lp(lp(sense, c, cons), method)
    A_ub, b_ub, A_eq, b_eq = [], [], [], []
    for a, rel, b in cons:
        if rel == "<=": A_ub.append(a); b_ub.append(b)
        elif rel == ">=": A_ub.append([-v for v in a]); b_ub.append(-b)
        else: A_eq.append(a); b_eq.append(b)
    sc = -1 if sense == "max" else 1
    ref = linprog([sc * v for v in c], A_ub=A_ub or None, b_ub=b_ub or None, A_eq=A_eq or None, b_eq=b_eq or None,
                  bounds=[(0, None)] * n, method="highs")
    assert ref.status == 0 and mine.status == "optimal"
    assert abs(float(mine.z) - sc * ref.fun) < 1e-6
    assert lp(sense, c, cons).check(mine.x) == []


@pytest.mark.parametrize("cons", [RADIO, RADIO_GEQ])
def test_radioterapico_confere_com_scipy(cons):
    """Validação independente (HiGHS) de duas formulações do modelo radioterápico."""
    linprog = pytest.importorskip("scipy.optimize").linprog
    A_ub, b_ub, A_eq, b_eq = [], [], [], []
    for a, rel, b in cons:
        if rel == "<=": A_ub.append(a); b_ub.append(b)
        elif rel == ">=": A_ub.append([-v for v in a]); b_ub.append(-b)
        else: A_eq.append(a); b_eq.append(b)
    ref = linprog([0.4, 0.5], A_ub=A_ub, b_ub=b_ub, A_eq=A_eq or None, b_eq=b_eq or None, bounds=[(0, None)] * 2, method="highs")
    mine = solve_lp(lp("min", [0.4, 0.5], list(cons)))
    assert abs(ref.fun - float(mine.z)) < 1e-9 and np.allclose(ref.x, [float(v) for v in mine.x])
