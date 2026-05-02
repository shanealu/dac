import { Skeleton } from "@/components/ui/skeleton";

export default function AccountLoading() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-6 flex items-center gap-2">
        <Skeleton className="h-3 w-16" />
        <span className="text-muted-foreground/40">/</span>
        <Skeleton className="h-3 w-32" />
        <span className="text-muted-foreground/40">/</span>
        <Skeleton className="h-3 w-28" />
      </div>

      <section className="border-y bg-card">
        <div className="grid grid-cols-1 gap-10 px-6 py-10 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-56" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="flex flex-col items-start gap-6 lg:items-end">
            <div className="space-y-2 lg:text-right">
              <Skeleton className="h-3 w-24 lg:ml-auto" />
              <Skeleton className="h-14 w-64 lg:ml-auto" />
              <Skeleton className="h-3 w-32 lg:ml-auto" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full" />
        ))}
      </section>

      <section className="mt-12 space-y-6">
        <div className="flex gap-6 border-b pb-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </section>
    </div>
  );
}
