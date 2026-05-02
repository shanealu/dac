import Link from "next/link";
import { listCustomers } from "@/lib/services/customer.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/domain/page-header";
import { CustomerCreateForm } from "@/components/domain/customer-create-form";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await listCustomers();
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        eyebrow="Customers"
        title="Customer directory"
        description={`${customers.length} customer${customers.length === 1 ? "" : "s"} on file. Each can hold multiple accounts.`}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>All customers</CardTitle>
            <CardDescription>Click a customer to manage their accounts.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {customers.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                No customers yet. Create the first one.
              </div>
            ) : (
              <ul className="divide-y">
                {customers.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/customers/${c.id}`}
                      className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-muted/50"
                    >
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{c.email}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={c.clientType === "institutional" ? "default" : "secondary"}>
                          {c.clientType}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {fmtDate(c.createdAt)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New customer</CardTitle>
            <CardDescription>
              Client type is informational — accounts can hold either storage form.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CustomerCreateForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
