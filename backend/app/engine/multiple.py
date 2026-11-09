"""Soluções ótimas múltiplas: custo reduzido nulo em variável não básica ⇒ pivoteamento gera outro vértice ótimo."""
from __future__ import annotations
from fractions import Fraction as F
from .numbers import num, dec_str
from .simplex import Presenter, choose_leaving, operations


def find_alternatives(lp, res, limit: int = 12) -> dict:
    t0, std = res.tableau, res.std
    pres = Presenter(std)
    n0 = len(std.col_names)
    key = lambda t: tuple(t.colvals()[:n0])
    seen = {key(t0)}
    queue, alts, rays, zero_cols = [t0], [], [], []
    z_opt = res.z
    while queue and len(alts) < limit:
        cur = queue.pop(0)
        for j in range(len(cur.names)):
            if not cur.active[j] or cur.kinds[j] == "artificial" or j in cur.basis:
                continue
            if cur.zc[j] != 0 or cur.zm[j] != 0:
                continue
            if cur is t0:
                zero_cols.append(cur.names[j])
            row, ratios = choose_leaving(cur, j)
            if row is None:
                if cur.names[j] not in rays:
                    rays.append(cur.names[j])
                continue
            nt = cur.copy()
            leaving = nt.names[nt.basis[row]]
            ops = operations(nt, row, j)
            nt.pivot(row, j)
            k = key(nt)
            if k in seen:
                continue
            seen.add(k)
            x = std.recover(list(k))
            z = lp.objective(x)
            snap = pres.snap(nt, 0, f"Solução alternativa {len(alts) + 1}: entra {nt.names[j]}, sai {leaving}", ops=ops,
                             note="Após o pivô, o valor de Z permanece o mesmo.")
            alts.append({"x": [num(v) for v in x], "z": num(z), "entering": nt.names[j], "leaving": leaving,
                         "same_objective": z == z_opt, "snapshot": snap})
            queue.append(nt)
    exists = bool(alts) or bool(rays)
    return {
        "exists": exists,
        "zero_reduced_cost": zero_cols,
        "alternatives": alts,
        "unbounded_rays": rays,
        "points": [[num(v) for v in res.x]] + [a["x"] for a in alts],
        "criterion": "Variável não básica com custo reduzido igual a 0 na tabela ótima (critério de múltiplas soluções).",
    }
