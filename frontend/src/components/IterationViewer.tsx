import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import type { Snapshot } from '@/lib/types'
import { br } from '@/lib/format'
import { useApp } from '@/store'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const show = (v: string, frac: boolean) => (frac ? v : br(v)).replace(/-/g, '−')

export function TableauTable({ s, frac }: { s: Snapshot; frac: boolean }) {
  const cells = frac ? s.cells_frac : s.cells_dec
  const ratios = frac ? s.ratios_frac : s.ratios_dec
  const pr = s.pivot?.row ?? -1
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="tbl">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-muted text-left">Base</th>
            {s.columns.map((c, j) => (
              <th key={c} className={cn(j === s.entering_col && 'bg-primary text-primary-foreground', s.kinds[j] === 'artificial' && j !== s.entering_col && 'text-warn')}>{c}</th>
            ))}
            <th>RHS</th><th>Razão</th>
          </tr>
        </thead>
        <tbody>
          {cells.map((row, i) => (
            <tr key={i} className={cn(i === 0 && 'bg-primary-soft/50', i === pr && 'bg-primary-soft')}>
              <th className={cn('sticky left-0 z-10', i === 0 ? 'bg-primary-soft text-primary' : 'bg-card')} title={i === 0 ? 'Linha Z: custos reduzidos e valor da função objetivo' : undefined}>{i === 0 ? 'Z' : s.basis[i - 1]}</th>
              {row.map((v, j) => {
                const isPivot = s.pivot && s.pivot.row === i && s.pivot.col === j
                return (
                  <td key={j} className={cn(j === s.entering_col && j < row.length - 1 && 'bg-primary/[0.07]', j === row.length - 1 && 'font-semibold', isPivot && 'bg-primary font-bold text-primary-foreground')}>{show(v, frac)}</td>
                )
              })}
              <td className={cn('text-muted-foreground', i === pr && 'font-bold text-primary')}>{i > 0 && ratios?.[i - 1] != null ? show(ratios[i - 1]!, frac) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const Chip = ({ children, tone }: { children: React.ReactNode; tone: 'in' | 'out' }) => (
  <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-sm font-semibold', tone === 'in' ? 'bg-success-soft text-success' : 'bg-warn-soft text-warn')}>{children}</span>
)

export const Stat = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-1.5 last:border-b-0"><span className="text-sm text-muted-foreground">{k}</span><b className={cn('font-mono text-sm tabular-nums', strong && 'text-primary')}>{v}</b></div>
)

export function IterationViewer({ iterations, variables, title }: { iterations: Snapshot[]; variables: string[]; title?: string }) {
  const { showFrac, setShowFrac } = useApp()
  const [k, setK] = useState(0)
  const [playing, setPlaying] = useState(false)
  const last = iterations.length - 1
  const idx = Math.min(k, last)
  const s = iterations[idx]

  useEffect(() => { setK(0); setPlaying(false) }, [iterations])
  useEffect(() => {
    if (!playing) return
    if (idx >= last) { setPlaying(false); return }
    const t = setTimeout(() => setK(idx + 1), 1400)
    return () => clearTimeout(t)
  }, [playing, idx, last])

  const phases = useMemo(() => {
    const seen = new Map<number, number>()
    iterations.forEach((it, i) => { if (it.phase > 0 && !seen.has(it.phase)) seen.set(it.phase, i) })
    return [...seen.entries()]
  }, [iterations])

  if (!s) return null
  const ops = showFrac ? s.operations_frac : s.operations_dec
  const x = showFrac ? s.x_frac : s.x_dec
  const isLast = idx === last

  return (
    <div className="space-y-5">
      <div className="no-print rounded-xl border bg-card p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setK(Math.max(0, idx - 1))} disabled={idx === 0}><ChevronLeft size={15} />Anterior</Button>
          <Button size="sm" onClick={() => setK(Math.min(last, idx + 1))} disabled={isLast}>Próxima<ChevronRight size={15} /></Button>
          <Button variant="outline" size="sm" onClick={() => setPlaying(!playing)} disabled={isLast}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? 'Pausar' : 'Automático'}</Button>
          <Button variant="ghost" size="sm" onClick={() => { setPlaying(false); setK(last) }}><SkipForward size={15} />Resolver tudo</Button>
          <Button variant="ghost" size="sm" onClick={() => { setPlaying(false); setK(0) }}><RotateCcw size={15} />Reiniciar</Button>
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={showFrac} onChange={(e) => setShowFrac(e.target.checked)} />Frações exatas</label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {phases.length > 1 && (
            <div className="flex gap-1" role="group" aria-label="Fases do método">
              {phases.map(([p, first]) => (
                <button key={p} onClick={() => setK(first)} className={cn('rounded-md px-2.5 py-1 text-xs font-semibold transition-colors', s.phase === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>Fase {p}</button>
              ))}
            </div>
          )}
          <input type="range" min={0} max={last} value={idx} onChange={(e) => { setPlaying(false); setK(Number(e.target.value)) }} className="h-1.5 min-w-[160px] flex-1 cursor-pointer accent-[hsl(var(--primary))]" aria-label="Passo da resolução" />
          <span className="font-mono text-xs text-muted-foreground">{title ? `${title} · ` : ''}passo {idx + 1}/{iterations.length}</span>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_290px]">
        <div className="min-w-0 space-y-5">
          <Section title={s.title} description={s.note || undefined} actions={isLast ? <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">Passo final</span> : undefined}>
            <TableauTable s={s} frac={showFrac} />
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-primary" />pivô</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-primary-soft ring-1 ring-primary/30" />linha pivô</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-primary/[0.12]" />coluna pivô</span>
              <span>Linha Z = custos reduzidos · M = penalidade do Big-M · linha Z na forma de maximização (em minimização, Z = −linha)</span>
            </div>
          </Section>
          {ops.length > 0 && (
            <Section title="Operações elementares" description="Atualização da tabela para o próximo passo.">
              <ul className="space-y-1 font-mono text-[13px]">{ops.map((o) => <li key={o} className="rounded-md bg-muted/50 px-3 py-1.5">{show(o, showFrac)}</li>)}</ul>
            </Section>
          )}
        </div>
        <div className="space-y-5">
          <Section title="Pivoteamento">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Entra na base</span>{s.entering ? <Chip tone="in"><ArrowRight size={13} />{s.entering}</Chip> : <span>—</span>}</div>
              <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Sai da base</span>{s.leaving ? <Chip tone="out"><ArrowLeft size={13} />{s.leaving}</Chip> : <span>—</span>}</div>
              <Stat k="Elemento pivô" v={s.pivot_value ? show(showFrac ? s.pivot_value.frac : s.pivot_value.dec, showFrac) : '—'} />
            </div>
          </Section>
          <Section title="Solução atual">
            {variables.map((v, i) => <Stat key={v} k={v} v={show(x[i] ?? '—', showFrac)} />)}
            <Stat k={s.z_label} v={show(showFrac ? s.z_frac : s.z_dec, showFrac)} strong />
          </Section>
        </div>
      </div>
    </div>
  )
}
