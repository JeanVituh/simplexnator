import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import JSZip from 'jszip'
import { json, legacy, payloadOf, renderApp } from './utils'
import { buildProjectFile } from '@/lib/project'
import { exportProjectZip } from '@/lib/zip'
import type { Problem, SolveResponse } from '@/lib/types'
import examples from './fixtures/examples.json'
import radioFx from './fixtures/solve-radioterapico.json'

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const toImage = vi.hoisted(() => vi.fn())
vi.mock('plotly.js-dist-min', () => ({ default: { toImage } }))
vi.mock('@/components/PlotGraph', () => ({ default: () => <div data-testid="plot" /> }))

const radio = examples.find((e) => e.id === 'radioterapico')!.problem as Problem
const R = radioFx as unknown as SolveResponse
const downloads: { name: string; blob: Blob }[] = []
const solveCalls: string[] = []
const bytes = (b: Blob) => new Promise<Uint8Array>((res, rej) => { const r = new FileReader(); r.onload = () => res(new Uint8Array(r.result as ArrayBuffer)); r.onerror = () => rej(r.error); r.readAsArrayBuffer(b) })
const text = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(b) })

beforeEach(() => {
  downloads.length = 0; solveCalls.length = 0; toImage.mockReset().mockResolvedValue(`data:image/png;base64,${PNG}`)
  let last: Blob | null = null
  URL.createObjectURL = vi.fn((b: Blob) => { last = b; return 'blob:teste' }) as never
  URL.revokeObjectURL = vi.fn() as never
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloads.push({ name: this.download, blob: last! }) })
  vi.stubGlobal('fetch', vi.fn(async (url: string) => { solveCalls.push(url); return json({}, 404) }))
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

const upload = async (file: File) => userEvent.upload(await screen.findByLabelText('Importar arquivo'), file)
const alertText = () => screen.findByRole('alert')

describe('exportação pela interface', () => {
  it('exporta JSON no formato novo, legível também pelo formato antigo ({problem, result})', async () => {
    renderApp('/projetos', { payload: payloadOf(radio, R, { method: 'twophase' }) })
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar JSON' }))
    expect(downloads).toHaveLength(1); expect(downloads[0].name).toBe('problema-radioterapico.json')
    const f = JSON.parse(await text(downloads[0].blob))
    expect(f).toMatchObject({ format: 'simplexnator-project', version: 2, settings: { method: 'twophase', integer: 'all' } })
    expect(f.problem.name).toBe('Problema Radioterápico'); expect(f.result.relaxation.z.frac).toBe('21/4')
    expect(await screen.findByText('JSON exportado')).toBeInTheDocument()
  })
  it('exporta ZIP com projeto.json, README.txt e os PNGs gerados pelo Plotly a partir da figura real', async () => {
    renderApp('/resultados', { payload: payloadOf(radio, R) })
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar ZIP' }))
    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0].name).toBe('problema-radioterapico.zip')
    const zip = await JSZip.loadAsync(await bytes(downloads[0].blob))
    expect(Object.keys(zip.files).filter((n) => !n.endsWith('/')).sort()).toEqual(['README.txt', 'graficos/regiao-viavel.png', 'graficos/solucao-inteira.png', 'projeto.json'])
    expect([...(await zip.file('graficos/solucao-inteira.png')!.async('uint8array')).slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(toImage).toHaveBeenCalledTimes(2)
    const [fig, opts] = toImage.mock.calls[1]
    expect(fig.data.length).toBeGreaterThan(3); expect(fig.data.map((t: { name: string }) => t.name).join('|')).toMatch(/Inteira ótima/)   // figura da solução inteira
    expect(fig.layout.paper_bgcolor).toBe('#ffffff'); expect(opts).toMatchObject({ format: 'png' })
    expect(await screen.findByText('ZIP exportado')).toBeInTheDocument(); expect(screen.getByText(/2 gráfico\(s\) em PNG/)).toBeInTheDocument()
  })
  it('explica quando não é possível gerar o gráfico (erro do Plotly) e ainda exporta o projeto', async () => {
    toImage.mockRejectedValue(new Error('WebGL indisponível'))
    renderApp('/projetos', { payload: payloadOf(radio, R) })
    await userEvent.click(await screen.findByRole('button', { name: 'Exportar ZIP' }))
    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(await screen.findAllByText(/não gerado: WebGL indisponível/)).not.toHaveLength(0)
    const zip = await JSZip.loadAsync(await bytes(downloads[0].blob))
    expect(zip.file('projeto.json')).not.toBeNull(); expect(zip.file('graficos/regiao-viavel.png')).toBeNull(); expect(await zip.file('README.txt')!.async('string')).toMatch(/WebGL indisponível/)
  })
  it('modelo com mais de 2 variáveis: ZIP sem gráficos e com a explicação', async () => {
    const z = await exportProjectZip(payloadOf(radio, { ...R, graph: null }), async () => { throw new Error('não deveria chamar') })
    expect(z.images).toEqual([]); expect(z.notes.join()).toMatch(/exige exatamente 2/)
  })
})

describe('importação pela interface', () => {
  it('JSON antigo (v1.1, apenas o problema): restaura o modelo na Entrada', async () => {
    renderApp('/projetos')
    await upload(new File([JSON.stringify({ problem: radio })], 'antigo.json', { type: 'application/json' }))
    expect(await screen.findByRole('heading', { name: 'Entrada do problema' })).toBeInTheDocument()
    expect(screen.getByLabelText('Lado direito de Região do tumor')).toHaveValue('6'); expect(await screen.findByText('Projeto importado')).toBeInTheDocument()
  })
  it('JSON antigo com resultado da v1.1: restaura sem recalcular e mostra a resolução', async () => {
    renderApp('/projetos')
    await upload(new File([JSON.stringify({ problem: radio, result: legacy(R) })], 'antigo-com-resultado.json'))
    expect(await screen.findByRole('heading', { name: 'Resolução pelo Simplex tabular' })).toBeInTheDocument(); expect(screen.getByText('Solução ótima encontrada')).toBeInTheDocument()
    expect(solveCalls).toEqual([])                                                       // nenhuma chamada ao servidor
  })
  it('JSON novo: restaura modelo, configurações (método e inteiros) e resultados', async () => {
    renderApp('/projetos')
    await upload(new File([JSON.stringify(buildProjectFile({ problem: radio, method: 'twophase', integer: 'marked', result: R }))], 'novo.json'))
    expect(await screen.findByRole('heading', { name: 'Resolução pelo Simplex tabular' })).toBeInTheDocument()
    expect(screen.getByText('Solução ótima encontrada')).toBeInTheDocument(); expect(solveCalls).toEqual([])
    await userEvent.click(screen.getAllByRole('link', { name: 'Entrada' })[0])
    expect(await screen.findByRole('radio', { name: 'Duas Fases' })).toBeChecked(); expect(screen.getByLabelText('Solução inteira')).toHaveValue('marked')
  })
  it('ZIP do Simplexnator: restaura modelo, configurações e resultados', async () => {
    const z = await exportProjectZip(payloadOf(radio, R, { method: 'twophase', integer: 'none' }), async () => `data:image/png;base64,${PNG}`)
    renderApp('/projetos')
    await upload(new File([(await bytes(z.blob)) as unknown as BlobPart], 'pacote.zip', { type: 'application/zip' }))
    expect(await screen.findByRole('heading', { name: 'Resolução pelo Simplex tabular' })).toBeInTheDocument(); expect(solveCalls).toEqual([])
    await userEvent.click(screen.getAllByRole('link', { name: 'Entrada' })[0])
    expect(await screen.findByRole('radio', { name: 'Duas Fases' })).toBeChecked(); expect(screen.getByLabelText('Solução inteira')).toHaveValue('none')
  })
  it('rejeita arquivos inválidos com mensagem clara e sem alterar o estado', async () => {
    renderApp('/projetos')
    await upload(new File(['isto não é json'], 'ruim.json')); expect(await alertText()).toHaveTextContent('não é um JSON válido')
    await upload(new File([JSON.stringify({ qualquer: 1 })], 'outro.json')); await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/problema de programação linear/))
    const evil = new JSZip(); evil.file('projeto.json', JSON.stringify({ problem: radio })); evil.file('../fora.txt', 'x')
    await upload(new File([(await bytes(await evil.generateAsync({ type: 'blob' }))) as unknown as BlobPart], 'evil.zip'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/caminhos inválidos/))
    expect(screen.getByRole('heading', { name: 'Projetos e histórico' })).toBeInTheDocument()   // continua na página
    expect(within(screen.getByRole('alert')).queryByText(/Entrada/)).toBeNull()
  })
})
