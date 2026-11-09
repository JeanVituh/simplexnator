import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NumInput } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { IterationViewer, TableauTable } from '@/components/IterationViewer'
import { AppProviders } from '@/App'
import type { SolveResponse } from '@/lib/types'
import radio from './fixtures/solve-radioterapico.json'

const r = radio as unknown as SolveResponse

describe('TableauTable', () => {
  const s = r.relaxation.iterations[0]
  it('mostra base, colunas, razões e destaca o pivô', () => {
    render(<TableauTable s={s} frac={false} />)
    expect(screen.getAllByText('a2').length).toBeGreaterThanOrEqual(2)       // coluna artificial e variável básica
    expect(screen.getByRole('columnheader', { name: s.entering! })).toHaveClass('bg-primary')
    const pivot = screen.getAllByRole('cell').find((c) => c.className.includes('bg-primary font-bold'))
    expect(pivot).toBeDefined()
  })
  it('alterna para frações exatas', () => {
    render(<TableauTable s={s} frac />)
    expect(screen.getAllByText('3/10').length).toBeGreaterThan(0)
  })
})

describe('IterationViewer', () => {
  it('navega entre as iterações da resolução', async () => {
    render(<AppProviders><IterationViewer iterations={r.relaxation.iterations} variables={r.relaxation.variables} /></AppProviders>)
    const total = r.relaxation.iterations.length
    expect(screen.getByText(r.relaxation.iterations[0].title)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Anterior/ })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: /Próxima/ }))
    expect(screen.getByText(r.relaxation.iterations[1].title)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Resolver tudo/ }))
    expect(screen.getByText(`passo ${total}/${total}`)).toBeInTheDocument()
    expect(screen.getByText('Passo final')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Reiniciar/ }))
    expect(screen.getByText(`passo 1/${total}`)).toBeInTheDocument()
  })
})

function Harness() {
  const [v, setV] = useState<number | null>(1)
  return (<><NumInput value={v} onChange={setV} allowEmpty label="campo" /><output data-testid="out">{String(v)}</output></>)
}
describe('NumInput', () => {
  it('aceita vírgula decimal, sinal negativo e campo vazio', async () => {
    render(<Harness />)
    const input = screen.getByLabelText('campo')
    await userEvent.clear(input)
    expect(screen.getByTestId('out').textContent).toBe('null')
    await userEvent.type(input, '-2,5')
    expect(screen.getByTestId('out').textContent).toBe('-2.5')
  })
})

describe('Segmented', () => {
  it('troca a opção selecionada', async () => {
    function H() { const [v, setV] = useState<'max' | 'min'>('max'); return <Segmented label="Objetivo" value={v} onChange={setV} options={[{ value: 'max', label: 'Maximizar' }, { value: 'min', label: 'Minimizar' }]} /> }
    render(<H />)
    expect(screen.getByRole('radio', { name: 'Maximizar' })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: 'Minimizar' }))
    expect(screen.getByRole('radio', { name: 'Minimizar' })).toBeChecked()
  })
})
