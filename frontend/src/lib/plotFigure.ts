import type { Data, Layout } from 'plotly.js'
import type { GraphData } from '@/lib/types'
import type { Layers } from '@/lib/layers'
import { dec } from '@/lib/format'

export interface FigureOptions { dark: boolean; height?: number; background?: string }

/**
 * Figura Plotly (dados + layout) da região viável. É usada tanto pela página de gráficos quanto pela
 * exportação em PNG, de modo que o arquivo exportado é exatamente o gráfico exibido.
 */
export function buildFigure(g: GraphData, layers: Layers, { dark, height = 520, background }: FigureOptions): { data: Data[]; layout: Partial<Layout> } {
  const fg = dark ? '#e8eaf2' : '#161a2c'
  const grid = dark ? '#252a40' : '#e6e8f0'
  const [xn, yn] = g.var_names
  const d: Data[] = []

  if (layers.region && g.polygon.length) {
    const p = [...g.polygon, g.polygon[0]]
    const area = Math.abs(p.slice(0, -1).reduce((s, q, i) => s + q[0] * p[i + 1][1] - p[i + 1][0] * q[1], 0)) / 2
    const flat = area < 1e-9 // restrição de igualdade: a região viável é um segmento
    d.push({ x: p.map((q) => q[0]), y: p.map((q) => q[1]), type: 'scatter', mode: 'lines', fill: flat ? 'none' : 'toself',
      name: flat ? 'Região viável (segmento)' : 'Região viável', fillcolor: 'rgba(99,102,241,0.16)',
      line: { color: '#6366f1', width: flat ? 8 : 2 }, opacity: flat ? 0.55 : 1, hoverinfo: 'skip' })
  }
  let firstBound = true
  if (layers.constraints) g.constraints.forEach((c) => {
    const bound = c.kind === 'bound'
    d.push({
      x: c.segment.map((q) => q[0]), y: c.segment.map((q) => q[1]), type: 'scatter', mode: 'lines', name: bound ? 'Limites das variáveis' : c.label,
      legendgroup: bound ? 'bounds' : undefined, showlegend: bound ? firstBound : true, hovertemplate: `${c.label}<extra></extra>`,
      line: { color: fg, width: bound ? 1 : 1.8, dash: bound ? 'dot' : 'solid' }, opacity: bound ? 0.45 : 0.85,
    })
    if (bound) firstBound = false
  })
  let firstLevel = true
  if (layers.levels) g.level_curves.forEach((l) => {
    d.push({
      x: l.segment.map((q) => q[0]), y: l.segment.map((q) => q[1]), type: 'scatter', mode: 'lines',
      name: l.optimal ? `Curva de nível ótima · Z = ${dec(l.z)}` : 'Curvas de nível', legendgroup: l.optimal ? 'opt-level' : 'levels',
      showlegend: l.optimal || firstLevel, hovertemplate: `Z = ${dec(l.z)}<extra></extra>`,
      line: { color: l.optimal ? '#10b981' : '#94a3b8', width: l.optimal ? 3 : 1.4, dash: 'dash' },
    })
    if (!l.optimal) firstLevel = false
  })
  if (layers.segment && g.optimal_segment) d.push({
    x: g.optimal_segment.map((q) => q[0]), y: g.optimal_segment.map((q) => q[1]), type: 'scatter', mode: 'lines', name: 'Ótimos múltiplos',
    line: { color: '#f59e0b', width: 8 }, opacity: 0.75,
  })
  if (layers.ints && g.integer_points.length) d.push({
    x: g.integer_points.map((q) => q[0]), y: g.integer_points.map((q) => q[1]), type: 'scatter', mode: 'markers', name: 'Inteiros viáveis',
    marker: { size: 5, color: '#a1a1aa' }, hovertemplate: '(%{x}; %{y})<extra>inteiro viável</extra>',
  })
  if (layers.vertices && g.vertices.length) d.push({
    x: g.vertices.map((v) => v.x), y: g.vertices.map((v) => v.y), type: 'scatter', mode: 'text+markers', name: 'Vértices',
    text: g.vertices.map((_, i) => `V${i + 1}`), textposition: 'top right', textfont: { color: fg },
    marker: { size: 9, color: dark ? '#171a2b' : '#ffffff', line: { color: fg, width: 2 } },
    customdata: g.vertices.map((v) => dec(v.z)), hovertemplate: '(%{x:.4g}; %{y:.4g})<br>Z = %{customdata}<extra>vértice</extra>',
  })
  if (layers.optimum && g.optimum) d.push({
    x: [g.optimum.x], y: [g.optimum.y], type: 'scatter', mode: 'markers', name: `Ótimo contínuo · Z = ${dec(g.optimum.z)}`,
    marker: { size: 17, symbol: 'star', color: '#10b981', line: { color: fg, width: 1 } },
  })
  if (layers.rounding && g.rounding) {
    const r = g.rounding
    if (r.simple) d.push({ x: [r.simple.x], y: [r.simple.y], type: 'scatter', mode: 'markers', name: `Arredondamento simples (${r.simple.feasible ? 'viável' : 'inviável'})`,
      marker: { size: 12, symbol: 'x', color: r.simple.feasible ? '#10b981' : '#e11d48', line: { width: 3, color: r.simple.feasible ? '#10b981' : '#e11d48' } } })
    if (r.neighbor) d.push({ x: [r.neighbor.x], y: [r.neighbor.y], type: 'scatter', mode: 'markers', name: 'Melhor piso/teto viável',
      marker: { size: 12, symbol: 'diamond-open', color: '#6366f1', line: { width: 3, color: '#6366f1' } } })
  }
  if (layers.intOpt && g.integer_optimum) d.push({
    x: [g.integer_optimum.x], y: [g.integer_optimum.y], type: 'scatter', mode: 'markers', name: `Inteira ótima · Z = ${dec(g.integer_optimum.z)}`,
    marker: { size: 15, symbol: 'diamond', color: '#f97316', line: { color: fg, width: 1.5 } },
  })

  const [x0, x1, y0, y1] = g.box
  const layout: Partial<Layout> = {
    height, margin: { l: 56, r: 16, t: 8, b: 56 }, paper_bgcolor: background ?? 'rgba(0,0,0,0)', plot_bgcolor: background ?? 'rgba(0,0,0,0)',
    font: { color: fg, family: 'Geist, system-ui, sans-serif', size: 12 },
    xaxis: { title: { text: xn }, range: [x0, x1], gridcolor: grid, zerolinecolor: fg, zerolinewidth: 1.2 },
    yaxis: { title: { text: yn }, range: [y0, y1], gridcolor: grid, zerolinecolor: fg, zerolinewidth: 1.2 },
    legend: { orientation: 'h', y: -0.18, font: { size: 11 } }, hovermode: 'closest', showlegend: true,
  }
  return { data: d, layout }
}
