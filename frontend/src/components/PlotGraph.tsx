import { useEffect, useMemo, useRef } from 'react'
import Plotly from 'plotly.js-dist-min'
import type { Config } from 'plotly.js'
import type { GraphData } from '@/lib/types'
import type { Layers } from '@/lib/layers'
import { buildFigure } from '@/lib/plotFigure'
import { useApp } from '@/store'

/** Gráfico 2D interativo (Plotly). Carregado sob demanda pelas páginas via React.lazy. */
export default function PlotGraph({ g, layers, height = 520 }: { g: GraphData; layers: Layers; height?: number }) {
  const { dark } = useApp()
  const host = useRef<HTMLDivElement>(null)
  const fig = useMemo(() => buildFigure(g, layers, { dark, height }), [g, layers, dark, height])
  const config: Partial<Config> = useMemo(() => ({ responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] }), [])

  useEffect(() => { if (host.current) void Plotly.react(host.current, fig.data, fig.layout, config) }, [fig, config])
  useEffect(() => {
    const el = host.current
    if (!el) return
    const ro = new ResizeObserver(() => Plotly.Plots.resize(el))
    ro.observe(el)
    return () => { ro.disconnect(); Plotly.purge(el) }
  }, [])
  return <div ref={host} className="w-full" style={{ minHeight: height }} role="img" aria-label="Gráfico da região viável" />
}
