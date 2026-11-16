import { Link } from 'react-router-dom'
import { ClipboardCheck, FileArchive, FileJson, Printer } from 'lucide-react'
import { Empty, PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/IterationViewer'
import { StatusBanner } from '@/components/StatusBanner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, Section } from '@/components/ui/card'
import { BBIndicators } from '@/components/BranchBound'
import { Spinner } from '@/components/ui/spinner'
import { useProjectIO } from '@/lib/useProjectIO'
import { fmtNum, point } from '@/lib/format'
import { useApp } from '@/store'

const Kpi = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <Card className="p-5"><p className="kbd-label">{label}</p><p className="mt-1.5 truncate font-mono text-2xl font-semibold tabular-nums tracking-tight">{value}</p>{sub && <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>}</Card>
)

export default function Results() {
  const { result: r, solvedProblem: p, showFrac, setShowFrac } = useApp()
  const io = useProjectIO()
  if (!r || !p) return <Empty icon={ClipboardCheck} title="Sem resultados" text="Resolva um problema para ver o resumo da solução, a comparação entre soluções e a análise de sensibilidade." to="/entrada" cta="Ir para a Entrada" />
  const rel = r.relaxation, v = rel.validation, s = r.sensitivity
  const intInfo = r.integer.available === false ? null : r.integer
  const inc = intInfo?.branch_and_bound.incumbent ?? null
  const method = { standard: 'Simplex padrão', bigm: 'Big-M', twophase: 'Duas Fases' }[rel.method_used]
  const statusLabel = { optimal: 'Ótimo', infeasible: 'Inviável', unbounded: 'Ilimitado' }[rel.status]

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Saídas" title="Resultados" subtitle={p.name}>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={showFrac} onChange={(e) => setShowFrac(e.target.checked)} />Frações exatas</label>
        <Button variant="outline" onClick={io.exportJson}><FileJson size={15} />Exportar JSON</Button>
        <Button variant="outline" disabled={io.busy} onClick={() => void io.exportZip()}>{io.busy ? <Spinner /> : <FileArchive size={15} />}Exportar ZIP</Button>
        <Button onClick={() => window.print()}><Printer size={15} />Imprimir / PDF</Button>
      </PageHeader>
      <StatusBanner status={rel.status} message={rel.message} />
      {r.warnings.length > 0 && <div className="flex flex-wrap gap-2">{r.warnings.map((w) => <Badge key={w} variant="warn">{w}</Badge>)}</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Status" value={statusLabel} sub={method} />
        <Kpi label="Valor ótimo Z*" value={fmtNum(rel.z, showFrac)} sub={rel.x ? `x = ${point(rel.x, showFrac)}` : undefined} />
        <Kpi label="Z inteiro ótimo" value={inc ? fmtNum(inc.z, showFrac) : '—'} sub={inc ? `x = ${point(inc.x, showFrac)}` : 'não calculado'} />
        <Kpi label="Processamento" value={`${rel.pivots} ${rel.pivots === 1 ? 'pivô' : 'pivôs'}`} sub={intInfo ? `${intInfo.branch_and_bound.explored} nós no Branch and Bound` : undefined} />
      </div>

      {intInfo?.branch_and_bound.stats && (
        <Section title="Branch and Bound" description="Resumo da busca pela solução inteira ótima." actions={<Link to="/inteira" className="text-sm font-medium text-primary hover:underline">Ver tabela de nós e tableaus</Link>}>
          <BBIndicators bb={intInfo.branch_and_bound} sense={r.sense} frac={showFrac} compact />
        </Section>
      )}

      {rel.status === 'optimal' && rel.x && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Variáveis da solução" description="Ótimo contínuo e, quando calculada, a solução inteira ótima.">
            <div className="overflow-x-auto rounded-lg border"><table className="tbl tbl-plain"><thead><tr><th className="text-left">Variável</th><th>Contínua</th>{inc && <th>Inteira</th>}</tr></thead>
              <tbody>{rel.x.map((x, j) => <tr key={j}><th className="font-mono">{r.variables[j]}</th><td className="font-mono">{fmtNum(x, showFrac)}</td>{inc && <td className="font-mono">{fmtNum(inc.x[j], showFrac)}</td>}</tr>)}
                <tr><th>Z</th><td className="font-mono font-semibold">{fmtNum(rel.z, showFrac)}</td>{inc && <td className="font-mono font-semibold">{fmtNum(inc.z, showFrac)}</td>}</tr></tbody></table></div>
          </Section>
          <Section title="Resumo matemático">
            <Stat k="Método" v={method ?? '—'} /><Stat k="Variáveis artificiais" v={String(rel.artificial)} /><Stat k="Pivôs degenerados" v={String(rel.degenerate_pivots)} />
            <Stat k="Solução degenerada" v={rel.degenerate ? 'sim' : 'não'} /><Stat k="Soluções múltiplas" v={r.multiple.exists ? `sim (${r.multiple.alternatives.length} alternativa${r.multiple.alternatives.length === 1 ? '' : 's'})` : 'não'} />
            {r.dual.strong_duality && <Stat k="Dualidade forte (Z = W)" v={r.dual.strong_duality.holds ? 'confirmada' : 'divergente'} />}
            {v && <div className="mt-3 flex flex-wrap gap-2"><Badge variant={v.feasible ? 'success' : 'danger'}>{v.feasible ? 'satisfaz todas as restrições' : 'violações encontradas'}</Badge><Badge variant={v.matches_tableau ? 'success' : 'danger'}>{v.matches_tableau ? 'Z da tabela = Z recalculado' : 'Z diverge'}</Badge></div>}
          </Section>
        </div>
      )}

      {s.available && s.rhs ? (
        <Section title="Análise de sensibilidade" description="Preços-sombra e faixas em que a base ótima permanece válida.">
          <div className="space-y-6">
            <div>
              <h4 className="mb-2 text-sm font-semibold">Preços-sombra e lado direito</h4>
              <div className="overflow-x-auto rounded-lg border"><table className="tbl tbl-plain"><thead><tr><th className="text-left">Restrição</th><th>Preço-sombra</th><th>LD atual</th><th>Mínimo</th><th>Máximo</th><th>Ativa</th></tr></thead>
                <tbody>{s.rhs.map((x) => <tr key={x.constraint}><th>{x.constraint}</th><td className="font-mono font-semibold">{fmtNum(x.shadow_price, showFrac)}</td><td className="font-mono">{fmtNum(x.rhs, showFrac)}</td><td className="font-mono">{x.lower ? fmtNum(x.lower, showFrac) : '−∞'}</td><td className="font-mono">{x.upper ? fmtNum(x.upper, showFrac) : '+∞'}</td><td>{x.binding ? <Badge variant="success">sim</Badge> : <Badge variant="muted">não</Badge>}</td></tr>)}</tbody></table></div>
              <p className="mt-2 text-xs text-muted-foreground">Preço-sombra: variação de Z por unidade adicional no lado direito, válida dentro da faixa indicada.</p>
            </div>
            {s.objective && s.objective.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Coeficientes da função objetivo</h4>
                <div className="overflow-x-auto rounded-lg border"><table className="tbl tbl-plain"><thead><tr><th className="text-left">Variável</th><th>Coeficiente</th><th>Mínimo</th><th>Máximo</th><th>Básica</th><th>Custo reduzido</th></tr></thead>
                  <tbody>{s.objective.map((o, i) => <tr key={o.variable}><th className="font-mono">{o.variable}</th><td className="font-mono">{fmtNum(o.coefficient, showFrac)}</td><td className="font-mono">{o.lower ? fmtNum(o.lower, showFrac) : '−∞'}</td><td className="font-mono">{o.upper ? fmtNum(o.upper, showFrac) : '+∞'}</td><td>{o.basic ? 'sim' : 'não'}</td><td className="font-mono">{s.reduced_costs ? fmtNum(s.reduced_costs[i].reduced_cost, showFrac) : '—'}</td></tr>)}</tbody></table></div>
              </div>
            )}
            {s.objective_note && <p className="text-sm text-muted-foreground">{s.objective_note}</p>}
          </div>
        </Section>
      ) : <p className="px-1 text-sm text-muted-foreground">Análise de sensibilidade indisponível: {s.reason}</p>}
    </div>
  )
}
