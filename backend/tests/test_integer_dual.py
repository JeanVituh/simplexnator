import random
from fractions import Fraction as F
import pytest
from app.engine.dual import build_dual
from app.engine.integer import branch_and_bound, round_solution
from app.engine.sensitivity import sensitivity
from app.engine.simplex import solve_lp
from app.engine.solver import solve_problem
from .helpers import lp
from .test_simplex import RADIO, RADIO_GEQ, random_model


@pytest.mark.parametrize("cons", [RADIO, RADIO_GEQ])
def test_radio_integer_and_rounding(cons):
    m = lp("min", [0.4, 0.5], list(cons))
    r = solve_lp(m)
    rd = round_solution(m, r.x, {0, 1})
    assert [p["frac"] for p in rd["simple"]["x"]] == ["8", "5"] and rd["simple"]["feasible"] is False
    assert [p["frac"] for p in rd["neighbor"]["x"]] == ["7", "5"]
    bb = branch_and_bound(m, {0, 1})
    assert bb["proven_optimal"] and [p["frac"] for p in bb["incumbent"]["x"]] == ["7", "5"] and bb["incumbent"]["z"]["frac"] == "53/10"


def test_branch_and_bound_beats_rounding():
    m = lp("max", [5, 4], [([6, 4], "<=", 24), ([1, 2], "<=", 6)])
    r = solve_lp(m)
    bb = branch_and_bound(m, {0, 1})
    assert bb["incumbent"]["z"]["frac"] == "20" and [p["frac"] for p in bb["incumbent"]["x"]] == ["4", "0"]
    assert round_solution(m, r.x, {0, 1})["neighbor"]["z"]["frac"] == "19"   # piso/teto é pior que o ótimo inteiro
    assert any(n["decision"] == "pruned_bound" for n in bb["nodes"]) or any(n["decision"] == "infeasible" for n in bb["nodes"])


def test_binary_knapsack():
    from app.engine.model import Var
    m = lp("max", [10, 13, 7, 8], [([3, 4, 2, 3], "<=", 7)])
    m.vars = [Var(f"x{i+1}", "binary", F(0), F(1)) for i in range(4)]
    out = solve_problem(m, "bigm", "marked")
    inc = out["integer"]["branch_and_bound"]["incumbent"]
    assert inc["z"]["frac"] == "23" and [p["frac"] for p in inc["x"]] == ["1", "1", "0", "0"]


@pytest.mark.parametrize("seed", range(40))
def test_bb_against_milp(seed):
    so = pytest.importorskip("scipy.optimize")
    np = pytest.importorskip("numpy")
    milp, LinearConstraint, Bounds = so.milp, so.LinearConstraint, so.Bounds
    rng = random.Random(1000 + seed)
    n, m = rng.randint(2, 4), rng.randint(2, 3)
    sense, c, cons = random_model(rng, n, m)
    model = lp(sense, c, cons)
    rel = solve_lp(model)
    if rel.status != "optimal":
        pytest.skip("sem relaxação ótima")
    bb = branch_and_bound(model, set(range(n)), 5000)
    A = np.array([a for a, _, _ in cons], float)
    lo = np.array([b if r in (">=", "=") else -np.inf for _, r, b in cons], float)
    hi = np.array([b if r in ("<=", "=") else np.inf for _, r, b in cons], float)
    sc = -1 if sense == "max" else 1
    ref = milp(sc * np.array(c, float), constraints=LinearConstraint(A, lo, hi), integrality=np.ones(n), bounds=Bounds(0, np.inf))
    assert ref.status == 0 and bb["incumbent"] is not None
    assert abs(bb["incumbent"]["z"]["value"] - sc * ref.fun) < 1e-6


@pytest.mark.parametrize("seed", range(40))
def test_strong_duality_random(seed):
    rng = random.Random(500 + seed)
    n, m = rng.randint(2, 4), rng.randint(2, 4)
    sense, c, cons = random_model(rng, n, m)
    model = lp(sense, c, cons)
    p = solve_lp(model)
    dual, _ = build_dual(p.std)
    d = solve_lp(dual)
    assert p.status == "optimal" and d.status == "optimal"
    assert p.z - p.std.c0 == d.z


def test_dual_shadow_prices_and_ranges():
    m = lp("max", [5, 4], [([6, 4], "<=", 24), ([1, 2], "<=", 6)])
    s = sensitivity(solve_lp(m))
    assert [r["shadow_price"]["frac"] for r in s["rhs"]] == ["3/4", "1/2"]
    assert s["rhs"][0]["lower"]["frac"] == "12" and s["rhs"][0]["upper"]["frac"] == "36"
    # confirma o preço-sombra por perturbação dentro da faixa
    z0 = solve_lp(m).z
    z1 = solve_lp(lp("max", [5, 4], [([6, 4], "<=", 25), ([1, 2], "<=", 6)])).z
    assert z1 - z0 == F(3, 4)
    assert s["objective"][0]["lower"]["frac"] == "2" and s["objective"][0]["upper"]["frac"] == "6"
    # dentro da faixa a base ótima não muda; fora dela, muda
    cons = [([6, 4], "<=", 24), ([1, 2], "<=", 6)]
    assert solve_lp(lp("max", [F(3), 4], cons)).x == [3, F(3, 2)] and solve_lp(lp("max", [F(11, 2), 4], cons)).x == [3, F(3, 2)]
    assert solve_lp(lp("max", [F(19, 10), 4], cons)).x != [3, F(3, 2)] and solve_lp(lp("max", [F(61, 10), 4], cons)).x != [3, F(3, 2)]


def test_unbounded_primal_dual_infeasible():
    m = lp("max", [1, 1], [([1, -1], "<=", 1)])
    dual, _ = build_dual(solve_lp(m).std)
    assert solve_lp(dual).status == "infeasible"
