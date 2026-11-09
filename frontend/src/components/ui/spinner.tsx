import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Spinner = ({ className, size = 16 }: { className?: string; size?: number }) => <Loader2 size={size} className={cn('animate-spin', className)} aria-hidden />
export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('relative overflow-hidden rounded-lg bg-muted before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.4s_infinite] before:bg-gradient-to-r before:from-transparent before:via-foreground/5 before:to-transparent', className)} />
)
