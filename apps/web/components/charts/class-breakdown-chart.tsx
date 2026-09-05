"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPaise, leakClassLabel } from "@/lib/format";
import { CHART_COLORS, CLASS_COLORS } from "./colors";

type Row = { class: string; count: number; amountPaise: string };

export function ClassBreakdownChart({ data }: { data: Row[] }) {
  const rows = data
    .map((d) => ({ name: leakClassLabel(d.class), amount: Number(d.amountPaise) / 100, count: d.count }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: CHART_COLORS.muted }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: CHART_COLORS.ink }}
          axisLine={false}
          tickLine={false}
          width={130}
        />
        <Tooltip
          formatter={(value) => formatPaise(Math.round(Number(value) * 100))}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${CHART_COLORS.grid}`, background: "#0c0c0c", color: CHART_COLORS.ink }}
        />
        <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={18}>
          {rows.map((row, i) => (
            <Cell key={row.name} fill={CLASS_COLORS[i % CLASS_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
