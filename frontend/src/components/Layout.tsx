import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChartLine, ChevronsLeft, ClipboardCheck, FolderOpen, GitFork, House, Moon, PencilRuler, Sun, Table2, ArrowLeftRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useApp } from '@/store'
import { LogoMark } from '@/components/Logo'
import { Badge } from '@/components/ui/badge'
import { dec } from '@/lib/format'
import { sizeLabel } from '@/lib/model'
import { cn } from '@/lib/utils'

const groups: { title: string; items: { to: string; label: string; icon: LucideIcon; needsResult?: boolean }[] }[] = [
  { title: 'Modelagem', items: [{ to: '/', label: 'Início', icon: House }, { to: '/entrada', label: 'Entrada', icon: PencilRuler }] },
  { title: 'Análise', items: [
    { to: '/resolucao', label: 'Resolução', icon: Table2, needsResult: true }, { to: '/graficos', label: 'Gráficos', icon: ChartLine, needsResult: true },
    { to: '/inteira', label: 'Solução inteira', icon: GitFork, needsResult: true }, { to: '/dual', label: 'Dual', icon: ArrowLeftRight, needsResult: true } ] },
  { title: 'Saídas', items: [{ to: '/resultados', label: 'Resultados', icon: ClipboardCheck, needsResult: true }, { to: '/projetos', label: 'Projetos', icon: FolderOpen }] },
]

function StatusCard({ open }: { open: boolean }) {
  const { problem, result, stale } = useApp()
  if (!open) return null
  const st = result?.relaxation.status
  return (
    <NavLink to="/entrada" className="mx-3 mb-3 block rounded-xl border bg-muted/40 p-3 transition-colors hover:bg-muted">
      <p className="kbd-label">Problema atual</p>
      <p className="mt-0.5 truncate text-sm font-semibold">{problem.name || 'Sem nome'}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sizeLabel(problem)}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {!result && <Badge variant="muted">não resolvido</Badge>}
        {st === 'optimal' && <Badge variant="success">Z* = {dec(result!.relaxation.z!.value)}</Badge>}
        {st === 'infeasible' && <Badge variant="danger">inviável</Badge>}
        {st === 'unbounded' && <Badge variant="danger">ilimitado</Badge>}
        {stale && <Badge variant="warn">modelo alterado</Badge>}
      </div>
    </NavLink>
  )
}

export default function Layout() {
  const { dark, toggleTheme, result } = useApp()
  const [open, setOpen] = useState(true)
  const loc = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  const linkCls = ({ isActive }: { isActive: boolean }) => cn('group flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Navegação lateral (desktop) */}
      <aside className={cn('no-print sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-card transition-[width] duration-200 md:flex', open ? 'w-64' : 'w-[76px]')}>
        <div className="flex h-16 items-center gap-2.5 px-4"><LogoMark />{open && <span className="text-[17px] font-semibold tracking-tight">Simplexnator</span>}</div>
        <nav aria-label="Principal" className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
          {groups.map((g) => (
            <div key={g.title}>
              {open && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">{g.title}</p>}
              <div className="space-y-0.5">
                {g.items.map(({ to, label, icon: Icon, needsResult }) => (
                  <NavLink key={to} to={to} end={to === '/'} title={label} className={linkCls}>
                    <Icon size={18} className="shrink-0" />{open && <span>{label}</span>}
                    {open && needsResult && result && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-success" aria-label="disponível" />}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <StatusCard open={open} />
        <div className="flex items-center gap-1 border-t p-3">
          <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={toggleTheme} aria-label="Alternar tema">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button className="ml-auto rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setOpen(!open)} aria-label={open ? 'Recolher menu' : 'Expandir menu'}><ChevronsLeft size={18} className={cn('transition-transform', !open && 'rotate-180')} /></button>
        </div>
      </aside>

      {/* Navegação superior (mobile/tablet) */}
      <header className="app-bar sticky top-0 z-30 border-b bg-card/90 backdrop-blur md:hidden">
        <div className="flex h-14 items-center gap-2.5 px-4"><LogoMark size={26} /><span className="font-semibold tracking-tight">Simplexnator</span>
          <button className="ml-auto rounded-lg p-2 text-muted-foreground hover:bg-muted" onClick={toggleTheme} aria-label="Alternar tema">{dark ? <Sun size={18} /> : <Moon size={18} />}</button></div>
        <nav aria-label="Principal" className="flex gap-1 overflow-x-auto px-3 pb-2">
          {groups.flatMap((g) => g.items).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={linkCls}><Icon size={16} />{label}</NavLink>
          ))}
        </nav>
      </header>

      <main className="min-w-0 flex-1">
        <div key={loc.pathname} className="mx-auto max-w-[1180px] animate-fade-up px-4 py-7 md:px-10 md:py-10"><Outlet /></div>
      </main>
    </div>
  )
}
