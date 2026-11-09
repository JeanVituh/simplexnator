import * as React from 'react'
import { cn } from '@/lib/utils'

const field = 'h-9 w-full rounded-lg border bg-card px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/70 hover:border-foreground/25 focus:border-primary'

export const Input = ({ className, invalid, ref, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; ref?: React.Ref<HTMLInputElement> }) => (
  <input ref={ref} aria-invalid={invalid || undefined} className={cn(field, invalid && 'border-danger focus:border-danger', className)} {...p} />
)

export const Select = ({ className, ref, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { ref?: React.Ref<HTMLSelectElement> }) => (
  <select ref={ref} className={cn(field, 'cursor-pointer pr-8', className)} {...p} />
)

/** Campo numérico com rascunho de texto: aceita vírgula decimal, sinal e campo vazio (quando permitido). */
export function NumInput({ value, onChange, allowEmpty, placeholder, className, label, invalid }: {
  value: number | null; onChange: (v: number | null) => void; allowEmpty?: boolean; placeholder?: string; className?: string; label?: string; invalid?: boolean
}) {
  const [draft, setDraft] = React.useState<string | null>(null)
  const shown = draft ?? (value === null ? '' : String(value).replace('.', ','))
  return (
    <Input
      inputMode="decimal" aria-label={label} placeholder={placeholder} invalid={invalid}
      className={cn('text-center font-mono tabular-nums', className)} value={shown}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const t = e.target.value
        setDraft(t)
        const n = Number(t.replace(',', '.'))
        if (t.trim() === '') { if (allowEmpty) onChange(null) }
        else if (Number.isFinite(n)) onChange(n)
      }}
      onBlur={() => setDraft(null)}
    />
  )
}
