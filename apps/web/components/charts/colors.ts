// Recharts needs literal color values (SVG fill/stroke don't reliably
// resolve CSS custom properties across browsers) — kept in one place so
// every chart draws from the same palette as globals.css's --primary etc.
export const CHART_COLORS = {
  primary: "#3b82f6",
  primaryTint: "#1e293b",
  recovered: "#22c55e",
  atRisk: "#ef4444",
  pending: "#f59e0b",
  grid: "#1e1e1e",
  muted: "#8a8a8a",
  ink: "#f0f0f0",
};

export const CLASS_COLORS = ["#3b82f6", "#06b6d4", "#60a5fa", "#f59e0b", "#ef4444", "#93c5fd"];
