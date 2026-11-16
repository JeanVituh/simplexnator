import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FileArchive, FileJson, FolderOpen, History, Trash2, Upload } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { sizeLabel } from '@/lib/model'
import { useProjectIO } from '@/lib/useProjectIO'
import { useApp } from '@/store'

export default function Projects() {
  const { loadProblem, history, removeHistory, clearHistory, setMethod, setInteger } = useApp()
  const io = useProjectIO()
  const nav = useNavigate()
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const onFile = async (f?: File) => {
    if (!f) return
    setMsg(null)
    const r = await io.importFile(f)
    if (r.ok) nav(r.to); else setMsg(r.error)
  }
  return (
    <div>
      <PageHeader eyebrow="Saídas" title="Projetos e histórico" subtitle="Exporte o modelo e os resultados em JSON ou em um pacote ZIP com os gráficos, importe de volta e reabra resoluções anteriores. O histórico fica salvo neste navegador." />
      <div className="grid items-start gap-5 lg:grid-cols-[360px_1fr]">
        <Section title="Arquivos" description="Importe JSON (versões 1.1 e 1.2) ou ZIP gerado pelo Simplexnator.">
          <div className="space-y-3">
            <button type="button" onClick={() => file.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-7 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary-soft/50 hover:text-primary">
              <Upload size={22} /><span className="font-medium">Importar arquivo</span><span className="text-xs">.json ou .zip do Simplexnator</span>
            </button>
            <input ref={file} type="file" accept="application/json,.json,application/zip,.zip" hidden aria-label="Importar arquivo" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Button variant="outline" onClick={io.exportJson}><FileJson size={15} />Exportar JSON</Button>
              <Button variant="outline" disabled={io.busy} onClick={() => void io.exportZip()}>{io.busy ? <Spinner /> : <FileArchive size={15} />}Exportar ZIP</Button>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">O ZIP contém <span className="font-mono">projeto.json</span>, os gráficos em PNG (problemas de 2 variáveis já resolvidos) e um <span className="font-mono">README.txt</span>. {io.hasResult ? 'O resultado atual será incluído.' : 'Resolva o problema para incluir resultados e gráficos.'}</p>
            {msg && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{msg}</p>}
          </div>
        </Section>
        <Section title="Histórico de resoluções" actions={history.length > 0 ? <Button variant="ghost" size="sm" onClick={clearHistory}>Limpar histórico</Button> : undefined}>
          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground"><History size={26} /><p className="text-sm">As resoluções aparecerão aqui.</p></div>
          ) : (
            <ul className="divide-y">{history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary"><FolderOpen size={17} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{h.problem.name || 'Sem nome'}</p>
                  <p className="text-xs text-muted-foreground">{new Date(h.date).toLocaleString('pt-BR')} · {sizeLabel(h.problem)}</p>
                </div>
                <Badge variant={h.summary.startsWith('Z') ? 'success' : 'danger'}>{h.summary}</Badge>
                <Badge variant="muted">{h.method === 'bigm' ? 'Big-M' : 'Duas Fases'}</Badge>
                <Button size="sm" variant="outline" onClick={() => { loadProblem(h.problem); setMethod(h.method); setInteger(h.integer); nav('/entrada') }}>Reabrir</Button>
                <button className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger" onClick={() => removeHistory(h.id)} aria-label="Excluir do histórico"><Trash2 size={15} /></button>
              </li>))}</ul>
          )}
        </Section>
      </div>
      <p className="mt-4 flex items-center gap-1.5 px-1 text-xs text-muted-foreground"><Download size={13} />Com uma conta, os projetos também podem ser salvos na nuvem (página Conta).</p>
    </div>
  )
}
