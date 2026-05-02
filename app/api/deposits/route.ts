import { created, readJson, withErrorHandling } from "@/lib/api/handler";
import { recordDeposit } from "@/lib/services/deposit.service";
import { depositSchema } from "@/lib/validation";

export const POST = withErrorHandling(async (req: Request) => {
  const body = await readJson(req);
  const input = depositSchema.parse(body);
  const result = await recordDeposit(input);
  return created(result);
});
