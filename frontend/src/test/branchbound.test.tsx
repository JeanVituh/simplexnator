import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { json, legacy, payloadOf, renderApp } from './utils'
import type { Problem, SolveResponse } from '@/lib/types'
import examples from './fixtures/examples.json'
import radioFx from './fixtures/solve-radioterapico.json'
import raizFx from './fixtures/solve-raiz-inteira.json'
import limiteFx from './fixtures/solve-limite-nos.json'
import semFx from './fixtures/solve-sem-inteira.json'
import nodeFx from './fixtures/bb-node-radioterapico-2.json'

vi.mock('@/components/PlotGraph', () => ({ default: () => <div data-testid="plot" /> }))
const radio = examples.find((e) => e.id === 'radioterapico')!.problem as Problem
const R = radioFx as unknown as SolveResponse
const fetchCalls: { url: string; body: any }[] = []
beforeEach(() => {
  fetchCalls.length = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => { fetchCalls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null }); return url.endsWith('/api/bb/node') ? json(nodeFx) : json({}, 404) }))
})
afterEach(() => vi.unstubAllGlobals())
const kpi = (label: string) => screen.getByText(label).parentElement as HTMLElement
const prob = (fx: unknown): Problem => ({ name: 'p', sense: 'max', objective: [1, 1], variables: (fx as SolveResponse).variables.map((n) => ({ name: n, kind: 'continuous', lower: 0, upper: null })), constraints: [{ name: 'R1', coefficients: (fx as SolveResponse).variables.map(() => 1), relation: '<=', rhs: 1 }] })
const open = async (fx: unknown, problem: Problem = prob(fx)) => { renderApp('/inteira', { payload: payloadOf(problem, fx as SolveResponse) }); return screen.findByRole('heading', { name: 'Solução inteira' }) }

describe('Branch and Bound detalhado — Problema Radioterápico (minimização)', () => {
  it('mostra indicadores calculados pela execução real', async () => {
    await open(R, radio)
    const s = R.integer.available === false ? null : R.integer.branch_and_bound.stats!
    expect(kpi('Nós explorados')).toHaveTextContent('3'); expect(kpi('Nós ramificados')).toHaveTextContent('1'); expect(kpi('Nós inviáveis')).toHaveTextContent('1')
    expect(kpi('Podados por limite')).toHaveTextContent('0'); expect(kpi('Soluções inteiras')).toHaveTextContent('1'); expect(kpi('Profundidade máxima')).toHaveTextContent('1')
    expect(kpi('Pivôs Simplex (nós)')).toHaveTextContent(String(s!.total_pivots))
    expect(kpi('Relaxação na raiz (Z)')).toHaveTextContent('5,25'); expect(kpi('Relaxação na raiz (Z)')).toHaveTextContent('limite inferior')
    expect(kpi('Melhor Z inteiro')).toHaveTextContent('5,3'); expect(kpi('Melhor Z inteiro')).toHaveTextContent('(7; 5)')
    expect(kpi('Diferença contínuo × inteiro')).toHaveTextContent('0,05')
    expect(kpi('Situação final')).toHaveTextContent('Busca concluída'); expect(kpi('Otimalidade inteira')).toHaveTextContent('Comprovada')
  })
  it('lista todos os nós com as colunas pedidas e estados identificáveis', async () => {
    await open(R, radio)
    const table = screen.getAllByRole('table').find((t) => within(t).queryByText('Restrições de ramificação acumuladas'))!
    for (const h of ['Nó', 'Nó pai', 'Prof.', 'Restrições de ramificação acumuladas', 'Variável de ramificação', 'Valor fracionário', 'Limite inteiro', 'Z da relaxação', 'Solução relaxada (x)', 'Pivôs', 'Situação', 'Decisão', 'Motivo de encerramento']) expect(within(table).getByRole('columnheader', { name: h })).toBeInTheDocument()
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('nenhuma (raiz)'); expect(rows[0]).toHaveTextContent('x1'); expect(rows[0]).toHaveTextContent('7,5'); expect(rows[0]).toHaveTextContent('x1 ≤ 7 | x1 ≥ 8'); expect(rows[0]).toHaveTextContent('Ramificado')
    expect(rows[1]).toHaveTextContent('x1 ≤ 7'); expect(rows[1]).toHaveTextContent('Solução inteira'); expect(rows[1]).toHaveTextContent('(7; 5)')
    expect(rows[2]).toHaveTextContent('x1 ≥ 8'); expect(rows[2]).toHaveTextContent('Inviável'); expect(rows[2]).toHaveTextContent('inviável')
  })
  it('exibe o tableau final do nó selecionado e carrega todas as iterações sob demanda', async () => {
    await open(R, radio)
    const nodePanel = (await screen.findByRole('heading', { name: 'Nó 2' })).closest('div.rounded-xl') as HTMLElement   // incumbente já vem selecionado
    expect(within(nodePanel).getByText('Tableau final do nó')).toBeInTheDocument()
    await userEvent.click(within(nodePanel).getByRole('button', { name: /Ver todas as iterações deste nó/ }))
    await waitFor(() => expect(within(nodePanel).getByText(/Nó 2 · passo 1\//)).toBeInTheDocument())
    expect(fetchCalls).toHaveLength(1); expect(fetchCalls[0].url).toMatch(/\/api\/bb\/node$/)
    expect(fetchCalls[0].body.problem.name).toBe(radio.name); expect(fetchCalls[0].body.upper).toEqual(['7', null])   // limites do nó 2: x1 ≤ 7
    await userEvent.click(within(nodePanel).getByRole('button', { name: /Resolver tudo/ }))
    expect(within(nodePanel).getByText('Passo final')).toBeInTheDocument()
  })
  it('seleciona outro nó (inviável) e mostra seu tableau e sua situação', async () => {
    await open(R, radio)
    await userEvent.click(screen.getByRole('button', { name: '3' }))
    const panel = (await screen.findByRole('heading', { name: 'Nó 3' })).closest('div.rounded-xl') as HTMLElement
    expect(within(panel).getByText(/Restrições: x1 ≥ 8/)).toBeInTheDocument(); expect(within(panel).getByText('Tableau final do nó')).toBeInTheDocument()
  })
  it('apresenta a Tabela Simplex da Solução Inteira Ótima com iterações do nó incumbente', async () => {
    await open(R, radio)
    const sec = (await screen.findByRole('heading', { name: 'Tabela Simplex da Solução Inteira Ótima' })).closest('div.rounded-xl') as HTMLElement
    const bb = R.integer.available === false ? null : R.integer.branch_and_bound
    expect(within(sec).getByText(new RegExp(`passo 1/${bb!.incumbent_iterations!.length}$`))).toBeInTheDocument()
    expect(within(sec).getByText('Nó incumbente').parentElement).toHaveTextContent('2')
    await userEvent.click(within(sec).getByRole('button', { name: /Próxima/ }))
    expect(within(sec).getByText('Operações elementares')).toBeInTheDocument(); expect(within(sec).getByText('Entra na base')).toBeInTheDocument()
    await userEvent.click(within(sec).getByRole('button', { name: /Resolver tudo/ }))
    expect(within(sec).getByText('Passo final')).toBeInTheDocument(); expect(within(sec).getAllByText('(7; 5)').length).toBeGreaterThan(0)
  })
  it('a página Resultados traz o resumo do Branch and Bound', async () => {
    renderApp('/resultados', { payload: payloadOf(radio, R) })
    await screen.findByRole('heading', { name: 'Resultados' })
    expect(screen.getByRole('heading', { name: 'Branch and Bound' })).toBeInTheDocument(); expect(kpi('Nós explorados')).toHaveTextContent('3')
  })
})

describe('Casos especiais do Branch and Bound', () => {
  it('relaxação inteira na raiz: encerra no nó raiz sem inventar ramificações', async () => {
    await open(raizFx)
    expect(screen.getByText(/encerrou no/)).toHaveTextContent('nó raiz'); expect(kpi('Nós explorados')).toHaveTextContent('1'); expect(kpi('Nós ramificados')).toHaveTextContent('0')
    expect(kpi('Situação final')).toHaveTextContent('Encerrado no nó raiz'); expect(kpi('Diferença contínuo × inteiro')).toHaveTextContent('0')
    const table = screen.getAllByRole('table').find((t) => within(t).queryByText('Restrições de ramificação acumuladas'))!
    expect(within(table).getAllByRole('row')).toHaveLength(2); expect(within(table).queryByText('Ramificado')).toBeNull()
  })
  it('limite de nós atingido: não declara otimalidade e mostra os nós não explorados', async () => {
    await open(limiteFx)
    expect(screen.getByText(/otimalidade inteira não está comprovada/)).toBeInTheDocument()
    expect(kpi('Situação final')).toHaveTextContent('Limite de nós atingido'); expect(kpi('Otimalidade inteira')).toHaveTextContent('Não comprovada')
    expect(kpi('Nós explorados')).toHaveTextContent('10'); expect(screen.getByText('Nós não explorados')).toBeInTheDocument()
    const pending = (limiteFx as unknown as SolveResponse & { integer: { branch_and_bound: { stats: { pending: number } } } }).integer.branch_and_bound.stats.pending
    expect(pending).toBeGreaterThan(0)
    expect(screen.getAllByText('Limite de nós atingido')).toHaveLength(1 + pending)         // KPI + um selo por nó pendente
    expect(screen.queryByText('Comprovada')).toBeNull(); expect(screen.queryByText(/ótimo comprovado/i)).toBeNull()
  })
  it('sem solução inteira viável: avisa e não monta a tabela do incumbente', async () => {
    await open(semFx)
    expect(screen.getByText(/sem encontrar solução inteira viável/)).toBeInTheDocument(); expect(kpi('Situação final')).toHaveTextContent('Sem solução inteira viável')
    expect(screen.queryByRole('heading', { name: 'Tabela Simplex da Solução Inteira Ótima' })).toBeNull(); expect(screen.getByText('nenhuma solução')).toBeInTheDocument()
  })
  it('resultado gerado pela v1.1 (sem detalhes) continua abrindo, com orientação para resolver de novo', async () => {
    await open(legacy(R), radio)
    expect(screen.getByText(/versão anterior do Simplexnator/)).toBeInTheDocument(); expect(screen.getByRole('heading', { name: 'Árvore de Branch and Bound' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Tabela de nós' })).toBeNull()
  })
})
