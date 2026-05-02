"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GaugeIcon, UsersIcon, WalletIcon, ScaleIcon, BarChart3Icon } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard", icon: GaugeIcon, exact: true },
  { href: "/customers", label: "Customers", icon: UsersIcon },
  { href: "/accounts", label: "Accounts", icon: WalletIcon },
  { href: "/admin/prices", label: "Prices", icon: BarChart3Icon },
  { href: "/admin/bars", label: "Bars", icon: ScaleIcon },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-foreground text-background text-[11px] font-bold">
            BM
          </span>
          <span className="hidden sm:inline">Bare Metals</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((l) => {
            const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden md:inline">{l.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto text-xs text-muted-foreground">
          Digital Asset Custody Platform
        </div>
      </div>
    </header>
  );
}
