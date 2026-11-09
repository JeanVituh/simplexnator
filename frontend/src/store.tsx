import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { solveProblem } from '@/lib/api'
import { dec } from '@/lib/format'
import type { Example, ExampleContext, HistoryItem, IntegerMode, Method, Problem, SolveResponse } from '@/lib/types'
import { useToast } from '@/components/ui/toast'

export const emptyProblem = (): Problem => ({
  name: 'Novo problema', sense: 'max', objective: [0, 0],
  variables: [{ name: 'x1', kind: 'continuous', lower: 0, upper: null }, { name: 'x2', kind: 'continuous', lower: 0, upper: null }],
  constraints: [{ name: 'R1', coefficients: [0, 0], relation: '<=', rhs: 0 }],
})
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

interface Ctx {
  problem: Problem; setProblem: (p: Problem) => void
  method: Method; setMethod: (m: Method) => void
  integer: IntegerMode; setInteger: (m: IntegerMode) => void
  result: SolveResponse | null; solvedProblem: Problem | null; stale: boolean
  loading: boolean; error: string | null
  solve: (p?: Problem) => Promise<boolean>
  newProblem: () => void; loadProblem: (p: Problem) => void; loadExample: (e: Example) => void
  context: ExampleContext | null
  history: HistoryItem[]; removeHistory: (id: string) => void; clearHistory: () => void
  dark: boolean; toggleTheme: () => void
  showFrac: boolean; setShowFrac: (b: boolean) => void
}
const AppCtx = createContext<Ctx | null>(null)
export const useApp = () => {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp deve ser usado dentro de AppProvider')
  return c
}

const HKEY = 'simplexnator.history'
const readHistory = (): HistoryItem[] => {
  try { return JSON.parse(localStorage.getItem(HKEY) ?? '[]') } catch { return [] }
}
const prefersDark = () => {
  const saved = localStorage.getItem('simplexnator.theme')
  return saved ? saved === 'dark' : typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
}

export function AppProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [problem, setProblem] = useState<Problem>(emptyProblem)
  const [method, setMethod] = useState<Method>('bigm')
  const [integer, setInteger] = useState<IntegerMode>('all')
  const [result, setResult] = useState<SolveResponse | null>(null)
  const [solvedProblem, setSolved] = useState<Problem | null>(null)
  const [context, setContext] = useState<ExampleContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>(readHistory)
  const [showFrac, setShowFrac] = useState(false)
  const [dark, setDark] = useState(prefersDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('simplexnator.theme', dark ? 'dark' : 'light')
  }, [dark])
  useEffect(() => { localStorage.setItem(HKEY, JSON.stringify(history.slice(0, 30))) }, [history])

  const solve = useCallback(async (p?: Problem) => {
    const prob = p ?? problem
    setLoading(true); setError(null)
    try {
      const r = await solveProblem(prob, method, integer)
      setResult(r); setSolved(clone(prob))
      const z = r.relaxation.z
      const summary = r.relaxation.status === 'optimal' && z ? `Z* = ${dec(z.value)}` : r.relaxation.status === 'infeasible' ? 'Inviável' : 'Ilimitado'
      setHistory((h) => [{ id: crypto.randomUUID(), date: new Date().toISOString(), problem: clone(prob), method, integer, summary }, ...h])
      if (r.relaxation.status === 'optimal') toast({ kind: 'success', title: 'Problema resolvido', description: `Solução ótima encontrada: ${summary}.` })
      else toast({ kind: 'error', title: r.relaxation.status === 'infeasible' ? 'Problema inviável' : 'Problema ilimitado', description: 'Veja os detalhes na página Resolução.' })
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido'
      setError(msg); toast({ kind: 'error', title: 'Não foi possível resolver', description: msg })
      return false
    } finally { setLoading(false) }
  }, [problem, method, integer, toast])

  const loadProblem = useCallback((p: Problem) => { setProblem(clone(p)); setResult(null); setSolved(null); setError(null); setContext(null) }, [])
  const newProblem = useCallback(() => loadProblem(emptyProblem()), [loadProblem])
  const loadExample = useCallback((e: Example) => { loadProblem(e.problem); setContext(e.context ?? null) }, [loadProblem])
  const stale = !!result && !!solvedProblem && JSON.stringify(problem) !== JSON.stringify(solvedProblem)

  const value = useMemo<Ctx>(() => ({
    problem, setProblem, method, setMethod, integer, setInteger, result, solvedProblem, stale, loading, error, solve,
    newProblem, loadProblem, loadExample, context,
    history, removeHistory: (id) => setHistory((h) => h.filter((x) => x.id !== id)), clearHistory: () => setHistory([]),
    dark, toggleTheme: () => setDark((d) => !d), showFrac, setShowFrac,
  }), [problem, method, integer, result, solvedProblem, stale, loading, error, solve, newProblem, loadProblem, loadExample, context, history, dark, showFrac])
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
