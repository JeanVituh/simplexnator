/**
 * Integração real: monta a aplicação e conversa com o FastAPI em execução.
 * Uso: iniciar o backend e executar  VITE_API_URL=http://127.0.0.1:8000 npm run test:integration
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppProviders, AppRoutes } from '@/App'
import type { SolveResponse } from '@/lib/types'

vi.mock('@/components/PlotGraph', () => ({ default: () => <div data-testid="plot" /> }))
const API = import.meta.env.VITE_API_URL as string | undefined
const link = (name: string) => screen.getAllByRole('link', { name })[0]

describe.skipIf(!API)('integração frontend ↔ backend (servidor real)', () => {
  // Aguarda o servidor responder (até 30 s); se não subir, falha com uma mensagem clara em vez de um erro de conexão confuso.
  beforeAll(async () => {
    const t0 = Date.now()
    for (;;) {
      try { if ((await fetch(`${API}/api/health`)).ok) return } catch { /* ainda subindo */ }
      if (Date.now() - t0 > 30000) throw new Error(`O backend não respondeu em ${API}/api/health. Inicie o FastAPI antes de rodar a integração.`)
      await new Promise((r) => setTimeout(r, 500))
    }
  }, 35000)

  it('resolve o Problema Radioterápico pela interface e confere com a resposta do servidor', async () => {
    const examples = await (await fetch(`${API}/api/examples`)).json()
    const radio = examples.find((e: { id: string }) => e.id === 'radioterapico')
    const direct: SolveResponse = await (await fetch(`${API}/api/solve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ problem: radio.problem, method: 'bigm', integer: 'all' }),
    })).json()

    render(<AppProviders><MemoryRouter><AppRoutes /></MemoryRouter></AppProviders>)
    const heading = await screen.findByRole('heading', { name: 'Problema Radioterápico' })
    await userEvent.click(within(heading.closest('div.flex-col') as HTMLElement).getByRole('button', { name: /Carregar e resolver/ }))
    expect(await screen.findByText('Solução ótima encontrada', {}, { timeout: 20000 })).toBeInTheDocument()

    await userEvent.click(link('Resultados'))
    await screen.findByRole('heading', { name: 'Resultados' })
    const z = String(direct.relaxation.z!.value).replace('.', ',')
    expect(screen.getAllByText(z).length).toBeGreaterThan(0)
    const zi = String((direct.integer as { branch_and_bound: { incumbent: { z: { value: number } } } }).branch_and_bound.incumbent.z.value).replace('.', ',')
    expect(screen.getAllByText(zi).length).toBeGreaterThan(0)

    await userEvent.click(link('Solução inteira'))
    await screen.findByRole('heading', { name: 'Solução inteira' })
    expect(screen.getAllByText('(8; 5)').length).toBeGreaterThan(0)
    expect(screen.getAllByText('(7; 5)').length).toBeGreaterThan(0)
  })

  it('exibe os mesmos valores recalculados após editar um parâmetro', async () => {
    render(<AppProviders><MemoryRouter initialEntries={['/']}><AppRoutes /></MemoryRouter></AppProviders>)
    const heading = await screen.findByRole('heading', { name: 'Problema Radioterápico' })
    await userEvent.click(within(heading.closest('div.flex-col') as HTMLElement).getByRole('button', { name: 'Carregar exemplo' }))
    const rhs = await screen.findByLabelText('Lado direito de Região do tumor')
    await userEvent.clear(rhs); await userEvent.type(rhs, '7')
    await userEvent.click(screen.getByRole('button', { name: 'Resolver modelo' }))
    expect(await screen.findByText('Solução ótima encontrada', {}, { timeout: 20000 })).toBeInTheDocument()
    await userEvent.click(link('Resultados'))
    await screen.findByRole('heading', { name: 'Resultados' })
    // Região do tumor = 7: x1 + x2 = 14 e x1 ≤ 6,5 (tecidos críticos) → ótimo em x = (6,5; 7,5), calculado pelo motor
    expect(screen.getAllByText('6,5').length).toBeGreaterThan(0)
  })
})
