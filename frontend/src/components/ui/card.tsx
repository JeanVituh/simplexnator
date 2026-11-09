import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('rounded-xl border bg-card shadow-card', className)} {...p} />
export const CardHeader = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('flex flex-col gap-1 px-5 pb-2 pt-5', className)} {...p} />
export const CardTitle = ({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) => <h3 className={cn('text-[15px] font-semibold tracking-tight', className)} {...p} />
export const CardDescription = ({ className, ...p }: HTMLAttributes<HTMLParagraphElement>) => <p className={cn('text-sm leading-relaxed text-muted-foreground', className)} {...p} />
export const CardContent = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('px-5 pb-5 pt-2', className)} {...p} />

/** Cartão com cabeçalho padronizado (título, descrição e ações). */
export function Section({ title, description, actions, children, className, contentClassName }: {
  title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; contentClassName?: string
}) {
  return (
    <Card className={className}>
      {(title || actions) && (
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="min-w-0">{title && <CardTitle>{title}</CardTitle>}{description && <CardDescription className="mt-1">{description}</CardDescription>}</div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </CardHeader>
      )}
      <CardContent className={cn(!title && !actions && 'pt-5', contentClassName)}>{children}</CardContent>
    </Card>
  )
}
