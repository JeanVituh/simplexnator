"""Validação e estruturação dos dados da API (Pydantic)."""
from __future__ import annotations
import math
from typing import Literal
from fractions import Fraction

from pydantic import BaseModel, Field, model_validator
from .config import settings
from .engine.model import LP, Con, Var
from .engine.numbers import to_frac


class VariableIn(BaseModel):
    name: str = Field(min_length=1, max_length=24)
    kind: Literal["continuous", "integer", "binary"] = "continuous"
    lower: float | None = 0.0      # null = sem limite inferior (variável livre)
    upper: float | None = None


class ConstraintIn(BaseModel):
    name: str | None = None
    coefficients: list[float]
    relation: Literal["<=", ">=", "="]
    rhs: float


class ProblemIn(BaseModel):
    name: str = ""
    sense: Literal["max", "min"]
    objective: list[float]
    variables: list[VariableIn]
    constraints: list[ConstraintIn]

    @model_validator(mode="after")
    def _check(self):
        n = len(self.variables)
        if n < 1 or n > settings.max_variables:
            raise ValueError(f"Número de variáveis deve estar entre 1 e {settings.max_variables}.")
        if not 1 <= len(self.constraints) <= settings.max_constraints:
            raise ValueError(f"Número de restrições deve estar entre 1 e {settings.max_constraints}.")
        if len(self.objective) != n:
            raise ValueError("A função objetivo deve ter um coeficiente por variável.")
        if len({v.name for v in self.variables}) != n:
            raise ValueError("Os nomes das variáveis devem ser únicos.")
        for c in self.constraints:
            if len(c.coefficients) != n:
                raise ValueError("Cada restrição deve ter um coeficiente por variável.")
        nums = list(self.objective) + [c.rhs for c in self.constraints] + [a for c in self.constraints for a in c.coefficients]
        if not all(math.isfinite(v) for v in nums):
            raise ValueError("Todos os coeficientes devem ser números finitos.")
        return self

    def to_lp(self) -> LP:
        vs = []
        for v in self.variables:
            lo, up = to_frac(v.lower), to_frac(v.upper)
            if v.kind == "binary":
                lo, up = to_frac(0), to_frac(1)
            vs.append(Var(v.name, v.kind, lo, up))
        cons = [Con(c.name or f"R{i+1}", [to_frac(a) for a in c.coefficients], c.relation, to_frac(c.rhs)) for i, c in enumerate(self.constraints)]
        return LP(self.sense, [to_frac(a) for a in self.objective], vs, cons, self.name)


class SolveRequest(BaseModel):
    problem: ProblemIn
    method: Literal["bigm", "twophase"] = "bigm"
    integer: Literal["none", "marked", "all"] = "all"
    node_limit: int = Field(default=settings.bb_node_limit, ge=1, le=50000)


class NodeRequest(BaseModel):
    """Consulta das iterações de um nó do Branch and Bound: limites efetivos das variáveis (frações, ex.: "7" ou "15/2")."""
    problem: ProblemIn
    method: Literal["bigm", "twophase"] = "bigm"
    lower: list[str | None]
    upper: list[str | None]

    @model_validator(mode="after")
    def _check(self):
        n = len(self.problem.variables)
        if len(self.lower) != n or len(self.upper) != n:
            raise ValueError("Os limites do nó devem ter um valor por variável.")
        for v in [*self.lower, *self.upper]:
            if v is not None:
                try:
                    Fraction(v)
                except (ValueError, ZeroDivisionError):
                    raise ValueError(f"Limite inválido: {v!r}.")
        return self

    def bounds(self):
        f = lambda v: None if v is None else Fraction(v)
        return [f(v) for v in self.lower], [f(v) for v in self.upper]
