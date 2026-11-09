"""Modelo de PL e conversão para a forma padrão (variáveis ≥ 0)."""
from __future__ import annotations
from dataclasses import dataclass
from fractions import Fraction as F
from .numbers import dec_str

SYMBOL = {"<=": "≤", ">=": "≥", "=": "="}


@dataclass
class Var:
    name: str
    kind: str = "continuous"      # continuous | integer | binary
    lower: F | None = F(0)        # None = sem limite inferior (variável livre)
    upper: F | None = None        # None = sem limite superior


@dataclass
class Con:
    name: str
    coeffs: list
    rel: str                      # "<=", ">=", "="
    rhs: F


@dataclass
class LP:
    sense: str                    # "max" | "min"
    c: list
    vars: list
    cons: list
    name: str = ""

    def with_bounds(self, lowers, uppers) -> "LP":
        vs = [Var(v.name, v.kind, lo, up) for v, lo, up in zip(self.vars, lowers, uppers)]
        return LP(self.sense, self.c, vs, self.cons, self.name)

    def objective(self, x) -> F:
        return sum((c * xi for c, xi in zip(self.c, x)), F(0))

    def check(self, x) -> list:
        """Verificação exata da viabilidade. Devolve a lista de violações."""
        out = []
        for j, v in enumerate(self.vars):
            if v.lower is not None and x[j] < v.lower:
                out.append(f"{v.name} ≥ {dec_str(v.lower)}")
            if v.upper is not None and x[j] > v.upper:
                out.append(f"{v.name} ≤ {dec_str(v.upper)}")
        for c in self.cons:
            lhs = sum((a * xi for a, xi in zip(c.coeffs, x)), F(0))
            ok = lhs <= c.rhs if c.rel == "<=" else lhs >= c.rhs if c.rel == ">=" else lhs == c.rhs
            if not ok:
                out.append(f"{c.name}: lado esquerdo = {dec_str(lhs)}, mas deveria ser {SYMBOL[c.rel]} {dec_str(c.rhs)}")
        return out


@dataclass
class Row:
    name: str
    coeffs: list
    rel: str
    rhs: F
    origin: int | None            # índice da restrição original (None = limite de variável)


@dataclass
class Std:
    sense: str
    s: int                        # +1 max, -1 min
    col_names: list
    cobj: list                    # coeficientes na função objetivo (sentido do usuário)
    c0: F                         # constante do objetivo (vinda de deslocamentos)
    rows: list
    cmap: list                    # por variável original: [(coluna, coef)]
    offset: list
    identity: bool

    def recover(self, colvals) -> list:
        return [self.offset[j] + sum((cf * colvals[k] for k, cf in self.cmap[j]), F(0)) for j in range(len(self.cmap))]


def standardize(lp: LP) -> Std:
    names, cmap, offset, bound_rows = [], [], [], []
    for v in lp.vars:
        if v.lower is not None:
            k = len(names)
            names.append(v.name if v.lower == 0 else f"{v.name}'")
            cmap.append([(k, F(1))]); offset.append(v.lower)
            if v.upper is not None:
                bound_rows.append((k, v.upper - v.lower, f"{v.name} ≤ {dec_str(v.upper)}"))
        elif v.upper is not None:
            k = len(names)
            names.append(f"{v.name}'")
            cmap.append([(k, F(-1))]); offset.append(v.upper)
        else:
            k = len(names)
            names.extend([f"{v.name}⁺", f"{v.name}⁻"])
            cmap.append([(k, F(1)), (k + 1, F(-1))]); offset.append(F(0))
    n = len(names)
    cobj = [F(0)] * n
    c0 = F(0)
    for j, cj in enumerate(lp.c):
        c0 += cj * offset[j]
        for k, cf in cmap[j]:
            cobj[k] += cj * cf
    rows = []
    for i, con in enumerate(lp.cons):
        co, rhs = [F(0)] * n, con.rhs
        for j, a in enumerate(con.coeffs):
            rhs -= a * offset[j]
            for k, cf in cmap[j]:
                co[k] += a * cf
        rows.append(Row(con.name, co, con.rel, rhs, i))
    for k, ub, label in bound_rows:
        co = [F(0)] * n
        co[k] = F(1)
        rows.append(Row(label, co, "<=", ub, None))
    identity = all(len(cm) == 1 and cm[0][1] == 1 and off == 0 for cm, off in zip(cmap, offset))
    return Std(lp.sense, 1 if lp.sense == "max" else -1, names, cobj, c0, rows, cmap, offset, identity)
