import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createFakeCloud } from './fakeCloud'
import { json, payloadOf, renderApp } from './utils'
import type { Problem, SolveResponse } from '@/lib/types'
import examples from './fixtures/examples.json'
import radioFx from './fixtures/solve-radioterapico.json'

vi.mock('@/components/PlotGraph', () => ({ default: () => <div data-testid="plot" /> }))
const radio = examples.find((e) => e.id === 'radioterapico')!.problem as Problem
const R = radioFx as unknown as SolveResponse
const solved = () => payloadOf(radio, R)

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.endsWith('/api/solve') ? json(R) : url.endsWith('/api/examples') ? json(examples) : json({}, 404))))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

const type = async (label: string | RegExp, text: string, scope?: HTMLElement) => { const el = (scope ? within(scope) : screen).getByLabelText(label); await userEvent.clear(el); await userEvent.type(el, text) }
const form = (name: string) => screen.getByRole('form', { name })
/** Item da lista “Meus projetos” (o nome também aparece no vínculo do projeto aberto). */
const item = async (name: string) => waitFor(() => { const li = screen.getAllByText(name).map((e) => e.closest('li')).find(Boolean); if (!li) throw new Error('sem item'); return li as HTMLElement })
async function registerUser(email = 'ana@exemplo.com', pass = 'senha-segura-1') {
  const f = form('Criar conta')
  await type('Nome', 'Ana Souza', f); await type('E-mail', email, f); await type('Senha', pass, f); await type('Confirmação de senha', pass, f)
  await userEvent.click(within(f).getByRole('button', { name: 'Criar conta' }))
}

describe('sem Firebase configurado', () => {
  it('a página Conta informa a indisponibilidade e o restante do aplicativo segue funcionando', async () => {
    renderApp('/conta', { backend: createFakeCloud({ configured: false }) })
    expect(await screen.findByText('Contas indisponíveis nesta instalação')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Entrar' })).toBeNull()
    await userEvent.click(screen.getAllByRole('link', { name: 'Entrada' })[0])
    expect(await screen.findByRole('heading', { name: 'Entrada do problema' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Resolver modelo' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Resolução pelo Simplex tabular' })).toBeInTheDocument())
  })
  it('o provedor padrão (sem variáveis VITE_FIREBASE_*) não quebra a inicialização', async () => {
    renderApp('/conta')
    expect(await screen.findByText('Contas indisponíveis nesta instalação')).toBeInTheDocument()
  })
})

describe('cadastro, login, logout e recuperação de senha', () => {
  it('valida os campos do cadastro', async () => {
    renderApp('/conta', { backend: createFakeCloud() })
    const f = await screen.findByRole('form', { name: 'Criar conta' })
    await userEvent.click(within(f).getByRole('button', { name: 'Criar conta' }))
    for (const m of ['Informe seu nome.', 'Informe um e-mail válido.', /pelo menos 8 caracteres/]) expect(within(f).getByText(m)).toBeInTheDocument()
    await type('Nome', 'Ana', f); await type('E-mail', 'ana@exemplo.com', f); await type('Senha', 'senha-segura-1', f); await type('Confirmação de senha', 'outra-senha-1', f)
    await userEvent.click(within(f).getByRole('button', { name: 'Criar conta' }))
    expect(within(f).getByText('A confirmação não confere com a senha.')).toBeInTheDocument()
  })
  it('cria a conta, identifica o usuário e permite sair', async () => {
    const be = createFakeCloud()
    renderApp('/conta', { backend: be })
    await screen.findByRole('form', { name: 'Criar conta' })
    await registerUser()
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument(); expect(screen.getByText('ana@exemplo.com')).toBeInTheDocument()
    expect(screen.getByText('Você ainda não salvou nenhum projeto.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Sair/ }))
    expect(await screen.findByRole('form', { name: 'Entrar' })).toBeInTheDocument(); expect(be.calls).toContain('logout')
  })
  it('recusa e-mail já cadastrado e credenciais incorretas, e entra com as corretas', async () => {
    const be = createFakeCloud()
    await be.register('Ana', 'ana@exemplo.com', 'senha-segura-1'); await be.logout()
    renderApp('/conta', { backend: be })
    await screen.findByRole('form', { name: 'Criar conta' })
    await registerUser('ana@exemplo.com')
    expect(await screen.findByText('Já existe uma conta com este e-mail.')).toBeInTheDocument()
    const l = form('Entrar')
    await type('E-mail', 'ana@exemplo.com', l); await type('Senha', 'errada', l)
    await userEvent.click(within(l).getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeInTheDocument()
    await type('Senha', 'senha-segura-1', l)
    await userEvent.click(within(l).getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Meus projetos')).toBeInTheDocument()
  })
  it('valida o login e a recuperação de senha', async () => {
    const be = createFakeCloud()
    renderApp('/conta', { backend: be })
    const l = await screen.findByRole('form', { name: 'Entrar' })
    await userEvent.click(within(l).getByRole('button', { name: 'Entrar' }))
    expect(within(l).getByText('Informe um e-mail válido.')).toBeInTheDocument(); expect(within(l).getByText('Informe a senha.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Esqueci minha senha/ }))
    expect(await screen.findByText(/Digite seu e-mail no campo acima/)).toBeInTheDocument(); expect(be.calls.some((c) => c.startsWith('reset'))).toBe(false)
    await type('E-mail', 'ana@exemplo.com', l)
    await userEvent.click(screen.getByRole('button', { name: /Esqueci minha senha/ }))
    expect(await screen.findByText(/enviamos um link para redefinir a senha/)).toBeInTheDocument(); expect(be.calls).toContain('reset:ana@exemplo.com')
  })
  it('persistência de sessão: ao abrir o app já logado, mostra o repositório sem pedir login', async () => {
    renderApp('/conta', { backend: createFakeCloud({ session: { uid: 'u9', name: 'Beto', email: 'beto@exemplo.com' } }) })
    expect(await screen.findByText('Beto')).toBeInTheDocument(); expect(screen.queryByRole('form', { name: 'Entrar' })).toBeNull()
  })
})

describe('projetos na nuvem', () => {
  const session = { uid: 'u1', name: 'Ana', email: 'ana@exemplo.com' }
  it('salva com nome, lista, abre restaurando modelo e resultados, e exclui', async () => {
    const be = createFakeCloud({ session })
    renderApp('/conta', { backend: be, payload: solved() })
    await screen.findByText('Meus projetos')
    await userEvent.type(screen.getByLabelText('Nome do novo projeto'), 'Radioterapia v1')
    await userEvent.click(screen.getByRole('button', { name: /Salvar como novo projeto/ }))
    const li = await item('Radioterapia v1')
    expect(within(li).getByText('com resultados')).toBeInTheDocument(); expect(within(li).getByText(/Criado em .* atualizado em/)).toBeInTheDocument()
    expect(screen.getByText(/Projeto vinculado:/)).toHaveTextContent('Radioterapia v1')
    const stored = [...be.db.get('u1')!.values()][0].stored
    expect(stored.resultJson).toBeTypeOf('string'); expect(stored.problem).toMatchObject({ sense: 'min' })
    // abrir em outro estado (problema vazio) restaura modelo e resultado
    await userEvent.click(within(li).getByRole('button', { name: 'Abrir' }))
    expect(await screen.findByRole('heading', { name: 'Entrada do problema' })).toBeInTheDocument()
    expect(screen.getByLabelText('Lado direito de Região do tumor')).toHaveValue('6')
    await userEvent.click(screen.getAllByRole('link', { name: 'Conta' })[0])
    await userEvent.click(within(await item('Radioterapia v1')).getByRole('button', { name: 'Excluir Radioterapia v1' }))
    expect(await screen.findByText('Você ainda não salvou nenhum projeto.')).toBeInTheDocument()
    expect(be.calls).toContain('remove:' + [...be.calls].find((c) => c.startsWith('remove:'))!.slice(7))
  })
  it('salvamento automático: atualiza apenas o projeto vinculado, após nova resolução, e avisa', async () => {
    const be = createFakeCloud({ session })
    renderApp('/conta', { backend: be, payload: solved() })
    await screen.findByText('Meus projetos')
    await userEvent.type(screen.getByLabelText('Nome do novo projeto'), 'Meu projeto')
    await userEvent.click(screen.getByRole('button', { name: /Salvar como novo projeto/ }))
    await screen.findByText(/Projeto vinculado:/)
    await userEvent.click(screen.getAllByRole('link', { name: 'Entrada' })[0])
    await userEvent.click(await screen.findByRole('button', { name: 'Resolver modelo' }))
    await waitFor(() => expect(be.calls.some((c) => c.startsWith('update:'))).toBe(true))
    expect(await screen.findByText('Projeto atualizado na nuvem')).toBeInTheDocument()
  })
  it('não sobrescreve silenciosamente: ao carregar outro modelo o vínculo é desfeito e nada é atualizado', async () => {
    const be = createFakeCloud({ session })
    renderApp('/conta', { backend: be, payload: solved() })
    await screen.findByText('Meus projetos')
    await userEvent.type(screen.getByLabelText('Nome do novo projeto'), 'Original')
    await userEvent.click(screen.getByRole('button', { name: /Salvar como novo projeto/ }))
    await screen.findByText(/Projeto vinculado:/)
    await userEvent.click(screen.getAllByRole('link', { name: 'Início' })[0])
    await userEvent.click((await screen.findAllByRole('button', { name: 'Carregar e resolver' }))[1])   // outro exemplo
    await screen.findByRole('heading', { name: 'Resolução pelo Simplex tabular' })
    expect(be.calls.filter((c) => c.startsWith('update:'))).toHaveLength(0)
    await userEvent.click(screen.getAllByRole('link', { name: 'Conta' })[0])
    expect(await screen.findByText(/Nenhum projeto vinculado/)).toBeInTheDocument()
  })
  it('substituir pede confirmação e só então atualiza o projeto escolhido', async () => {
    const be = createFakeCloud({ session })
    await be.create('u1', 'Antigo', { problem: radio, method: 'bigm', integer: 'all', result: null })
    renderApp('/conta', { backend: be, payload: solved() })
    const li = await item('Antigo')
    ;(window.confirm as ReturnType<typeof vi.fn>).mockReturnValueOnce(false)
    await userEvent.click(within(li).getByRole('button', { name: 'Substituir' }))
    expect(be.calls.filter((c) => c.startsWith('update:'))).toHaveLength(0)
    await userEvent.click(within(li).getByRole('button', { name: 'Substituir' }))
    await waitFor(() => expect(be.calls.filter((c) => c.startsWith('update:'))).toHaveLength(1))
    await waitFor(async () => expect(within(await item('Antigo')).getByText('com resultados')).toBeInTheDocument())
  })
  it('informa quando o salvamento falha e não altera a lista', async () => {
    const be = createFakeCloud({ session, failWrites: true })
    renderApp('/conta', { backend: be, payload: solved() })
    await screen.findByText('Meus projetos')
    await userEvent.click(screen.getByRole('button', { name: /Salvar como novo projeto/ }))
    expect(await screen.findByText('Não foi possível salvar o projeto')).toBeInTheDocument(); expect(screen.getByText(/indisponível no momento/)).toBeInTheDocument()
    expect(screen.getByText('Você ainda não salvou nenhum projeto.')).toBeInTheDocument()
  })
  it('projetos de um usuário não são acessíveis por outro', async () => {
    const be = createFakeCloud({ session })
    const { id } = await be.create('u1', 'Segredo da Ana', { problem: radio, method: 'bigm', integer: 'all', result: null })
    renderApp('/conta', { backend: be })
    expect(await screen.findByText('Segredo da Ana')).toBeInTheDocument()
    be.setSession({ uid: 'u2', name: 'Beto', email: 'beto@exemplo.com' })          // outro usuário entra
    expect(await screen.findByText('Beto')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Segredo da Ana')).toBeNull()); expect(await screen.findByText('Você ainda não salvou nenhum projeto.')).toBeInTheDocument()
    await expect(be.get('u1', id)).rejects.toThrow('Sem permissão para acessar este projeto.')   // acesso direto também é negado
    await expect(be.list('u1')).rejects.toThrow(/Sem permissão/)
    await expect(be.update('u1', id, { problem: radio, method: 'bigm', integer: 'all', result: null })).rejects.toThrow(/Sem permissão/)
    await expect(be.remove('u1', id)).rejects.toThrow(/Sem permissão/)
    be.setSession(null)
    await expect(be.list('u1')).rejects.toThrow(/Entre na sua conta/)
  })
})
