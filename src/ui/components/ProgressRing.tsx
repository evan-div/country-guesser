import type { ReactNode } from 'react'

interface Segment {
  value: number
  color: string
}

/** Multi-segment ring (e.g. mastered + learning out of 195). */
export function ProgressRing({
  segments,
  total,
  size = 160,
  stroke = 12,
  children,
}: {
  segments: Segment[]
  total: number
  size?: number
  stroke?: number
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const len = total ? (s.value / total) * c : 0
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeLinecap={len > 0 ? 'round' : 'butt'}
              strokeDasharray={`${Math.max(0, len - (len > stroke ? 0 : 0))} ${c}`}
              strokeDashoffset={-offset}
              style={{ filter: `drop-shadow(0 0 6px ${s.color})`, transition: 'stroke-dasharray 900ms ease' }}
            />
          )
          offset += len
          return el
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}
