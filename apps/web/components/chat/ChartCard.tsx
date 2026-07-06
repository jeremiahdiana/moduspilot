'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

// MODUS emits ```chart { json } ``` and this renders a real, interactive chart.
// Spec: { type: 'bar'|'line'|'area'|'pie', title?, unit?, data: [{ label, value } | { label, <series>: n }] }
// Robust: bad JSON / missing data falls back to a small notice instead of crashing.

type ChartSpec = {
  type?: 'bar' | 'line' | 'area' | 'pie';
  title?: string;
  unit?: string;
  data?: Record<string, string | number>[];
};

// Brand-led categorical palette (violet first), tuned to read in light + dark.
const PALETTE = ['#7C3AED', '#a78bfa', '#c084fc', '#6d28d9', '#818cf8', '#d8b4fe'];

export default function ChartCard({ raw }: { raw: string }) {
  const spec = useMemo<ChartSpec | null>(() => {
    try {
      const parsed = JSON.parse(raw) as ChartSpec;
      if (!parsed || !Array.isArray(parsed.data) || parsed.data.length === 0) return null;
      return parsed;
    } catch {
      return null;
    }
  }, [raw]);

  if (!spec) {
    return (
      <div className="rounded-xl border border-border bg-bg px-4 py-3 text-xs text-muted">
        Couldn&apos;t render this chart.
      </div>
    );
  }

  const data = spec.data!;
  const type = spec.type ?? 'bar';
  const labelKey = ['label', 'name', 'x', 'category'].find(k => k in data[0]) ?? Object.keys(data[0])[0];
  const seriesKeys = Object.keys(data[0]).filter(
    k => k !== labelKey && typeof data[0][k] === 'number',
  );
  const keys = seriesKeys.length ? seriesKeys : ['value'];
  const unit = spec.unit ?? '';
  const fmt = (v: number | string) => `${v}${unit ? ` ${unit}` : ''}`;

  const axisTick = { fontSize: 11, fill: 'rgb(var(--color-muted))' };
  const tooltipStyle = {
    background: 'rgb(var(--color-panel))',
    border: '1px solid rgb(var(--color-border))',
    borderRadius: 10,
    fontSize: 12,
    color: 'rgb(var(--color-text))',
  };

  return (
    <div className="w-full rounded-xl border border-border bg-bg p-3 sm:p-4">
      {spec.title && <p className="text-sm font-semibold text-text mb-3">{spec.title}</p>}
      <div className="w-full" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          {type === 'pie' ? (
            <PieChart>
              <Pie
                data={data} dataKey={keys[0]} nameKey={labelKey}
                cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2}
              >
                {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          ) : type === 'line' ? (
            <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border))" vertical={false} />
              <XAxis dataKey={labelKey} tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
              {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
              {keys.map((k, i) => (
                <Line key={k} type="monotone" dataKey={k} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              ))}
            </LineChart>
          ) : type === 'area' ? (
            <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
              <defs>
                {keys.map((k, i) => (
                  <linearGradient key={k} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border))" vertical={false} />
              <XAxis dataKey={labelKey} tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
              {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
              {keys.map((k, i) => (
                <Area key={k} type="monotone" dataKey={k} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.5} fill={`url(#grad-${i})`} />
              ))}
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border))" vertical={false} />
              <XAxis dataKey={labelKey} tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgb(var(--color-brand) / 0.06)' }} formatter={(v: number) => fmt(v)} />
              {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
              {keys.map((k, i) => (
                <Bar key={k} dataKey={k} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} maxBarSize={48} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
