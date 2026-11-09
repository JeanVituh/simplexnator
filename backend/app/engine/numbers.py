"""Aritmética exata e formatação. Todo o motor usa Fraction: sem erros de arredondamento."""
from __future__ import annotations
from fractions import Fraction

F = Fraction


def to_frac(v) -> Fraction | None:
    if v is None:
        return None
    if isinstance(v, Fraction):
        return v
    if isinstance(v, int):
        return Fraction(v)
    return Fraction(repr(float(v))).limit_denominator(10**9)


def dec_str(q, nd: int = 4) -> str:
    if q == 0:
        return "0"
    s = f"{float(q):.{nd}f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def frac_str(q) -> str:
    return str(Fraction(q))


def m_str(c, m, fn) -> str:
    """Formata c + m·M (Big-M). fn formata cada coeficiente."""
    s = ""
    if m != 0:
        s = "M" if m == 1 else "-M" if m == -1 else f"{fn(m)}M"
    if c != 0:
        s = (s + ("+" if c > 0 else "") + fn(c)) if s else fn(c)
    return s or "0"


def num(q) -> dict:
    return {"value": float(q), "frac": frac_str(q)}


def lin_str(coeffs, names) -> str:
    parts = [(a, n) for a, n in zip(coeffs, names) if a != 0]
    if not parts:
        return "0"
    out = ""
    for k, (a, n) in enumerate(parts):
        mag = abs(a)
        term = ("" if mag == 1 else dec_str(mag)) + n
        if k == 0:
            out += ("-" if a < 0 else "") + term
        else:
            out += (" - " if a < 0 else " + ") + term
    return out
