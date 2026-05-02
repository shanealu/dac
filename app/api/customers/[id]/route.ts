import { ok, withErrorHandling } from "@/lib/api/handler";
import { getCustomer } from "@/lib/services/customer.service";

export const GET = withErrorHandling(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const customer = await getCustomer(id);
    return ok(customer);
  },
);
