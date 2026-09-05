"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { methodLabel } from "@/lib/format";
import { CHART_COLORS } from "./colors";

type Row = { method: string; attempts: number; failures: number };

export function MethodChart({ data }: { data: Row[] }) {
  const rows = data
    .map((d) => ({ name: methodLabel(d.method), succeeded: d.attempts - d.failures, failed: d.failures }))
    .sort((a, b) => b.succeeded + b.failed - (a.succeeded + a.failed));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: CHART_COLORS.ink }} axisLine={{ stroke: CHART_COLORS.grid }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.muted }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${CHART_COLORS.grid}`, background: "#0c0c0c", color: CHART_COLORS.ink }} />
        <Bar dataKey="succeeded" name="Succeeded" stackId="a" fill={CHART_COLORS.primary} radius={[0, 0, 0, 0]} />
        <Bar dataKey="failed" name="Failed" stackId="a" fill={CHART_COLORS.atRisk} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
