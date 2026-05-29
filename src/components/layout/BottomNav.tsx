"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Leaf, Flame, ShoppingBag, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Inicio",     icon: LayoutDashboard },
  { href: "/inventory", label: "Stock",      icon: Leaf },
  { href: "/roasts",    label: "Tuestes",    icon: Flame },
  { href: "/sales",     label: "Ventas",     icon: ShoppingBag },
  { href: "/clients",   label: "Clientes",   icon: Users },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border-default z-40">
      <div className="flex">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                active ? "text-accent-green" : "text-text-secondary"
              )}
            >
              <Icon className={cn("w-5 h-5", active && "text-accent-green")} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
