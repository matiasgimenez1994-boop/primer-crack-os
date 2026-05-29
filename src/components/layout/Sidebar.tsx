"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Leaf, Flame, ShoppingBag,
  Users, BarChart2, FileText, Receipt, BookOpen,
  ClipboardList, Tag, Settings, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { FirstCrackIcon } from "@/components/ui/FirstCrackIcon";

const navItems = [
  { href: "/dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { href: "/inventory", label: "Inventario", icon: Leaf },
  { href: "/roasts",    label: "Tuestes",    icon: Flame },
  { href: "/profiles",  label: "Perfiles",   icon: BookOpen },
  { href: "/sales",     label: "Ventas",     icon: ShoppingBag },
  { href: "/orders",    label: "Pedidos",    icon: ClipboardList },
  { href: "/clients",   label: "Clientes",   icon: Users },
  { href: "/expenses",  label: "Gastos",     icon: Receipt },
  { href: "/finances",  label: "Finanzas",   icon: BarChart2 },
  { href: "/reports",   label: "Reportes",   icon: FileText },
  { href: "/labels",    label: "Etiquetas",  icon: Tag },
];

const bottomItems = [{ href: "/settings", label: "Ajustes", icon: Settings }];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 min-h-screen bg-brand-dark">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
        <div className="w-7 h-7 rounded-lg bg-accent-green flex items-center justify-center">
          <FirstCrackIcon className="w-4 h-4 text-brand-dark" />
        </div>
        <span className="text-white font-semibold text-sm tracking-tight">
          Primer crack OS
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-accent-green text-brand-dark font-semibold"
                  : "text-white/60 hover:text-white hover:bg-white/8"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 pt-3 border-t border-white/10 flex flex-col gap-0.5">
        {bottomItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active ? "bg-accent-green text-brand-dark" : "text-white/60 hover:text-white hover:bg-white/8"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />{label}
            </Link>
          );
        })}
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/8 transition-colors w-full text-left"
        >
          <LogOut className="w-4 h-4 shrink-0" />Salir
        </button>
      </div>
    </aside>
  );
}
