import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { CloudOff, FolderOpen, KeyRound, LogOut, Save, Trash2, UserRound } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, Section } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton, Spinner } from '@/components/ui/spinner'
import { validateEmailOnly, validateLogin, validateRegister, type FormErrors } from '@/lib/auth'
import { useCloud } from '@/lib/cloudContext'
import { sizeLabel } from '@/lib/model'
import { useApp } from '@/store'
import { cn } from '@/lib/utils'

const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5"><label className="block space-y-1.5"><span className="kbd-label block">{label}</span>{children}</label>{error && <p role="alert" className="text-xs text-danger">{error}</p>}</div>
)
const Msg = ({ kind, children }: { kind: 'ok' | 'error'; children: React.ReactNode }) => (
  <p role={kind === 'ok' ? 'status' : 'alert'} className={cn('rounded-lg px-3 py-2 text-sm', kind === 'ok' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>{children}</p>
)
const fmt = (d: Date | null) => (d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—')

function AuthForms() {
  const { login, register, resetPassword } = useCloud()
  const [le, setLe] = useState(''), [lp, setLp] = useState(''), [lerr, setLerr] = useState<FormErrors>({}), [lmsg, setLmsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null), [lbusy, setLbusy] = useState(false)
  const [r, setR] = useState({ name: '', email: '', password: '', confirm: '' }), [rerr, setRerr] = useState<FormErrors>({}), [rmsg, setRmsg] = useState<string | null>(null), [rbusy, setRbusy] = useState(false)

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLmsg(null)
    const errs = validateLogin(le, lp); setLerr(errs); if (Object.keys(errs).length) return
    setLbusy(true); const err = await login(le, lp); setLbusy(false)
    if (err) setLmsg({ kind: 'error', text: err })
  }
  const doReset = async () => {
    setLmsg(null)
    const errs = validateEmailOnly(le); setLerr(errs); if (Object.keys(errs).length) { setLmsg({ kind: 'error', text: 'Digite seu e-mail no campo acima para receber o link de redefinição.' }); return }
    setLbusy(true); const err = await resetPassword(le); setLbusy(false)
    setLmsg(err ? { kind: 'error', text: err } : { kind: 'ok', text: 'Se houver uma conta com este e-mail, enviamos um link para redefinir a senha. Verifique também a caixa de spam.' })
  }
  const doRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setRmsg(null)
    const errs = validateRegister(r); setRerr(errs); if (Object.keys(errs).length) return
    setRbusy(true); const err = await register(r.name, r.email, r.password); setRbusy(false)
    if (err) setRerr({ form: err })
  }
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Section title="Entrar" description="Acesse seus projetos salvos na nuvem.">
        <form onSubmit={doLogin} noValidate className="space-y-4" aria-label="Entrar">
          <Field label="E-mail" error={lerr.email}><Input type="email" autoComplete="email" value={le} invalid={!!lerr.email} onChange={(e) => setLe(e.target.value)} className="font-sans" /></Field>
          <Field label="Senha" error={lerr.password}><Input type="password" autoComplete="current-password" value={lp} invalid={!!lerr.password} onChange={(e) => setLp(e.target.value)} className="font-sans" /></Field>
          {lmsg && <Msg kind={lmsg.kind}>{lmsg.text}</Msg>}
          <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={lbusy}>{lbusy && <Spinner />}Entrar</Button>
            <button type="button" onClick={() => void doReset()} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline" disabled={lbusy}><KeyRound size={14} />Esqueci minha senha</button></div>
        </form>
      </Section>
      <Section title="Criar conta" description="Gratuito e opcional. Sem conta você continua usando tudo normalmente.">
        <form onSubmit={doRegister} noValidate className="space-y-4" aria-label="Criar conta">
          <Field label="Nome" error={rerr.name}><Input autoComplete="name" value={r.name} invalid={!!rerr.name} onChange={(e) => setR({ ...r, name: e.target.value })} className="font-sans" /></Field>
          <Field label="E-mail" error={rerr.email}><Input type="email" autoComplete="email" value={r.email} invalid={!!rerr.email} onChange={(e) => setR({ ...r, email: e.target.value })} className="font-sans" /></Field>
          <Field label="Senha" error={rerr.password}><Input type="password" autoComplete="new-password" value={r.password} invalid={!!rerr.password} onChange={(e) => setR({ ...r, password: e.target.value })} className="font-sans" /></Field>
          <Field label="Confirmação de senha" error={rerr.confirm}><Input type="password" autoComplete="new-password" value={r.confirm} invalid={!!rerr.confirm} onChange={(e) => setR({ ...r, confirm: e.target.value })} className="font-sans" /></Field>
          {rerr.form && <Msg kind="error">{rerr.form}</Msg>}{rmsg && <Msg kind="ok">{rmsg}</Msg>}
          <Button type="submit" variant="outline" disabled={rbusy}>{rbusy && <Spinner />}Criar conta</Button>
        </form>
      </Section>
    </div>
  )
}

function Repository() {
  const c = useCloud(), { problem, binding, result, stale } = useApp()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const user = c.user!
  const saveName = name.trim() || problem.name
  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-soft text-primary"><UserRound size={20} /></span>
        <div className="min-w-0 flex-1"><p className="truncate font-semibold">{user.name ?? 'Usuário'}</p><p className="truncate text-sm text-muted-foreground">{user.email}</p></div>
        <Button variant="outline" onClick={() => void c.logout()}><LogOut size={15} />Sair</Button>
      </Card>

      <Section title="Salvar na nuvem" description="Os projetos ficam vinculados à sua conta e só você pode acessá-los.">
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1"><Field label="Nome do novo projeto"><Input value={name} placeholder={problem.name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-label="Nome do novo projeto" className="font-sans" /></Field></div>
            <Button disabled={c.saving || !saveName.trim()} onClick={() => void c.saveNew(saveName).then((ok) => ok && setName(''))}>{c.saving ? <Spinner /> : <Save size={15} />}Salvar como novo projeto</Button>
          </div>
          <p className="text-xs text-muted-foreground">Serão salvos o modelo, as configurações{result && !stale ? ' e os resultados calculados' : ' (resolva o problema antes para incluir os resultados)'}.</p>
          {binding ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/60 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1">Projeto vinculado: <b>{binding.name}</b></span>
              <label className="flex cursor-pointer items-center gap-2 text-muted-foreground"><input type="checkbox" className="accent-[hsl(var(--primary))]" checked={c.autoSave} onChange={(e) => c.setAutoSave(e.target.checked)} />Atualizar após cada resolução</label>
              <Button size="sm" variant="outline" disabled={c.saving} onClick={() => void c.saveCurrent()}>Salvar alterações agora</Button>
            </div>
          ) : <p className="rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">Nenhum projeto vinculado. Salve como novo projeto ou abra um existente para ativar a atualização automática após cada resolução.</p>}
        </div>
      </Section>

      <Section title="Meus projetos" description={c.projects.length ? `${c.projects.length} projeto(s) salvo(s).` : undefined}
        actions={<Button variant="ghost" size="sm" onClick={() => void c.refresh()} disabled={c.loadingProjects}>Atualizar lista</Button>}>
        {c.loadingProjects && c.projects.length === 0 ? <Skeleton className="h-20" /> : c.projects.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground"><FolderOpen size={26} /><p className="text-sm">Você ainda não salvou nenhum projeto.</p></div>
        ) : (
          <ul className="divide-y">{c.projects.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary"><FolderOpen size={17} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.name}{binding?.id === p.id && <Badge className="ml-2">aberto</Badge>}</p>
                <p className="text-xs text-muted-foreground">Criado em {fmt(p.createdAt)} · atualizado em {fmt(p.updatedAt)}</p>
              </div>
              {p.resultOmitted ? <Badge variant="warn">sem resultados (grandes)</Badge> : <Badge variant={p.hasResult ? 'success' : 'muted'}>{p.hasResult ? 'com resultados' : 'sem resultados'}</Badge>}
              <Button size="sm" variant="outline" disabled={c.saving} onClick={() => void c.open(p.id).then((ok) => ok && nav('/entrada'))}>Abrir</Button>
              <Button size="sm" variant="ghost" disabled={c.saving} title="Substituir o conteúdo deste projeto pelo problema atual"
                onClick={() => { if (window.confirm(`Substituir o conteúdo de “${p.name}” pelo problema atual (${sizeLabel(problem)})? Esta ação não pode ser desfeita.`)) void c.overwrite(p.id, p.name) }}>Substituir</Button>
              <button className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger" aria-label={`Excluir ${p.name}`} disabled={c.saving}
                onClick={() => { if (window.confirm(`Excluir o projeto “${p.name}”? Esta ação não pode ser desfeita.`)) void c.remove(p.id) }}><Trash2 size={15} /></button>
            </li>))}</ul>
        )}
      </Section>
    </div>
  )
}

export default function Account() {
  const c = useCloud()
  return (
    <div>
      <PageHeader eyebrow="Saídas" title="Conta e repositório" subtitle="Login opcional. Sem conta, você usa, importa e exporta normalmente. Com conta, seus projetos ficam salvos na nuvem." />
      {!c.configured ? (
        <Section title="Contas indisponíveis nesta instalação">
          <div className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground"><CloudOff size={20} className="mt-0.5 shrink-0" />
            <p>O armazenamento em conta não está habilitado nesta instalação. Todas as funções de cálculo, o histórico local e a importação e exportação de arquivos continuam disponíveis em <Link to="/projetos" className="font-medium text-primary underline">Projetos</Link>.</p></div>
        </Section>
      ) : !c.ready ? <Skeleton className="h-64" /> : c.user ? <Repository /> : <AuthForms />}
    </div>
  )
}
