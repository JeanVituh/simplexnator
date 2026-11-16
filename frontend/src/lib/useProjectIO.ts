import { useState } from 'react'
import { downloadBlob, downloadJson, safeFileName } from './download'
import { buildProjectFile, ImportError, type ProjectPayload } from './project'
import type { ImageRenderer } from './zip'
import { useApp } from '@/store'
import { useToast } from '@/components/ui/toast'

/** Exportação (JSON e ZIP) e importação do projeto atual, compartilhadas pelas páginas Resultados e Projetos. */
export function useProjectIO(render?: ImageRenderer) {
  const { problem, method, integer, result, stale, restoreProject } = useApp()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const payload = (): ProjectPayload => ({ problem, method, integer, result: result && !stale ? result : null })
  const base = () => safeFileName(problem.name)

  const exportJson = () => { downloadJson(`${base()}.json`, buildProjectFile(payload())); toast({ kind: 'success', title: 'JSON exportado', description: 'Modelo, configurações e resultados salvos no arquivo.' }) }

  const exportZip = async () => {
    setBusy(true)
    try {
      const { exportProjectZip } = await import('./zip')   // JSZip só é baixado quando o usuário exporta/importa
      const z = await exportProjectZip(payload(), render)
      downloadBlob(`${base()}.zip`, z.blob)
      toast({ kind: 'success', title: 'ZIP exportado', description: z.images.length ? `projeto.json e ${z.images.length} gráfico(s) em PNG.` : 'projeto.json e README.txt (sem gráficos).' })
      z.notes.forEach((n) => toast({ kind: 'error', title: 'Gráficos', description: n }))
    } catch (e) { toast({ kind: 'error', title: 'Não foi possível exportar o ZIP', description: e instanceof Error ? e.message : 'Erro inesperado.' }) }
    finally { setBusy(false) }
  }

  /** Devolve o destino sugerido (rota) ou uma mensagem de erro. */
  const importFile = async (file: File): Promise<{ ok: true; to: string } | { ok: false; error: string }> => {
    try {
      const { importProjectFile } = await import('./zip')
      const { payload: p, warnings } = await importProjectFile(file)
      restoreProject(p, null)
      toast({ kind: 'success', title: 'Projeto importado', description: `“${p.problem.name}”${p.result ? ' com os resultados salvos' : ' (sem resultados: resolva para calcular)'}.` })
      warnings.forEach((w) => toast({ kind: 'error', title: 'Aviso na importação', description: w }))
      return { ok: true, to: p.result ? '/resolucao' : '/entrada' }
    } catch (e) {
      const error = e instanceof ImportError ? e.message : 'Não foi possível ler o arquivo.'
      return { ok: false, error }
    }
  }
  return { exportJson, exportZip, importFile, busy, hasResult: !!result && !stale }
}
