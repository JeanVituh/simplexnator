import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { friendlyError, MAX_NAME, noopBackend, type CloudBackend, type CloudProjectMeta, type CloudUser } from './cloud'
import { readFirebaseConfig } from './env'
import { createFirebaseBackend } from './firebaseBackend'
import type { ProjectPayload } from './project'
import { useApp } from '@/store'
import { useToast } from '@/components/ui/toast'

interface CloudCtx {
  configured: boolean; ready: boolean; user: CloudUser | null
  projects: CloudProjectMeta[]; loadingProjects: boolean; saving: boolean
  autoSave: boolean; setAutoSave: (b: boolean) => void
  register: (name: string, email: string, password: string) => Promise<string | null>
  login: (email: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<string | null>
  refresh: () => Promise<void>
  saveNew: (name: string) => Promise<boolean>
  saveCurrent: () => Promise<boolean>
  overwrite: (id: string, name: string) => Promise<boolean>
  open: (id: string) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
}
const Ctx = createContext<CloudCtx | null>(null)
export const useCloud = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCloud deve ser usado dentro de CloudProvider')
  return c
}

let cached: CloudBackend | null = null
const defaultBackend = (): CloudBackend => {
  if (!cached) { const cfg = readFirebaseConfig(); cached = cfg ? createFirebaseBackend(cfg) : noopBackend }
  return cached
}

export function CloudProvider({ backend, children }: { backend?: CloudBackend; children: ReactNode }) {
  const be = useMemo(() => backend ?? defaultBackend(), [backend])
  const toast = useToast()
  const app = useApp()
  const { problem, method, integer, result, solvedProblem, stale, binding, setBinding, restoreProject, solveCount } = app
  const [user, setUser] = useState<CloudUser | null>(null)
  const [ready, setReady] = useState(false)
  const [projects, setProjects] = useState<CloudProjectMeta[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [saving, setSaving] = useState(false)
  const [autoSave, setAutoSave] = useState(true)

  useEffect(() => be.onAuth((u) => { setUser(u); setReady(true) }), [be])

  const refresh = useCallback(async () => {
    if (!user) { setProjects([]); return }
    setLoadingProjects(true)
    try { setProjects(await be.list(user.uid)) }
    catch (e) { toast({ kind: 'error', title: 'Não foi possível listar os projetos', description: friendlyError(e) }) }
    finally { setLoadingProjects(false) }
  }, [be, user, toast])
  useEffect(() => { setProjects([]); void refresh() }, [refresh])   // limpa antes de carregar: nunca exibe projetos do usuário anterior
  useEffect(() => { if (!user) setBinding(null) }, [user, setBinding])

  /** Modelo atual + resultados, somente quando os resultados correspondem ao modelo exibido. */
  const payload = useCallback((): ProjectPayload => ({ problem, method, integer, result: result && !stale ? result : null }), [problem, method, integer, result, stale])
  const note = (omitted: boolean) => omitted && toast({ kind: 'error', title: 'Resultados não salvos', description: 'Os resultados são grandes demais para a nuvem; foram salvos apenas o modelo e as configurações.' })

  const guard = async (fn: () => Promise<boolean>, failTitle: string): Promise<boolean> => {
    setSaving(true)
    try { return await fn() } catch (e) { toast({ kind: 'error', title: failTitle, description: friendlyError(e) }); return false } finally { setSaving(false) }
  }

  const saveNew = (name: string) => guard(async () => {
    if (!user) throw new Error('Entre na sua conta para salvar projetos.')
    const nm = name.trim().slice(0, MAX_NAME)
    if (!nm) throw new Error('Informe um nome para o projeto.')
    const r = await be.create(user.uid, nm, payload())
    setBinding({ id: r.id, name: nm }); note(r.resultOmitted)
    toast({ kind: 'success', title: 'Projeto salvo na nuvem', description: `“${nm}” foi criado. Novas resoluções atualizarão este projeto.` })
    await refresh(); return true
  }, 'Não foi possível salvar o projeto')

  const overwrite = (id: string, name: string) => guard(async () => {
    if (!user) throw new Error('Entre na sua conta para salvar projetos.')
    const r = await be.update(user.uid, id, payload()); note(r.resultOmitted)
    setBinding({ id, name })
    toast({ kind: 'success', title: 'Projeto atualizado', description: `“${name}” foi atualizado na nuvem.` })
    await refresh(); return true
  }, 'Não foi possível atualizar o projeto')

  const saveCurrent = () => (binding ? overwrite(binding.id, binding.name) : Promise.resolve(false))

  const open = (id: string) => guard(async () => {
    if (!user) throw new Error('Entre na sua conta para abrir projetos.')
    const r = await be.get(user.uid, id)
    restoreProject(r.payload, { id, name: r.meta.name })
    toast({ kind: 'success', title: 'Projeto aberto', description: `“${r.meta.name}”${r.payload.result ? ' com os resultados salvos' : ''}.` })
    r.warnings.forEach((w) => toast({ kind: 'error', title: 'Aviso ao abrir o projeto', description: w }))
    return true
  }, 'Não foi possível abrir o projeto')

  const remove = (id: string) => guard(async () => {
    if (!user) throw new Error('Entre na sua conta.')
    await be.remove(user.uid, id)
    if (binding?.id === id) setBinding(null)
    toast({ kind: 'success', title: 'Projeto excluído' }); await refresh(); return true
  }, 'Não foi possível excluir o projeto')

  // Salvamento automático: só atualiza o projeto vinculado (aberto ou salvo pelo usuário) após uma nova resolução, e sempre avisa.
  const seen = useRef(solveCount)
  useEffect(() => {
    if (solveCount === seen.current) return
    seen.current = solveCount
    if (!user || !binding || !autoSave || !result || !solvedProblem) return
    const b = binding
    void (async () => {
      setSaving(true)
      try {
        const r = await be.update(user.uid, b.id, { problem: solvedProblem, method, integer, result })
        note(r.resultOmitted)
        toast({ kind: 'success', title: 'Projeto atualizado na nuvem', description: `“${b.name}” foi salvo com a nova resolução.` })
        void refresh()
      } catch (e) { toast({ kind: 'error', title: 'Falha no salvamento automático', description: `${friendlyError(e)} O projeto na nuvem não foi alterado.` }) }
      finally { setSaving(false) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solveCount])

  const auth = (fn: () => Promise<unknown>) => async (): Promise<string | null> => { try { await fn(); return null } catch (e) { return friendlyError(e) } }
  const value: CloudCtx = {
    configured: be.configured, ready, user, projects, loadingProjects, saving, autoSave, setAutoSave,
    register: (n, e, p) => auth(() => be.register(n, e, p))(), login: (e, p) => auth(() => be.login(e, p))(),
    resetPassword: (e) => auth(() => be.resetPassword(e))(),
    logout: async () => { try { await be.logout(); setProjects([]); toast({ kind: 'success', title: 'Você saiu da conta' }) } catch (e) { toast({ kind: 'error', title: 'Não foi possível sair', description: friendlyError(e) }) } },
    refresh, saveNew, saveCurrent, overwrite, open, remove,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
