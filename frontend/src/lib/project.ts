import type { IntegerMode, Kind, Method, Problem, Relation, SolveResponse } from './types'
import { LIMITS } from './model'

export const PROJECT_FORMAT = 'simplexnator-project'
export const PROJECT_VERSION = 2
export const MAX_FILE_BYTES = 25 * 1024 * 1024
export const MAX_JSON_BYTES = 10 * 1024 * 1024

export interface ProjectPayload { problem: Problem; method: Method; integer: IntegerMode; result: SolveResponse | null }

export class ImportError extends Error {}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const KINDS: Kind[] = ['continuous', 'integer', 'binary']
const RELS: Relation[] = ['<=', '>=', '=']

/** Valida e normaliza um problema (aceita o formato exportado pela v1.1 e pela v1.2). */
export function validateProblem(raw: unknown): Problem {
  if (!isObj(raw)) throw new ImportError('O arquivo não contém um problema de programação linear.')
  if (raw.sense !== 'max' && raw.sense !== 'min') throw new ImportError('Problema inválido: o objetivo deve ser “max” ou “min”.')
  if (!Array.isArray(raw.variables) || !Array.isArray(raw.constraints) || !Array.isArray(raw.objective)) throw new ImportError('Problema inválido: faltam variáveis, restrições ou função objetivo.')
  const n = raw.variables.length
  if (n < 1 || n > LIMITS.variables) throw new ImportError(`Problema inválido: o número de variáveis deve estar entre 1 e ${LIMITS.variables}.`)
  if (raw.constraints.length < 1 || raw.constraints.length > LIMITS.constraints) throw new ImportError(`Problema inválido: o número de restrições deve estar entre 1 e ${LIMITS.constraints}.`)
  if (raw.objective.length !== n || !raw.objective.every(isNum)) throw new ImportError('Problema inválido: a função objetivo deve ter um coeficiente numérico por variável.')
  const names = new Set<string>()
  const variables = raw.variables.map((v, j) => {
    if (!isObj(v) || typeof v.name !== 'string' || !v.name.trim() || v.name.length > 24) throw new ImportError(`Variável ${j + 1} sem nome válido (até 24 caracteres).`)
    if (names.has(v.name)) throw new ImportError(`Nome de variável repetido: ${v.name}.`)
    names.add(v.name)
    const kind = (v.kind ?? 'continuous') as Kind
    if (!KINDS.includes(kind)) throw new ImportError(`Tipo de variável inválido em ${v.name}.`)
    const lower = v.lower === undefined ? 0 : v.lower, upper = v.upper === undefined ? null : v.upper
    if ((lower !== null && !isNum(lower)) || (upper !== null && !isNum(upper))) throw new ImportError(`Limites inválidos em ${v.name}.`)
    if (lower !== null && upper !== null && lower > upper) throw new ImportError(`Limite inferior maior que o superior em ${v.name}.`)
    return kind === 'binary' ? { name: v.name, kind, lower: 0, upper: 1 } : { name: v.name, kind, lower: lower as number | null, upper: upper as number | null }
  })
  const constraints = raw.constraints.map((c, i) => {
    if (!isObj(c) || !Array.isArray(c.coefficients) || c.coefficients.length !== n || !c.coefficients.every(isNum)) throw new ImportError(`Restrição ${i + 1}: deve haver um coeficiente numérico por variável.`)
    if (!RELS.includes(c.relation as Relation)) throw new ImportError(`Restrição ${i + 1}: relação inválida.`)
    if (!isNum(c.rhs)) throw new ImportError(`Restrição ${i + 1}: lado direito inválido.`)
    return { name: typeof c.name === 'string' && c.name.trim() ? c.name.slice(0, 120) : `R${i + 1}`, coefficients: [...c.coefficients] as number[], relation: c.relation as Relation, rhs: c.rhs }
  })
  return { name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.slice(0, 120) : 'Problema importado', sense: raw.sense, objective: [...raw.objective] as number[], variables, constraints }
}

/** Verificação superficial de que um resultado salvo corresponde ao problema (mesmas variáveis e blocos esperados). */
export function isCompatibleResult(r: unknown, p: Problem): r is SolveResponse {
  if (!isObj(r) || !isObj(r.relaxation) || !Array.isArray(r.variables)) return false
  const rel = r.relaxation
  if (!['optimal', 'infeasible', 'unbounded'].includes(String(rel.status)) || !Array.isArray(rel.iterations)) return false
  if (r.variables.length !== p.variables.length || !r.variables.every((v, i) => v === p.variables[i].name)) return false
  return isObj(r.dual) && isObj(r.multiple) && isObj(r.sensitivity) && isObj(r.formulation) && isObj(r.standard_form) && isObj(r.integer)
}

export function buildProjectFile({ problem, method, integer, result }: ProjectPayload) {
  return { format: PROJECT_FORMAT, version: PROJECT_VERSION, app: 'Simplexnator', exportedAt: new Date().toISOString(), name: problem.name,
    problem, settings: { method, integer }, result }
}

/** Interpreta um objeto JSON: v1.1 (`{problem}`, `{problem,result}`, ou o próprio problema) ou v1.2 (`format: simplexnator-project`). */
export function parseProjectFile(data: unknown): { payload: ProjectPayload; warnings: string[] } {
  if (!isObj(data)) throw new ImportError('O arquivo não contém um projeto do Simplexnator.')
  if (data.format === PROJECT_FORMAT && isNum(data.version) && data.version > PROJECT_VERSION) throw new ImportError('Este arquivo foi criado por uma versão mais nova do Simplexnator.')
  const rawProblem = isObj(data.problem) ? data.problem : 'sense' in data ? data : null
  if (!rawProblem) throw new ImportError('O arquivo não contém um problema de programação linear.')
  const problem = validateProblem(rawProblem)
  const warnings: string[] = []
  const s = isObj(data.settings) ? data.settings : data
  const method: Method = s.method === 'twophase' ? 'twophase' : 'bigm'
  const integer: IntegerMode = s.integer === 'none' || s.integer === 'marked' ? s.integer : 'all'
  let result: SolveResponse | null = null
  if (data.result !== undefined && data.result !== null) {
    if (isCompatibleResult(data.result, problem)) result = data.result
    else warnings.push('Os resultados salvos não são compatíveis com o modelo e foram ignorados. Resolva o problema novamente.')
  }
  return { payload: { problem, method, integer, result }, warnings }
}

export function parseJsonText(text: string) {
  if (text.length > MAX_JSON_BYTES) throw new ImportError('O arquivo JSON é grande demais (limite de 10 MB).')
  let data: unknown
  try { data = JSON.parse(text) } catch { throw new ImportError('O arquivo não é um JSON válido.') }
  return parseProjectFile(data)
}
