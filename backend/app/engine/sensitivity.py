"""Análise de sensibilidade a partir da tabela ótima (aritmética exata)."""
from __future__ import annotations
from fractions import Fraction as F
from .numbers import num


def _n(q):
    return None if q is None else num(q)


def sensitivity(res) -> dict:
    t, std = res.tableau, res.std
    if res.status != "optimal":
        return {"available": False, "reason": "Só existe para problemas com solução ótima."}
    if any(t.kinds[bj] == "artificial" for bj in t.basis):
        return {"available": False, "reason": "Variável artificial permaneceu na base (restrição redundante)."}
    s, m = std.s, len(t.A)
    basic = set(t.basis)
    rhs = []
    for i, row in enumerate(std.rows):
        k = t.init_basis[i]
        y_f = t.zc[k]                      # preço-sombra no espaço de maximização
        sigma = -1 if t.flipped[i] else 1
        shadow = s * y_f * sigma           # dZ/d(RHS original)
        lo = hi = None                     # variação permitida de RHS normalizado
        for r in range(m):
            a = t.A[r][k]
            if a > 0:
                v = -t.b[r] / a
                lo = v if lo is None else max(lo, v)
            elif a < 0:
                v = -t.b[r] / a
                hi = v if hi is None else min(hi, v)
        if sigma == -1:
            lo, hi = (None if hi is None else -hi), (None if lo is None else -lo)
        cur = row.rhs
        rhs.append({
            "constraint": row.name, "origin": row.origin, "shadow_price": num(shadow),
            "rhs": num(cur),
            "allowable_decrease": _n(None if lo is None else -lo), "allowable_increase": _n(hi),
            "lower": _n(None if lo is None else cur + lo), "upper": _n(None if hi is None else cur + hi),
            "binding": cur == sum((a * v for a, v in zip(row.coeffs, t.colvals()[: len(row.coeffs)])), F(0)),
        })
    out = {"available": True, "rhs": rhs, "objective": [], "reduced_costs": []}
    if not std.identity:
        out["objective_note"] = "Variáveis com deslocamento ou livres: faixas dos coeficientes não calculadas."
        return out
    cv = t.colvals()
    for j, name in enumerate(std.col_names):
        c_user = std.cobj[j]
        cf = s * c_user
        rc = -s * t.zc[j]          # variação de Z por unidade forçada na base
        out["reduced_costs"].append({"variable": name, "value": num(cv[j]), "reduced_cost": num(rc)})
        if j in basic:
            r = t.basis.index(j)
            lo = hi = None
            for k in range(len(t.names)):
                if k in basic or not t.active[k] or t.kinds[k] == "artificial":
                    continue
                a = t.A[r][k]
                d = t.zc[k]
                if a > 0:
                    v = -d / a; lo = v if lo is None else max(lo, v)
                elif a < 0:
                    v = -d / a; hi = v if hi is None else min(hi, v)
            fl = None if lo is None else cf + lo
            fh = None if hi is None else cf + hi
        else:
            fl, fh = None, cf + t.zc[j]
        if s == -1:
            fl, fh = (None if fh is None else -fh), (None if fl is None else -fl)
        out["objective"].append({"variable": name, "coefficient": num(c_user), "lower": _n(fl), "upper": _n(fh), "basic": j in basic})
    return out
