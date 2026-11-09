import type { Num } from './types'

/** Decimal em pt-BR (vírgula), até 4 casas. */
export const dec = (v: number, nd = 4) => {
  const s = Number(v.toFixed(nd)).toString()
  return (s === '-0' ? '0' : s).replace('.', ',')
}
/** Converte textos decimais do backend (ponto) para pt-BR; frações permanecem como estão. */
export const br = (s: string) => s.replace(/\./g, ',')
export const fmtNum = (n: Num | null | undefined, frac: boolean) => (n == null ? '—' : frac ? n.frac : dec(n.value))
export const sub = (s: string) => s.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])
export const rel = (r: string) => (r === '<=' ? '≤' : r === '>=' ? '≥' : '=')
export const point = (xs: Num[], frac: boolean) => `(${xs.map((x) => fmtNum(x, frac)).join('; ')})`
