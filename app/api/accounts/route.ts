import { created, ok, readJson, withErrorHandling } from "@/lib/api/handler";
import { createAccount, listAccounts } from "@/lib/services/account.service";
import { accountCreateSchema } from "@/lib/validation";

export const GET = withErrorHandling(async () => {
  return ok(await listAccounts());
});

export const POST = withErrorHandling(async (req: Request) => {
  const body = await readJson(req);
  const input = accountCreateSchema.parse(body);
  const account = await createAccount(input);
  return created(account);
});
