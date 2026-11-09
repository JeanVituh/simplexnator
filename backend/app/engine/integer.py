"""Soluções inteiras: arredondamento (simples e piso/teto) e Branch and Bound exato."""
from __future__ import annotations
import math
from fractions import Fraction as F
from .model import LP
from .numbers import num, dec_str
from .simplex import solve_lp


def _pack(lp: LP, x) -> dict:
    viol = lp.check(x)
    return {"x": [num(v) for v in x], "z": num(lp.objective(x)), "feasible": not viol, "violations": viol}


def round_solution(lp: LP, x, int_idx) -> dict:
    """Arredondamento simples (meio para cima) e melhor combinação piso/teto viável."""
    simple = [F(math.floor(v + F(1, 2))) if j in int_idx else v for j, v in enumerate(x)]
    frac = [j for j in int_idx if x[j].denominator != 1]
    better = (lambda a, b: a > b) if lp.sense == "max" else (lambda a, b: a < b)
    best, checked, skipped = None, 0, False
    if len(frac) > 16:
        skipped = True
    else:
        for mask in range(1 << len(frac)):
            cand = list(x)
            for k, j in enumerate(frac):
                cand[j] = F(math.ceil(x[j])) if mask >> k & 1 else F(math.floor(x[j]))
            checked += 1
            if not lp.check(cand):
                z = lp.objective(cand)
                if best is None or better(z, best[1]):
                    best = (cand, z)
    out = {"simple": _pack(lp, simple), "neighbor": None, "combinations_checked": checked, "skipped": skipped,
           "fractional_variables": [lp.vars[j].name for j in frac]}
    if best:
        out["neighbor"] = _pack(lp, best[0])
    return out


def branch_and_bound(lp: LP, int_idx, node_limit: int = 2000, method: str = "bigm") -> dict:
    better = (lambda a, b: a > b) if lp.sense == "max" else (lambda a, b: a < b)
    lo0, up0 = [v.lower for v in lp.vars], [v.upper for v in lp.vars]
    stack = [(None, "raiz", lo0, up0, 0)]
    nodes, inc, hit = [], None, False
    while stack:
        if len(nodes) >= node_limit:
            hit = True
            break
        parent, label, lo, up, depth = stack.pop()
        nid = len(nodes) + 1
        node = {"id": nid, "parent": parent, "depth": depth, "branch": label, "status": None, "z": None, "x": None,
                "decision": None, "branch_var": None, "note": ""}
        nodes.append(node)
        res = solve_lp(lp.with_bounds(lo, up), method, record=False)
        node["status"] = res.status
        node["iterations"] = res.pivots
        if res.status != "optimal":
            node["decision"] = "infeasible" if res.status == "infeasible" else "unbounded"
            node["note"] = "Relaxação inviável: nó encerrado." if res.status == "infeasible" else "Relaxação ilimitada."
            continue
        z = res.z
        node["z"], node["x"] = num(z), [num(v) for v in res.x]
        if inc is not None and not better(z, inc["z"]):
            node["decision"] = "pruned_bound"
            node["note"] = f"Z = {dec_str(z)} não supera o incumbente {dec_str(inc['z'])}: podado por limite."
            continue
        frac = [j for j in int_idx if res.x[j].denominator != 1]
        if not frac:
            inc = {"x": res.x, "z": z, "node": nid}
            node["decision"] = "integer"
            node["note"] = f"Solução inteira com Z = {dec_str(z)}: novo incumbente."
            continue
        j = min(frac, key=lambda k: abs(res.x[k] - math.floor(res.x[k]) - F(1, 2)))
        fl = math.floor(res.x[j])
        name = lp.vars[j].name
        node["decision"], node["branch_var"] = "branched", name
        node["note"] = f"{name} = {dec_str(res.x[j])} é fracionário: ramifica em {name} ≤ {fl} e {name} ≥ {fl + 1}."
        up_c, lo_c = up[:], lo[:]
        up_c[j] = F(fl) if up[j] is None else min(up[j], F(fl))
        lo_c[j] = F(fl + 1) if lo[j] is None else max(lo[j], F(fl + 1))
        stack.append((nid, f"{name} ≥ {fl + 1}", lo_c, up[:], depth + 1))
        stack.append((nid, f"{name} ≤ {fl}", lo[:], up_c, depth + 1))
    status = "optimal" if inc and not hit else "node_limit" if hit else "infeasible"
    return {
        "status": status, "nodes": nodes, "explored": len(nodes), "node_limit": node_limit, "node_limit_hit": hit,
        "incumbent": None if inc is None else {"x": [num(v) for v in inc["x"]], "z": num(inc["z"]), "node": inc["node"]},
        "proven_optimal": bool(inc) and not hit,
    }
