import { createClient } from"@/lib/supabase/server";
import { notFound, redirect } from"next/navigation";
import Link from"next/link";
import { ArrowLeft, Edit, AlertTriangle, Mail, Phone, ShoppingBag, TrendingUp, DollarSign, Calendar } from"lucide-react";
import { formatCurrency, formatDate } from"@/lib/utils";
import { differenceInDays, parseISO, format, startOfMonth, endOfMonth, subMonths } from"date-fns";
import { es } from"date-fns/locale";
import type { Sale } from"@/types";

const typeLabels: Record<string, string> = {
  cafe:"Cafetería", individual:"Consumidor final",
  restaurant:"Restaurante", distributor:"Distribuidor", other:"Otro",
};

const weightLabels: Record<number, string> = { 250:"250g", 500:"500g", 1000:"1kg" };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters").select("id, currency").eq("user_id", user.id).single();
  if (!roaster) redirect("/onboarding");

  const { id } = await params;

  const { data: client } = await supabase
    .from("clients").select("*").eq("id", id).eq("roaster_id", roaster.id).single();
  if (!client) notFound();

  const { data: sales } = await supabase
    .from("sales")
    .select("*, roast_batches(green_coffees(name)), green_coffees(name)")
    .eq("client_id", id)
    .order("sale_date", { ascending: false });

  const allSales: Sale[] = sales ?? [];

  // Stats globales
  const totalRevenue = allSales.reduce((s, x) => s + x.final_price, 0);
  const totalProfit = allSales.reduce((s, x) => s + x.profit, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const lastSale = allSales[0];
  const daysSinceLastPurchase = lastSale
    ? differenceInDays(new Date(), parseISO(lastSale.sale_date))
    : null;
  const isInactive = daysSinceLastPurchase === null || daysSinceLastPurchase >= client.inactive_alert_days;

  // Stats por mes (últimos 6 meses)
  const monthlyStats = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), i);
    const start = format(startOfMonth(d),"yyyy-MM-dd");
    const end = format(endOfMonth(d),"yyyy-MM-dd");
    const monthSales = allSales.filter(s => s.sale_date >= start && s.sale_date <= end);
    return {
      month: format(d,"MMM yyyy", { locale: es }),
      revenue: monthSales.reduce((s, x) => s + x.final_price, 0),
      count: monthSales.length,
    };
  }).reverse();

  // Productos más comprados
  const productCount: Record<string, { name: string; count: number; revenue: number }> = {};
  allSales.forEach(s => {
    const name = s.product_type ==="roasted"
      ? `${(s as any).roast_batches?.green_coffees?.name ??"Tostado"} ${weightLabels[s.weight_grams!] ??""}`
      : `${(s as any).green_coffees?.name ??"Verde"} (verde)`;
    if (!productCount[name]) productCount[name] = { name, count: 0, revenue: 0 };
    productCount[name].count += s.quantity;
    productCount[name].revenue += s.final_price;
  });
  const topProducts = Object.values(productCount).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  return (<div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/clients" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1 className="page-title">{client.name}</h1>
            <p className="text-sm text-text-secondary">{typeLabels[client.type]}</p>
          </div>
        </div>
        <Link href={`/clients/${id}/edit`} className="btn-secondary"><Edit className="w-4 h-4" /> Editar</Link>
      </div>

      {/* Alerta inactividad */}
      {isInactive && (<div className="mb-5 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-status-warning shrink-0" />
          <p className="text-sm text-status-warning font-medium">
            {daysSinceLastPurchase === null
              ?"Este cliente nunca registró una compra"
              : `Hace ${daysSinceLastPurchase} días sin comprar — umbral configurado: ${client.inactive_alert_days} días`}
          </p>
        </div>)}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info + stats rápidas */}
        <div className="flex flex-col gap-4">
          {/* Datos de contacto */}
          <div className="card p-5">
            <p className="section-title">Contacto</p>
            <div className="flex flex-col gap-2.5">
              {client.email && (<div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-text-secondary shrink-0" />
                  <a href={`mailto:${client.email}`} className="text-accent-terra hover:underline">{client.email}</a>
                </div>)}
              {client.phone && (<div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-text-secondary shrink-0" />
                  <a href={`https://wa.me/${client.phone.replace(/\D/g,"")}`} target="_blank" className="text-accent-terra hover:underline">
                    {client.phone}
                  </a>
                </div>)}
              {!client.email && !client.phone && (<p className="text-sm text-text-secondary">Sin datos de contacto</p>)}
              {client.notes && (<p className="text-xs text-text-secondary mt-1 pt-2 border-t border-border-default">{client.notes}</p>)}
            </div>
          </div>

          {/* Stats globales */}
          <div className="card p-5">
            <p className="section-title">Resumen total</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: ShoppingBag, label:"Compras", value: `${allSales.length}` },
                { icon: DollarSign, label:"Ingresos", value: formatCurrency(totalRevenue, roaster.currency) },
                { icon: TrendingUp, label:"Ganancia", value: formatCurrency(totalProfit, roaster.currency) },
                { icon: Calendar, label:"Última compra", value: lastSale ? formatDate(lastSale.sale_date) :"—" },
              ].map(({ icon: Icon, label, value }) => (<div key={label} className="flex flex-col gap-1">
                  <p className="text-xs text-text-secondary flex items-center gap-1">
                    <Icon className="w-3 h-3" /> {label}
                  </p>
                  <p className="text-sm font-semibold font-mono text-text-primary">{value}</p>
                </div>))}
            </div>
            {avgMargin > 0 && (<div className="mt-3 pt-3 border-t border-border-default flex justify-between text-sm">
                <span className="text-text-secondary">Margen promedio</span>
                <span className="font-mono font-semibold text-status-success">{avgMargin.toFixed(1)}%</span>
              </div>)}
          </div>

          {/* Top productos */}
          {topProducts.length > 0 && (<div className="card p-5">
              <p className="section-title">Productos favoritos</p>
              <div className="flex flex-col gap-2">
                {topProducts.map((p) => (<div key={p.name} className="flex justify-between items-center text-sm">
                    <span className="text-text-primary truncate max-w-[160px]" title={p.name}>{p.name}</span>
                    <span className="font-mono text-xs text-text-secondary shrink-0 ml-2">
                      {p.count}× · {formatCurrency(p.revenue, roaster.currency)}
                    </span>
                  </div>))}
              </div>
            </div>)}
        </div>

        {/* Historial + stats mensuales */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Stats mensuales */}
          <div className="card p-5">
            <p className="section-title">Compras por mes (últimos 6 meses)</p>
            <div className="grid grid-cols-6 gap-2">
              {monthlyStats.map((m) => (<div key={m.month} className="flex flex-col items-center gap-1">
                  <div className="w-full bg-border-default rounded-full overflow-hidden" style={{ height: 48 }}>
                    <div
                      className="bg-accent-terra rounded-full w-full transition-all"
                      style={{
                        height: `${Math.max(4, (m.revenue / Math.max(...monthlyStats.map(x => x.revenue), 1)) * 100)}%`,
                        marginTop: `${100 - Math.max(4, (m.revenue / Math.max(...monthlyStats.map(x => x.revenue), 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-text-secondary text-center capitalize">{m.month.split("")[0]}</p>
                  {m.revenue > 0 && (<p className="text-xs font-mono font-medium text-text-primary">
                      {formatCurrency(m.revenue, roaster.currency)}
                    </p>)}
                </div>))}
            </div>
          </div>

          {/* Historial de compras */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
              <h2 className="text-sm font-semibold text-text-primary">Historial de compras</h2>
              <Link href={`/sales/new`} className="btn-primary text-xs py-1.5">
                + Registrar venta
              </Link>
            </div>

            {allSales.length === 0 ? (<div className="py-10 text-center">
                <p className="text-sm text-text-secondary">Este cliente no tiene compras registradas</p>
              </div>) : (<div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-[#FDFAF6]">
                      <th className="text-left px-5 py-3 text-xs font-medium text-text-secondary">Fecha</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-text-secondary">Producto</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-text-secondary">Cant.</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-text-secondary">Total</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-text-secondary hidden sm:table-cell">Ganancia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSales.map((s: Sale) => {
                      const name = s.product_type ==="roasted"
                        ? `${(s as any).roast_batches?.green_coffees?.name ??"Tostado"} ${weightLabels[s.weight_grams!] ??""}`
                        : `${(s as any).green_coffees?.name ??"Verde"} (verde)`;
                      return (<tr key={s.id} className="border-b border-border-default last:border-0 hover:bg-[#F5EFE6]/50">
                          <td className="px-5 py-3 text-text-secondary">{formatDate(s.sale_date)}</td>
                          <td className="px-5 py-3 font-medium text-text-primary">{name}</td>
                          <td className="px-5 py-3 text-right font-mono">{s.quantity}</td>
                          <td className="px-5 py-3 text-right font-mono font-medium">
                            {formatCurrency(s.final_price, roaster.currency)}
                            {s.discount_pct > 0 && (<span className="ml-1 text-xs text-status-warning">(-{s.discount_pct.toFixed(0)}%)</span>)}
                          </td>
                          <td className="px-5 py-3 text-right font-mono hidden sm:table-cell">
                            <span className={s.profit >= 0 ?"text-status-success" :"text-status-danger"}>
                              {formatCurrency(s.profit, roaster.currency)}
                            </span>
                          </td>
                        </tr>);
                    })}
                  </tbody>
                </table>
              </div>)}
          </div>
        </div>
      </div>
    </div>);
}
