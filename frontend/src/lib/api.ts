import type { BBNode, Example, IntegerMode, Method, NodeIterations, Problem, SolveResponse } from './types'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

async function parse(res: Response) {
  if (res.ok) return res.json()
  let msg = `Erro ${res.status}`
  try {
    const body = await res.json()
    const d = body.detail
    msg = Array.isArray(d) ? d.map((e: { msg?: string }) => e.msg ?? '').join(' ') : String(d ?? msg)
  } catch { /* corpo não é JSON */ }
  throw new Error(msg)
}

export async function solveProblem(problem: Problem, method: Method, integer: IntegerMode): Promise<SolveResponse> {
  const res = await fetch(`${BASE}/api/solve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problem, method, integer }),
  }).catch(() => { throw new Error('Não foi possível conectar ao servidor de cálculo. Verifique se o backend está em execução.') })
  return parse(res)
}

export async function fetchExamples(): Promise<Example[]> {
  const res = await fetch(`${BASE}/api/examples`).catch(() => { throw new Error('Servidor de cálculo indisponível.') })
  return parse(res)
}

/** Iterações completas da relaxação de um nó do Branch and Bound (consulta sob demanda). */
export async function fetchNodeIterations(problem: Problem, node: BBNode, method: Method = 'bigm'): Promise<NodeIterations> {
  if (!node.bounds) throw new Error('Este resultado foi gerado por uma versão anterior. Resolva o problema novamente para consultar os nós.')
  const res = await fetch(`${BASE}/api/bb/node`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problem, method, lower: node.bounds.lower, upper: node.bounds.upper }),
  }).catch(() => { throw new Error('Não foi possível conectar ao servidor de cálculo. Verifique se o backend está em execução.') })
  return parse(res)
}
