import { ArrowLeftRight } from 'lucide-react'
import { Empty, PageHeader } from '@/components/PageHeader'
import { IterationViewer, Stat } from '@/components/IterationViewer'
import { StatusBanner } from '@/components/StatusBanner'
import { Badge } from '@/components/ui/badge'
import { Section } from '@/components/ui/card'
import { br, fmtNum } from '@/lib/format'
import { useApp } from '@/store'
import { Link } from 'react-router-dom'

/** Cada par primal↔dual recebe a mesma cor para facilitar a leitura da correspondência. */
const hue = (i: number) => [250, 160, 25, 330, 200, 90][i % 6]
const Pair = ({ i, children }: { i: number; children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `hsl(${hue(i)} 70% 55%)` }} />{children}</span>
)

export default function Dual() {
  const { result: r, showFrac } = useApp()
  if (!r) return <Empty icon={ArrowLeftRight} title="Dual indisponível" text="Resolva um problema para ver a construção do dual e a sua resolução tabular." to="/entrada" cta="Ir para a Entrada" />
  const d = r.dual, dr = d.result, sd = d.strong_duality
  const colIdx = new Map(d.correspondence.columns.map((c, i) => [c.dual_constraint, i]))
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Análise" title="Problema dual" subtitle="O dual é construído a partir do primal e resolvido pelo Simplex tabular, com todas as iterações." />
      {r.multiple.exists && <div className="rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">Solução múltipla detectada no primal. Os vértices alternativos estão em <Link className="font-medium underline" to="/resolucao">Resolução</Link>.</div>}
      <div className="grid gap-5 md:grid-cols-2">
        <Section title="Primal"><pre className="overflow-x-auto rounded-lg bg-muted/60 p-3.5 font-mono text-[13px] leading-relaxed">{br(r.formulation.primal.join('\n'))}</pre></Section>
        <Section title="Dual" description={d.note}><pre className="overflow-x-auto rounded-lg bg-muted/60 p-3.5 font-mono text-[13px] leading-relaxed">{br(d.model_lines.join('\n'))}</pre>
          {d.correspondence.rows.some((x) => x.sign !== '≥ 0') && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Na tabela, variáveis duais ≤ 0 entram por substituição (y′ = −y) e as livres são separadas em y⁺ − y⁻.</p>}</Section>
      </div>
      <Section title="Correspondência primal ↔ dual" description="Cada restrição do primal gera uma variável dual; cada variável do primal gera uma restrição dual.">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="overflow-x-auto rounded-lg border"><table className="tbl tbl-plain"><thead><tr><th className="text-left">Restrição do primal</th><th>Variável dual</th><th>Sinal</th></tr></thead>
            <tbody>{d.correspondence.rows.map((x, i) => <tr key={x.dual_var}><td className="text-left"><Pair i={i}>{x.primal}</Pair></td><td className="font-mono font-semibold">{x.dual_var}</td><td className="font-mono">{x.sign}</td></tr>)}</tbody></table></div>
          <div className="overflow-x-auto rounded-lg border"><table className="tbl tbl-plain"><thead><tr><th className="text-left">Variável do primal</th><th>Restrição dual</th><th>Relação</th></tr></thead>
            <tbody>{d.correspondence.columns.map((x) => <tr key={x.dual_constraint}><td className="text-left"><Pair i={colIdx.get(x.dual_constraint) ?? 0}>{x.primal_var}</Pair></td><td className="font-mono font-semibold">{x.dual_constraint}</td><td className="font-mono">{x.relation === '>=' ? '≥' : '≤'}</td></tr>)}</tbody></table></div>
        </div>
      </Section>
      <StatusBanner status={dr.status} message={dr.message || (dr.status !== 'optimal' ? 'Resultado coerente com o primal, pela teoria da dualidade.' : undefined)} />
      {dr.iterations.length > 0 && <IterationViewer iterations={dr.iterations} variables={dr.variables} title="Dual" />}
      {sd && (
        <Section title="Dualidade forte" description="Para problemas com solução ótima, os valores ótimos do primal e do dual coincidem.">
          <div className="max-w-md"><Stat k="Z (primal)" v={fmtNum(sd.z, showFrac)} /><Stat k="W (dual)" v={fmtNum(sd.w, showFrac)} />
            {sd.constant.value !== 0 && <Stat k="Constante do deslocamento" v={fmtNum(sd.constant, showFrac)} />}</div>
          <div className="mt-3"><Badge variant={sd.holds ? 'success' : 'danger'}>{sd.holds ? 'Z = W confirmado' : 'Z ≠ W'}</Badge></div>
        </Section>
      )}
    </div>
  )
}
