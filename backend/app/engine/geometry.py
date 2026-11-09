"""Dados geométricos para o gráfico 2D (exatos para viabilidade, floats só para desenho)."""
from __future__ import annotations
import math
from fractions import Fraction as F
from .model import LP, SYMBOL
from .numbers import dec_str, num


def _ok(L, p):
    for l in L:
        s = l["a"][0] * p[0] + l["a"][1] * p[1]
        if l["rel"] == "<=" and s > l["b"]: return False
        if l["rel"] == ">=" and s < l["b"]: return False
        if l["rel"] == "=" and s != l["b"]: return False
    return True


def _inter(l1, l2):
    d = l1["a"][0] * l2["a"][1] - l1["a"][1] * l2["a"][0]
    if d == 0:
        return None
    return ((l1["b"] * l2["a"][1] - l1["a"][1] * l2["b"]) / d, (l1["a"][0] * l2["b"] - l1["b"] * l2["a"][0]) / d)


def _vertices(L):
    out = []
    for i in range(len(L)):
        for j in range(i + 1, len(L)):
            p = _inter(L[i], L[j])
            if p is not None and _ok(L, p) and p not in out:
                out.append(p)
    return out


def _clip(a1, a2, b, box):
    xmin, xmax, ymin, ymax = box
    pts = []
    if a2 != 0:
        for x in (xmin, xmax):
            y = (b - a1 * x) / a2
            if ymin - 1e-9 <= y <= ymax + 1e-9: pts.append((x, y))
    if a1 != 0:
        for y in (ymin, ymax):
            x = (b - a2 * y) / a1
            if xmin - 1e-9 <= x <= xmax + 1e-9: pts.append((x, y))
    if len(pts) < 2:
        return None
    pts.sort()
    return [list(pts[0]), list(pts[-1])]


def build_graph(lp: LP, relax, rounding, bb, multiple) -> dict | None:
    if len(lp.vars) != 2:
        return None
    L = []
    for c in lp.cons:
        L.append({"a": (c.coeffs[0], c.coeffs[1]), "b": c.rhs, "rel": c.rel, "label": c.name, "kind": "constraint"})
    for j, v in enumerate(lp.vars):
        e = (F(1), F(0)) if j == 0 else (F(0), F(1))
        if v.lower is not None: L.append({"a": e, "b": v.lower, "rel": ">=", "label": f"{v.name} ≥ {dec_str(v.lower)}", "kind": "bound"})
        if v.upper is not None: L.append({"a": e, "b": v.upper, "rel": "<=", "label": f"{v.name} ≤ {dec_str(v.upper)}", "kind": "bound"})
    V = _vertices(L)
    marks = list(V)
    if relax.status == "optimal": marks.append((relax.x[0], relax.x[1]))
    for a in (multiple or {}).get("alternatives", []): marks.append((F(str(a["x"][0]["frac"])), F(str(a["x"][1]["frac"]))))
    xs = [float(p[0]) for p in marks] or [0.0, 10.0]
    ys = [float(p[1]) for p in marks] or [0.0, 10.0]
    px, py = max((max(xs) - min(xs)) * 0.3, 1.0), max((max(ys) - min(ys)) * 0.3, 1.0)
    box = (min(0.0, min(xs) - (px if min(xs) < 0 else 0)), max(xs) + px, min(0.0, min(ys) - (py if min(ys) < 0 else 0)), max(ys) + py)
    boxL = [{"a": (F(1), F(0)), "b": F(box[0]).limit_denominator(10**6), "rel": ">=", "label": "", "kind": "box"},
            {"a": (F(1), F(0)), "b": F(box[1]).limit_denominator(10**6), "rel": "<=", "label": "", "kind": "box"},
            {"a": (F(0), F(1)), "b": F(box[2]).limit_denominator(10**6), "rel": ">=", "label": "", "kind": "box"},
            {"a": (F(0), F(1)), "b": F(box[3]).limit_denominator(10**6), "rel": "<=", "label": "", "kind": "box"}]
    poly = _vertices(L + boxL)
    if poly:
        cx, cy = sum(float(p[0]) for p in poly) / len(poly), sum(float(p[1]) for p in poly) / len(poly)
        poly.sort(key=lambda p: math.atan2(float(p[1]) - cy, float(p[0]) - cx))
    c1, c2 = float(lp.c[0]), float(lp.c[1])
    zf = lambda p: lp.c[0] * p[0] + lp.c[1] * p[1]
    cons = []
    for l in L:
        seg = _clip(float(l["a"][0]), float(l["a"][1]), float(l["b"]), box)
        if seg: cons.append({"label": l["label"], "kind": l["kind"], "relation": l["rel"], "segment": seg})
    levels = []
    if (c1 or c2) and V:
        zs = [float(zf(p)) for p in V]
        lo, hi = min(zs), max(zs)
        span = (hi - lo) or abs(lo) or 1.0
        vals = [lo - 0.25 * span + k * 1.5 * span / 4 for k in range(5)]
        if relax.status == "optimal": vals.append(float(relax.z))
        for z in vals:
            seg = _clip(c1, c2, z, box)
            if seg: levels.append({"z": z, "segment": seg, "optimal": relax.status == "optimal" and abs(z - float(relax.z)) < 1e-12})
    pts = []
    xi0, xi1, yi0, yi1 = math.ceil(box[0]), math.floor(box[1]), math.ceil(box[2]), math.floor(box[3])
    if (xi1 - xi0 + 1) * (yi1 - yi0 + 1) <= 8000:
        for xv in range(xi0, xi1 + 1):
            for yv in range(yi0, yi1 + 1):
                if _ok(L, (F(xv), F(yv))): pts.append([xv, yv])
    opt = None
    if relax.status == "optimal":
        opt = {"x": float(relax.x[0]), "y": float(relax.x[1]), "z": float(relax.z)}
    seg = None
    if multiple and multiple.get("exists") and relax.status == "optimal":
        P = sorted({(float(p[0]["value"]), float(p[1]["value"])) for p in multiple["points"]})
        if len(P) >= 2: seg = [list(P[0]), list(P[-1])]
    ints = None
    if bb and bb.get("incumbent"):
        i = bb["incumbent"]; ints = {"x": i["x"][0]["value"], "y": i["x"][1]["value"], "z": i["z"]["value"]}
    rnd = None
    if rounding:
        for k in ("simple", "neighbor"):
            r = rounding.get(k)
            if r: rnd = (rnd or {}) | {k: {"x": r["x"][0]["value"], "y": r["x"][1]["value"], "z": r["z"]["value"], "feasible": r["feasible"]}}
    return {
        "box": list(box), "polygon": [[float(p[0]), float(p[1])] for p in poly] if relax.status != "infeasible" else [],
        "constraints": cons, "vertices": [{"x": float(p[0]), "y": float(p[1]), "z": float(zf(p)),
                                           "optimal": relax.status == "optimal" and zf(p) == relax.z} for p in V],
        "level_curves": levels, "integer_points": pts, "optimum": opt, "integer_optimum": ints, "rounding": rnd,
        "optimal_segment": seg, "objective": [c1, c2], "var_names": [v.name for v in lp.vars],
    }
