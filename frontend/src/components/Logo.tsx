export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path d="M8 23 14 9l10 6-4 8z" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="14" cy="9" r="2.4" fill="hsl(var(--primary-foreground))" />
    </svg>
  )
}
