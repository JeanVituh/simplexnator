import { lazy, Suspense, useState } from 'react'
import { ChartLine } from 'lucide-react'
import { Empty, PageHeader } from '@/components/PageHeader'
import { Section } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/spinner'
import { LAYER_META, type Layers } from '@/lib/layers'
import { dec } from '@/lib/format'
import { useApp } from '@/store'
import { cn } from '@/lib/utils'

const PlotGraph = lazy(() => import('@/components/PlotGraph'))

export function LayerChips({ layers, onChange, only }: { layers: Layers; onChange: (l: Layers) => void; only?: (keyof Layers)[] }) {
  const keys = (only ?? (Object.keys(LAYER_META) as (keyof Layers)[]))
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Camadas do gráfico">
      {keys.map((k) => (
        <button key={k} type="button" aria-pressed={layers[k]} onClick={() => onChange({ ...layers, [k]: !layers[k] })}
          className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] font-medium transition-all', layers[k] ? 'border-foreground/20 bg-card shadow-sm' : 'border-transparent bg-muted text-muted-foreground hover:text-foreground')}>
          <i className="h-2.5 w-2.5 rounded-full" style={{ background: LAYER_META[k].color, opacity: layers[k] ? 1 : 0.35 }} />{LAYER_META[k].label}
        </button>
      ))}
    </div>
  )
}

export default function Graphs() {
  const { result: r } = useApp()
  const [layers, setLayers] = useState<Layers>({ region: true, constraints: true, levels: true, vertices: true, ints: false, optimum: true, intOpt: false, rounding: false, segment: true })
  if (!r) return <Empty icon={ChartLine} title="Nada para exibir" text="Resolva um problema para visualizar a região viável, as curvas de nível e a solução ótima." to="/entrada" cta="Ir para a Entrada" />
  const g = r.graph
  if (!g) return <Empty icon={ChartLine} title="Gráfico indisponível" text={`O gráfico 2D exige exatamente 2 variáveis e este modelo possui ${r.variables.length}. Acompanhe a resolução nas tabelas da página Resolução.`} to="/resolucao" cta="Abrir Resolução" />
  const rel = r.relaxation
  return (
    <div>
      <PageHeader eyebrow="Análise" title="Gráficos" subtitle="Região viável, retas das restrições, curvas de nível e solução ótima. Passe o mouse sobre os pontos para ver coordenadas e Z." />
      {r.multiple.exists && g.optimal_segment && <div className="mb-5 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">Soluções ótimas múltiplas: todo o segmento destacado em âmbar entre os dois vértices ótimos tem o mesmo valor de Z.</div>}
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_320px]">
        <Section title={`Plano ${g.var_names[0]} × ${g.var_names[1]}`} description={rel.status === 'optimal' && rel.z ? `Ótimo contínuo: Z = ${dec(rel.z.value)}` : 'Sem ótimo finito'} actions={undefined}>
          <div className="mb-4"><LayerChips layers={layers} onChange={setLayers} /></div>
          <Suspense fallback={<Skeleton className="h-[520px]" />}><PlotGraph g={g} layers={layers} /></Suspense>
        </Section>
        <Section title="Vértices da região viável" description="O vértice ótimo está destacado.">
          {g.vertices.length === 0 ? <p className="text-sm text-muted-foreground">A região viável é vazia.</p> : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="tbl"><thead><tr><th /><th className="normal-case">{g.var_names[0]}</th><th className="normal-case">{g.var_names[1]}</th><th>Z</th></tr></thead>
                <tbody>{g.vertices.map((v, i) => <tr key={i} className={v.optimal ? 'bg-success-soft/70 font-semibold text-success' : ''}><th className={v.optimal ? '!bg-transparent' : ''}>V{i + 1}{v.optimal ? ' ★' : ''}</th><td>{dec(v.x)}</td><td>{dec(v.y)}</td><td>{dec(v.z)}</td></tr>)}</tbody></table>
            </div>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">A curva de nível verde tracejada passa pelo ótimo: deslocá-la na direção de melhora de Z até tocar o último ponto da região viável identifica a solução.</p>
        </Section>
      </div>
    </div>
  )
}
