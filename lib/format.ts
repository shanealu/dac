import Decimal from "decimal.js";

export const fmtKg = (value: string | null | undefined, frac = 4): string => {
  if (value === null || value === undefined || value === "") return "—";
  const d = new Decimal(value);
  return `${d.toDecimalPlaces(frac).toString()} kg`;
};

export const fmtUSD = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  const n = Number(new Decimal(value).toFixed(2));
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

export const fmtPct = (numerator: string, denominator: string, frac = 2): string => {
  const d = new Decimal(denominator);
  if (d.isZero()) return "—";
  return `${new Decimal(numerator).div(d).times(100).toDecimalPlaces(frac).toString()}%`;
};

export const fmtPurity = (value: string | null | undefined, frac = 4): string => {
  if (value === null || value === undefined || value === "") return "—";
  return new Decimal(value).toDecimalPlaces(frac).toFixed(frac);
};

export const fmtDate = (iso: string | Date): string => {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const fmtRelative = (iso: string | Date): string => {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return d.toLocaleDateString();
};
