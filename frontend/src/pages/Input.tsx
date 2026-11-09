import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Info, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react'
import { useApp, emptyProblem } from '@/store'
import { formulation, LIMITS, validate } from '@/lib/model'
import type { Problem } from '@/lib/types'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/card'
import { Input, NumInput, Select } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5"><span className="kbd-label block">{label}</span>{children}</div>
)

export default function InputPage() {
  const { problem: p, setProblem, method, setMethod, integer, setInteger, solve, loading, error, context } = useApp()
  const nav = useNavigate()
  const issues = validate(p)
  const upd = (fn: (q: Problem) => void) => { const q: Problem = structuredClone(p); fn(q); setProblem(q) }
  const n = p.variables.length

  const addVar = () => upd((q) => {
    let k = q.variables.length + 1
    while (q.variables.some((v) => v.name === `x${k}`)) k++
    q.variables.push({ name: `x${k}`, kind: 'continuous', lower: 0, upper: null }); q.objective.push(0)
    q.constraints.forEach((c) => c.coefficients.push(0))
  })
  const delVar = (j: number) => upd((q) => { q.variables.splice(j, 1); q.objective.splice(j, 1); q.constraints.forEach((c) => c.coefficients.splice(j, 1)) })
  const addCon = () => upd((q) => q.constraints.push({ name: `R${q.constraints.length + 1}`, coefficients: Array(q.variables.length).fill(0), relation: '<=', rhs: 0 }))
  const delCon = (i: number) => upd((q) => { q.constraints.splice(i, 1) })
  const submit = async () => { if (issues.errors.length === 0 && (await solve())) nav('/resolucao') }

  return (
    <div>
      <PageHeader eyebrow="Modelagem" title="Entrada do problema" subtitle="Defina a função objetivo, as variáveis e as restrições. As tabelas se ajustam ao número de variáveis e restrições.">
        <Button variant="outline" onClick={() => setProblem(emptyProblem())}><RotateCcw size={15} />Limpar</Button>
        <Button onClick={submit} disabled={loading || issues.errors.length > 0}>{loading && <Spinner />}Resolver modelo</Button>
      </PageHeader>
      {error && <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger"><XCircle size={18} className="mt-0.5 shrink-0" />{error}</div>}

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <Section>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do problema"><Input value={p.name} onChange={(e) => upd((q) => { q.name = e.target.value })} aria-label="Nome do problema" /></Field>
              <Field label="Objetivo"><Segmented label="Objetivo" value={p.sense} onChange={(v) => upd((q) => { q.sense = v })} options={[{ value: 'max', label: 'Maximizar' }, { value: 'min', label: 'Minimizar' }]} /></Field>
              <Field label="Tratamento do modelo"><Segmented label="Tratamento" value={method} onChange={setMethod} options={[{ value: 'bigm', label: 'Big-M' }, { value: 'twophase', label: 'Duas Fases' }]} /></Field>
              <Field label="Solução inteira"><Select aria-label="Solução inteira" value={integer} onChange={(e) => setInteger(e.target.value as typeof integer)}><option value="all">Todas as variáveis</option><option value="marked">Apenas as marcadas</option><option value="none">Não calcular</option></Select></Field>
            </div>
          </Section>

          <Section title={`Variáveis e função objetivo (${p.sense === 'max' ? 'máx' : 'mín'} Z)`} description="Não negatividade é o padrão (limite inferior 0). Apague o limite inferior para tornar a variável livre."
            actions={<Button size="sm" variant="secondary" disabled={n >= LIMITS.variables} onClick={addVar}><Plus size={14} />Variável</Button>}>
            <div className="overflow-x-auto rounded-lg border">
              <table className="tbl tbl-plain">
                <thead><tr><th className="text-left">&nbsp;</th>{p.variables.map((v, j) => (
                  <th key={j} className="min-w-[118px] !p-1.5"><div className="group flex items-center gap-1">
                    <Input value={v.name} invalid={issues.badNames.has(j)} onChange={(e) => upd((q) => { q.variables[j].name = e.target.value })} className="h-8 text-center font-mono font-semibold normal-case tracking-normal" aria-label={`Nome da variável ${j + 1}`} />
                    <button className="rounded p-1 text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-30" disabled={n <= 1} onClick={() => delVar(j)} aria-label={`Remover variável ${v.name}`}><Trash2 size={14} /></button></div></th>))}
                </tr></thead>
                <tbody>
                  <tr><th>Coeficiente em Z</th>{p.objective.map((c, j) => <td key={j}><NumInput value={c} onChange={(v) => upd((q) => { q.objective[j] = v ?? 0 })} label={`Coeficiente de ${p.variables[j].name} em Z`} /></td>)}</tr>
                  <tr><th>Tipo</th>{p.variables.map((v, j) => <td key={j}><Select aria-label={`Tipo de ${v.name}`} className="min-w-[112px]" value={v.kind} onChange={(e) => upd((q) => {
                    const k = e.target.value as typeof v.kind; q.variables[j].kind = k
                    if (k === 'binary') { q.variables[j].lower = 0; q.variables[j].upper = 1 } })}>
                    <option value="continuous">Contínua</option><option value="integer">Inteira</option><option value="binary">Binária</option></Select></td>)}</tr>
                  <tr><th>Limite inferior</th>{p.variables.map((v, j) => <td key={j}><NumInput allowEmpty value={v.lower} placeholder="−∞" invalid={issues.badBounds.has(j)} onChange={(x) => upd((q) => { q.variables[j].lower = x })} label={`Limite inferior de ${v.name}`} /></td>)}</tr>
                  <tr><th>Limite superior</th>{p.variables.map((v, j) => <td key={j}><NumInput allowEmpty value={v.upper} placeholder="+∞" invalid={issues.badBounds.has(j)} onChange={(x) => upd((q) => { q.variables[j].upper = x })} label={`Limite superior de ${v.name}`} /></td>)}</tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Restrições" actions={<Button size="sm" variant="secondary" disabled={p.constraints.length >= LIMITS.constraints} onClick={addCon}><Plus size={14} />Restrição</Button>}>
            <div className="overflow-x-auto rounded-lg border">
              <table className="tbl tbl-plain">
                <thead><tr><th className="text-left">Nome</th>{p.variables.map((v, j) => <th key={j} className="font-mono normal-case">{v.name}</th>)}<th>Relação</th><th>Lado direito</th><th /></tr></thead>
                <tbody>
                  {p.constraints.map((c, i) => (
                    <tr key={i} className="transition-colors hover:bg-muted/30">
                      <th className="!p-1.5"><Input value={c.name} onChange={(e) => upd((q) => { q.constraints[i].name = e.target.value })} className="h-8 min-w-[130px] font-sans" aria-label={`Nome da restrição ${i + 1}`} /></th>
                      {c.coefficients.map((a, j) => <td key={j} className="!p-1.5"><NumInput value={a} onChange={(v) => upd((q) => { q.constraints[i].coefficients[j] = v ?? 0 })} label={`${c.name}: coeficiente de ${p.variables[j].name}`} className="h-8 min-w-[76px]" /></td>)}
                      <td className="!p-1.5"><Select aria-label={`Relação de ${c.name}`} className={cn('h-8 w-[84px] !pl-3 !pr-6 text-center font-mono text-base font-semibold')} value={c.relation} onChange={(e) => upd((q) => { q.constraints[i].relation = e.target.value as typeof c.relation })}><option value="<=">≤</option><option value=">=">≥</option><option value="=">=</option></Select></td>
                      <td className="!p-1.5"><NumInput value={c.rhs} onChange={(v) => upd((q) => { q.constraints[i].rhs = v ?? 0 })} label={`Lado direito de ${c.name}`} className="h-8 min-w-[84px]" /></td>
                      <td className="!p-1.5"><button className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-30" disabled={p.constraints.length <= 1} onClick={() => delCon(i)} aria-label={`Remover ${c.name}`}><Trash2 size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-8">
          <Section title="Formulação" description="Prévia do modelo que será enviado ao motor.">
            <pre className="overflow-x-auto whitespace-pre rounded-lg bg-muted/60 p-3.5 font-mono text-[13px] leading-relaxed" aria-label="Formulação do modelo">{formulation(p).join('\n')}</pre>
          </Section>
          {(issues.errors.length > 0 || issues.warnings.length > 0) && (
            <Section title="Verificação do modelo">
              <ul className="space-y-2 text-sm">
                {issues.errors.map((e) => <li key={e} className="flex gap-2 text-danger"><XCircle size={16} className="mt-0.5 shrink-0" />{e}</li>)}
                {issues.warnings.map((e) => <li key={e} className="flex gap-2 text-warn"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{e}</li>)}
              </ul>
            </Section>
          )}
          {context && (
            <Section title="Sobre este modelo">
              <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p>{context.statement}</p><p className="font-medium text-foreground">{context.objective}</p>
                <ul className="list-inside list-disc space-y-0.5">{context.constraints.map((c) => <li key={c}>{c}</li>)}</ul>
              </div>
            </Section>
          )}
          <p className="flex gap-2 px-1 text-xs leading-relaxed text-muted-foreground"><Info size={14} className="mt-0.5 shrink-0" />Limites: até {LIMITS.variables} variáveis e {LIMITS.constraints} restrições (configuráveis no servidor).</p>
        </aside>
      </div>
    </div>
  )
}
