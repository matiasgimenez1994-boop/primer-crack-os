"use client";

import { useState } from"react";
import { FileText, Download, TrendingUp, Flame, Package, DollarSign } from"lucide-react";
import { formatCurrency, formatWeight, formatPct, formatDate } from"@/lib/utils";
import { generateCSV, downloadCSV, generatePDF } from"@/lib/export";
import { toast } from"sonner";

interface ReportData {
  roasterName: string;
  currency: string;
  monthlyRoasting: { month: string; kg: number; lotes: number }[];
  topRoasted: { name: string; kg: number; lotes: number }[];
  topMargin: { name: string; margin: number; totalRevenue: number; totalCost: number; batches: number }[];
  stockValued: { name: string; origin: string; kg: number; price: number; value: number; status: string }[];
  totalStockValue: number;
  roastHistory: { id: string; cafe: string; fecha: string; verde: number; tostado: number; merma: number; costo: number; estado: string }[];
  allSales: { fecha: string; cliente: string; producto: string; tipo: string; cantidad: number; precio: number; descuento: number; total: number; ganancia: number; pago: string; estado: string }[];
}

export function ReportsClient({ data }: { data: ReportData }) {
  const [activeTab, setActiveTab] = useState<"production" |"margins" |"stock" |"sales">("production");

  const tabs = [
    { key:"production", label:"Producción", icon: Flame },
    { key:"margins", label:"Rentabilidad", icon: TrendingUp },
    { key:"stock", label:"Stock valorizado", icon: Package },
    { key:"sales", label:"Historial ventas", icon: DollarSign },
  ] as const;

  const maxKg = Math.max(...data.monthlyRoasting.map(m => m.kg), 1);
  const maxMargin = 100;

  async function handleExportPDF() {
    toast.loading("Generando PDF...");
    try {
      const doc = await generatePDF({
        title:"Reporte de Producción",
        businessName: data.roasterName,
        tables: [
          {
            title:"Kg tostados por mes",
            headers: ["Mes","Kg tostados","Lotes"],
            rows: data.monthlyRoasting.map(m => [m.month, m.kg.toFixed(2), m.lotes]),
          },
          {
            title:"Cafés más tostados",
            headers: ["Café","Kg totales","Lotes"],
            rows: data.topRoasted.map(c => [c.name, c.kg.toFixed(2), c.lotes]),
          },
          {
            title:"Ranking por margen",
            headers: ["Café","Margen","Ingresos","Costo"],
            rows: data.topMargin.map(c => [
              c.name,
              `${c.margin.toFixed(1)}%`,
              `${c.totalRevenue.toFixed(2)}`,
              `${c.totalCost.toFixed(2)}`,
            ]),
          },
          {
            title:"Stock valorizado",
            headers: ["Café","Origen","Stock (kg)","Precio/kg","Valor"],
            rows: data.stockValued.map(c => [
              c.name, c.origin, c.kg.toFixed(3),
              c.price.toFixed(2), c.value.toFixed(2),
            ]),
          },
        ],
      });
      doc.save(`brachi-os-reporte-${new Date().toISOString().split("T")[0]}.pdf`);
      toast.dismiss();
      toast.success("PDF descargado");
    } catch {
      toast.dismiss();
      toast.error("Error al generar PDF");
    }
  }

  function handleExportCSVTuestes() {
    const csv = generateCSV(["Café","Fecha","Verde (kg)","Tostado (kg)","Merma (%)","Costo/kg","Estado"],
      data.roastHistory.map(r => [r.cafe, r.fecha, r.verde, r.tostado, r.merma, r.costo, r.estado]));
    downloadCSV(`tuestes-${new Date().toISOString().split("T")[0]}.csv`, csv);
    toast.success("CSV de tuestes descargado");
  }

  function handleExportCSVVentas() {
    const csv = generateCSV(["Fecha","Cliente","Producto","Tipo","Cantidad","Precio","Descuento%","Total","Ganancia","Pago","Estado"],
      data.allSales.map(s => [s.fecha, s.cliente, s.producto, s.tipo, s.cantidad, s.precio, s.descuento, s.total, s.ganancia, s.pago, s.estado]));
    downloadCSV(`ventas-${new Date().toISOString().split("T")[0]}.csv`, csv);
    toast.success("CSV de ventas descargado");
  }

  function handleExportCSVStock() {
    const csv = generateCSV(["Café","Origen","Stock (kg)","Precio/kg","Valor total","Estado"],
      data.stockValued.map(c => [c.name, c.origin, c.kg, c.price, c.value, c.status]));
    downloadCSV(`stock-valorizado-${new Date().toISOString().split("T")[0]}.csv`, csv);
    toast.success("CSV de stock descargado");
  }

  return (<div>
      <div className="page-header">
        <h1 className="text-xl font-semibold text-text-primary">Reportes</h1>
        <div className="flex gap-2">
          <button onClick={handleExportCSVTuestes} className="btn-secondary text-xs">
            <Download className="w-3.5 h-3.5" /> CSV Tuestes
          </button>
          <button onClick={handleExportCSVVentas} className="btn-secondary text-xs">
            <Download className="w-3.5 h-3.5" /> CSV Ventas
          </button>
          <button onClick={handleExportPDF} className="btn-primary text-xs">
            <FileText className="w-3.5 h-3.5" /> PDF Reporte
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white rounded-lg border border-border-default p-1 w-fit flex-wrap">
        {tabs.map(({ key, label, icon: Icon }) => (<button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === key ?"bg-brand-dark text-white" :"text-text-secondary hover:text-text-primary"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />{label}
          </button>))}
      </div>

      {/* TAB: Producción */}
      {activeTab ==="production" && (<div className="flex flex-col gap-6">
          {/* Gráfico kg por mes */}
          <div className="card p-5">
            <p className="text-sm font-semibold text-text-primary mb-5">Kg tostados por mes</p>
            <div className="flex items-end gap-3 h-40">
              {data.monthlyRoasting.map((m) => (<div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                  <p className="text-xs font-mono text-text-secondary">
                    {m.kg > 0 ? m.kg.toFixed(1) :""}
                  </p>
                  <div className="w-full flex items-end" style={{ height: 100 }}>
                    <div
                      className="w-full bg-accent-green rounded-t-md transition-all"
                      style={{ height: `${Math.max(m.kg > 0 ? 4 : 0, (m.kg / maxKg) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-text-secondary capitalize text-center leading-tight">
                    {m.month}
                  </p>
                  {m.lotes > 0 && (<p className="text-xs text-text-secondary">{m.lotes} lotes</p>)}
                </div>))}
            </div>
          </div>

          {/* Top cafés por kg */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-border-default">
              <p className="text-sm font-semibold text-text-primary">Cafés más tostados</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-[#FDFAF6]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">#</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Café</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Kg tostados</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Lotes</th>
                  <th className="px-5 py-3 w-40" />
                </tr>
              </thead>
              <tbody>
                {data.topRoasted.map((c, i) => {
                  const maxKgC = data.topRoasted[0]?.kg ?? 1;
                  return (<tr key={c.name} className="border-b border-border-default last:border-0">
                      <td className="px-5 py-3 text-text-secondary font-mono">{i + 1}</td>
                      <td className="px-5 py-3 font-medium text-text-primary">{c.name}</td>
                      <td className="px-5 py-3 text-right font-mono">{c.kg.toFixed(2)} kg</td>
                      <td className="px-5 py-3 text-right font-mono text-text-secondary">{c.lotes}</td>
                      <td className="px-5 py-3">
                        <div className="h-1.5 bg-border-default rounded-full">
                          <div className="h-full bg-accent-green rounded-full"
                            style={{ width: `${(c.kg / maxKgC) * 100}%` }} />
                        </div>
                      </td>
                    </tr>);
                })}
              </tbody>
            </table>
          </div>
        </div>)}

      {/* TAB: Rentabilidad */}
      {activeTab ==="margins" && (<div className="flex flex-col gap-6">
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-border-default">
              <p className="text-sm font-semibold text-text-primary">Ranking de cafés por margen</p>
              <p className="text-xs text-text-secondary mt-0.5">Basado en ventas registradas</p>
            </div>
            {data.topMargin.length === 0 ? (<p className="text-sm text-text-secondary p-6">Registrá ventas para ver el ranking de rentabilidad</p>) : (<table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-[#FDFAF6]">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">#</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Café</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Margen</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Ingresos</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Costo</th>
                    <th className="px-5 py-3 w-32" />
                  </tr>
                </thead>
                <tbody>
                  {data.topMargin.map((c, i) => (<tr key={c.name} className="border-b border-border-default last:border-0">
                      <td className="px-5 py-3 text-text-secondary font-mono">{i + 1}</td>
                      <td className="px-5 py-3 font-medium text-text-primary">{c.name}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-mono font-semibold ${
                          c.margin >= 40 ?"text-status-success" :
                          c.margin >= 20 ?"text-status-warning" :"text-status-danger"
                        }`}>
                          {c.margin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-text-secondary hidden sm:table-cell">
                        {formatCurrency(c.totalRevenue, data.currency)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-text-secondary hidden sm:table-cell">
                        {formatCurrency(c.totalCost, data.currency)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="h-1.5 bg-border-default rounded-full">
                          <div className={`h-full rounded-full ${
                            c.margin >= 40 ?"bg-status-success" :
                            c.margin >= 20 ?"bg-status-warning" :"bg-status-danger"
                          }`} style={{ width: `${Math.min(c.margin, 100)}%` }} />
                        </div>
                      </td>
                    </tr>))}
                </tbody>
              </table>)}
          </div>
        </div>)}

      {/* TAB: Stock valorizado */}
      {activeTab ==="stock" && (<div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <p className="text-xs text-text-secondary">Valor total inventario</p>
              <p className="text-2xl font-mono font-semibold text-text-primary mt-1">
                {formatCurrency(data.totalStockValue, data.currency)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-text-secondary">Cafés en stock</p>
              <p className="text-2xl font-mono font-semibold text-text-primary mt-1">
                {data.stockValued.length}
              </p>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
              <p className="text-sm font-semibold text-text-primary">Stock valorizado</p>
              <button onClick={handleExportCSVStock} className="btn-ghost text-xs">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-[#FDFAF6]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Café</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Origen</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Stock</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Precio/kg</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Valor</th>
                  <th className="px-5 py-3 w-32" />
                </tr>
              </thead>
              <tbody>
                {data.stockValued.map((c) => (<tr key={c.name} className="border-b border-border-default last:border-0">
                    <td className="px-5 py-3 font-medium text-text-primary">{c.name}</td>
                    <td className="px-5 py-3 text-text-secondary hidden sm:table-cell">{c.origin}</td>
                    <td className="px-5 py-3 text-right font-mono">{c.kg.toFixed(3)} kg</td>
                    <td className="px-5 py-3 text-right font-mono text-text-secondary">
                      {formatCurrency(c.price, data.currency)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-text-primary">
                      {formatCurrency(c.value, data.currency)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="h-1.5 bg-border-default rounded-full">
                        <div className="h-full bg-accent-green rounded-full"
                          style={{ width: `${(c.value / data.totalStockValue) * 100}%` }} />
                      </div>
                    </td>
                  </tr>))}
              </tbody>
              <tfoot className="border-t-2 border-border-default bg-[#FDFAF6]">
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-xs font-semibold text-text-secondary">Total</td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-text-primary">
                    {formatCurrency(data.totalStockValue, data.currency)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>)}

      {/* TAB: Historial ventas */}
      {activeTab ==="sales" && (<div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
            <p className="text-sm font-semibold text-text-primary">
              Historial de ventas ({data.allSales.length})
            </p>
            <button onClick={handleExportCSVVentas} className="btn-ghost text-xs">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
          {data.allSales.length === 0 ? (<p className="text-sm text-text-secondary p-6">No hay ventas registradas</p>) : (<div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-[#FDFAF6]">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Fecha</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Producto</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">Cliente</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Cant.</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Total</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Ganancia</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {data.allSales.map((s, i) => (<tr key={i} className="border-b border-border-default last:border-0 hover:bg-[#F5EFE6]/40">
                      <td className="px-5 py-3 text-text-secondary">{formatDate(s.fecha)}</td>
                      <td className="px-5 py-3 font-medium text-text-primary">{s.producto}</td>
                      <td className="px-5 py-3 text-text-secondary hidden md:table-cell">{s.cliente}</td>
                      <td className="px-5 py-3 text-right font-mono">{s.cantidad}</td>
                      <td className="px-5 py-3 text-right font-mono font-medium">
                        {formatCurrency(s.total, data.currency)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono hidden sm:table-cell">
                        <span className={s.ganancia >= 0 ?"text-status-success" :"text-status-danger"}>
                          {formatCurrency(s.ganancia, data.currency)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${
                          s.estado ==="Pagado" ?"bg-green-50 text-status-success border-green-200" :
                          s.estado ==="Parcial" ?"bg-yellow-50 text-yellow-700 border-yellow-200" :"bg-orange-50 text-status-warning border-orange-200"
                        }`}>
                          {s.pago} · {s.estado}
                        </span>
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>)}
        </div>)}
    </div>);
}

