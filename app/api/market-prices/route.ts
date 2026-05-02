import { created, ok, readJson, withErrorHandling } from "@/lib/api/handler";
import {
  listPriceHistory,
  recordMarketPrice,
} from "@/lib/services/market-price.service";
import { marketPriceCreateSchema } from "@/lib/validation";

export const GET = withErrorHandling(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("metalCode");
  if (!code) {
    return Response.json(
      { error: { code: "BAD_REQUEST", message: "metalCode query param is required" } },
      { status: 400 },
    );
  }
  const history = await listPriceHistory(code);
  return ok(history);
});

export const POST = withErrorHandling(async (req: Request) => {
  const body = await readJson(req);
  const input = marketPriceCreateSchema.parse(body);
  const price = await recordMarketPrice(input);
  return created(price);
});
