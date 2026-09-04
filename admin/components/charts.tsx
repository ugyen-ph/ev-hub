'use client';

// Tiny dependency-free charts (flexbox + SVG) — enough for the admin
// analytics dashboard without adding a charting library to the stack.

export type Datum = { label: string; value: number };

export function BarChart({
  data,
  height = 140,
  barColor = 'bg-emerald-500',
}: {
  data: Datum[];
  height?: number;
  barColor?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d) => (
          <div
            key={d.label}
            className="group flex min-w-0 flex-1 flex-col items-center justify-end"
            title={`${d.label}: ${d.value}`}
          >
            <span className="mb-1 text-[10px] text-neutral-400 opacity-0 transition group-hover:opacity-100">
              {d.value}
            </span>
            <div
              className={`w-full max-w-8 rounded-t ${barColor} ${d.value === 0 ? 'bg-neutral-800' : ''}`}
              style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 3 : 2)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {data.map((d) => (
          <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[10px] text-neutral-500">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HBars({
  data,
  barColor = 'bg-emerald-500',
}: {
  data: Datum[];
  barColor?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="text-xs">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-neutral-300">{d.label}</span>
            <span className="shrink-0 text-neutral-400">{d.value}</span>
          </div>
          <div className="h-2 rounded bg-neutral-800">
            <div
              className={`h-2 rounded ${barColor}`}
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Donut({
  segments,
  size = 130,
  thickness = 16,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#262626" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s) => {
            const frac = s.value / total;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${frac * c} ${c}`}
                strokeDashoffset={-offset * c}
              />
            );
            offset += frac;
            return el;
          })}
      </svg>
      <ul className="space-y-1.5 text-xs">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="capitalize text-neutral-300">{s.label}</span>
            <span className="text-neutral-500">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
