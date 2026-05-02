import { created, ok, readJson, withErrorHandling } from "@/lib/api/handler";
import { createCustomer, listCustomers } from "@/lib/services/customer.service";
import { customerCreateSchema } from "@/lib/validation";

export const GET = withErrorHandling(async () => {
  const customers = await listCustomers();
  return ok(customers);
});

export const POST = withErrorHandling(async (req: Request) => {
  const body = await readJson(req);
  const input = customerCreateSchema.parse(body);
  const customer = await createCustomer(input);
  return created(customer);
});
