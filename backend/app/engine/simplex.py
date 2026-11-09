"""Simplex tabular genérico: Big-M, Duas Fases, regra de Bland anti-ciclagem.

Convenção da linha Z (forma de maximização f = s·Z):  f + Σ d_j x_j = RHS.
A variável entra quando d_j < 0. Em Big-M, d_j = zc_j + zm_j·M (M simbólico, exato).
"""
from __future__ import annotations
from dataclasses import dataclass, field
from fractions import Fraction as F
from .model import LP, Std, standardize
from .numbers import dec_str, frac_str, m_str

MAX_ITER = 5000
FLIP = {"<=": ">=", ">=": "<=", "=": "="}


class Tableau:
    def __init__(self, names, kinds, A, b, basis, init_basis, flipped, row_names):
        self.names, self.kinds, self.A, self.b, self.basis = names, kinds, A, b, basis
        self.init_basis, self.flipped, self.row_names = init_basis, flipped, row_names
        n = len(names)
        self.zc, self.zm = [F(0)] * n, [F(0)] * n
        self.z0c = self.z0m = F(0)
        self.active = [True] * n

    def copy(self) -> "Tableau":
        t = Tableau(self.names, self.kinds, [r[:] for r in self.A], self.b[:], self.basis[:], self.init_basis, self.flipped, self.row_names)
        t.zc, t.zm, t.z0c, t.z0m, t.active = self.zc[:], self.zm[:], self.z0c, self.z0m, self.active[:]
        return t

    def pivot(self, r: int, c: int) -> None:
        p = self.A[r][c]
        self.A[r] = [v / p for v in self.A[r]]
        self.b[r] = self.b[r] / p
        for i in range(len(self.A)):
            if i != r and self.A[i][c] != 0:
                f = self.A[i][c]
                self.A[i] = [a - f * pr for a, pr in zip(self.A[i], self.A[r])]
                self.b[i] -= f * self.b[r]
        fc, fm = self.zc[c], self.zm[c]
        if fc != 0:
            self.zc = [a - fc * pr for a, pr in zip(self.zc, self.A[r])]
            self.z0c -= fc * self.b[r]
        if fm != 0:
            self.zm = [a - fm * pr for a, pr in zip(self.zm, self.A[r])]
            self.z0m -= fm * self.b[r]
        self.basis[r] = c

    def colvals(self) -> list:
        v = [F(0)] * len(self.names)
        for i, bj in enumerate(self.basis):
            v[bj] = self.b[i]
        return v


def build_tableau(std: Std) -> Tableau:
    n0 = len(std.col_names)
    names, kinds = list(std.col_names), ["decision"] * n0
    norm = []
    for r in std.rows:
        flip = r.rhs < 0
        co = [-a for a in r.coeffs] if flip else list(r.coeffs)
        norm.append((co, FLIP[r.rel] if flip else r.rel, -r.rhs if flip else r.rhs, flip))
    slack, art = {}, {}
    for i, (_, rel, _, _) in enumerate(norm):
        if rel == "<=":
            slack[i] = len(names); names.append(f"s{i+1}"); kinds.append("slack")
        elif rel == ">=":
            slack[i] = len(names); names.append(f"e{i+1}"); kinds.append("surplus")
    for i, (_, rel, _, _) in enumerate(norm):
        if rel != "<=":
            art[i] = len(names); names.append(f"a{i+1}"); kinds.append("artificial")
    n = len(names)
    A, b, basis = [], [], []
    for i, (co, rel, rhs, _) in enumerate(norm):
        row = [F(0)] * n
        row[:n0] = co
        if i in slack:
            row[slack[i]] = F(1) if rel == "<=" else F(-1)
        if i in art:
            row[art[i]] = F(1)
        A.append(row); b.append(rhs); basis.append(art.get(i, slack.get(i)))
    return Tableau(names, kinds, A, b, basis[:], basis[:], [x[3] for x in norm], [r.name for r in std.rows])


def eliminate_basis(t: Tableau) -> None:
    for i, bj in enumerate(t.basis):
        fc, fm = t.zc[bj], t.zm[bj]
        if fc == 0 and fm == 0:
            continue
        row = t.A[i]
        t.zc = [a - fc * r for a, r in zip(t.zc, row)]
        t.zm = [a - fm * r for a, r in zip(t.zm, row)]
        t.z0c -= fc * t.b[i]
        t.z0m -= fm * t.b[i]


def set_objective(t: Tableau, std: Std, mode: str) -> None:
    n, n0 = len(t.names), len(std.col_names)
    t.zc, t.zm, t.z0c, t.z0m = [F(0)] * n, [F(0)] * n, F(0), F(0)
    if mode == "phase1":
        for j, k in enumerate(t.kinds):
            if k == "artificial":
                t.zc[j] = F(1)
    else:
        for j in range(n0):
            t.zc[j] = -std.s * std.cobj[j]
        if mode == "bigm":
            for j, k in enumerate(t.kinds):
                if k == "artificial":
                    t.zm[j] = F(1)
    eliminate_basis(t)


class Presenter:
    """Gera os snapshots (tabelas) enviados ao frontend. Só apresentação: não calcula nada."""

    def __init__(self, std: Std):
        self.std, self.snaps, self.n0 = std, [], len(std.col_names)

    def snap(self, t, phase, title, entering=None, row=None, ratios=None, ops=None, note=""):
        std = self.std
        idx = [j for j in range(len(t.names)) if t.active[j]]
        pos = {j: k for k, j in enumerate(idx)}
        m = len(t.A)

        def mat(fn):
            out = [[m_str(t.zc[j], t.zm[j], fn) for j in idx] + [m_str(t.z0c, t.z0m, fn)]]
            for i in range(m):
                out.append([fn(t.A[i][j]) for j in idx] + [fn(t.b[i])])
            return out

        x = std.recover(t.colvals()[: self.n0])
        if phase == 1:
            zc, zm, zlabel = -t.z0c, -t.z0m, "W = Σ artificiais"
        else:
            zc, zm, zlabel = std.s * t.z0c + std.c0, std.s * t.z0m, "Z"
        piv = None
        if entering is not None and row is not None:
            piv = {"row": row + 1, "col": pos[entering]}
        d = {
            "index": len(self.snaps), "phase": phase, "title": title, "note": note,
            "columns": [t.names[j] for j in idx], "kinds": [t.kinds[j] for j in idx],
            "basis": [t.names[b] for b in t.basis],
            "cells_dec": mat(dec_str), "cells_frac": mat(frac_str),
            "ratios_dec": None if ratios is None else [None if r is None else dec_str(r) for r in ratios],
            "ratios_frac": None if ratios is None else [None if r is None else frac_str(r) for r in ratios],
            "entering": None if entering is None else t.names[entering],
            "entering_col": None if entering is None else pos[entering],
            "leaving": None if row is None else t.names[t.basis[row]],
            "pivot": piv,
            "pivot_value": None if piv is None else {"dec": dec_str(t.A[row][entering]), "frac": frac_str(t.A[row][entering])},
            "operations_dec": ops[0] if ops else [], "operations_frac": ops[1] if ops else [],
            "x_dec": [dec_str(v) for v in x], "x_frac": [frac_str(v) for v in x],
            "z_label": zlabel, "z_dec": m_str(zc, zm, dec_str), "z_frac": m_str(zc, zm, frac_str),
        }
        self.snaps.append(d)
        return d


def operations(t: Tableau, r: int, c: int):
    out = []
    for fn in (dec_str, frac_str):
        p = t.A[r][c]
        ops = [f"L{r+1} ← L{r+1} ÷ {fn(p)}"]
        for i in range(len(t.A)):
            if i != r and t.A[i][c] != 0:
                ops.append(f"L{i+1} ← L{i+1} − ({fn(t.A[i][c])})·L{r+1}")
        if t.zc[c] != 0 or t.zm[c] != 0:
            ops.append(f"L0 ← L0 − ({m_str(t.zc[c], t.zm[c], fn)})·L{r+1}")
        out.append(ops)
    return out


def choose_entering(t: Tableau, bland: bool):
    basic, best, bk = set(t.basis), None, None
    for j in range(len(t.names)):
        if not t.active[j] or j in basic:
            continue
        key = (t.zm[j], t.zc[j])
        if key < (0, 0):
            if bland:
                return j
            if best is None or key < bk:
                best, bk = j, key
    return best


def choose_leaving(t: Tableau, c: int):
    ratios = [t.b[i] / t.A[i][c] if t.A[i][c] > 0 else None for i in range(len(t.A))]
    cand = [i for i, r in enumerate(ratios) if r is not None]
    if not cand:
        return None, ratios
    mn = min(ratios[i] for i in cand)
    return min((i for i in cand if ratios[i] == mn), key=lambda i: t.basis[i]), ratios


def run(t: Tableau, pres, phase: int, ctr: dict) -> str:
    streak = 0
    for _ in range(MAX_ITER):
        pre = {1: "Fase 1 — ", 2: "Fase 2 — "}.get(phase, "")
        title = f"{pre}Iteração {ctr['k'] - ctr.get('base', 0)}"
        c = choose_entering(t, ctr["bland"])
        if c is None:
            if pres: pres.snap(t, phase, title + " (condição de parada: todos os custos reduzidos ≥ 0)")
            return "optimal"
        row, ratios = choose_leaving(t, c)
        if row is None:
            if pres: pres.snap(t, phase, title + f" (coluna de {t.names[c]} sem elemento positivo)", entering=c, ratios=ratios)
            return "unbounded"
        if pres:
            pres.snap(t, phase, title, entering=c, row=row, ratios=ratios, ops=operations(t, row, c),
                      note="Regra de Bland ativa (anti-ciclagem)." if ctr["bland"] else "")
        ctr["k"] += 1
        if t.b[row] == 0:
            ctr["degen"] += 1; streak += 1
        else:
            streak = 0
        if streak >= 3 and not ctr["bland"]:
            ctr["bland"] = True
        t.pivot(row, c)
    raise RuntimeError("Limite de iterações excedido")


def drive_out_artificials(t: Tableau, pres, ctr) -> None:
    for i in range(len(t.A)):
        if t.kinds[t.basis[i]] != "artificial":
            continue
        for j in range(len(t.names)):
            if t.kinds[j] != "artificial" and t.A[i][j] != 0:
                if pres: pres.snap(t, 1, f"Remoção de {t.names[t.basis[i]]} da base", entering=j, row=i, ops=operations(t, i, j),
                                   note="Variável artificial com valor 0 trocada por uma variável real.")
                t.pivot(i, j)
                break


@dataclass
class LPResult:
    status: str                    # optimal | infeasible | unbounded
    x: list | None
    z: F | None
    iterations: list
    tableau: Tableau | None
    std: Std
    method_used: str
    n_artificial: int
    degenerate: bool
    degenerate_pivots: int
    bland_used: bool
    message: str = ""
    pivots: int = 0


def solve_lp(lp: LP, method: str = "bigm", record: bool = True) -> LPResult:
    std = standardize(lp)
    t = build_tableau(std)
    pres = Presenter(std) if record else None
    n_art = sum(k == "artificial" for k in t.kinds)
    used = "standard" if n_art == 0 else method
    ctr = {"k": 0, "degen": 0, "bland": False}

    def result(status, msg="", x=None, z=None):
        degen = status == "optimal" and any(t.kinds[bj] != "artificial" and t.b[i] == 0 for i, bj in enumerate(t.basis))
        return LPResult(status, x, z, pres.snaps if pres else [], t, std, used, n_art, degen, ctr["degen"], ctr["bland"], msg, ctr["k"])

    if used == "twophase":
        set_objective(t, std, "phase1")
        run(t, pres, 1, ctr)
        if t.z0c != 0:
            return result("infeasible", f"Fase 1 terminou com soma das variáveis artificiais = {dec_str(-t.z0c)} > 0: não existe solução viável.")
        drive_out_artificials(t, pres, ctr)
        for j, k in enumerate(t.kinds):
            if k == "artificial":
                t.active[j] = False
        set_objective(t, std, "phase2")
        ctr["base"] = ctr["k"]
        status = run(t, pres, 2, ctr)
    else:
        set_objective(t, std, "bigm" if used == "bigm" else "phase2")
        status = run(t, pres, 0, ctr)

    if status == "unbounded":
        return result("unbounded", "A função objetivo é ilimitada: há uma coluna de entrada sem elemento positivo para o teste da razão.")
    cv = t.colvals()
    if any(t.kinds[j] == "artificial" and cv[j] > 0 for j in range(len(cv))):
        return result("infeasible", "Variável artificial positiva na solução ótima do Big-M: o problema é inviável.")
    x = std.recover(cv[: len(std.col_names)])
    return result("optimal", "", x, lp.objective(x))
