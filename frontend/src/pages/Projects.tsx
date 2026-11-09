import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FolderOpen, History, Trash2, Upload } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/card'
import { downloadJson } from '@/lib/download'
import { sizeLabel } from '@/lib/model'
import type { Problem } from '@/lib/types'
import { useApp } from '@/store'

const isProblem = (p: unknown): p is Problem => {
  const q = p as Problem
  return !!q && (q.sense === 'max' || q.sense === 'min') && Array.isArray(q.objective) && Array.isArray(q.variables) && Array.isArray(q.constraints)
}

export default function Projects() {
  const { problem, loadProblem, history, removeHistory, clearHistory, setMethod, setInteger } = useApp()
  const nav = useNavigate()
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const onFile = async (f?: File) => {
    if (!f) return
    try {
      const data = JSON.parse(await f.text())
      const p = isProblem(data) ? data : isProblem(data?.problem) ? data.problem : null
      if (!p) throw new Error('O arquivo não contém um problema de programação linear válido.')
      loadProblem(p); nav('/entrada')
    } catch (e) { setMsg(e instanceof SyntaxError ? 'O arquivo não é um JSON válido.' : e instanceof Error ? e.message : 'Arquivo inválido.') }
  }
  return (
    <div>
      <PageHeader eyebrow="Saídas" title="Projetos e histórico" subtitle="Exporte o modelo atual em JSON, importe de volta e reabra resoluções anteriores. O histórico fica salvo neste navegador." />
      <div className="grid items-start gap-5 lg:grid-cols-[340px_1fr]">
        <Section title="Arquivos" description="Importe um problema ou um projeto completo exportado pelo Simplexnator.">
          <div className="space-y-3">
            <button type="button" onClick={() => file.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-7 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary-soft/50 hover:text-primary">
              <Upload size={22} /><span className="font-medium">Importar arquivo JSON</span><span className="text-xs">problema ou projeto completo</span>
            </button>
            <input ref={file} type="file" accept="application/json,.json" hidden aria-label="Importar arquivo JSON" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
            <Button variant="outline" className="w-full" onClick={() => downloadJson(`${(problem.name || 'problema').replace(/\s+/g, '-').toLowerCase()}.json`, { problem })}><Download size={15} />Exportar problema atual</Button>
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
    </div>
  )
}
