import { z } from "zod";
import Decimal from "decimal.js";

const positiveDecimal = (max?: Decimal.Value) =>
  z
    .string()
    .trim()
    .min(1)
    .refine(
      (v) => {
        try {
          const d = new Decimal(v);
          return d.gt(0) && (max === undefined || d.lte(max));
        } catch {
          return false;
        }
      },
      { message: "Must be a positive decimal" },
    );

const purity = z
  .string()
  .trim()
  .refine(
    (v) => {
      try {
        const d = new Decimal(v);
        return d.gt(0) && d.lte(1);
      } catch {
        return false;
      }
    },
    { message: "Purity must be in (0, 1]" },
  );

export const metalCode = z.enum(["XAU", "XAG", "XPT"]);

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(255),
  phone: z.string().trim().max(30).optional(),
  clientType: z.enum(["retail", "institutional"]),
});
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;

export const accountCreateSchema = z.object({
  customerId: z.uuid(),
});
export type AccountCreateInput = z.infer<typeof accountCreateSchema>;

export const marketPriceCreateSchema = z.object({
  metalCode,
  pricePerKg: positiveDecimal(),
  currency: z.string().length(3).optional(),
  effectiveAt: z.iso.datetime().optional(),
});
export type MarketPriceCreateInput = z.infer<typeof marketPriceCreateSchema>;

const depositUnallocated = z.object({
  storageType: z.literal("unallocated"),
  accountId: z.uuid(),
  metalCode,
  vaultId: z.number().int().positive(),
  quantityKg: positiveDecimal(),
  notes: z.string().max(500).optional(),
});

const depositAllocated = z.object({
  storageType: z.literal("allocated"),
  accountId: z.uuid(),
  metalCode,
  vaultId: z.number().int().positive(),
  bar: z.object({
    serialNumber: z.string().trim().min(1).max(64),
    weightKg: positiveDecimal(),
    purity,
  }),
  notes: z.string().max(500).optional(),
});

export const depositSchema = z.discriminatedUnion("storageType", [
  depositUnallocated,
  depositAllocated,
]);
export type DepositInput = z.infer<typeof depositSchema>;
export type DepositUnallocatedInput = z.infer<typeof depositUnallocated>;
export type DepositAllocatedInput = z.infer<typeof depositAllocated>;

const withdrawalUnallocated = z.object({
  storageType: z.literal("unallocated"),
  accountId: z.uuid(),
  metalCode,
  vaultId: z.number().int().positive(),
  quantityKg: positiveDecimal(),
  notes: z.string().max(500).optional(),
});

const withdrawalAllocated = z.object({
  storageType: z.literal("allocated"),
  accountId: z.uuid(),
  barId: z.uuid(),
  notes: z.string().max(500).optional(),
});

export const withdrawalSchema = z.discriminatedUnion("storageType", [
  withdrawalUnallocated,
  withdrawalAllocated,
]);
export type WithdrawalInput = z.infer<typeof withdrawalSchema>;
export type WithdrawalUnallocatedInput = z.infer<typeof withdrawalUnallocated>;
export type WithdrawalAllocatedInput = z.infer<typeof withdrawalAllocated>;
