import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, ArrowRight, ChartLine, Check, Divide, GitFork, PencilRuler, Play, RefreshCw, Sigma, Table2, type LucideIcon } from 'lucide-react'
import { fetchExamples } from '@/lib/api'
import { sizeLabel } from '@/lib/model'
import type { Example } from '@/lib/types'
import { useApp } from '@/store'
import HeroArt from '@/components/HeroArt'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton, Spinner } from '@/components/ui/spinner'

const flow: { n: string; icon: LucideIcon; title: string; text: string; to: string }[] = [
  { n: '01', icon: PencilRuler, title: 'Modelagem', text: 'Função objetivo, variáveis, limites e restrições.', to: '/entrada' },
  { n: '02', icon: Table2, title: 'Simplex Tabular', text: 'Tabelas, pivoteamento, operações de linha e iterações.', to: '/resolucao' },
  { n: '03', icon: ChartLine, title: 'Gráficos', text: 'Região viável, curvas de nível, vértices e solução ótima.', to: '/graficos' },
  { n: '04', icon: GitFork, title: 'Solução Inteira', text: 'Arredondamento, Branch and Bound e árvore de decisões.', to: '/inteira' },
  { n: '05', icon: ArrowLeftRight, title: 'Dual e Soluções Múltiplas', text: 'Construção do dual, resolução tabular e soluções ótimas alternativas.', to: '/dual' },
]
const indicators: { icon: LucideIcon; text: string }[] = [
  { icon: Sigma, text: 'Big-M e Duas Fases' }, { icon: Divide, text: 'Aritmética exata em frações' },
  { icon: GitFork, text: 'Branch and Bound' }, { icon: ArrowLeftRight, text: 'Dual tabular e ótimos múltiplos' },
]

function ExampleCard({ e, featured, onLoad, onSolve, busy }: { e: Example; featured?: boolean; onLoad: () => void; onSolve: () => void; busy: boolean }) {
  const p = e.problem
  return (
    <Card className={featured ? 'overflow-hidden lg:col-span-3' : 'flex flex-col'}>
      <div className={featured ? 'grid gap-0 lg:grid-cols-[1.1fr_1fr]' : 'flex h-full flex-col p-5'}>
        <div className={featured ? 'flex flex-col p-6' : 'flex flex-1 flex-col'}>
          <div className="mb-3 flex flex-wrap items-center gap-2"><Badge>{e.category}</Badge><Badge variant="muted">{p.sense === 'max' ? 'Maximização' : 'Minimização'}</Badge><Badge variant="outline">{sizeLabel(p)}</Badge></div>
          <h3 className={featured ? 'text-xl font-semibold tracking-tight' : 'text-base font-semibold tracking-tight'}>{e.title}</h3>
          <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{featured && e.context ? e.context.statement : e.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{e.highlights.map((h) => <span key={h} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{h}</span>)}</div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" onClick={onSolve} disabled={busy}>{busy ? <Spinner size={14} /> : <Play size={14} />}Carregar e resolver</Button>
            <Button size="sm" variant="outline" onClick={onLoad}>Carregar exemplo</Button>
          </div>
        </div>
        {featured && e.context && (
          <div className="border-t bg-muted/40 p-6 lg:border-l lg:border-t-0">
            <p className="kbd-label mb-2">Formulação matemática</p>
            <div className="space-y-2 font-mono text-[13px] leading-relaxed">
              <p className="font-semibold text-primary">{e.context.objective}</p>
              <p className="text-muted-foreground">sujeito a</p>
              <ul className="space-y-1">{e.context.constraints.map((c) => <li key={c} className="rounded-md bg-card px-3 py-1.5 shadow-sm">{c}</li>)}</ul>
              <p className="text-muted-foreground">x₁, x₂ ≥ 0</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export default function Home() {
  const nav = useNavigate()
  const { newProblem, loadExample, solve, loading } = useApp()
  const [examples, setExamples] = useState<Example[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const exRef = useRef<HTMLElement>(null)

  const load = useCallback(() => { setErr(null); setExamples(null); fetchExamples().then(setExamples).catch((e: Error) => setErr(e.message)) }, [])
  useEffect(load, [load])

  const run = async (e: Example) => {
    setBusy(e.id); loadExample(e)
    const ok = await solve(e.problem)
    setBusy(null)
    if (ok) nav('/resolucao')
  }
  const [featured, ...rest] = examples ?? []

  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="eyebrow mb-4">Programação linear · Método Simplex</p>
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight md:text-[52px]">Resolva problemas de programação linear com o Método Simplex.</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">Modele seus problemas, acompanhe cada iteração e compreenda como o algoritmo encontra a solução ótima, com tabelas matemáticas, gráficos interativos e otimização inteira.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => { newProblem(); nav('/entrada') }}>Novo problema<ArrowRight size={18} /></Button>
            <Button size="lg" variant="outline" onClick={() => exRef.current?.scrollIntoView({ behavior: 'smooth' })}>Ver exemplos</Button>
          </div>
          <ul className="mt-9 grid max-w-xl gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {indicators.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 text-sm text-muted-foreground"><span className="grid h-6 w-6 place-items-center rounded-md bg-primary-soft text-primary"><Icon size={14} /></span>{text}</li>
            ))}
          </ul>
        </div>
        <Card className="p-4 md:p-6"><HeroArt /></Card>
      </section>

      <section aria-labelledby="fluxo">
        <h2 id="fluxo" className="mb-1 text-xl font-semibold tracking-tight">Fluxo de resolução</h2>
        <p className="mb-5 text-sm text-muted-foreground">Do modelo à solução ótima, em cinco áreas.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {flow.map(({ n, icon: Icon, title, text, to }) => (
            <button key={n} onClick={() => nav(to)} className="group rounded-xl border bg-card p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-pop">
              <div className="mb-4 flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary"><Icon size={18} /></span><span className="font-mono text-xs font-semibold text-muted-foreground">{n}</span></div>
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{text}</p>
            </button>
          ))}
        </div>
      </section>

      <section id="exemplos" ref={exRef} aria-labelledby="exemplos-t" className="scroll-mt-8">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div><h2 id="exemplos-t" className="text-xl font-semibold tracking-tight">Exemplos</h2><p className="text-sm text-muted-foreground">Modelos prontos, resolvidos pelo motor: carregue, edite os parâmetros e execute de novo.</p></div>
        </div>
        {err && (
          <Card className="flex flex-wrap items-center gap-3 border-warn/40 bg-warn-soft p-4 text-sm text-warn">
            <span className="flex-1">{err} Inicie o backend para carregar os exemplos; a Entrada continua disponível.</span>
            <Button size="sm" variant="outline" onClick={load}><RefreshCw size={14} />Tentar novamente</Button>
          </Card>
        )}
        {!err && !examples && <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-56 lg:col-span-3" />{[1, 2, 3].map((i) => <Skeleton key={i} className="h-52" />)}</div>}
        {examples && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featured && <ExampleCard e={featured} featured busy={busy === featured.id || loading} onLoad={() => { loadExample(featured); nav('/entrada') }} onSolve={() => run(featured)} />}
            {rest.map((e) => <ExampleCard key={e.id} e={e} busy={busy === e.id || loading} onLoad={() => { loadExample(e); nav('/entrada') }} onSolve={() => run(e)} />)}
          </div>
        )}
        {examples && <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><Check size={13} />Todos os exemplos são resolvidos pelo motor matemático a cada execução.</p>}
      </section>
    </div>
  )
}
