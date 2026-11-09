import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppProviders, AppRoutes } from '@/App'
import examples from './fixtures/examples.json'
import radio from './fixtures/solve-radioterapico.json'

vi.mock('@/components/PlotGraph', () => ({ default: () => <div data-testid="plot" /> }))

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const solveCalls: unknown[] = []

beforeEach(() => {
  solveCalls.length = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/examples')) return json(examples)
    if (url.endsWith('/api/solve')) { solveCalls.push(JSON.parse(String(init?.body))); return json(radio) }
    return json({}, 404)
  }))
})
afterEach(() => vi.unstubAllGlobals())

const open = (path = '/') => render(<AppProviders><MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter></AppProviders>)
const link = (name: string) => screen.getAllByRole('link', { name })[0]
const BANNED = /figma|protótipo|conferir enunciado|claude|anthropic|inteligência artificial/i

describe('Home', () => {
  it('apresenta o título, o subtítulo e os cinco blocos do fluxo', async () => {
    open()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Resolva problemas de programação linear com o Método Simplex.')
    expect(screen.getByText(/Modele seus problemas, acompanhe cada iteração/)).toBeInTheDocument()
    for (const t of ['Modelagem', 'Simplex Tabular', 'Gráficos', 'Solução Inteira', 'Dual e Soluções Múltiplas']) expect(screen.getByRole('heading', { name: t })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Novo problema/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver exemplos' })).toBeInTheDocument()
    await screen.findByRole('heading', { name: 'Problema Radioterápico' })
  })
  it('lista os sete exemplos, com um único Problema Radioterápico e sem textos internos', async () => {
    open()
    await screen.findByRole('heading', { name: 'Problema Radioterápico' })
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    for (const t of ['Problema Radioterápico', 'Produção com solução inteira diferente do arredondamento', 'Soluções ótimas múltiplas', 'Mix de produção com três variáveis', 'Mochila binária', 'Problema inviável', 'Problema ilimitado']) expect(titles).toContain(t)
    expect(titles.filter((t) => /radiot/i.test(t ?? ''))).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Carregar exemplo' })).toHaveLength(7)
    expect(document.body.textContent).not.toMatch(BANNED)
  })
  it('mostra mensagem e permite nova tentativa quando o servidor está indisponível', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    open()
    expect(await screen.findByRole('button', { name: /Tentar novamente/ })).toBeInTheDocument()
  })
})

describe('Navegação', () => {
  it('percorre as páginas pelo menu', async () => {
    open()
    for (const [name, heading] of [['Entrada', 'Entrada do problema'], ['Resolução', 'Nenhum problema resolvido'], ['Gráficos', 'Nada para exibir'], ['Solução inteira', 'Nenhuma solução inteira ainda'],
      ['Dual', 'Dual indisponível'], ['Resultados', 'Sem resultados'], ['Projetos', 'Projetos e histórico'], ['Início', 'Resolva problemas de programação linear com o Método Simplex.']] as const) {
      await userEvent.click(link(name))
      expect(await screen.findByRole('heading', { level: name === 'Início' ? 1 : undefined, name: heading })).toBeInTheDocument()
    }
  })
  it('alterna o tema escuro', async () => {
    open()
    const before = document.documentElement.classList.contains('dark')
    await userEvent.click(screen.getAllByRole('button', { name: 'Alternar tema' })[0])
    expect(document.documentElement.classList.contains('dark')).toBe(!before)
  })
})

describe('Fluxo completo: exemplo → resolução → resultados', () => {
  it('carrega e resolve o Problema Radioterápico e exibe o que o backend retornou', async () => {
    open()
    const card = (await screen.findByRole('heading', { name: 'Problema Radioterápico' })).closest('div.p-6, div')!.parentElement!.parentElement!
    await userEvent.click(within(card as HTMLElement).getByRole('button', { name: /Carregar e resolver/ }))
    expect(await screen.findByRole('heading', { name: 'Resolução pelo Simplex tabular' })).toBeInTheDocument()
    expect(screen.getByText('Solução ótima encontrada')).toBeInTheDocument()
    expect(solveCalls).toHaveLength(1)
    const sent = solveCalls[0] as { problem: { sense: string; objective: number[]; constraints: { relation: string }[] } }
    expect(sent.problem.sense).toBe('min'); expect(sent.problem.objective).toEqual([0.4, 0.5]); expect(sent.problem.constraints.map((c) => c.relation)).toEqual(['<=', '=', '>='])

    await userEvent.click(link('Resultados'))
    await screen.findByRole('heading', { name: 'Resultados' })
    expect(screen.getAllByText('5,25').length).toBeGreaterThan(0)          // Z* contínuo
    expect(screen.getAllByText('5,3').length).toBeGreaterThan(0)           // Z inteiro ótimo
    expect(screen.getAllByText('7,5').length).toBeGreaterThan(0)
    expect(screen.getByText('Dualidade forte (Z = W)')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(BANNED)

    await userEvent.click(link('Solução inteira'))
    await screen.findByRole('heading', { name: 'Solução inteira' })
    expect(screen.getAllByText('(8; 5)').length).toBeGreaterThan(0)         // arredondamento simples
    expect(screen.getAllByText('inviável').length).toBeGreaterThan(0)
    expect(screen.getAllByText('(7; 5)').length).toBeGreaterThan(0)         // inteira ótima
    expect(screen.getByText(/Consistente com a relaxação/)).toBeInTheDocument()

    await userEvent.click(link('Dual'))
    await screen.findByRole('heading', { name: 'Problema dual' })
    expect(screen.getByText('Z = W confirmado')).toBeInTheDocument()

    await userEvent.click(link('Gráficos'))
    await waitFor(() => expect(screen.getByTestId('plot')).toBeInTheDocument())
  })

  it('carrega o exemplo na Entrada e permite editar parâmetros e resolver novamente', async () => {
    open()
    const heading = await screen.findByRole('heading', { name: 'Problema Radioterápico' })
    await userEvent.click(within(heading.closest('div.flex-col') as HTMLElement).getByRole('button', { name: 'Carregar exemplo' }))
    await screen.findByRole('heading', { name: 'Entrada do problema' })
    const rhs = screen.getByLabelText('Lado direito de Região do tumor')
    expect(rhs).toHaveValue('6')
    await userEvent.clear(rhs); await userEvent.type(rhs, '7')
    expect(screen.getByLabelText('Formulação do modelo')).toHaveTextContent('0,5x1 + 0,5x2 = 7')
    await userEvent.click(screen.getByRole('button', { name: 'Resolver modelo' }))
    await screen.findByRole('heading', { name: 'Resolução pelo Simplex tabular' })
    expect((solveCalls[0] as { problem: { constraints: { rhs: number }[] } }).problem.constraints[1].rhs).toBe(7)
  })
})

describe('Entrada: validação e edição', () => {
  it('bloqueia a resolução com nomes repetidos e informa o erro', async () => {
    open('/entrada')
    const names = screen.getAllByLabelText(/Nome da variável/)
    await userEvent.clear(names[1]); await userEvent.type(names[1], 'x1')
    expect(screen.getByText(/está repetido/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resolver modelo' })).toBeDisabled()
  })
  it('adiciona e remove variáveis e restrições; as tabelas se atualizam', async () => {
    open('/entrada')
    await userEvent.click(screen.getByRole('button', { name: /Variável/ }))
    expect(screen.getAllByLabelText(/Nome da variável/)).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: /Restrição/ }))
    expect(screen.getAllByLabelText(/Nome da restrição/)).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Remover variável x3' }))
    expect(screen.getAllByLabelText(/Nome da variável/)).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Remover R2' }))
    expect(screen.getAllByLabelText(/Nome da restrição/)).toHaveLength(1)
  })
  it('exibe erro do servidor sem travar a página', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ detail: 'Modelo recusado.' }, 422)))
    open('/entrada')
    await userEvent.click(screen.getByRole('button', { name: 'Resolver modelo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Modelo recusado.')
  })
})
