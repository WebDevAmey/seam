"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPaise, shortDate } from "@/lib/format";
import { CHART_COLORS } from "./colors";

type Point = { date: string; leakAmountPaise: string; recoveredPaise: string };

export function TrendChart({ data }: { data: Point[] }) {
  const rows = data.map((d) => ({
    date: shortDate(d.date),
    leaked: Number(d.leakAmountPaise) / 100,
    recovered: Number(d.recoveredPaise) / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="leakedFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.atRisk} stopOpacity={0.18} />
            <stop offset="100%" stopColor={CHART_COLORS.atRisk} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="recoveredFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.recovered} stopOpacity={0.25} />
            <stop offset="100%" stopColor={CHART_COLORS.recovered} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: CHART_COLORS.muted }}
          axisLine={{ stroke: CHART_COLORS.grid }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: CHART_COLORS.muted }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
          width={44}
        />
        <Tooltip
          formatter={(value) => formatPaise(Math.round(Number(value) * 100))}
          labelStyle={{ fontSize: 12, fontWeight: 600, color: CHART_COLORS.ink }}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${CHART_COLORS.grid}`, background: "#0c0c0c", color: CHART_COLORS.ink }}
        />
        <Area type="monotone" dataKey="leaked" name="Leaked" stroke={CHART_COLORS.atRisk} strokeWidth={2} fill="url(#leakedFill)" />
        <Area type="monotone" dataKey="recovered" name="Recovered (EV)" stroke={CHART_COLORS.recovered} strokeWidth={2} fill="url(#recoveredFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
