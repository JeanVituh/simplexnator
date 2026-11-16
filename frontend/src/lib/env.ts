/** Configuração pública do Firebase (variáveis VITE_FIREBASE_*). Sem ela, o Simplexnator funciona normalmente, sem contas. */
export interface FirebaseConfig { apiKey: string; authDomain: string; projectId: string; appId: string; storageBucket?: string; messagingSenderId?: string }

export function readFirebaseConfig(env: Record<string, string | undefined> = import.meta.env): FirebaseConfig | null {
  const v = (k: string) => (env[`VITE_FIREBASE_${k}`] ?? '').trim()
  const cfg = { apiKey: v('API_KEY'), authDomain: v('AUTH_DOMAIN'), projectId: v('PROJECT_ID'), appId: v('APP_ID'), storageBucket: v('STORAGE_BUCKET') || undefined, messagingSenderId: v('MESSAGING_SENDER_ID') || undefined }
  return cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId ? cfg : null
}
