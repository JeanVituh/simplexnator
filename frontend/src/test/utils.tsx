import { useEffect, type ReactNode } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppProviders, AppRoutes } from '@/App'
import type { CloudBackend } from '@/lib/cloud'
import type { ProjectPayload } from '@/lib/project'
import type { Problem, SolveResponse } from '@/lib/types'
import { useApp } from '@/store'

export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

/** Restaura um projeto (modelo + resultado reais da API) no estado da aplicação, como a importação faz. */
function Loader({ payload, children }: { payload: ProjectPayload; children: ReactNode }) {
  const { restoreProject } = useApp()
  useEffect(() => { restoreProject(payload) }, [payload, restoreProject])
  return <>{children}</>
}

export function renderApp(path = '/', opts: { payload?: ProjectPayload; backend?: CloudBackend } = {}) {
  const tree = <MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>
  return render(<AppProviders backend={opts.backend}>{opts.payload ? <Loader payload={opts.payload}>{tree}</Loader> : tree}</AppProviders>)
}

export const payloadOf = (problem: Problem, result: SolveResponse | null, extra: Partial<ProjectPayload> = {}): ProjectPayload => ({ problem, method: 'bigm', integer: 'all', result, ...extra })

/** Resultado como a v1.1 o gravava: sem estatísticas nem detalhes de nós. */
export function legacy(result: SolveResponse): SolveResponse {
  const r = clone(result)
  const bb = (r.integer as unknown as { branch_and_bound: { nodes: Record<string, unknown>[] } & Record<string, unknown> }).branch_and_bound
  for (const k of ['stats', 'incumbent_node', 'incumbent_iterations', 'tableau_limit']) delete bb[k]
  bb.nodes.forEach((n) => { for (const k of ['constraints', 'bound', 'bounds', 'branch_value', 'floor', 'ceil', 'pivots', 'tableau']) delete n[k] })
  return r
}
