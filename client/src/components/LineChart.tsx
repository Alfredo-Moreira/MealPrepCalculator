import { useId } from 'react';

export interface ChartLine {
  label: string;
  color: string;
  points: Array<{ x: number; y: number }>; // x = timestamp (ms), y = value
}

interface Props {
  lines: ChartLine[];
  height?: number;
  yUnit?: string;
  formatY?: (v: number) => string;
}

const W = 640;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

/** Minimal multi-series line chart. Dependency-free, scales to container width. */
export default function LineChart({ lines, height = 240, yUnit = '', formatY = (v) => String(Math.round(v)) }: Props) {
  const gid = useId();
  const H = height;
  const allPts = lines.flatMap((l) => l.points);

  if (allPts.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-border py-12 text-sm text-faint" style={{ height }}>
        No data yet — log a check-in to start tracking.
      </div>
    );
  }

  const xs = allPts.map((p) => p.x);
  const ys = allPts.map((p) => p.y);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minX === maxX) { minX -= 1; maxX += 1; }
  // pad y range a touch
  const yPad = (maxY - minY) * 0.12 || Math.abs(maxY) * 0.1 || 1;
  minY -= yPad;
  maxY += yPad;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const sx = (x: number) => PAD.left + ((x - minX) / (maxX - minX)) * plotW;
  const sy = (y: number) => PAD.top + (1 - (y - minY) / (maxY - minY)) * plotH;

  // y gridlines (4 ticks)
  const ticks = Array.from({ length: 4 }, (_, i) => minY + ((maxY - minY) * i) / 3);
  const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} role="img">
        {/* gridlines + y labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={sy(t)} x2={W - PAD.right} y2={sy(t)} className="stroke-border" strokeWidth="1" />
            <text x={PAD.left - 8} y={sy(t) + 4} textAnchor="end" className="fill-faint text-[10px]">
              {formatY(t)}
            </text>
          </g>
        ))}
        {/* x endpoints */}
        <text x={PAD.left} y={H - 8} textAnchor="start" className="fill-faint text-[10px]">{fmtDate(minX)}</text>
        <text x={W - PAD.right} y={H - 8} textAnchor="end" className="fill-faint text-[10px]">{fmtDate(maxX)}</text>

        {lines.map((line, li) => {
          const pts = [...line.points].sort((a, b) => a.x - b.x);
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
          return (
            <g key={li}>
              {pts.length > 1 && <path d={d} fill="none" stroke={line.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
              {pts.map((p, i) => (
                <circle key={`${gid}-${li}-${i}`} cx={sx(p.x)} cy={sy(p.y)} r="3.5" className="fill-surface" stroke={line.color} strokeWidth="2" />
              ))}
            </g>
          );
        })}
      </svg>

      {lines.length > 1 && (
        <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-muted">
          {lines.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <i className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
      {yUnit && <p className="mt-1 text-center text-[11px] text-faint">{yUnit}</p>}
    </div>
  );
}
