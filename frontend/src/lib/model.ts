import type { Problem } from './types'
import { dec, rel, sub } from './format'

export const LIMITS = { variables: 12, constraints: 20 } // devem coincidir com MAX_VARIABLES / MAX_CONSTRAINTS do backend

export interface Issues { errors: string[]; warnings: string[]; badNames: Set<number>; badBounds: Set<number> }

/** Validação do formulário antes de enviar ao motor. */
export function validate(p: Problem): Issues {
  const errors: string[] = [], warnings: string[] = []
  const badNames = new Set<number>(), badBounds = new Set<number>()
  const seen = new Map<string, number>()
  p.variables.forEach((v, j) => {
    const nm = v.name.trim()
    if (!nm) { errors.push(`A variável ${j + 1} precisa de um nome.`); badNames.add(j) }
    else if (nm.length > 24) { errors.push(`O nome “${nm}” excede 24 caracteres.`); badNames.add(j) }
    else if (seen.has(nm)) { errors.push(`O nome “${nm}” está repetido.`); badNames.add(j); badNames.add(seen.get(nm)!) }
    else seen.set(nm, j)
    if (v.lower !== null && v.upper !== null && v.lower > v.upper) { errors.push(`${nm || `Variável ${j + 1}`}: o limite inferior é maior que o superior.`); badBounds.add(j) }
  })
  if (p.variables.length > LIMITS.variables) errors.push(`O máximo é de ${LIMITS.variables} variáveis.`)
  if (p.constraints.length > LIMITS.constraints) errors.push(`O máximo é de ${LIMITS.constraints} restrições.`)
  if (p.objective.every((c) => c === 0)) warnings.push('A função objetivo está zerada: qualquer solução viável é ótima.')
  p.constraints.forEach((c, i) => {
    if (c.coefficients.every((a) => a === 0)) warnings.push(`${c.name || `Restrição ${i + 1}`} não possui variáveis.`)
  })
  return { errors, warnings, badNames, badBounds }
}

const term = (c: number, name: string, first: boolean) => {
  if (c === 0) return ''
  const mag = Math.abs(c), body = `${mag === 1 ? '' : dec(mag)}${name}`
  return first ? `${c < 0 ? '−' : ''}${body}` : ` ${c < 0 ? '−' : '+'} ${body}`
}
export const linear = (coefs: number[], names: string[]) => {
  let out = ''
  coefs.forEach((c, j) => { out += term(c, names[j], out === '') })
  return out || '0'
}
/** Texto da formulação para a prévia ao vivo. */
export function formulation(p: Problem): string[] {
  const names = p.variables.map((v) => v.name || '?')
  const lines = [`${p.sense === 'max' ? 'Maximizar' : 'Minimizar'}  Z = ${linear(p.objective, names)}`, 'sujeito a']
  p.constraints.forEach((c) => lines.push(`  ${linear(c.coefficients, names)} ${rel(c.relation)} ${dec(c.rhs)}`))
  const dom = p.variables.map((v, j) => {
    const nm = names[j]
    if (v.kind === 'binary') return `${nm} ∈ {0, 1}`
    const lo = v.lower === null ? '' : v.lower === 0 && v.upper === null ? `${nm} ≥ 0` : v.upper === null ? `${nm} ≥ ${dec(v.lower)}` : `${dec(v.lower)} ≤ ${nm} ≤ ${dec(v.upper)}`
    if (v.lower === null) return v.upper === null ? `${nm} livre` : `${nm} ≤ ${dec(v.upper)}`
    return lo + (v.kind === 'integer' ? ' (inteira)' : '')
  })
  lines.push(`  ${dom.join(',  ')}`)
  return lines
}
export const sizeLabel = (p: Problem) => `${p.variables.length} variáve${p.variables.length === 1 ? 'l' : 'is'} · ${p.constraints.length} restriç${p.constraints.length === 1 ? 'ão' : 'ões'}`
export const varLabel = (j: number) => `x${sub(String(j + 1))}`
