# Simplexnator

Plataforma web para resolver problemas de **Programação Linear pelo Método Simplex**, com tabelas de cada iteração, gráfico da região viável, otimização inteira (Branch and Bound), dual resolvido em tabelas e análise de sensibilidade.

O cálculo é feito no backend, em **Python com aritmética exata (frações)**; a interface é um aplicativo **React + TypeScript**.

## Funcionalidades

| Área | O que oferece |
|---|---|
| **Entrada** | Maximizar/minimizar; variáveis contínuas, inteiras ou binárias; limites inferior e superior (ou variável livre); restrições ≤, ≥ e =; adicionar/remover variáveis e restrições; validação do formulário; prévia da formulação. |
| **Resolução** | Simplex tabular com **Big-M** ou **Duas Fases**; forma padrão; pivô, variáveis que entram/saem, razões, operações de linha e custos reduzidos em cada iteração; navegação passo a passo, modo automático e frações exatas. Detecta inviabilidade, ilimitabilidade, degenerescência (regra de Bland contra ciclagem) e soluções múltiplas. |
| **Gráficos** | Região viável, retas das restrições, curvas de nível, vértices com Z, ótimo contínuo, pontos inteiros e solução inteira (Plotly interativo, camadas ativáveis). Para 2 variáveis. |
| **Solução inteira** | Ótimo contínuo, arredondamento simples (com verificação de viabilidade), melhor combinação piso/teto viável e **Branch and Bound** com árvore, ramificações, podas e motivo de encerramento. |
| **Dual** | Construção do dual, correspondência primal ↔ dual, **resolução do dual em tabelas Simplex (todas as iterações)** e conferência da dualidade forte (Z = W). |
| **Soluções múltiplas** | Detecção (custo reduzido nulo em variável não básica), geração de vértices alternativos por pivoteamento, confirmação do mesmo Z e segmento destacado no gráfico. |
| **Resultados / Projetos** | Resumo, comparação entre soluções, preços-sombra e faixas de sensibilidade; exportar/importar JSON; histórico local; impressão/PDF pelo navegador; tema claro e escuro. |

O motor é genérico: **qualquer modelo digitado em Entrada é resolvido**, sem alterar código. Limites padrão: 12 variáveis e 20 restrições (configuráveis).

## Tecnologias

- **Frontend:** React 19, TypeScript 6, Vite 8, Tailwind CSS 3.4, componentes no estilo shadcn/ui (Radix UI + class-variance-authority), Plotly.js (`plotly.js-dist-min` 4.2), React Router 7, Vitest 5 + Testing Library.
- **Backend:** Python, FastAPI, Pydantic, Uvicorn, python-dotenv. O motor usa apenas a biblioteca padrão (`fractions`, `dataclasses`).
- **Testes de validação independente (opcional):** SciPy/NumPy.

## Arquitetura

```
Navegador (React) ──HTTP/JSON──▶ FastAPI (app/main.py, schemas.py)
                                      └──▶ engine/  (motor matemático independente da API)
```

O frontend **não calcula**: apenas exibe o que o backend retorna (tabelas, pivôs, árvore, dual, gráfico). Em desenvolvimento o Vite encaminha `/api` para `http://127.0.0.1:8000`.

```
simplexnator/
├─ backend/
│  ├─ app/
│  │  ├─ main.py  schemas.py  config.py
│  │  └─ engine/
│  │     ├─ numbers.py  model.py          # Fraction, modelo e forma padrão
│  │     ├─ simplex.py                    # tabela, Big-M, Duas Fases, Bland
│  │     ├─ dual.py  multiple.py  sensitivity.py
│  │     ├─ integer.py  geometry.py  solver.py  examples.py
│  ├─ scripts/export_fixtures.py          # gera respostas reais da API para os testes do frontend
│  ├─ tests/                              # pytest
│  ├─ requirements.txt  requirements-dev.txt  .env.example
├─ frontend/
│  ├─ src/{pages,components,components/ui,lib,test}
│  ├─ package.json  package-lock.json  vite.config.ts  vercel.json  .env.example
├─ render.yaml  .github/workflows/ci.yml  .gitignore
```

## Pré-requisitos (Windows)

- **Python 3.12 ou superior** (validado com 3.12 e **3.15.2**) — marque *Add python.exe to PATH*.
- **Node.js ^22.22.2 ou ^24.15.0** (validado com **24.19.0** e npm 11).
- Git e Visual Studio Code.

## Instalação e execução

Abra a pasta `simplexnator` no VS Code e use dois terminais (`Ctrl+'`).

**1. Backend**
```powershell
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000 --env-file .env
```
Se o PowerShell bloquear o ativador: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
Teste a API em http://127.0.0.1:8000/api/health e http://127.0.0.1:8000/docs.

> **Sobre o `uvicorn`:** as dependências usam `uvicorn` **sem** o extra `[standard]` (que exige o PyYAML e falhou em alguns ambientes) e incluem `python-dotenv`, necessário para `--env-file`. Não é preciso `websockets`, `httptools` nem `uvloop`.

**2. Frontend**
```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```
Abra **http://localhost:5173**. Em produção, defina `VITE_API_URL` com a URL pública do backend.

## Testes e verificações

```powershell
# Backend (na pasta backend, com o ambiente virtual ativo)
python -m pytest -q tests

# Frontend (na pasta frontend)
npm run typecheck
npm test
npm run build
npm audit
npm audit --omit=dev

# Integração real interface ↔ API (backend rodando em 127.0.0.1:8000)
$env:VITE_API_URL="http://127.0.0.1:8000"; npm run test:integration
```

- **Backend:** testes de Simplex (máx/mín, ≤/≥/=, Big-M, Duas Fases, inviável, ilimitado, degenerado, exemplo de ciclagem de Beale, variáveis livres e com limites), múltiplas soluções, Branch and Bound (árvore e podas), dual (todas as iterações e dualidade forte), sensibilidade, exemplos e API. Os testes que usam **SciPy** (`linprog`/`milp`) comparam o motor com um solver independente em problemas aleatórios; se o SciPy não estiver instalado eles são ignorados (aparecem como *skipped*).
- **Frontend:** componentes, validação, navegação, fluxo completo (exemplo → resolução → resultados → inteira → dual → gráfico) com respostas reais da API, e um teste de integração que monta a aplicação e conversa com o FastAPI em execução.

## Segurança das dependências

`npm audit` e `npm audit --omit=dev` retornam **0 vulnerabilidades**. As correções vieram da atualização coordenada de Vite (8.3.6), Vitest (5.1.0), React Router (7.18.5) e React (19.3.1), com o código adaptado. Foram removidos `react-plotly.js` (e com ele o `plotly.js` completo e o `es5-ext`), que não eram necessários: o gráfico usa `plotly.js-dist-min` diretamente. O `jsdom` 31 eliminou o pacote descontinuado `whatwg-encoding`. Com Vite 8 o `esbuild` deixou de ser dependência.

Scripts de instalação (`npm approve-scripts`): **nenhum pacote** do projeto possui script de instalação pendente, então nada precisa ser aprovado (`npm ci` não emite avisos `allow-scripts`). Se um pacote futuro exigir script, aprove-o individualmente com `npm approve-scripts`, nunca em bloco.

O Tailwind permanece na linha 3.4 (sem vulnerabilidades conhecidas); a migração para a v4 exige reescrever a configuração e não era necessária.

## GitHub

```powershell
git init
git add .
git commit -m "Simplexnator v1.1"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/simplexnator.git
git push -u origin main
```
Para atualizar: `git pull`. Para trabalhar em ramos: `git checkout -b minha-alteracao`. `.env`, `node_modules` e `.venv` estão no `.gitignore`. O workflow `.github/workflows/ci.yml` executa os testes a cada push.

## Publicação (Vercel + Render)

> A publicação **não foi executada nem testada** neste repositório; as configurações estão prontas.

1. **Backend (Render):** crie um *Web Service* a partir do repositório (o `render.yaml` já define a raiz `backend`, o comando de início e o `healthCheckPath`). Defina `CORS_ORIGINS=https://SEU-PROJETO.vercel.app` (várias origens separadas por vírgula). Anote a URL pública.
2. **Frontend (Vercel):** importe o repositório, **Root Directory = `frontend`**, framework Vite. Em *Environment Variables* defina `VITE_API_URL` com a URL do backend (sem barra final). O `vercel.json` reescreve as rotas para o React Router.
3. Cada `git push` na `main` republica os dois serviços. Em planos gratuitos o backend pode demorar na primeira requisição (*cold start*).

## Limitações conhecidas

- O gráfico 2D exige exatamente 2 variáveis; com mais variáveis a resolução continua completa nas tabelas.
- O dual é construído a partir do primal na forma padrão (variáveis ≥ 0; limites superiores viram restrições; variáveis duais ≤ 0 ou livres entram por substituição). O Simplex Dual como método independente não foi implementado: o dual é resolvido pelo Simplex tabular.
- Faixas de sensibilidade dos coeficientes não são calculadas quando há variáveis deslocadas (limite inferior ≠ 0) ou livres.
- A árvore do Branch and Bound mostra resultado, ramificação e motivo de cada nó; as tabelas Simplex individuais de cada nó não são exibidas.
- O relatório PDF usa a impressão do navegador (Salvar como PDF).
- Sem autenticação, armazenamento em nuvem ou gráfico 3D. O histórico é salvo no navegador (localStorage).
- As fontes (Geist) são carregadas do Google Fonts; sem internet a interface usa a fonte do sistema.

## Procedência do exemplo radioterápico

O **Problema Radioterápico** segue a formulação clássica de planejamento de radioterapia atribuída a Hillier & Lieberman (minimizar Z = 0,4x₁ + 0,5x₂ sujeito a 0,3x₁ + 0,1x₂ ≤ 2,7; 0,5x₁ + 0,5x₂ = 6; 0,6x₁ + 0,4x₂ ≥ 6). Os coeficientes foram cadastrados como modelo demonstrativo e **não constituem transcrição do enunciado de nenhuma disciplina**: se o enunciado oficial tiver outros valores, edite-os em *Entrada* e execute novamente. Todos os resultados exibidos (contínuo, arredondamento e inteiro) são recalculados pelo motor a cada execução e verificados por testes automáticos (incluindo comparação com SciPy).
