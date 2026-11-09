import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Toast { id: number; title: string; description?: string; kind: 'success' | 'error' }
const Ctx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const dismiss = (id: number) => setItems((l) => l.filter((t) => t.id !== id))
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setItems((l) => [...l.slice(-2), { ...t, id }])
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), t.kind === 'error' ? 7000 : 3800)
  }, [])
  const value = useMemo(() => push, [push])
  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="no-print fixed bottom-4 right-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role="status" className="flex animate-toast-in items-start gap-3 rounded-xl border bg-card p-3.5 shadow-pop">
            {t.kind === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />}
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{t.title}</p>{t.description && <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>}</div>
            <button onClick={() => dismiss(t.id)} aria-label="Fechar" className={cn('rounded p-1 text-muted-foreground hover:bg-muted')}><X size={14} /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
