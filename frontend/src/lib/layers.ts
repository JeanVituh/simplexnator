export interface Layers {
  region: boolean; constraints: boolean; levels: boolean; vertices: boolean; ints: boolean
  optimum: boolean; intOpt: boolean; rounding: boolean; segment: boolean
}
export const LAYER_META: Record<keyof Layers, { label: string; color: string }> = {
  region: { label: 'Região viável', color: '#6366f1' },
  constraints: { label: 'Restrições', color: '#64748b' },
  levels: { label: 'Curvas de nível', color: '#94a3b8' },
  vertices: { label: 'Vértices', color: '#334155' },
  ints: { label: 'Pontos inteiros', color: '#a1a1aa' },
  optimum: { label: 'Ótimo contínuo', color: '#10b981' },
  intOpt: { label: 'Inteira ótima', color: '#f97316' },
  rounding: { label: 'Arredondamento', color: '#e11d48' },
  segment: { label: 'Ótimos múltiplos', color: '#f59e0b' },
}
