import { created, readJson, withErrorHandling } from "@/lib/api/handler";
import { recordWithdrawal } from "@/lib/services/withdrawal.service";
import { withdrawalSchema } from "@/lib/validation";

export const POST = withErrorHandling(async (req: Request) => {
  const body = await readJson(req);
  const input = withdrawalSchema.parse(body);
  const result = await recordWithdrawal(input);
  return created(result);
});
