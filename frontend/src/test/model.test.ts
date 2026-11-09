import { formulation, validate } from '@/lib/model'
import { emptyProblem } from '@/store'
import type { Problem } from '@/lib/types'
import examples from './fixtures/examples.json'

const base = (): Problem => ({
  name: 't', sense: 'min', objective: [0.4, 0.5],
  variables: [{ name: 'x1', kind: 'continuous', lower: 0, upper: null }, { name: 'x2', kind: 'continuous', lower: 0, upper: null }],
  constraints: [{ name: 'R1', coefficients: [0.3, 0.1], relation: '<=', rhs: 2.7 }],
})

describe('validação do formulário', () => {
  it('aceita um modelo correto', () => { const v = validate(base()); expect(v.errors).toEqual([]); expect(v.warnings).toEqual([]) })
  it('detecta nomes vazios, repetidos e longos', () => {
    const p = base(); p.variables[1].name = 'x1'
    expect(validate(p).errors.join()).toMatch(/repetido/)
    p.variables[1].name = '  '; expect(validate(p).errors.join()).toMatch(/precisa de um nome/)
    p.variables[1].name = 'a'.repeat(25); expect(validate(p).errors.join()).toMatch(/24 caracteres/)
  })
  it('detecta limite inferior maior que o superior', () => {
    const p = base(); p.variables[0].lower = 5; p.variables[0].upper = 2
    const v = validate(p); expect(v.errors.join()).toMatch(/limite inferior é maior/); expect(v.badBounds.has(0)).toBe(true)
  })
  it('avisa objetivo zerado e restrição sem variáveis', () => {
    const v = validate(emptyProblem()); expect(v.warnings.length).toBe(2)
  })
})

describe('formulação', () => {
  it('descreve o Problema Radioterápico do exemplo cadastrado', () => {
    const radio = examples.find((e) => e.id === 'radioterapico')!.problem as Problem
    const f = formulation(radio)
    expect(f[0]).toBe('Minimizar  Z = 0,4x1 + 0,5x2')
    expect(f).toContain('  0,5x1 + 0,5x2 = 6'); expect(f).toContain('  0,6x1 + 0,4x2 ≥ 6')
  })
  it('descreve limites e tipos das variáveis', () => {
    const p = base(); p.variables[0] = { name: 'a', kind: 'binary', lower: 0, upper: 1 }; p.variables[1] = { name: 'b', kind: 'integer', lower: null, upper: null }
    expect(formulation(p).at(-1)).toContain('a ∈ {0, 1}'); expect(formulation(p).at(-1)).toContain('b livre')
  })
})
