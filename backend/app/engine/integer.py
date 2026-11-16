"""Soluções inteiras: arredondamento (simples e piso/teto) e Branch and Bound exato."""
from __future__ import annotations
import math
from fractions import Fraction as F
from .model import LP
from collections import Counter

from .numbers import frac_str, num, dec_str
from .simplex import Presenter, solve_lp


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


def _fr(v):
    return None if v is None else frac_str(v)


def branch_and_bound(lp: LP, int_idx, node_limit: int = 2000, method: str = "bigm", tableau_limit: int = 150) -> dict:
    """Branch and Bound exato (busca em profundidade; ramifica na variável inteira mais fracionária).

    Cada nó resolve a relaxação pelo Simplex tabular com limites de variável adicionais (restrições de ramificação).
    Para não gerar respostas enormes, o tableau final só é anexado aos primeiros `tableau_limit` nós e ao nó incumbente;
    as iterações completas de qualquer nó podem ser obtidas depois (ver solver.solve_node). As iterações do nó
    incumbente vêm sempre em `incumbent_iterations`.
    """
    better = (lambda a, b: a > b) if lp.sense == "max" else (lambda a, b: a < b)
    lo0, up0 = [v.lower for v in lp.vars], [v.upper for v in lp.vars]
    stack = [(None, "raiz", lo0, up0, 0, [], None)]
    nodes, inc, hit = [], None, False
    bounds_of = {}

    def new_node(parent, label, lo, up, depth, cons, bound):
        nid = len(nodes) + 1
        node = {"id": nid, "parent": parent, "depth": depth, "branch": label, "constraints": cons, "bound": bound,
                "bounds": {"lower": [_fr(v) for v in lo], "upper": [_fr(v) for v in up]},
                "status": None, "z": None, "x": None, "decision": None, "branch_var": None, "branch_value": None,
                "floor": None, "ceil": None, "pivots": 0, "iterations": 0, "tableau": None, "note": ""}
        nodes.append(node)
        bounds_of[nid] = (lo, up)
        return node

    while stack:
        if len(nodes) >= node_limit:
            hit = True
            break
        parent, label, lo, up, depth, cons, bound = stack.pop()
        node = new_node(parent, label, lo, up, depth, cons, bound)
        nid = node["id"]
        res = solve_lp(lp.with_bounds(lo, up), method, record=False)
        node["status"] = res.status
        node["pivots"] = node["iterations"] = res.pivots
        if nid <= tableau_limit:
            node["tableau"] = Presenter(res.std).snap(res.tableau, 0, f"Nó {nid}: tableau final", note=res.message)
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
            if node["tableau"] is None:
                node["tableau"] = Presenter(res.std).snap(res.tableau, 0, f"Nó {nid}: tableau final")
            continue
        j = min(frac, key=lambda k: abs(res.x[k] - math.floor(res.x[k]) - F(1, 2)))
        fl = math.floor(res.x[j])
        name = lp.vars[j].name
        node["decision"], node["branch_var"] = "branched", name
        node["branch_value"], node["floor"], node["ceil"] = num(res.x[j]), fl, fl + 1
        node["note"] = f"{name} = {dec_str(res.x[j])} é fracionário: ramifica em {name} ≤ {fl} e {name} ≥ {fl + 1}."
        up_c, lo_c = up[:], lo[:]
        up_c[j] = F(fl) if up[j] is None else min(up[j], F(fl))
        lo_c[j] = F(fl + 1) if lo[j] is None else max(lo[j], F(fl + 1))
        stack.append((nid, f"{name} ≥ {fl + 1}", lo_c, up[:], depth + 1, cons + [f"{name} ≥ {fl + 1}"], {"var": name, "op": ">=", "value": fl + 1}))
        stack.append((nid, f"{name} ≤ {fl}", lo[:], up_c, depth + 1, cons + [f"{name} ≤ {fl}"], {"var": name, "op": "<=", "value": fl}))

    explored = len(nodes)
    if hit:  # nós gerados mas não resolvidos: limite de nós atingido
        for parent, label, lo, up, depth, cons, bound in reversed(stack):
            n = new_node(parent, label, lo, up, depth, cons, bound)
            n["decision"] = "node_limit"
            n["note"] = "Nó não explorado: limite de nós atingido."

    inc_iter, inc_node = [], None
    if inc is not None:
        inc_node = inc["node"]
        lo, up = bounds_of[inc_node]
        again = solve_lp(lp.with_bounds(lo, up), method, record=True)
        inc_iter = again.iterations
        n = nodes[inc_node - 1]
        if n["tableau"] is None:
            n["tableau"] = inc_iter[-1] if inc_iter else None

    status = "optimal" if inc and not hit else "node_limit" if hit else "infeasible"
    proven = bool(inc) and not hit
    dec = Counter(n["decision"] for n in nodes)
    root = nodes[0]
    root_integral = root["decision"] == "integer"
    final = "root_integral" if proven and root_integral and explored == 1 else "proven" if proven else "node_limit" if hit else "no_integer"
    stats = {
        "explored": explored, "branched": dec["branched"], "infeasible": dec["infeasible"], "unbounded": dec["unbounded"],
        "pruned_bound": dec["pruned_bound"], "integer_nodes": dec["integer"], "pending": dec["node_limit"],
        "max_depth": max((n["depth"] for n in nodes if n["status"] is not None), default=0),
        "total_pivots": sum(n["pivots"] for n in nodes),
        "root_z": root["z"], "incumbent_z": None if inc is None else num(inc["z"]),
        "gap": None if inc is None or root["z"] is None else num(abs(inc["z"] - F(root["z"]["frac"]))),
        "root_integral": root_integral, "final_status": final, "proven_optimal": proven,
        "branching_rule": "variável inteira mais fracionária (mais próxima de 1/2)",
        "search_order": "busca em profundidade; o ramo ≤ é explorado antes do ramo ≥",
    }
    return {
        "status": status, "nodes": nodes, "explored": explored, "node_limit": node_limit, "node_limit_hit": hit,
        "incumbent": None if inc is None else {"x": [num(v) for v in inc["x"]], "z": num(inc["z"]), "node": inc["node"]},
        "proven_optimal": proven, "stats": stats, "incumbent_node": inc_node, "incumbent_iterations": inc_iter,
        "tableau_limit": tableau_limit,
    }
