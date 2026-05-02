import { ok, withErrorHandling } from "@/lib/api/handler";
import { getCurrentPrices } from "@/lib/services/market-price.service";

export const GET = withErrorHandling(async () => {
  return ok(await getCurrentPrices());
});
