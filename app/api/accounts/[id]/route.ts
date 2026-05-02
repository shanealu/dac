import { ok, withErrorHandling } from "@/lib/api/handler";
import { getAccount } from "@/lib/services/account.service";

export const GET = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    return ok(await getAccount(id));
  },
);
