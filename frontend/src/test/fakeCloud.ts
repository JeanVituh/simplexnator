import { friendlyError, serializeProject, deserializeProject, type CloudBackend, type CloudProjectMeta, type CloudUser } from '@/lib/cloud'
import type { ProjectPayload } from '@/lib/project'

const err = (code: string) => Object.assign(new Error(friendlyError({ code })), { code })

/** Backend em memória que imita as regras do Firestore: só o dono (uid da sessão) lê e grava em users/{uid}/projects. */
export function createFakeCloud(opts: { configured?: boolean; session?: CloudUser | null; failWrites?: boolean } = {}) {
  const users = new Map<string, { uid: string; name: string; password: string }>()
  const db = new Map<string, Map<string, { name: string; stored: ReturnType<typeof serializeProject>; createdAt: Date; updatedAt: Date }>>()
  let session: CloudUser | null = opts.session ?? null
  const listeners = new Set<(u: CloudUser | null) => void>()
  const emit = () => listeners.forEach((l) => l(session))
  let seq = 0
  const owner = (uid: string) => { if (!session) throw err('unauthenticated'); if (session.uid !== uid) throw err('permission-denied') }
  const meta = (id: string, d: { name: string; stored: { resultJson: string | null; resultOmitted: boolean }; createdAt: Date; updatedAt: Date }): CloudProjectMeta =>
    ({ id, name: d.name, createdAt: d.createdAt, updatedAt: d.updatedAt, hasResult: d.stored.resultJson !== null, resultOmitted: d.stored.resultOmitted })

  const backend: CloudBackend & { calls: string[]; db: typeof db; users: typeof users; setSession: (u: CloudUser | null) => void } = {
    configured: opts.configured ?? true, calls: [], db, users,
    setSession(u) { session = u; emit() },
    onAuth(cb) { listeners.add(cb); queueMicrotask(() => cb(session)); return () => { listeners.delete(cb) } },
    async register(name, email, password) {
      backend.calls.push('register')
      if (users.has(email)) throw err('auth/email-already-in-use')
      const u = { uid: `uid-${++seq}`, name, password }; users.set(email, u)
      session = { uid: u.uid, name, email }; emit(); return session
    },
    async login(email, password) {
      backend.calls.push('login')
      const u = users.get(email)
      if (!u || u.password !== password) throw err('auth/invalid-credential')
      session = { uid: u.uid, name: u.name, email }; emit(); return session
    },
    async logout() { backend.calls.push('logout'); session = null; emit() },
    async resetPassword(email) { backend.calls.push(`reset:${email}`) },
    async list(uid) {
      owner(uid)
      return [...(db.get(uid) ?? new Map()).entries()].map(([id, d]) => meta(id, d)).sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
    },
    async get(uid, id) {
      owner(uid)
      const d = db.get(uid)?.get(id)
      if (!d) throw err('not-found')
      return { meta: meta(id, d), ...deserializeProject(d.stored) }
    },
    async create(uid, name, payload: ProjectPayload) {
      owner(uid); backend.calls.push('create')
      if (opts.failWrites) throw err('unavailable')
      const id = `p${++seq}`, now = new Date(Date.now() + seq)
      const stored = serializeProject(payload)
      if (!db.has(uid)) db.set(uid, new Map())
      db.get(uid)!.set(id, { name, stored, createdAt: now, updatedAt: now })
      return { id, resultOmitted: stored.resultOmitted }
    },
    async update(uid, id, payload, name) {
      owner(uid); backend.calls.push(`update:${id}`)
      if (opts.failWrites) throw err('unavailable')
      const d = db.get(uid)?.get(id)
      if (!d) throw err('permission-denied')
      const stored = serializeProject(payload)
      db.get(uid)!.set(id, { ...d, name: name ?? d.name, stored, updatedAt: new Date(Date.now() + ++seq) })
      return { resultOmitted: stored.resultOmitted }
    },
    async remove(uid, id) { owner(uid); backend.calls.push(`remove:${id}`); db.get(uid)?.delete(id) },
  }
  return backend
}
