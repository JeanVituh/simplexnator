import type { FirebaseConfig } from './env'
import { deserializeProject, friendlyError, serializeProject, MAX_NAME, type CloudBackend, type CloudProjectMeta, type CloudUser } from './cloud'
import type { ProjectPayload } from './project'

type Auth = typeof import('firebase/auth')
type Fs = typeof import('firebase/firestore')
interface Sdk { auth: ReturnType<Auth['getAuth']>; db: ReturnType<Fs['getFirestore']>; A: Auth; F: Fs }

const toUser = (u: { uid: string; displayName: string | null; email: string | null }): CloudUser => ({ uid: u.uid, name: u.displayName, email: u.email })
const toDate = (v: unknown): Date | null => (v && typeof (v as { toDate?: unknown }).toDate === 'function' ? (v as { toDate: () => Date }).toDate() : null)

/**
 * Firebase Authentication + Cloud Firestore. O SDK só é baixado quando a configuração existe e a conta é utilizada.
 * Estrutura: users/{uid}/projects/{id} (as regras em firestore.rules restringem o acesso ao dono).
 */
export function createFirebaseBackend(cfg: FirebaseConfig): CloudBackend {
  let sdk: Promise<Sdk> | null = null
  const load = () => (sdk ??= (async () => {
    const [app, A, F] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')])
    const a = app.getApps().length ? app.getApp() : app.initializeApp(cfg)
    const auth = A.getAuth(a)
    auth.languageCode = 'pt-BR'
    return { auth, db: F.getFirestore(a), A, F }
  })())
  const col = (s: Sdk, uid: string) => s.F.collection(s.db, 'users', uid, 'projects')
  const meta = (id: string, d: Record<string, unknown>): CloudProjectMeta => ({
    id, name: String(d.name ?? 'Sem nome'), createdAt: toDate(d.createdAt), updatedAt: toDate(d.updatedAt),
    hasResult: typeof d.resultJson === 'string', resultOmitted: d.resultOmitted === true,
  })
  const wrap = async <T>(fn: () => Promise<T>): Promise<T> => { try { return await fn() } catch (e) { throw new Error(friendlyError(e)) } }

  return {
    configured: true,
    onAuth(cb) {
      let off: (() => void) | null = null, cancelled = false
      load().then((s) => { if (!cancelled) off = s.A.onAuthStateChanged(s.auth, (u) => cb(u ? toUser(u) : null)) }).catch(() => cb(null))
      return () => { cancelled = true; off?.() }
    },
    register: (name, email, password) => wrap(async () => {
      const s = await load()
      const cred = await s.A.createUserWithEmailAndPassword(s.auth, email.trim(), password)
      await s.A.updateProfile(cred.user, { displayName: name.trim() })
      return { uid: cred.user.uid, name: name.trim(), email: cred.user.email }
    }),
    login: (email, password) => wrap(async () => { const s = await load(); return toUser((await s.A.signInWithEmailAndPassword(s.auth, email.trim(), password)).user) }),
    logout: () => wrap(async () => { const s = await load(); await s.A.signOut(s.auth) }),
    resetPassword: (email) => wrap(async () => { const s = await load(); await s.A.sendPasswordResetEmail(s.auth, email.trim()) }),
    list: (uid) => wrap(async () => {
      const s = await load()
      const snap = await s.F.getDocs(s.F.query(col(s, uid), s.F.orderBy('updatedAt', 'desc')))
      return snap.docs.map((d) => meta(d.id, d.data()))
    }),
    get: (uid, id) => wrap(async () => {
      const s = await load()
      const snap = await s.F.getDoc(s.F.doc(s.db, 'users', uid, 'projects', id))
      if (!snap.exists()) throw Object.assign(new Error('Projeto não encontrado.'), { code: 'not-found' })
      const d = snap.data()
      return { meta: meta(snap.id, d), ...deserializeProject(d) }
    }),
    create: (uid, name, payload: ProjectPayload) => wrap(async () => {
      const s = await load()
      const st = serializeProject(payload)
      const ref = await s.F.addDoc(col(s, uid), { name: name.trim().slice(0, MAX_NAME), ...st, schemaVersion: 2, ownerId: uid, createdAt: s.F.serverTimestamp(), updatedAt: s.F.serverTimestamp() })
      return { id: ref.id, resultOmitted: st.resultOmitted }
    }),
    update: (uid, id, payload, name) => wrap(async () => {
      const s = await load()
      const st = serializeProject(payload)
      await s.F.updateDoc(s.F.doc(s.db, 'users', uid, 'projects', id), { ...(name ? { name: name.trim().slice(0, MAX_NAME) } : {}), ...st, updatedAt: s.F.serverTimestamp() })
      return { resultOmitted: st.resultOmitted }
    }),
    remove: (uid, id) => wrap(async () => { const s = await load(); await s.F.deleteDoc(s.F.doc(s.db, 'users', uid, 'projects', id)) }),
  }
}
