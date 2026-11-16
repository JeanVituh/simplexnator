"""Orquestra o motor: relaxação, soluções múltiplas, inteira, dual, sensibilidade e dados do gráfico."""
from __future__ import annotations
from .dual import build_dual, format_lp
from .geometry import build_graph
from .integer import branch_and_bound, round_solution
from .model import LP
from .multiple import find_alternatives
from .numbers import num
from .sensitivity import sensitivity
from .simplex import solve_lp


def _res_dict(res, names):
    return {"status": res.status, "message": res.message, "variables": names,
            "x": None if res.x is None else [num(v) for v in res.x],
            "z": None if res.z is None else num(res.z), "iterations": res.iterations, "pivots": res.pivots,
            "degenerate": res.degenerate, "degenerate_pivots": res.degenerate_pivots, "bland_used": res.bland_used,
            "artificial": res.n_artificial, "method_used": res.method_used}


def standard_info(res):
    t, std = res.tableau, res.std
    notes = []
    for i, f in enumerate(t.flipped):
        if f:
            notes.append(f"{std.rows[i].name}: lado direito negativo; linha multiplicada por −1 (relação invertida).")
    if not std.identity:
        notes.append("Há variáveis com limite inferior diferente de 0, apenas com limite superior ou livres: foram transformadas (x = l + x', x = u − x' ou x = x⁺ − x⁻).")
    extra = [r.name for r in std.rows if r.origin is None]
    if extra:
        notes.append("Limites superiores convertidos em restrições: " + "; ".join(extra) + ".")
    cnt = {k: sum(1 for x in t.kinds if x == k) for k in ("slack", "surplus", "artificial")}
    notes.append(f"Variáveis adicionadas: {cnt['slack']} de folga (s), {cnt['surplus']} de excesso (e), {cnt['artificial']} artificiais (a).")
    return {"columns": t.names, "kinds": t.kinds, "notes": notes}


def solve_problem(lp: LP, method: str = "bigm", integer: str = "all", node_limit: int = 2000, tableau_limit: int = 150) -> dict:
    names = [v.name for v in lp.vars]
    relax = solve_lp(lp, method, True)
    out = {"method": method, "method_used": relax.method_used, "sense": lp.sense, "variables": names,
           "formulation": {"primal": format_lp(lp, "Z")}, "standard_form": standard_info(relax),
           "relaxation": _res_dict(relax, names), "warnings": []}
    opt = relax.status == "optimal"
    if opt:
        viol = lp.check(relax.x)
        z_tab = relax.std.s * relax.tableau.z0c + relax.std.c0
        out["relaxation"]["validation"] = {"feasible": not viol, "violations": viol, "objective_recomputed": num(lp.objective(relax.x)),
                                           "matches_tableau": z_tab == relax.z}
        if relax.degenerate:
            out["warnings"].append("Solução degenerada: há variável básica com valor 0.")
    out["multiple"] = find_alternatives(lp, relax) if opt else {"exists": False, "alternatives": [], "points": [], "unbounded_rays": [], "zero_reduced_cost": []}
    if out["multiple"]["exists"]:
        out["warnings"].append("Soluções ótimas múltiplas detectadas.")
    # --- dual (resolvido explicitamente na forma tabular) ---
    dual_lp, corr = build_dual(relax.std)
    dres = solve_lp(dual_lp, method, True)
    strong = None
    if opt and dres.status == "optimal":
        zt = relax.z - relax.std.c0
        strong = {"holds": zt == dres.z, "z": num(relax.z), "w": num(dres.z), "constant": num(relax.std.c0)}
    out["dual"] = {"model_lines": format_lp(dual_lp, "W"), "correspondence": corr,
                   "result": _res_dict(dres, [v.name for v in dual_lp.vars]), "strong_duality": strong,
                   "note": "Dual construído a partir do primal na forma padrão (variáveis ≥ 0, limites superiores como restrições)."}
    out["sensitivity"] = sensitivity(relax)
    # --- inteira ---
    rounding = bb = None
    if integer != "none" and opt:
        int_idx = {j for j, v in enumerate(lp.vars) if integer == "all" or v.kind in ("integer", "binary")}
        if int_idx:
            rounding = round_solution(lp, relax.x, int_idx)
            bb = branch_and_bound(lp, int_idx, node_limit, "bigm", tableau_limit)
            out["integer"] = {"scope": integer, "variables": [lp.vars[j].name for j in sorted(int_idx)], "rounding": rounding, "branch_and_bound": bb,
                              "relaxation_is_integer": all(relax.x[j].denominator == 1 for j in int_idx)}
            if not rounding["simple"]["feasible"]:
                out["warnings"].append("O arredondamento simples produziu uma solução inviável.")
        else:
            out["integer"] = {"available": False, "reason": "Nenhuma variável marcada como inteira ou binária."}
    else:
        out["integer"] = {"available": False, "reason": "Sem solução ótima contínua." if not opt else "Resolução inteira desativada."}
    out["graph"] = build_graph(lp, relax, rounding, bb, out["multiple"]) if len(lp.vars) == 2 else None
    return out


def solve_node(lp: LP, lower: list, upper: list, method: str = "bigm") -> dict:
    """Resolve novamente a relaxação de um nó do Branch and Bound, com todas as iterações (consulta sob demanda)."""
    names = [v.name for v in lp.vars]
    res = solve_lp(lp.with_bounds(lower, upper), method, record=True)
    out = _res_dict(res, names)
    out["standard_form"] = standard_info(res)
    return out
