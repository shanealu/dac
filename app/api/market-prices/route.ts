import { created, ok, readJson, withErrorHandling } from "@/lib/api/handler";
import {
  listPriceHistory,
  recordMarketPrice,
} from "@/lib/services/market-price.service";
import { marketPriceCreateSchema, metalCode } from "@/lib/validation";

export const GET = withErrorHandling(async (req: Request) => {
  const url = new URL(req.url);
  const code = metalCode.parse(url.searchParams.get("metalCode"));
  const history = await listPriceHistory(code);
  return ok(history);
});

export const POST = withErrorHandling(async (req: Request) => {
  const body = await readJson(req);
  const input = marketPriceCreateSchema.parse(body);
  const price = await recordMarketPrice(input);
  return created(price);
});
