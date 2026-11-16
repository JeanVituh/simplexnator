/** Ilustração discreta: região viável, curvas de nível e vértice ótimo. */
export default function HeroArt() {
  const grid = Array.from({ length: 9 }, (_, i) => 40 + i * 40)
  return (
    <svg viewBox="0 0 400 300" role="img" aria-label="Região viável com curvas de nível e vértice ótimo" className="h-auto w-full">
      <g className="stroke-border" strokeWidth="1">
        {grid.map((v) => <line key={`v${v}`} x1={v} y1="20" x2={v} y2="270" />)}
        {[50, 100, 150, 200, 250].map((v) => <line key={`h${v}`} x1="20" y1={v} x2="380" y2={v} />)}
      </g>
      <path d="M40 270V150L120 70 250 55 330 130 290 270Z" className="fill-primary/10 stroke-primary" strokeWidth="2" strokeLinejoin="round" />
      <g className="stroke-muted-foreground/50" strokeWidth="1.5" strokeDasharray="5 5" fill="none">
        <path d="M60 30 360 210" /><path d="M20 70 320 250" /><path d="M110 18 380 180" />
      </g>
      <path d="M193 20 380 134.825" className="stroke-success" strokeWidth="2.5" strokeDasharray="7 5" fill="none" />
      {[[40, 150], [120, 70], [330, 130], [290, 270], [40, 270]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" className="fill-card stroke-foreground" strokeWidth="2" />)}
      <g transform="translate(250 55)">
        <circle r="6" className="origin-center animate-pulse-ring fill-success/40" style={{ transformBox: 'fill-box' }} />
        <circle r="7" className="fill-success stroke-card" strokeWidth="2.5" />
      </g>
      <text x="262" y="48" className="fill-success font-mono text-[13px] font-semibold">Z*</text>
      <text x="338" y="285" className="fill-muted-foreground font-mono text-[12px]">x₁</text>
      <text x="6" y="30" className="fill-muted-foreground font-mono text-[12px]">x₂</text>
    </svg>
  )
}
