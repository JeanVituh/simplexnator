import { cn } from '@/lib/utils'

export function Segmented<T extends string>({ value, onChange, options, label, className }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex w-full rounded-lg bg-muted p-1', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn('h-7 flex-1 rounded-md px-3 text-[13px] font-medium transition-all', value === o.value ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
