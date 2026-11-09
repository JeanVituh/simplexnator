from fractions import Fraction as F
from app.engine.model import LP, Con, Var


def lp(sense, c, cons, vars_=None, kinds=None):
    n = len(c)
    vs = vars_ or [Var(f"x{i+1}", (kinds or ["continuous"] * n)[i]) for i in range(n)]
    return LP(sense, [F(str(v)) for v in c], vs,
              [Con(f"R{i+1}", [F(str(a)) for a in co], rel, F(str(b))) for i, (co, rel, b) in enumerate(cons)])
