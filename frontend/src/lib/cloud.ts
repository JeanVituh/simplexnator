import { isCompatibleResult, parseProjectFile, type ProjectPayload } from './project'
import type { IntegerMode, Method } from './types'

export interface CloudUser { uid: string; name: string | null; email: string | null }
export interface CloudProjectMeta { id: string; name: string; createdAt: Date | null; updatedAt: Date | null; hasResult: boolean; resultOmitted: boolean }

/** Contrato entre a aplicação e o armazenamento em conta (Firebase em produção; substituível em testes). */
export interface CloudBackend {
  readonly configured: boolean
  onAuth(cb: (u: CloudUser | null) => void): () => void
  register(name: string, email: string, password: string): Promise<CloudUser>
  login(email: string, password: string): Promise<CloudUser>
  logout(): Promise<void>
  resetPassword(email: string): Promise<void>
  list(uid: string): Promise<CloudProjectMeta[]>
  get(uid: string, id: string): Promise<{ meta: CloudProjectMeta; payload: ProjectPayload; warnings: string[] }>
  create(uid: string, name: string, payload: ProjectPayload): Promise<{ id: string; resultOmitted: boolean }>
  update(uid: string, id: string, payload: ProjectPayload, name?: string): Promise<{ resultOmitted: boolean }>
  remove(uid: string, id: string): Promise<void>
}

export const MAX_RESULT_CHARS = 900_000   // documento do Firestore: limite de 1 MiB
export const MAX_NAME = 120

export interface StoredProject { problem: unknown; method: Method; integer: IntegerMode; resultJson: string | null; resultOmitted: boolean }

/** O Firestore não aceita arrays dentro de arrays; os resultados vão como texto JSON e só o modelo vai como mapa. */
export function serializeProject(p: ProjectPayload): StoredProject {
  const resultJson = p.result ? JSON.stringify(p.result) : null
  const tooBig = resultJson !== null && resultJson.length > MAX_RESULT_CHARS
  const stored: StoredProject = {
    problem: JSON.parse(JSON.stringify(p.problem)), method: p.method, integer: p.integer,
    resultJson: tooBig ? null : resultJson, resultOmitted: tooBig,
  }
  assertNoNestedArrays(stored.problem, 'problem')
  return stored
}

export function deserializeProject(doc: { problem?: unknown; method?: unknown; integer?: unknown; resultJson?: unknown }): { payload: ProjectPayload; warnings: string[] } {
  let result: unknown = null
  const warnings: string[] = []
  if (typeof doc.resultJson === 'string') {
    try { result = JSON.parse(doc.resultJson) } catch { warnings.push('Os resultados salvos estão ilegíveis e foram ignorados.') }
  }
  const { payload, warnings: w } = parseProjectFile({ problem: doc.problem, settings: { method: doc.method, integer: doc.integer }, result })
  if (payload.result && !isCompatibleResult(payload.result, payload.problem)) payload.result = null
  return { payload, warnings: [...warnings, ...w] }
}

export function assertNoNestedArrays(v: unknown, path = ''): void {
  if (Array.isArray(v)) {
    v.forEach((x, i) => { if (Array.isArray(x)) throw new Error(`Array aninhado em ${path}[${i}] não é aceito pelo Firestore`); assertNoNestedArrays(x, `${path}[${i}]`) })
  } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) assertNoNestedArrays(x, `${path}.${k}`)
}

const CODES: Record<string, string> = {
  'auth/email-already-in-use': 'Já existe uma conta com este e-mail.',
  'auth/invalid-email': 'O e-mail informado é inválido.',
  'auth/weak-password': 'A senha é fraca demais. Use pelo menos 8 caracteres.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'permission-denied': 'Sem permissão para acessar este projeto.',
  'unauthenticated': 'Entre na sua conta para continuar.',
  'not-found': 'Projeto não encontrado.',
  'unavailable': 'O serviço está indisponível no momento. Tente novamente em instantes.',
  'resource-exhausted': 'Limite de uso do serviço atingido. Tente novamente mais tarde.',
}
export function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code
  if (code && CODES[code.replace(/^firestore\//, '')]) return CODES[code.replace(/^firestore\//, '')]
  if (code && CODES[code]) return CODES[code]
  return e instanceof Error && e.message ? e.message : 'Ocorreu um erro inesperado.'
}

/** Implementação usada quando o Firebase não está configurado: o aplicativo segue funcionando sem contas. */
export const noopBackend: CloudBackend = {
  configured: false,
  onAuth(cb) { cb(null); return () => {} },
  register: () => Promise.reject(new Error('Contas não estão disponíveis nesta instalação.')),
  login: () => Promise.reject(new Error('Contas não estão disponíveis nesta instalação.')),
  logout: () => Promise.resolve(),
  resetPassword: () => Promise.reject(new Error('Contas não estão disponíveis nesta instalação.')),
  list: () => Promise.resolve([]),
  get: () => Promise.reject(new Error('Contas não estão disponíveis nesta instalação.')),
  create: () => Promise.reject(new Error('Contas não estão disponíveis nesta instalação.')),
  update: () => Promise.reject(new Error('Contas não estão disponíveis nesta instalação.')),
  remove: () => Promise.reject(new Error('Contas não estão disponíveis nesta instalação.')),
}
