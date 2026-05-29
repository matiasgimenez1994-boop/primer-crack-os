import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Leaf } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatWeight } from "@/lib/utils";
import type { GreenCoffee } from "@/types";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters")
    .select("id, currency")
    .eq("user_id", user.id)
    .single();

  if (!roaster) redirect("/onboarding");

  const params = await searchParams;
  const statusFilter = params.status;

  let query = supabase
    .from("green_coffees")
    .select("*")
    .eq("roaster_id", roaster.id)
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: coffees } = await query;

  const tabs = [
    { key: "all", label: "Todos" },
    { key: "active", label: "Activos" },
    { key: "depleted", label: "Agotados" },
    { key: "reserved", label: "Reservados" },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Inventario de café verde</h1>
        <Link href="/inventory/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Agregar café
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-1 mb-5 bg-white rounded-lg border border-border-default p-1 w-fit">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/inventory" : `/inventory?status=${tab.key}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              (tab.key === "all" && !statusFilter) ||
              tab.key === statusFilter
                ? "bg-brand-dark text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Table */}
      {(coffees ?? []).length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Leaf}
            title="No hay cafés en inventario"
            description="Agregá tu primer café verde para empezar a registrar tuestes y calcular costos."
            actionLabel="+ Agregar café verde"
            actionHref="/inventory/new"
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-[#FDFAF6]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">
                    Café
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">
                    Origen
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden lg:table-cell">
                    Proceso
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">
                    Stock
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">
                    Precio/kg
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">
                    Valor
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {(coffees ?? []).map((c: GreenCoffee) => (
                  <tr
                    key={c.id}
                    className="border-b border-border-default last:border-0 hover:bg-[#F5EFE6]/50 transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/inventory/${c.id}`}
                        className="font-medium text-text-primary group-hover:text-accent-green transition-colors"
                      >
                        {c.name}
                      </Link>
                      {c.farm_producer && (
                        <p className="text-xs text-text-secondary mt-0.5">
                          {c.farm_producer}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary hidden md:table-cell">
                      {c.origin_country ?? "â€”"}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary hidden lg:table-cell">
                      {c.process ?? "â€”"}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-medium text-text-primary">
                      {formatWeight(c.current_stock_kg)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-text-secondary">
                      {formatCurrency(c.purchase_price_per_kg, roaster.currency)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-text-secondary hidden sm:table-cell">
                      {formatCurrency(
                        c.current_stock_kg * c.purchase_price_per_kg,
                        roaster.currency
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

