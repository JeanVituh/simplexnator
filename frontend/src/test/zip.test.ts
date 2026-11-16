import JSZip from 'jszip'
import { exportProjectZip, importProjectFile, parseZip, ZIP_JSON, type ImageRenderer } from '@/lib/zip'
import { ImportError, type ProjectPayload } from '@/lib/project'
import type { Problem, SolveResponse } from '@/lib/types'
import examples from './fixtures/examples.json'
import radioFx from './fixtures/solve-radioterapico.json'
import mix3 from './fixtures/solve-raiz-inteira.json'

const radio = examples.find((e) => e.id === 'radioterapico')!.problem as Problem
const result = radioFx as unknown as SolveResponse
// PNG 1x1 real (assinatura 89 50 4E 47...)
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const fakeRender: ImageRenderer = async () => `data:image/png;base64,${PNG}`
const payload = (over: Partial<ProjectPayload> = {}): ProjectPayload => ({ problem: radio, method: 'bigm', integer: 'all', result, ...over })
const bytes = (b: Blob) => new Promise<Uint8Array>((res, rej) => { const r = new FileReader(); r.onload = () => res(new Uint8Array(r.result as ArrayBuffer)); r.onerror = () => rej(r.error); r.readAsArrayBuffer(b) })
const asFile = async (b: Blob, name: string) => new File([(await bytes(b)) as unknown as BlobPart], name)

describe('exportação ZIP', () => {
  it('contém projeto.json, README.txt e os gráficos PNG gerados a partir da figura do Plotly', async () => {
    const calls: string[] = []
    const z = await exportProjectZip(payload(), async (g, layers) => { calls.push(Object.entries(layers).filter(([, v]) => v).map(([k]) => k).join('+')); return fakeRender(g, layers) })
    const zip = await JSZip.loadAsync(await bytes(z.blob))
    expect(Object.keys(zip.files).sort()).toEqual(['README.txt', 'graficos/', 'graficos/regiao-viavel.png', 'graficos/solucao-inteira.png', ZIP_JSON].sort())
    expect(z.images).toEqual(['graficos/regiao-viavel.png', 'graficos/solucao-inteira.png']); expect(z.notes).toEqual([])
    const png = await zip.file('graficos/regiao-viavel.png')!.async('uint8array')
    expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(calls[0]).toContain('region'); expect(calls[1]).toContain('intOpt')       // a figura inteira inclui a solução inteira ótima
    const json = JSON.parse(await zip.file(ZIP_JSON)!.async('string'))
    expect(json.format).toBe('simplexnator-project'); expect(json.problem.name).toBe(radio.name); expect(json.result.relaxation.z.frac).toBe('21/4')
    const readme = await zip.file('README.txt')!.async('string')
    expect(readme).toContain('projeto.json'); expect(readme).toContain('graficos/regiao-viavel.png')
  })
  it('informa quando não há resultado, quando há mais de 2 variáveis e quando um gráfico falha', async () => {
    const none = await exportProjectZip(payload({ result: null }), fakeRender)
    expect(none.images).toEqual([]); expect(none.notes.join()).toMatch(/ainda não foi resolvido/)
    const mix = (await import('./fixtures/solve-raiz-inteira.json')).default as unknown as SolveResponse
    const three = { ...mix, graph: null, variables: ['x1', 'x2', 'x3'] } as SolveResponse
    const t = await exportProjectZip(payload({ result: three }), fakeRender)
    expect(t.notes.join()).toMatch(/2 variáveis|exige exatamente 2/)
    const failing = await exportProjectZip(payload(), async () => { throw new Error('canvas indisponível') })
    expect(failing.images).toEqual([]); expect(failing.notes.join()).toMatch(/não gerado: canvas indisponível/)
    const readme = await (await JSZip.loadAsync(await bytes(failing.blob))).file('README.txt')!.async('string')
    expect(readme).toMatch(/canvas indisponível/)
    const bad = await exportProjectZip(payload(), async () => 'data:text/html;base64,AAAA')
    expect(bad.images).toEqual([])
  })
})

describe('importação de ZIP', () => {
  it('restaura modelo, configurações e resultados (ida e volta)', async () => {
    const z = await exportProjectZip(payload({ method: 'twophase', integer: 'marked' }), fakeRender)
    const { payload: p } = await parseZip(await bytes(z.blob))
    expect(p.problem).toEqual(radio); expect(p.method).toBe('twophase'); expect(p.integer).toBe('marked'); expect(p.result).toEqual(result)
    expect((await importProjectFile(await asFile(z.blob, 'x.zip'))).payload.problem.name).toBe(radio.name)
  })
  it('importa JSON antigo e novo pelo mesmo caminho', async () => {
    const old = new File([JSON.stringify({ problem: radio })], 'antigo.json')
    expect((await importProjectFile(old)).payload.problem).toEqual(radio)
    const z = await exportProjectZip(payload(), fakeRender)
    const json = await (await JSZip.loadAsync(await bytes(z.blob))).file(ZIP_JSON)!.async('string')
    expect((await importProjectFile(new File([json], 'novo.json'))).payload.result).toEqual(result)
  })
  it('rejeita ZIP corrompido, sem projeto.json, com caminhos perigosos ou JSON inválido', async () => {
    await expect(parseZip(new Uint8Array([1, 2, 3, 4, 5]))).rejects.toThrow(/corrompido|ZIP válido/)
    const vazio = new JSZip(); vazio.file('outro.txt', 'x')
    await expect(parseZip(await vazio.generateAsync({ type: 'uint8array' }))).rejects.toThrow(/não contém o arquivo projeto\.json/)
    for (const evil of ['../fora.json', '/abs/fora.json', 'a/../../b.json', 'C:\\x.json']) {
      const z = new JSZip(); z.file(ZIP_JSON, JSON.stringify({ problem: radio })); z.file(evil, 'x')
      await expect(parseZip(await z.generateAsync({ type: 'uint8array' }))).rejects.toThrow(/caminhos inválidos/)
    }
    const bad = new JSZip(); bad.file(ZIP_JSON, '{não é json')
    await expect(parseZip(await bad.generateAsync({ type: 'uint8array' }))).rejects.toThrow(/JSON válido/)
    const wrong = new JSZip(); wrong.file(ZIP_JSON, JSON.stringify({ problem: { sense: 'max' } }))
    await expect(parseZip(await wrong.generateAsync({ type: 'uint8array' }))).rejects.toBeInstanceOf(ImportError)
    const many = new JSZip(); many.file(ZIP_JSON, JSON.stringify({ problem: radio })); for (let i = 0; i < 101; i++) many.file(`a${i}.txt`, 'x')
    await expect(parseZip(await many.generateAsync({ type: 'uint8array' }))).rejects.toThrow(/arquivos demais/)
  })
  it('só lê projeto.json: nenhum outro conteúdo é extraído', async () => {
    const z = new JSZip(); z.file(ZIP_JSON, JSON.stringify({ problem: radio })); z.file('graficos/a.png', 'qualquer'); z.file('script.js', 'alert(1)')
    const r = await parseZip(await z.generateAsync({ type: 'uint8array' }))
    expect(Object.keys(r)).toEqual(['payload', 'warnings']); expect(r.payload.problem).toEqual(radio)
  })
  it('arquivo .zip com conteúdo que não é ZIP é recusado', async () => {
    await expect(importProjectFile(new File(['texto'], 'falso.zip'))).rejects.toThrow(/ZIP válido/)
  })
})

void mix3
