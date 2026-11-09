import { lazy, Suspense, useState } from 'react'
import { GitFork } from 'lucide-react'
import { Empty, PageHeader } from '@/components/PageHeader'
import { Stat } from '@/components/IterationViewer'
import { LayerChips } from '@/pages/Graphs'
import { Badge } from '@/components/ui/badge'
import { Section } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/spinner'
import type { BBNode, Num, Rounding } from '@/lib/types'
import type { Layers } from '@/lib/layers'
import { br, fmtNum, point } from '@/lib/format'
import { useApp } from '@/store'
import { cn } from '@/lib/utils'

const PlotGraph = lazy(() => import('@/components/PlotGraph'))

const DECISION = {
  branched: { tone: 'default', label: 'ramificado', bar: 'border-l-primary' },
  integer: { tone: 'success', label: 'solução inteira', bar: 'border-l-success' },
  infeasible: { tone: 'danger', label: 'inviável', bar: 'border-l-danger' },
  unbounded: { tone: 'danger', label: 'ilimitado', bar: 'border-l-danger' },
  pruned_bound: { tone: 'warn', label: 'podado por limite', bar: 'border-l-warn' },
} as const

function Tree({ node, all, frac }: { node: BBNode; all: BBNode[]; frac: boolean }) {
  const kids = all.filter((n) => n.parent === node.id)
  const d = node.decision ? DECISION[node.decision] : null
  return (
    <li>
      <div className={cn('relative mb-2.5 rounded-lg border border-l-4 bg-card p-3 text-sm shadow-card', d?.bar, node.parent !== null && 'before:absolute before:-left-[17px] before:top-5 before:h-px before:w-4 before:bg-border')}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-semibold">Nó {node.id}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{node.branch}</span>
          {d && <Badge variant={d.tone}>{d.label}</Badge>}
          {node.z && <span className="font-mono text-xs text-muted-foreground">Z = {fmtNum(node.z, frac)}</span>}
          {node.x && <span className="font-mono text-xs text-muted-foreground">x = {point(node.x, frac)}</span>}
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{br(node.note)}</p>
      </div>
      {kids.length > 0 && <ul className="ml-3 border-l pl-4">{kids.map((k) => <Tree key={k.id} node={k} all={all} frac={frac} />)}</ul>}
    </li>
  )
}

function Row({ label, hint, x, z, ok, frac, accent }: { label: string; hint: string; x: Num[] | null; z: Num | null; ok?: boolean; frac: boolean; accent?: boolean }) {
  return (
    <tr className={cn(accent && 'bg-success-soft/60')}>
      <th><span className="block font-sans text-sm">{label}</span><span className="block font-sans text-xs font-normal text-muted-foreground">{hint}</span></th>
      <td>{x ? point(x, frac) : '—'}</td><td className="font-semibold">{z ? fmtNum(z, frac) : '—'}</td>
      <td>{ok === undefined ? <Badge variant="muted">relaxação</Badge> : ok ? <Badge variant="success">viável</Badge> : <Badge variant="danger">inviável</Badge>}</td>
    </tr>
  )
}

const RoundBox = ({ title, r, frac }: { title: string; r: Rounding | null; frac: boolean }) => (
  <Section title={title}>
    {r ? <><Stat k="x" v={point(r.x, frac)} /><Stat k="Z" v={fmtNum(r.z, frac)} strong />
      <div className="mt-3">{r.feasible ? <Badge variant="success">viável</Badge> : <Badge variant="danger">inviável — não é solução válida</Badge>}</div>
      {!r.feasible && <p className="mt-2 text-xs leading-relaxed text-danger">Não satisfaz: {br(r.violations.join('; '))}</p>}</>
      : <p className="text-sm text-muted-foreground">Nenhuma combinação de piso e teto satisfaz as restrições.</p>}
  </Section>
)

export default function IntegerPage() {
  const { result: res, showFrac, setShowFrac } = useApp()
  const [layers, setLayers] = useState<Layers>({ region: true, constraints: true, levels: false, vertices: false, ints: true, optimum: true, intOpt: true, rounding: true, segment: false })
  if (!res) return <Empty icon={GitFork} title="Nenhuma solução inteira ainda" text="Resolva um problema para comparar arredondamento e Branch and Bound." to="/entrada" cta="Ir para a Entrada" />
  const info = res.integer
  if (info.available === false) return <Empty icon={GitFork} title="Solução inteira indisponível" text={info.reason} to="/entrada" cta="Voltar à Entrada" />
  const rel = res.relaxation, bb = info.branch_and_bound, inc = bb.incumbent, rd = info.rounding
  const gap = inc && rel.z ? Math.abs(inc.z.value - rel.z.value) : null
  const consistent = inc && rel.z ? (res.sense === 'min' ? inc.z.value >= rel.z.value - 1e-9 : inc.z.value <= rel.z.value + 1e-9) : null

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Análise" title="Solução inteira" subtitle={`Variáveis inteiras: ${info.variables.join(', ')}. Os quatro resultados abaixo são distintos e comparados com a relaxação linear.`}>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={showFrac} onChange={(e) => setShowFrac(e.target.checked)} />Frações exatas</label>
      </PageHeader>

      <Section title="Comparação das soluções" description={consistent === null ? undefined : consistent ? `Consistente com a relaxação: em ${res.sense === 'min' ? 'minimização' : 'maximização'}, o ótimo inteiro nunca é ${res.sense === 'min' ? 'menor' : 'maior'} que o contínuo.` : 'Atenção: o valor inteiro contradiz a relaxação.'}>
        <div className="overflow-x-auto rounded-lg border">
          <table className="tbl tbl-plain">
            <thead><tr><th className="text-left">Solução</th><th>x</th><th>Z</th><th>Situação</th></tr></thead>
            <tbody>
              <Row label="1. Ótimo contínuo" hint="Relaxação linear (Simplex)" x={rel.x} z={rel.z} frac={showFrac} />
              <Row label="2. Arredondamento simples" hint="Inteiro mais próximo de cada variável" x={rd.simple.x} z={rd.simple.z} ok={rd.simple.feasible} frac={showFrac} />
              <Row label="3. Melhor piso/teto viável" hint={`${rd.combinations_checked} combinações testadas`} x={rd.neighbor?.x ?? null} z={rd.neighbor?.z ?? null} ok={rd.neighbor ? true : undefined} frac={showFrac} />
              <Row label="4. Inteira ótima" hint={bb.proven_optimal ? 'Branch and Bound · ótimo comprovado' : 'Branch and Bound · limite de nós atingido'} x={inc?.x ?? null} z={inc?.z ?? null} ok={inc ? true : undefined} frac={showFrac} accent />
            </tbody>
          </table>
        </div>
        {gap !== null && <p className="mt-3 text-sm text-muted-foreground">Diferença entre o ótimo inteiro e o contínuo: <b className="font-mono text-foreground">{gap.toFixed(4).replace(/\.?0+$/, '').replace('.', ',') || '0'}</b> · {bb.explored} nós explorados no Branch and Bound.</p>}
      </Section>

      <div className="grid gap-5 md:grid-cols-2">
        <RoundBox title="Arredondamento simples" r={rd.simple} frac={showFrac} />
        <RoundBox title="Melhor piso/teto viável" r={rd.neighbor} frac={showFrac} />
      </div>

      {res.graph && (
        <Section title="Representação gráfica da solução inteira" description="Pontos inteiros viáveis, ótimo contínuo, arredondamento e solução inteira ótima.">
          <div className="mb-4"><LayerChips layers={layers} onChange={setLayers} only={['region', 'constraints', 'ints', 'optimum', 'rounding', 'intOpt']} /></div>
          <Suspense fallback={<Skeleton className="h-[460px]" />}><PlotGraph g={res.graph} layers={layers} height={460} /></Suspense>
        </Section>
      )}

      <Section title="Árvore de Branch and Bound" description="Cada nó resolve a relaxação pelo Simplex com limites adicionais. O motivo do encerramento de cada nó está indicado.">
        <ul>{bb.nodes.filter((n) => n.parent === null).map((n) => <Tree key={n.id} node={n} all={bb.nodes} frac={showFrac} />)}</ul>
      </Section>
    </div>
  )
}
