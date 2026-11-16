import JSZip from 'jszip'
import type { Layers } from './layers'
import { buildFigure } from './plotFigure'
import { buildProjectFile, ImportError, MAX_FILE_BYTES, MAX_JSON_BYTES, parseJsonText, type ProjectPayload } from './project'
import type { GraphData } from './types'

export const ZIP_JSON = 'projeto.json'
const ALL_OFF: Layers = { region: false, constraints: false, levels: false, vertices: false, ints: false, optimum: false, intOpt: false, rounding: false, segment: false }
const FIGURES: { file: string; title: string; layers: Layers; needsInteger?: boolean }[] = [
  { file: 'graficos/regiao-viavel.png', title: 'Região viável, restrições, curvas de nível, vértices e ótimo', layers: { ...ALL_OFF, region: true, constraints: true, levels: true, vertices: true, optimum: true, segment: true } },
  { file: 'graficos/solucao-inteira.png', title: 'Pontos inteiros viáveis, arredondamento e solução inteira ótima', needsInteger: true,
    layers: { ...ALL_OFF, region: true, constraints: true, ints: true, optimum: true, rounding: true, intOpt: true } },
]

/** Renderiza a figura real do Plotly em PNG (data URL). Substituível em testes. */
export type ImageRenderer = (g: GraphData, layers: Layers) => Promise<string>
export const plotlyRenderer: ImageRenderer = async (g, layers) => {
  const Plotly = (await import('plotly.js-dist-min')).default
  const fig = buildFigure(g, layers, { dark: false, height: 760, background: '#ffffff' })
  return Plotly.toImage({ data: fig.data, layout: { ...fig.layout, width: 1200 } } as unknown as Parameters<typeof Plotly.toImage>[0], { format: 'png', width: 1200, height: 760, scale: 2 })
}

export interface ZipExport { blob: Blob; images: string[]; notes: string[] }

export async function exportProjectZip(payload: ProjectPayload, render: ImageRenderer = plotlyRenderer): Promise<ZipExport> {
  const zip = new JSZip()
  const notes: string[] = [], images: string[] = []
  zip.file(ZIP_JSON, JSON.stringify(buildProjectFile(payload), null, 2))
  const g = payload.result?.graph ?? null
  const hasInt = !!payload.result && payload.result.integer.available !== false
  if (!payload.result) notes.push('Gráficos não incluídos: o problema ainda não foi resolvido.')
  else if (!g) notes.push(`Gráficos não incluídos: o modelo possui ${payload.problem.variables.length} variáveis e o gráfico 2D exige exatamente 2.`)
  else {
    for (const f of FIGURES) {
      if (f.needsInteger && !hasInt) { notes.push(`${f.file} não gerado: a solução inteira não foi calculada.`); continue }
      try {
        const url = await render(g, f.layers)
        const b64 = url.split(',')[1]
        if (!url.startsWith('data:image/png') || !b64) throw new Error('o gráfico não retornou uma imagem PNG')
        zip.file(f.file, b64, { base64: true }); images.push(f.file)
      } catch (e) {
        notes.push(`${f.file} não gerado: ${e instanceof Error ? e.message : 'erro ao renderizar o gráfico'}.`)
      }
    }
  }
  zip.file('README.txt', [
    'Pacote de projeto do Simplexnator', `Gerado em: ${new Date().toLocaleString('pt-BR')}`, `Problema: ${payload.problem.name}`, '',
    'Conteúdo',
    `- ${ZIP_JSON}: modelo, configurações (método e solução inteira) e resultados calculados. Pode ser importado novamente no Simplexnator.`,
    ...(images.length ? ['- graficos/: gráficos exportados a partir da visualização do Plotly (PNG):', ...images.map((i) => `    ${i}  (${FIGURES.find((f) => f.file === i)!.title})`)] : ['- graficos/: nenhum gráfico incluído.']),
    ...(notes.length ? ['', 'Observações', ...notes.map((n) => `- ${n}`)] : []), '',
    'Para importar: Simplexnator > Projetos > Importar arquivo (aceita este ZIP e arquivos JSON).',
  ].join('\n'))
  return { blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), images, notes }
}

const unsafePath = (n: string) => n.startsWith('/') || n.startsWith('\\') || /^[a-zA-Z]:/.test(n) || n.includes('\\') || n.split('/').some((s) => s === '..')

/** Lê somente `projeto.json` de um ZIP do Simplexnator; nenhum outro caminho é extraído. */
export async function parseZip(data: Blob | ArrayBuffer | Uint8Array) {
  const size = data instanceof Blob ? data.size : data.byteLength
  if (size > MAX_FILE_BYTES) throw new ImportError('O arquivo é grande demais (limite de 25 MB).')
  let zip: JSZip
  try { zip = await JSZip.loadAsync(data) } catch { throw new ImportError('O arquivo ZIP está corrompido ou não é um ZIP válido.') }
  const names = Object.keys(zip.files)
  if (names.length > 100) throw new ImportError('O ZIP contém arquivos demais para ser um pacote do Simplexnator.')
  if (names.some(unsafePath)) throw new ImportError('O ZIP contém caminhos inválidos e foi recusado por segurança.')
  const entry = zip.file(ZIP_JSON)
  if (!entry) throw new ImportError(`O ZIP não contém o arquivo ${ZIP_JSON}: não é um pacote do Simplexnator.`)
  const declared = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize
  if (typeof declared === 'number' && declared > MAX_JSON_BYTES) throw new ImportError('O arquivo projeto.json é grande demais (limite de 10 MB).')
  return parseJsonText(await entry.async('string'))
}

/** Importa um arquivo escolhido pelo usuário: JSON (v1.1 ou v1.2) ou ZIP. */
export async function importProjectFile(file: File) {
  if (file.size > MAX_FILE_BYTES) throw new ImportError('O arquivo é grande demais (limite de 25 MB).')
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  const isZip = head[0] === 0x50 && head[1] === 0x4b
  if (isZip) return parseZip(file)
  if (/\.zip$/i.test(file.name)) throw new ImportError('O arquivo não é um ZIP válido.')
  return parseJsonText(await file.text())
}
