import { cn } from "@/lib/utils";

const sizes = {
  xs: "size-7 text-[10px]",
  sm: "size-9 text-xs",
  md: "size-10 text-[11px]",
} as const;

export function MetalMark({
  code,
  size = "md",
  className,
}: {
  code: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-md border bg-muted/40 font-mono font-semibold tracking-wider",
        sizes[size],
        className,
      )}
    >
      {code}
    </div>
  );
}
