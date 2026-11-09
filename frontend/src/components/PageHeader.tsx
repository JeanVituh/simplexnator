import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PageHeader({ title, subtitle, eyebrow, children }: { title: string; subtitle?: string; eyebrow?: string; children?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="no-print flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function Empty({ icon: Icon, title, text, to, cta }: { icon: LucideIcon; title: string; text: string; to?: string; cta?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-dashed px-8 py-14 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-primary-soft text-primary"><Icon size={22} /></span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
      {to && <Button asChild className="mt-5"><Link to={to}>{cta ?? 'Abrir'}</Link></Button>}
    </div>
  )
}
