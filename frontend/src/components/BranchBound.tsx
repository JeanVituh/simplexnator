import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react'
import { fetchNodeIterations } from '@/lib/api'
import { br, fmtNum, point } from '@/lib/format'
import type { BBDecision, BBNode, BBStats, BranchAndBound, NodeIterations, Problem, Sense } from '@/lib/types'
import { IterationViewer, Stat, TableauTable } from '@/components/IterationViewer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useApp } from '@/store'

type Tone = 'default' | 'success' | 'danger' | 'warn' | 'muted'
export const DECISION_META: Record<BBDecision, { tone: Tone; label: string; bar: string }> = {
  branched: { tone: 'default', label: 'Ramificado', bar: 'border-l-primary' },
  integer: { tone: 'success', label: 'Solução inteira', bar: 'border-l-success' },
  infeasible: { tone: 'danger', label: 'Inviável', bar: 'border-l-danger' },
  unbounded: { tone: 'danger', label: 'Ilimitado', bar: 'border-l-danger' },
  pruned_bound: { tone: 'warn', label: 'Podado por limite', bar: 'border-l-warn' },
  node_limit: { tone: 'muted', label: 'Limite de nós atingido', bar: 'border-l-muted-foreground' },
}
const STATUS_LABEL: Record<string, string> = { optimal: 'ótima', infeasible: 'inviável', unbounded: 'ilimitada' }
const FINAL_LABEL = { root_integral: 'Encerrado no nó raiz', proven: 'Busca concluída', node_limit: 'Limite de nós atingido', no_integer: 'Sem solução inteira viável' } as const

const Kpi = ({ label, value, sub, tone, text }: { label: string; value: string; sub?: string; tone?: 'success' | 'warn' | 'danger'; text?: boolean }) => (
  <div className="rounded-xl border bg-card p-3.5 shadow-card">
    <p className="kbd-label">{label}</p>
    <p className={cn('mt-1 font-mono font-semibold tabular-nums tracking-tight', text ? 'whitespace-normal text-base leading-snug' : 'truncate text-xl', tone === 'success' && 'text-success', tone === 'warn' && 'text-warn', tone === 'danger' && 'text-danger')}>{value}</p>
    {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
  </div>
)

export function BBBanner({ stats, nodeLimit }: { stats: BBStats; nodeLimit: number }) {
  if (stats.final_status === 'root_integral') return <Banner tone="success" icon={CheckCircle2}>O algoritmo encerrou no <b>nó raiz</b>: a relaxação linear já é inteira, portanto nenhuma ramificação foi necessária e o ótimo inteiro coincide com o contínuo.</Banner>
  if (stats.final_status === 'node_limit') return <Banner tone="warn" icon={AlertTriangle}>Limite de {nodeLimit} nós atingido: a busca foi interrompida e <b>a otimalidade inteira não está comprovada</b>. {stats.incumbent_z ? 'A melhor solução encontrada é apenas viável.' : 'Nenhuma solução inteira foi encontrada até o momento.'} {stats.pending > 0 && `${stats.pending} nó(s) ficaram sem explorar.`}</Banner>
  if (stats.final_status === 'no_integer') return <Banner tone="danger" icon={XCircle}>A busca terminou sem encontrar solução inteira viável: o problema é viável nos reais, mas não possui solução com as variáveis inteiras exigidas.</Banner>
  return null
}
const Banner = ({ tone, icon: Icon, children }: { tone: 'success' | 'warn' | 'danger'; icon: typeof Info; children: React.ReactNode }) => (
  <div role="status" className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', tone === 'success' && 'border-success/30 bg-success-soft text-success', tone === 'warn' && 'border-warn/30 bg-warn-soft text-warn', tone === 'danger' && 'border-danger/30 bg-danger-soft text-danger')}><Icon size={18} className="mt-0.5 shrink-0" /><p className="leading-relaxed">{children}</p></div>
)

/** Indicadores numéricos calculados pela execução real do Branch and Bound. */
export function BBIndicators({ bb, sense, frac, compact }: { bb: BranchAndBound; sense: Sense; frac: boolean; compact?: boolean }) {
  const s = bb.stats
  if (!s) return null
  const inc = bb.incumbent
  return (
    <div className="space-y-4">
      <BBBanner stats={s} nodeLimit={bb.node_limit} />
      <div className={cn('grid gap-3 sm:grid-cols-2', compact ? 'lg:grid-cols-4' : 'lg:grid-cols-4 xl:grid-cols-5')}>
        <Kpi label="Nós explorados" value={String(s.explored)} />
        <Kpi label="Nós ramificados" value={String(s.branched)} />
        <Kpi label="Nós inviáveis" value={String(s.infeasible + s.unbounded)} />
        <Kpi label="Podados por limite" value={String(s.pruned_bound)} />
        <Kpi label="Soluções inteiras" value={String(s.integer_nodes)} tone={s.integer_nodes > 0 ? 'success' : undefined} />
        <Kpi label="Profundidade máxima" value={String(s.max_depth)} />
        <Kpi label="Pivôs Simplex (nós)" value={String(s.total_pivots)} sub="soma das relaxações" />
        <Kpi label="Relaxação na raiz (Z)" value={fmtNum(s.root_z, frac)} sub={sense === 'min' ? 'limite inferior' : 'limite superior'} />
        <Kpi label="Melhor Z inteiro" value={fmtNum(s.incumbent_z, frac)} sub={inc ? `x = ${point(inc.x, frac)}` : 'nenhuma solução'} tone={inc ? 'success' : 'danger'} />
        <Kpi label="Diferença contínuo × inteiro" value={fmtNum(s.gap, frac)} sub="|Z inteiro − Z da raiz|" />
        {!compact && <Kpi text label="Situação final" value={FINAL_LABEL[s.final_status]} tone={s.final_status === 'node_limit' ? 'warn' : s.final_status === 'no_integer' ? 'danger' : 'success'} />}
        {!compact && <Kpi text label="Otimalidade inteira" value={s.proven_optimal ? 'Comprovada' : 'Não comprovada'} tone={s.proven_optimal ? 'success' : 'warn'} />}
        {s.pending > 0 && <Kpi label="Nós não explorados" value={String(s.pending)} tone="warn" />}
      </div>
      {!compact && <p className="text-xs leading-relaxed text-muted-foreground">Regra de ramificação: {s.branching_rule}. Ordem: {s.search_order}. Cada ramificação é uma restrição de limite na variável (não é plano de corte).</p>}
    </div>
  )
}

const StatusChip = ({ status }: { status: string | null }) => status ? <Badge variant={status === 'optimal' ? 'success' : 'danger'}>{STATUS_LABEL[status] ?? status}</Badge> : <Badge variant="muted">não resolvida</Badge>

/** Tabela completa dos nós + painel de detalhe (tableau final e, sob demanda, todas as iterações). */
export function BBNodeTable({ bb, problem, frac }: { bb: BranchAndBound; problem: Problem | null; frac: boolean }) {
  const [sel, setSel] = useState<number | null>(bb.incumbent_node ?? null)
  const [loaded, setLoaded] = useState<Record<number, NodeIterations>>({})
  const [busy, setBusy] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const node = bb.nodes.find((n) => n.id === sel) ?? null

  const load = async (n: BBNode) => {
    if (!problem) return
    setBusy(n.id); setErr(null)
    try { const it = await fetchNodeIterations(problem, n); setLoaded((l) => ({ ...l, [n.id]: it })) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Não foi possível consultar o nó.') }
    finally { setBusy(null) }
  }
  const th = 'whitespace-nowrap'
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-lg border">
        <table className="tbl tbl-plain">
          <thead><tr>
            {['Nó', 'Nó pai', 'Prof.', 'Restrições de ramificação acumuladas', 'Variável de ramificação', 'Valor fracionário', 'Limite inteiro', 'Z da relaxação', 'Solução relaxada (x)', 'Pivôs', 'Situação', 'Decisão', 'Motivo de encerramento'].map((h) => <th key={h} className={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {bb.nodes.map((n) => {
              const d = n.decision ? DECISION_META[n.decision] : null
              return (
                <tr key={n.id} className={cn('cursor-pointer transition-colors hover:bg-muted/40', sel === n.id && 'bg-primary-soft/60')} onClick={() => setSel(n.id)}>
                  <th className="text-left"><button type="button" className="font-mono font-semibold underline-offset-2 hover:underline" aria-pressed={sel === n.id} onClick={() => setSel(n.id)}>{n.id}</button></th>
                  <td>{n.parent ?? '—'}</td><td>{n.depth}</td>
                  <td className="text-left font-mono text-xs">{n.constraints?.length ? n.constraints.join(' ∧ ') : n.parent === null ? 'nenhuma (raiz)' : n.branch}</td>
                  <td className="font-mono">{n.branch_var ?? '—'}</td>
                  <td className="font-mono">{n.branch_value ? fmtNum(n.branch_value, frac) : '—'}</td>
                  <td className="text-left font-mono text-xs">{n.branch_var && n.floor != null ? `${n.branch_var} ≤ ${n.floor}  |  ${n.branch_var} ≥ ${n.ceil}` : '—'}</td>
                  <td className="font-mono">{fmtNum(n.z, frac)}</td>
                  <td className="font-mono">{n.x ? point(n.x, frac) : '—'}</td>
                  <td>{n.status ? (n.pivots ?? n.iterations ?? '—') : '—'}</td>
                  <td><StatusChip status={n.status} /></td>
                  <td>{d ? <Badge variant={d.tone}>{d.label}</Badge> : '—'}</td>
                  <td className="max-w-[320px] whitespace-normal text-left text-[13px] font-sans text-muted-foreground">{br(n.note)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {node ? (
        <Section title={`Nó ${node.id}${node.parent === null ? ' (raiz)' : ''}`} description={node.constraints?.length ? `Restrições: ${node.constraints.join(' ∧ ')}` : 'Relaxação do problema original, sem restrições de ramificação.'}
          actions={node.decision ? <Badge variant={DECISION_META[node.decision].tone}>{DECISION_META[node.decision].label}</Badge> : undefined}>
          {node.status === null ? <p className="text-sm text-muted-foreground">Este nó não foi resolvido porque o limite de nós foi atingido antes de sua exploração.</p> : (
            <div className="space-y-4">
              <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
                <Stat k="Situação da relaxação" v={STATUS_LABEL[node.status] ?? node.status} /><Stat k="Z" v={fmtNum(node.z, frac)} strong />
                <Stat k="Pivôs Simplex" v={String(node.pivots ?? node.iterations ?? 0)} /><Stat k="Solução relaxada" v={node.x ? point(node.x, frac) : '—'} />
              </div>
              <p className="text-sm text-muted-foreground">{br(node.note)}</p>
              {loaded[node.id] ? (
                <IterationViewer iterations={loaded[node.id].iterations} variables={loaded[node.id].variables} title={`Nó ${node.id}`} />
              ) : node.tableau ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Tableau final do nó</h4>
                  <TableauTable s={node.tableau} frac={frac} />
                  <p className="text-xs text-muted-foreground">Colunas: {node.tableau.columns.join(', ')}. Linha Z: custos reduzidos; RHS da linha Z na forma de maximização.</p>
                </div>
              ) : <p className="text-sm text-muted-foreground">O tableau deste nó não veio na resposta (limite de {bb.tableau_limit ?? 'nós'} tableaus). Carregue as iterações para consultá-lo.</p>}
              {!loaded[node.id] && problem && node.bounds && <Button variant="outline" size="sm" disabled={busy === node.id} onClick={() => void load(node)}>{busy === node.id && <Loader2 size={14} className="animate-spin" />}Ver todas as iterações deste nó</Button>}
              {err && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
            </div>
          )}
        </Section>
      ) : <p className="px-1 text-sm text-muted-foreground">Selecione um nó na tabela para ver seu tableau e suas informações.</p>}
    </div>
  )
}

/** Tabela Simplex da Solução Inteira Ótima: iterações da relaxação do nó incumbente. */
export function IncumbentSection({ bb, variables, frac }: { bb: BranchAndBound; variables: string[]; frac: boolean }) {
  const { showFrac } = useApp()
  const inc = bb.incumbent
  const node = bb.nodes.find((n) => n.id === bb.incumbent_node)
  if (!inc || !node || !bb.incumbent_iterations?.length) return null
  return (
    <Section title="Tabela Simplex da Solução Inteira Ótima"
      description={`Iterações da relaxação do nó ${node.id}${node.constraints?.length ? ` (${node.constraints.join(' ∧ ')})` : ' (raiz)'}, que produziu a melhor solução inteira.`}>
      <div className="mb-5 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
        <Stat k="Nó incumbente" v={`${node.id}`} /><Stat k="Solução inteira" v={point(inc.x, frac)} /><Stat k="Z" v={fmtNum(inc.z, frac)} strong /><Stat k="Pivôs Simplex" v={String(node.pivots ?? bb.incumbent_iterations.length - 1)} />
      </div>
      <IterationViewer iterations={bb.incumbent_iterations} variables={variables} title="Solução inteira" />
      <p className="mt-3 text-xs text-muted-foreground">{showFrac ? 'Valores em frações exatas.' : 'Valores em decimal; ative “Frações exatas” para ver os valores racionais.'}</p>
    </Section>
  )
}
