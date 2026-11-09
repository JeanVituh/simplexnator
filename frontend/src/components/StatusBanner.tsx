import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const MAP = {
  optimal: { icon: CheckCircle2, title: 'Solução ótima encontrada', cls: 'border-success/30 bg-success-soft text-success' },
  infeasible: { icon: XCircle, title: 'Problema inviável', cls: 'border-danger/30 bg-danger-soft text-danger' },
  unbounded: { icon: AlertTriangle, title: 'Problema ilimitado', cls: 'border-danger/30 bg-danger-soft text-danger' },
} as const

export function StatusBanner({ status, message }: { status: string; message?: string }) {
  const m = MAP[status as keyof typeof MAP] ?? MAP.optimal
  const Icon = m.icon
  return (
    <div role="status" className={cn('mb-5 flex items-start gap-3 rounded-xl border px-4 py-3', m.cls)}>
      <Icon size={20} className="mt-0.5 shrink-0" />
      <div><p className="font-semibold">{m.title}</p>{message && <p className="mt-0.5 text-sm opacity-90">{message}</p>}</div>
    </div>
  )
}
