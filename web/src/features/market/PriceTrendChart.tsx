import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { TrendPoint } from '@/domain/market'
import { formatPrice } from '@/lib/format'

const monthShort = new Intl.DateTimeFormat('en-CA', { month: 'short' })
const monthLong = new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric' })

const HEIGHT = 200
const PAD = { top: 16, right: 16, bottom: 26, left: 56 }

/** Width of an element in CSS pixels, so the chart draws at real size (text never scales). */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/** Round gridline steps: $500, $1,000, $2,000, $5,000... */
function niceStep(range: number): number {
  const raw = range / 3
  const power = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw
}

/**
 * P37: one series, so no legend; the heading names it. A 2px line, hairline
 * gridlines, the latest value labelled at the end, and this car's price as a
 * reference line. Hover or arrow keys move a crosshair with a tooltip. The
 * table under the chart has every value, so nothing depends on hovering.
 */
export function PriceTrendChart({ points, thisCar, label }: { points: TrendPoint[]; thisCar: number; label: string }) {
  const [ref, width] = useWidth()
  const [active, setActive] = useState<number | null>(null)

  const prices = points.map((p) => p.price)
  const step = niceStep(Math.max(...prices, thisCar) - Math.min(...prices, thisCar) || 1000)
  // Half a step of headroom, so no line sits right on the axis.
  const yMin = Math.floor((Math.min(...prices, thisCar) - step / 2) / step) * step
  const yMax = Math.ceil((Math.max(...prices, thisCar) + step / 2) / step) * step
  const ticks: number[] = []
  for (let t = yMin; t <= yMax + 1; t += step) ticks.push(t)

  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (points.length === 1 ? 0 : (i / (points.length - 1)) * plotW)
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ')
  const last = points.length - 1

  function pick(e: PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - box.left) / box.width
    setActive(Math.max(0, Math.min(last, Math.round(ratio * last))))
  }

  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? last) - 1))
    else if (e.key === 'ArrowRight') setActive((a) => Math.min(last, (a ?? -1) + 1))
    else return
    e.preventDefault()
  }

  const shown = active ?? null
  const first = points[0]
  const change = Math.round(((points[last].price - first.price) / first.price) * 1000) / 10

  return (
    <div ref={ref} className="relative mt-3">
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${label}. ${formatPrice(first.price)} in ${monthLong.format(first.month)}, ${formatPrice(points[last].price)} now (${change > 0 ? '+' : ''}${change}%). This car: ${formatPrice(thisCar)}. Use the arrow keys to read each month.`}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          className="overflow-visible rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {/* Gridlines and y labels: hairline, solid, recessive. */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {formatPrice(t)}
              </text>
            </g>
          ))}

          {/* Month labels: first, middle and last, so they never collide. */}
          {[0, Math.floor(last / 2), last].map((i) => (
            <text
              key={i}
              x={x(i)}
              y={HEIGHT - 6}
              textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}
              className="fill-muted-foreground text-[11px]"
            >
              {monthShort.format(points[i].month)}
            </text>
          ))}

          {/* This car's price, as a reference line. */}
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={y(thisCar)}
            y2={y(thisCar)}
            className="stroke-foreground/50"
            strokeWidth={1}
          />
          <text x={PAD.left + 4} y={y(thisCar) - 5} className="fill-foreground text-[11px] font-medium">
            This car {formatPrice(thisCar)}
          </text>

          <path d={path} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(last)} cy={y(points[last].price)} r={4} className="fill-primary stroke-card" strokeWidth={2} />
          <text
            x={x(last)}
            y={y(points[last].price) + (points[last].price >= thisCar ? -10 : 18)}
            textAnchor="end"
            className="fill-foreground text-[11px] font-semibold tabular-nums"
          >
            {formatPrice(points[last].price)}
          </text>

          {shown !== null && (
            <g>
              <line x1={x(shown)} x2={x(shown)} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="stroke-muted-foreground" strokeWidth={1} />
              <circle cx={x(shown)} cy={y(points[shown].price)} r={4} className="fill-primary stroke-card" strokeWidth={2} />
            </g>
          )}

          {/* Hit area: the whole plot, so the pointer only has to find the month. */}
          <rect
            x={PAD.left - 8}
            y={PAD.top}
            width={plotW + 16}
            height={plotH}
            fill="transparent"
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      )}

      {shown !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
          style={{
            left: Math.min(Math.max(x(shown) - 60, 0), Math.max(0, width - 120)),
          }}
          aria-live="polite"
        >
          <p className="font-semibold tabular-nums">{formatPrice(points[shown].price)}</p>
          <p className="text-muted-foreground">{monthLong.format(points[shown].month)}</p>
        </div>
      )}

      <details className="mt-1 text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:underline">Show as a table</summary>
        <table className="mt-2 w-full max-w-xs tabular-nums">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="font-normal">Month</th>
              <th className="text-right font-normal">Average sale price</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.month}>
                <td>{monthLong.format(p.month)}</td>
                <td className="text-right">{formatPrice(p.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
