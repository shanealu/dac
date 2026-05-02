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

export type DecimalString = string;
