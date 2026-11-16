import { buildProjectFile, ImportError, isCompatibleResult, parseJsonText, parseProjectFile, PROJECT_FORMAT, validateProblem } from '@/lib/project'
import type { Problem, SolveResponse } from '@/lib/types'
import examples from './fixtures/examples.json'
import radioFx from './fixtures/solve-radioterapico.json'

const radio = examples.find((e) => e.id === 'radioterapico')!.problem as Problem
const result = radioFx as unknown as SolveResponse
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

/** Resultado como a versão 1.1 o gravava: sem estatísticas, tableaus por nó nem estrutura detalhada. */
function legacyResult(): SolveResponse {
  const r = clone(result) as SolveResponse & { integer: { branch_and_bound: Record<string, unknown> } }
  const bb = r.integer.branch_and_bound as { nodes: Record<string, unknown>[] } & Record<string, unknown>
  for (const k of ['stats', 'incumbent_node', 'incumbent_iterations', 'tableau_limit']) delete bb[k]
  bb.nodes.forEach((n) => { for (const k of ['constraints', 'bound', 'bounds', 'branch_value', 'floor', 'ceil', 'pivots', 'tableau']) delete n[k] })
  return r
}

describe('importação de JSON', () => {
  it('aceita o JSON da v1.1 que continha apenas o problema', () => {
    const { payload, warnings } = parseProjectFile({ problem: radio })
    expect(payload.problem).toEqual(radio); expect(payload.result).toBeNull(); expect(payload.method).toBe('bigm'); expect(payload.integer).toBe('all'); expect(warnings).toEqual([])
  })
  it('aceita o JSON da v1.1 com problema e resultado (resultado antigo, sem detalhes do B&B)', () => {
    const { payload } = parseProjectFile({ problem: radio, result: legacyResult() })
    expect(payload.result?.relaxation.z?.frac).toBe('21/4')
    expect(payload.result && 'stats' in (payload.result.integer as object & { branch_and_bound: object }).branch_and_bound).toBe(false)
  })
  it('aceita um problema solto (sem envelope)', () => { expect(parseProjectFile(radio).payload.problem.name).toBe(radio.name) })
  it('aceita e restaura o formato novo (ida e volta)', () => {
    const file = buildProjectFile({ problem: radio, method: 'twophase', integer: 'marked', result })
    expect(file.format).toBe(PROJECT_FORMAT); expect(file.version).toBe(2)
    const { payload } = parseProjectFile(JSON.parse(JSON.stringify(file)))
    expect(payload.problem).toEqual(radio); expect(payload.method).toBe('twophase'); expect(payload.integer).toBe('marked'); expect(payload.result).toEqual(result)
  })
  it('o formato novo continua legível por quem espera { problem, result } (compatibilidade com a v1.1)', () => {
    const file = buildProjectFile({ problem: radio, method: 'bigm', integer: 'all', result }) as Record<string, unknown>
    expect(file.problem).toEqual(radio); expect(file.result).toEqual(result)
  })
  it('ignora, com aviso, resultados incompatíveis com o modelo', () => {
    const other = clone(radio); other.variables[0].name = 'y1'
    const { payload, warnings } = parseProjectFile({ problem: other, result })
    expect(payload.result).toBeNull(); expect(warnings.join()).toMatch(/não são compatíveis/)
    expect(isCompatibleResult({ foo: 1 }, radio)).toBe(false)
  })
})

describe('rejeição de arquivos inválidos', () => {
  const bad = (mut: (p: Problem & Record<string, unknown>) => void) => { const p = clone(radio) as Problem & Record<string, unknown>; mut(p); return () => validateProblem(p) }
  it('textos que não são JSON ou não são objetos', () => {
    expect(() => parseJsonText('isto não é json')).toThrow(/JSON válido/)
    expect(() => parseJsonText('[1,2,3]')).toThrow(ImportError); expect(() => parseJsonText('42')).toThrow(ImportError)
    expect(() => parseJsonText('{"foo": 1}')).toThrow(/problema/)
  })
  it('problemas malformados', () => {
    expect(bad((p) => { p.sense = 'x' as never })).toThrow(/objetivo/)
    expect(bad((p) => { p.objective = [1] })).toThrow(/coeficiente/)
    expect(bad((p) => { p.objective[0] = '1' as never })).toThrow(/coeficiente/)
    expect(bad((p) => { p.variables[1].name = p.variables[0].name })).toThrow(/repetido/)
    expect(bad((p) => { p.variables[0].name = '' })).toThrow(/sem nome/)
    expect(bad((p) => { p.variables[0].kind = 'zzz' as never })).toThrow(/Tipo/)
    expect(bad((p) => { p.variables[0].lower = 5; p.variables[0].upper = 1 })).toThrow(/Limite inferior/)
    expect(bad((p) => { p.constraints[0].relation = '<' as never })).toThrow(/relação/)
    expect(bad((p) => { p.constraints[0].coefficients = [1] })).toThrow(/coeficiente/)
    expect(bad((p) => { p.constraints[0].rhs = 'a' as never })).toThrow(/lado direito/)
    expect(bad((p) => { p.constraints = [] })).toThrow(/restrições/)
    expect(bad((p) => { p.variables = Array.from({ length: 13 }, (_, i) => ({ name: `v${i}`, kind: 'continuous' as const, lower: 0, upper: null })); p.objective = Array(13).fill(1) })).toThrow(/variáveis/)
  })
  it('arquivo de versão mais nova', () => {
    expect(() => parseProjectFile({ format: PROJECT_FORMAT, version: 99, problem: radio })).toThrow(/versão mais nova/)
  })
  it('normaliza variáveis binárias para limites 0 e 1', () => {
    const p = clone(radio); p.variables[0] = { name: 'b', kind: 'binary', lower: 7, upper: 9 }
    expect(validateProblem(p).variables[0]).toMatchObject({ lower: 0, upper: 1 })
  })
})
