"""Exemplos prontos. O motor resolve qualquer modelo enviado pela interface; estes são apenas modelos de partida."""


def _p(name, sense, obj, cons, names=None, cons_names=None, kinds=None):
    n = len(obj)
    names = names or [f"x{i+1}" for i in range(n)]
    variables = [{"name": nm, "kind": (kinds or {}).get(i, "continuous"), "lower": 0,
                  "upper": 1 if (kinds or {}).get(i) == "binary" else None} for i, nm in enumerate(names)]
    return {"name": name, "sense": sense, "objective": obj, "variables": variables,
            "constraints": [{"name": (cons_names or [f"R{i+1}" for i in range(len(cons))])[i], "coefficients": c, "relation": r, "rhs": b}
                            for i, (c, r, b) in enumerate(cons)]}


EXAMPLES = [
    {"id": "radioterapico", "title": "Problema Radioterápico", "category": "Radioterapia",
     "description": "Planejamento de radioterapia com dois feixes: minimiza a dose absorvida pelo tecido saudável, "
                    "respeitando o limite nos tecidos críticos e as doses exigidas no tumor.",
     "highlights": ["Minimização", "Restrições ≤, = e ≥", "Solução inteira"],
     "context": {
         "statement": "Dois feixes de radiação são aplicados ao paciente. As variáveis x₁ e x₂ são as doses (em kilorads) de cada feixe. "
                      "Os coeficientes indicam a dose absorvida por cada região do corpo por unidade de dose de cada feixe.",
         "objective": "Minimizar a dose total no tecido saudável: Z = 0,4x₁ + 0,5x₂.",
         "constraints": ["Tecidos críticos: 0,3x₁ + 0,1x₂ ≤ 2,7", "Região do tumor: 0,5x₁ + 0,5x₂ = 6", "Centro do tumor: 0,6x₁ + 0,4x₂ ≥ 6"],
     },
     "problem": _p("Problema Radioterápico", "min", [0.4, 0.5],
                   [([0.3, 0.1], "<=", 2.7), ([0.5, 0.5], "=", 6), ([0.6, 0.4], ">=", 6)],
                   cons_names=["Tecidos críticos", "Região do tumor", "Centro do tumor"])},
    {"id": "producao-inteira", "title": "Produção com solução inteira diferente do arredondamento", "category": "Programação inteira",
     "description": "Maximiza o lucro de dois produtos. O ótimo contínuo é fracionário e o Branch and Bound encontra um inteiro melhor que o obtido por piso e teto.",
     "highlights": ["Maximização", "Ótimo fracionário", "Branch and Bound"],
     "problem": _p("Produção com solução inteira", "max", [5, 4], [([6, 4], "<=", 24), ([1, 2], "<=", 6)],
                   cons_names=["Matéria-prima", "Horas de máquina"])},
    {"id": "multipla", "title": "Soluções ótimas múltiplas", "category": "Soluções múltiplas",
     "description": "A curva de nível de Z é paralela à restrição x₁ + 2x₂ ≤ 8, formando uma aresta inteira de soluções ótimas.",
     "highlights": ["Maximização", "Curva de nível paralela", "Vértices alternativos"],
     "problem": _p("Soluções ótimas múltiplas", "max", [2, 4], [([1, 2], "<=", 8), ([1, 0], "<=", 6), ([0, 1], "<=", 3)])},
    {"id": "mix3", "title": "Mix de produção com três variáveis", "category": "Modelagem",
     "description": "Maximiza o lucro de três produtos com três recursos limitados. Resolvido pelas tabelas Simplex; sem gráfico 2D.",
     "highlights": ["Maximização", "3 variáveis", "Somente restrições ≤"],
     "problem": _p("Mix de produção", "max", [3, 2, 5], [([1, 2, 1], "<=", 430), ([3, 0, 2], "<=", 460), ([1, 4, 0], "<=", 420)])},
    {"id": "binario", "title": "Mochila binária", "category": "Programação inteira",
     "description": "Escolhe quais itens levar maximizando o valor dentro da capacidade. Todas as variáveis são binárias (0 ou 1).",
     "highlights": ["Maximização", "4 variáveis binárias", "Branch and Bound"],
     "problem": _p("Mochila binária", "max", [10, 13, 7, 8], [([3, 4, 2, 3], "<=", 7)], cons_names=["Capacidade"],
                   kinds={0: "binary", 1: "binary", 2: "binary", 3: "binary"})},
    {"id": "inviavel", "title": "Problema inviável", "category": "Casos especiais",
     "description": "As restrições x₁ + x₂ ≤ 2 e x₁ + x₂ ≥ 5 não podem ser satisfeitas ao mesmo tempo.",
     "highlights": ["Região viável vazia", "Detecção pelo Big-M e pelas Duas Fases"],
     "problem": _p("Problema inviável", "max", [1, 1], [([1, 1], "<=", 2), ([1, 1], ">=", 5)])},
    {"id": "ilimitado", "title": "Problema ilimitado", "category": "Casos especiais",
     "description": "Em x₁ − x₂ ≤ 1 a função Z = x₁ + x₂ cresce sem limite: nenhuma linha passa no teste da razão.",
     "highlights": ["Região viável aberta", "Teste da razão sem pivô"],
     "problem": _p("Problema ilimitado", "max", [1, 1], [([1, -1], "<=", 1)])},
]
