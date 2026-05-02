import Decimal from "decimal.js";

// Money/weight precision: 8 decimal places, banker's rounding (HALF_EVEN).
// The DB stores everything as TEXT; this module is the only place the conversion happens.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

export const D = (value: Decimal.Value): Decimal => new Decimal(value);

export const SCALE = 8;
export const ZERO = new Decimal(0);

export const toDb = (value: Decimal.Value): string => D(value).toFixed(SCALE);

export const fromDb = (value: string | null): Decimal | null =>
  value === null ? null : new Decimal(value);

/** Format for display: trim trailing zeros, keep at most `maxFraction` digits. */
export const formatKg = (value: Decimal.Value, maxFraction = 4): string => {
  const d = D(value);
  return d.toDecimalPlaces(maxFraction).toString();
};

/** Format a USD price for display: thousands separators, two-decimal scale. */
export const formatUSD = (value: Decimal.Value): string => {
  const n = Number(D(value).toFixed(2));
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export type DecimalString = string;
