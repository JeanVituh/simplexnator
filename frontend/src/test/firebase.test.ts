import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { assertNoNestedArrays, deserializeProject, friendlyError, MAX_RESULT_CHARS, serializeProject } from '@/lib/cloud'
import { readFirebaseConfig } from '@/lib/env'
import type { ProjectPayload } from '@/lib/project'
import type { Problem, SolveResponse } from '@/lib/types'
import examples from './fixtures/examples.json'
import radioFx from './fixtures/solve-radioterapico.json'

const h = vi.hoisted(() => {
  const state = { listeners: [] as ((u: unknown) => void)[], unsub: vi.fn(), docs: [] as { id: string; data: Record<string, unknown> }[] }
  return {
    state,
    app: { getApps: vi.fn(() => [] as unknown[]), getApp: vi.fn(), initializeApp: vi.fn((cfg: unknown) => ({ cfg })) },
    auth: {
      getAuth: vi.fn(() => ({ languageCode: '' })),
      createUserWithEmailAndPassword: vi.fn(async (_a: unknown, email: string) => ({ user: { uid: 'U1', email, displayName: null } })),
      updateProfile: vi.fn(async () => {}), signInWithEmailAndPassword: vi.fn(), signOut: vi.fn(async () => {}), sendPasswordResetEmail: vi.fn(async () => {}),
      onAuthStateChanged: vi.fn((_a: unknown, cb: (u: unknown) => void) => { state.listeners.push(cb); return state.unsub }),
    },
    fs: {
      getFirestore: vi.fn(() => ({})), serverTimestamp: vi.fn(() => '<<TS>>'),
      collection: vi.fn((_d: unknown, ...p: string[]) => ({ path: p.join('/') })), doc: vi.fn((_d: unknown, ...p: string[]) => ({ path: p.join('/') })),
      orderBy: vi.fn((f: string, d: string) => ({ f, d })), query: vi.fn((c: unknown, ...r: unknown[]) => ({ c, r })),
      addDoc: vi.fn(async () => ({ id: 'NEW1' })), updateDoc: vi.fn(async () => {}), deleteDoc: vi.fn(async () => {}),
      getDocs: vi.fn(async () => ({ docs: state.docs.map((d) => ({ id: d.id, data: () => d.data })) })),
      getDoc: vi.fn(async () => ({ exists: () => false })),
    },
  }
})
vi.mock('firebase/app', () => h.app)
vi.mock('firebase/auth', () => h.auth)
vi.mock('firebase/firestore', () => h.fs)

const cfg = { apiKey: 'k', authDomain: 'a.firebaseapp.com', projectId: 'p', appId: '1:2:web:3' }
const radio = examples.find((e) => e.id === 'radioterapico')!.problem as Problem
const R = radioFx as unknown as SolveResponse
const payload: ProjectPayload = { problem: radio, method: 'bigm', integer: 'all', result: R }
const rules = readFileSync(resolve(process.cwd(), '..', 'firestore.rules'), 'utf-8')   // npm test roda na pasta frontend
const allowedKeys = [...rules.match(/hasOnly\(\[([^\]]+)\]\)/)![1].matchAll(/'([^']+)'/g)].map((m) => m[1])
const requiredKeys = [...rules.match(/hasAll\(\[([^\]]+)\]\)/)![1].matchAll(/'([^']+)'/g)].map((m) => m[1])
const backend = async () => { const { createFirebaseBackend } = await import('@/lib/firebaseBackend'); return createFirebaseBackend(cfg) }

describe('configuração', () => {
  it('só considera configurado quando os campos essenciais existem', () => {
    expect(readFirebaseConfig({})).toBeNull()
    expect(readFirebaseConfig({ VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_AUTH_DOMAIN: 'a' })).toBeNull()
    expect(readFirebaseConfig({ VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_AUTH_DOMAIN: 'a', VITE_FIREBASE_PROJECT_ID: 'p', VITE_FIREBASE_APP_ID: 'i', VITE_FIREBASE_STORAGE_BUCKET: ' ' })).toEqual({ apiKey: 'k', authDomain: 'a', projectId: 'p', appId: 'i', storageBucket: undefined, messagingSenderId: undefined })
  })
})

describe('serialização compatível com o Firestore', () => {
  it('não gera arrays aninhados e guarda os resultados como texto', () => {
    expect(() => assertNoNestedArrays(JSON.parse(JSON.stringify(R)))).toThrow(/aninhado/)   // o resultado cru NÃO poderia ir como mapa
    const s = serializeProject(payload)
    expect(() => assertNoNestedArrays(s)).not.toThrow(); expect(s.resultJson).toBeTypeOf('string'); expect(s.resultOmitted).toBe(false)
    expect(serializeProject({ ...payload, result: null })).toMatchObject({ resultJson: null, resultOmitted: false })
  })
  it('omite resultados maiores que o limite do documento e informa', () => {
    const big = { ...R, padding: 'x'.repeat(MAX_RESULT_CHARS) } as unknown as SolveResponse
    expect(serializeProject({ ...payload, result: big })).toMatchObject({ resultJson: null, resultOmitted: true })
  })
  it('ida e volta; resultado ilegível ou incompatível é descartado com aviso', () => {
    const s = serializeProject(payload)
    expect(deserializeProject(s).payload.result).toEqual(R); expect(deserializeProject(s).payload.problem).toEqual(radio)
    expect(deserializeProject({ ...s, resultJson: '{quebrado' })).toMatchObject({ payload: { result: null }, warnings: [expect.stringMatching(/ilegíveis/)] })
    expect(deserializeProject({ ...s, resultJson: JSON.stringify({ a: 1 }) }).warnings.join()).toMatch(/não são compatíveis/)
  })
  it('mensagens de erro amigáveis', () => {
    expect(friendlyError({ code: 'auth/email-already-in-use' })).toMatch(/Já existe/); expect(friendlyError({ code: 'firestore/permission-denied' })).toMatch(/Sem permissão/)
    expect(friendlyError({ code: 'auth/invalid-credential' })).toBe('E-mail ou senha incorretos.'); expect(friendlyError(new Error('x'))).toBe('x')
  })
})

describe('adaptador Firebase (módulos simulados)', () => {
  beforeEach(() => { Object.values(h.fs).forEach((f) => (f as { mockClear?: () => void }).mockClear?.()); h.state.docs = [] })
  it('cadastra com nome e inicializa o app uma única vez', async () => {
    const be = await backend()
    const u = await be.register('  Ana ', 'ana@exemplo.com', 'senha-segura-1')
    expect(u).toEqual({ uid: 'U1', name: 'Ana', email: 'ana@exemplo.com' }); expect(h.auth.updateProfile).toHaveBeenCalledWith(expect.anything(), { displayName: 'Ana' })
    expect(h.app.initializeApp).toHaveBeenCalledTimes(1); expect(h.app.initializeApp).toHaveBeenCalledWith(cfg)
  })
  it('traduz erros de autenticação', async () => {
    h.auth.signInWithEmailAndPassword.mockRejectedValueOnce({ code: 'auth/invalid-credential' })
    await expect((await backend()).login('a@b.co', 'x')).rejects.toThrow('E-mail ou senha incorretos.')
  })
  it('observa a sessão e cancela a assinatura', async () => {
    const be = await backend(); const seen: unknown[] = []
    const off = be.onAuth((u) => seen.push(u))
    await vi.waitFor(() => expect(h.state.listeners.length).toBeGreaterThan(0))
    h.state.listeners.at(-1)!({ uid: 'U1', displayName: 'Ana', email: 'a@b.co' }); h.state.listeners.at(-1)!(null)
    expect(seen).toEqual([{ uid: 'U1', name: 'Ana', email: 'a@b.co' }, null]); off(); expect(h.state.unsub).toHaveBeenCalled()
  })
  it('cria o projeto em users/{uid}/projects com exatamente os campos permitidos pelas regras', async () => {
    const r = await (await backend()).create('U1', ' Meu projeto ', payload)
    expect(r).toEqual({ id: 'NEW1', resultOmitted: false })
    const [colRef, data] = h.fs.addDoc.mock.calls[0] as unknown as [{ path: string }, Record<string, unknown>]
    expect(colRef.path).toBe('users/U1/projects')
    expect(Object.keys(data).every((k) => allowedKeys.includes(k))).toBe(true); expect(requiredKeys.every((k) => k in data)).toBe(true)
    expect(data).toMatchObject({ name: 'Meu projeto', method: 'bigm', integer: 'all', schemaVersion: 2, ownerId: 'U1', createdAt: '<<TS>>', updatedAt: '<<TS>>' })
    expect(data.resultJson).toBeTypeOf('string'); expect(() => assertNoNestedArrays(data)).not.toThrow()
  })
  it('atualiza sem mexer em createdAt/ownerId e sempre renovando updatedAt', async () => {
    await (await backend()).update('U1', 'P9', payload)
    const [ref, data] = h.fs.updateDoc.mock.calls[0] as unknown as [{ path: string }, Record<string, unknown>]
    expect(ref.path).toBe('users/U1/projects/P9'); expect(data.updatedAt).toBe('<<TS>>')
    expect('createdAt' in data || 'ownerId' in data).toBe(false); expect(Object.keys(data).every((k) => allowedKeys.includes(k))).toBe(true)
  })
  it('lista ordenada por atualização, abre e trata "não encontrado" e "permissão negada"', async () => {
    const be = await backend()
    h.state.docs = [{ id: 'A', data: { name: 'Um', resultJson: '{}', resultOmitted: false, createdAt: { toDate: () => new Date('2026-01-01') }, updatedAt: { toDate: () => new Date('2026-02-01') } } }]
    const list = await be.list('U1')
    expect(list).toEqual([expect.objectContaining({ id: 'A', name: 'Um', hasResult: true, updatedAt: new Date('2026-02-01') })])
    expect(h.fs.orderBy).toHaveBeenCalledWith('updatedAt', 'desc'); expect((h.fs.collection.mock.calls.at(-1) as unknown as string[]).slice(1)).toEqual(['users', 'U1', 'projects'])
    await expect(be.get('U1', 'X')).rejects.toThrow('Projeto não encontrado.')
    h.fs.deleteDoc.mockRejectedValueOnce({ code: 'permission-denied' })
    await expect(be.remove('OUTRO', 'A')).rejects.toThrow('Sem permissão para acessar este projeto.')
  })
})

describe('regras do Firestore (verificação estática do arquivo)', () => {
  it('restringe ao dono e nega o restante por padrão', () => {
    expect(rules).toContain("rules_version = '2'"); expect(rules).toContain('match /users/{uid}/projects/{projectId}')
    expect(rules).toContain('request.auth.uid == uid'); expect(rules).toMatch(/match \/\{document=\*\*\} \{\s*allow read, write: if false;/)
    expect(rules).not.toMatch(/if true/); expect(rules).not.toMatch(/allow [^;]*: if request\.auth != null;/)
    for (const op of ['read', 'create', 'update', 'delete']) expect(rules).toMatch(new RegExp(`allow ${op}: if isOwner\\(uid\\)`))
  })
  it('o cliente envia somente campos que as regras aceitam', () => {
    const keys = [...Object.keys(serializeProject(payload)), 'name', 'schemaVersion', 'ownerId', 'createdAt', 'updatedAt']
    expect(keys.every((k) => allowedKeys.includes(k))).toBe(true)
  })
})

describe('dependências do Firebase', () => {
  it('há uma única cópia de @firebase/app (duas cópias impedem o Auth de se registrar: "Component auth has not been registered yet")', () => {
    const from = (pkg: string, dep: string) => createRequire(resolve(process.cwd(), 'node_modules', pkg, 'package.json')).resolve(dep)
    const app = from('firebase', '@firebase/app')
    expect(from('@firebase/auth', '@firebase/app')).toBe(app)
    expect(from('@firebase/firestore', '@firebase/app')).toBe(app)
    expect(from('@firebase/auth', '@firebase/component')).toBe(from('firebase', '@firebase/component'))
  })
})
