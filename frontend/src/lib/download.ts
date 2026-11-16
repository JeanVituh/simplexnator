export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadJson(name: string, data: unknown) {
  downloadBlob(name, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
}

export const safeFileName = (s: string, fallback = 'problema') => (s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || fallback)
