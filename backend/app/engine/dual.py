"""Construção do modelo dual a partir do primal na forma padrão (variáveis ≥ 0).

Primal max → dual min, A'y ≥ c ;  primal min → dual max, A'y ≤ c.
Sinal de y_i: ≥0 / ≤0 / livre conforme a relação da linha i (tabela clássica SOB).
"""
from __future__ import annotations
from fractions import Fraction as F
from .model import LP, Con, Var, Std, SYMBOL
from .numbers import lin_str, dec_str


def build_dual(std: Std):
    pmax = std.sense == "max"
    rows, n = std.rows, len(std.col_names)
    vars_, corr_rows = [], []
    for i, r in enumerate(rows):
        if r.rel == "=":
            lo, up, sign = None, None, "livre"
        elif (pmax and r.rel == "<=") or (not pmax and r.rel == ">="):
            lo, up, sign = F(0), None, "≥ 0"
        else:
            lo, up, sign = None, F(0), "≤ 0"
        vars_.append(Var(f"y{i+1}", "continuous", lo, up))
        corr_rows.append({"primal": f"{r.name} ({SYMBOL[r.rel]} {dec_str(r.rhs)})", "dual_var": f"y{i+1}", "sign": sign})
    cons, corr_cols = [], []
    for j in range(n):
        cons.append(Con(f"D{j+1}", [rows[i].coeffs[j] for i in range(len(rows))], ">=" if pmax else "<=", std.cobj[j]))
        corr_cols.append({"primal_var": std.col_names[j], "dual_constraint": f"D{j+1}", "relation": ">=" if pmax else "<="})
    dual = LP("min" if pmax else "max", [r.rhs for r in rows], vars_, cons, "Dual")
    return dual, {"rows": corr_rows, "columns": corr_cols}


def format_lp(lp: LP, obj_name: str) -> list:
    names = [v.name for v in lp.vars]
    out = [f"{'Max' if lp.sense == 'max' else 'Min'} {obj_name} = {lin_str(lp.c, names)}", "sujeito a:"]
    for c in lp.cons:
        out.append(f"  {lin_str(c.coeffs, names)} {SYMBOL[c.rel]} {dec_str(c.rhs)}    ({c.name})")
    dom = []
    for v in lp.vars:
        if v.lower == 0 and v.upper is None:
            dom.append(f"{v.name} ≥ 0")
        elif v.lower is None and v.upper is None:
            dom.append(f"{v.name} livre")
        elif v.lower is None:
            dom.append(f"{v.name} ≤ {dec_str(v.upper)}")
        elif v.upper is None:
            dom.append(f"{v.name} ≥ {dec_str(v.lower)}")
        else:
            dom.append(f"{dec_str(v.lower)} ≤ {v.name} ≤ {dec_str(v.upper)}")
    out.append("  " + ", ".join(dom))
    return out
