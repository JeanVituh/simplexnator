import { useState } from 'react'
import { Table2 } from 'lucide-react'
import { Empty, PageHeader } from '@/components/PageHeader'
import { IterationViewer, Stat } from '@/components/IterationViewer'
import { StatusBanner } from '@/components/StatusBanner'
import { Badge } from '@/components/ui/badge'
import { Section } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { br, dec, fmtNum } from '@/lib/format'
import { useApp } from '@/store'

export default function Resolution() {
  const { result: r, solvedProblem, showFrac } = useApp()
  const [alt, setAlt] = useState(0)
  const [lam, setLam] = useState(0.5)
  if (!r) return <Empty icon={Table2} title="Nenhum problema resolvido" text="Monte um modelo na página Entrada ou carregue um exemplo para acompanhar o Simplex tabular passo a passo." to="/entrada" cta="Ir para a Entrada" />
  const rel = r.relaxation, m = r.multiple
  const method = { standard: 'Simplex padrão', bigm: 'Big-M', twophase: 'Duas Fases' }[rel.method_used]
  const a = m.alternatives[Math.min(alt, m.alternatives.length - 1)]
  const mix = a && solvedProblem && rel.x ? rel.x.map((v, j) => lam * v.value + (1 - lam) * a.x[j].value) : null
  const zmix = mix && solvedProblem ? mix.reduce((s, v, j) => s + v * solvedProblem.objective[j], 0) : null

  return (
    <div>
      <PageHeader eyebrow="Análise" title="Resolução pelo Simplex tabular" subtitle={solvedProblem?.name}>
        <Badge>{method}</Badge><Badge variant="muted">{rel.pivots} {rel.pivots === 1 ? 'pivô' : 'pivôs'}</Badge>
        {rel.artificial > 0 && <Badge variant="muted">{rel.artificial} variáve{rel.artificial === 1 ? 'l artificial' : 'is artificiais'}</Badge>}
        {rel.degenerate && <Badge variant="warn">solução degenerada</Badge>}
        {rel.bland_used && <Badge variant="warn">regra de Bland ativa</Badge>}
        {m.exists && <Badge variant="warn">soluções múltiplas</Badge>}
      </PageHeader>
      <StatusBanner status={rel.status} message={rel.message} />
      <Tabs defaultValue="tabela">
        <TabsList>
          <TabsTrigger value="tabela">Iterações</TabsTrigger>
          <TabsTrigger value="padrao">Forma padrão</TabsTrigger>
          <TabsTrigger value="multiplas">Soluções múltiplas{m.exists ? ' ●' : ''}</TabsTrigger>
        </TabsList>
        <TabsContent value="tabela"><IterationViewer iterations={rel.iterations} variables={rel.variables} /></TabsContent>
        <TabsContent value="padrao" className="space-y-5">
          <Section title="Transformação para a forma padrão" description="Variáveis de folga (s), excesso (e) e artificiais (a) acrescentadas ao modelo.">
            <ul className="list-inside list-disc space-y-1.5 text-sm leading-relaxed">{r.standard_form.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            <p className="mt-4 text-sm"><span className="text-muted-foreground">Colunas da tabela: </span><span className="font-mono">{r.standard_form.columns.join(', ')}</span></p>
          </Section>
          <Section title="Modelo original"><pre className="overflow-x-auto rounded-lg bg-muted/60 p-3.5 font-mono text-[13px] leading-relaxed">{br(r.formulation.primal.join('\n'))}</pre></Section>
        </TabsContent>
        <TabsContent value="multiplas" className="space-y-5">
          {!m.exists ? (
            <Section title="Solução ótima única"><p className="text-sm text-muted-foreground">Nenhuma variável não básica tem custo reduzido nulo na tabela ótima, portanto o ótimo é único.</p></Section>
          ) : (
            <>
              <Section title="Soluções ótimas múltiplas detectadas" description={m.criterion}>
                <p className="mb-3 text-sm">Variáveis com custo reduzido igual a zero: <b className="font-mono">{m.zero_reduced_cost.join(', ')}</b></p>
                {m.unbounded_rays.length > 0 && <p className="mb-3 rounded-lg bg-warn-soft p-3 text-sm text-warn">Há uma direção ilimitada de soluções ótimas ({m.unbounded_rays.join(', ')}): o conjunto de ótimos é ilimitado.</p>}
                <div className="overflow-x-auto rounded-lg border">
                  <table className="tbl tbl-plain">
                    <thead><tr><th className="text-left">Vértice ótimo</th>{rel.variables.map((v) => <th key={v} className="normal-case">{v}</th>)}<th>Z</th><th>Pivô aplicado</th></tr></thead>
                    <tbody>
                      <tr><th>Original</th>{rel.x?.map((v, j) => <td key={j}>{fmtNum(v, showFrac)}</td>)}<td>{fmtNum(rel.z, showFrac)}</td><td>—</td></tr>
                      {m.alternatives.map((x, i) => <tr key={i}><th>Alternativa {i + 1}</th>{x.x.map((v, j) => <td key={j}>{fmtNum(v, showFrac)}</td>)}<td>{fmtNum(x.z, showFrac)} <span className={x.same_objective ? 'text-success' : 'text-danger'}>{x.same_objective ? '✓' : '✗'}</span></td><td>entra {x.entering} · sai {x.leaving}</td></tr>)}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">✓ indica o mesmo valor ótimo de Z, conferido em aritmética exata.</p>
              </Section>
              {a && mix && (
                <Section title="Gerar soluções ao longo da aresta ótima" description="Combinação convexa entre o vértice original e uma alternativa: todos os pontos têm o mesmo Z.">
                  <div className="space-y-3 text-sm">
                    {m.alternatives.length > 1 && <label className="flex items-center gap-2">Alternativa <select className="h-8 rounded-lg border bg-card px-2" value={alt} onChange={(e) => setAlt(Number(e.target.value))}>{m.alternatives.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}</select></label>}
                    <input type="range" min={0} max={1} step={0.05} value={lam} onChange={(e) => setLam(Number(e.target.value))} className="w-full accent-[hsl(var(--primary))]" aria-label="Peso λ" />
                    <p className="rounded-lg bg-muted/60 px-3.5 py-2.5 font-mono">λ = {dec(lam, 2)} → x = ({mix.map((v) => dec(v)).join('; ')}) · Z = {dec(zmix ?? 0)}</p>
                  </div>
                </Section>
              )}
              <IterationViewer iterations={m.alternatives.map((x) => x.snapshot)} variables={rel.variables} title="Alternativas" />
            </>
          )}
        </TabsContent>
      </Tabs>
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:hidden"><Section title="Resumo"><Stat k="Método" v={method ?? '—'} /><Stat k="Pivôs" v={String(rel.pivots)} /><Stat k="Z" v={fmtNum(rel.z, showFrac)} strong /></Section></div>
    </div>
  )
}
