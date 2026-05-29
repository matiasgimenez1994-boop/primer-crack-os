"use client";

import { useState } from"react";
import { createClient } from"@/lib/supabase/client";
import { calculateMargin } from"@/lib/costs";
import { formatCurrency, formatPct } from"@/lib/utils";
import { toast } from"sonner";
import { Check } from"lucide-react";

interface Props {
  batchId: string;
  costPerKg: number;
  roastedWeightKg: number;
  currency: string;
  defaultWeights: number[];
  savedPrices: Record<number, number>;
}

const weightLabels: Record<number, string> = {
  250:"250 g",
  500:"500 g",
  1000:"1 kg",
};

export function PricingTable({
  batchId,
  costPerKg,
  roastedWeightKg,
  currency,
  defaultWeights,
  savedPrices,
}: Props) {
  const supabase = createClient();
  const [prices, setPrices] = useState<Record<number, string>>(Object.fromEntries(defaultWeights.map((w) => [w, savedPrices[w]?.toString() ??""])));
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<number[]>(defaultWeights.filter((w) => savedPrices[w] !== undefined) as number[]);

  async function savePrice(weight: number) {
    const price = parseFloat(prices[weight]);
    if (isNaN(price) || price <= 0) {
      toast.error("Ingresá un precio válido");
      return;
    }

    setSaving(weight);
    const { error } = await supabase.from("selling_prices").upsert({ roast_batch_id: batchId, weight_grams: weight, price },
      { onConflict:"roast_batch_id,weight_grams" });
    setSaving(null);

    if (error) {
      toast.error("Error al guardar");
      return;
    }

    setSaved((prev) => Array.from(new Set([...prev, weight])));
    toast.success(`Precio ${weightLabels[weight]} guardado`);
  }

  // Calcular totales del lote si todos los precios están ingresados
  const allPrices = defaultWeights.map((w) => parseFloat(prices[w] ||"0")).filter(Boolean);
  const avgPrice = allPrices.length > 0 ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : 0;
  const estRevenue = avgPrice > 0 ? roastedWeightKg * (1000 / 500) * avgPrice : null;

  return (<div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left pb-3 text-xs font-semibold text-text-secondary">
                Presentación
              </th>
              <th className="text-right pb-3 text-xs font-semibold text-text-secondary">
                Costo
              </th>
              <th className="text-right pb-3 text-xs font-semibold text-text-secondary">
                Precio de venta
              </th>
              <th className="text-right pb-3 text-xs font-semibold text-text-secondary">
                Ganancia
              </th>
              <th className="text-right pb-3 text-xs font-semibold text-text-secondary">
                Margen
              </th>
              <th className="pb-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {defaultWeights.map((weight) => {
              const price = parseFloat(prices[weight] ||"0");
              const margin =
                price > 0
                  ? calculateMargin(price, weight, costPerKg)
                  : null;

              return (<tr
                  key={weight}
                  className="border-b border-border-default last:border-0"
                >
                  <td className="py-3.5 font-medium text-text-primary">
                    {weightLabels[weight]}
                  </td>
                  <td className="py-3.5 text-right font-mono text-text-secondary">
                    {formatCurrency(costPerKg * (weight / 1000),
                      currency)}
                  </td>
                  <td className="py-3.5 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={prices[weight]}
                      onChange={(e) =>
                        setPrices((prev) => ({
                          ...prev,
                          [weight]: e.target.value,
                        }))
                      }
                      onBlur={() => {
                        if (prices[weight] && parseFloat(prices[weight]) > 0) {
                          savePrice(weight);
                        }
                      }}
                      className="w-24 px-2 py-1.5 text-right font-mono text-sm bg-white border border-border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-terra/30 focus:border-accent-terra transition-colors"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="py-3.5 text-right font-mono">
                    {margin ? (<span
                        className={
                          margin.profit > 0
                            ?"text-status-success"
                            :"text-status-danger"
                        }
                      >
                        {formatCurrency(margin.profit, currency)}
                      </span>) : (<span className="text-text-secondary">—</span>)}
                  </td>
                  <td className="py-3.5 text-right font-mono">
                    {margin ? (<span
                        className={`font-semibold ${
                          margin.marginPct >= 40
                            ?"text-status-success"
                            : margin.marginPct >= 20
                            ?"text-status-warning"
                            :"text-status-danger"
                        }`}
                      >
                        {formatPct(margin.marginPct)}
                      </span>) : (<span className="text-text-secondary">—</span>)}
                  </td>
                  <td className="py-3.5 pl-3">
                    {saved.includes(weight) && (<span className="text-status-success">
                        <Check className="w-4 h-4" />
                      </span>)}
                  </td>
                </tr>);
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-4 border-t border-border-default bg-[#F5EFE6] rounded-lg p-4">
        <p className="text-xs text-text-secondary mb-2">
          Resumen del lote · {roastedWeightKg.toFixed(3)} kg tostados
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-text-secondary">Costo total lote</p>
            <p className="font-mono font-semibold text-text-primary">
              {formatCurrency(costPerKg * roastedWeightKg, currency)}
            </p>
          </div>
          {defaultWeights.map((weight) => {
            const price = parseFloat(prices[weight] ||"0");
            const margin = price > 0 ? calculateMargin(price, weight, costPerKg) : null;
            const unitsApprox = Math.floor(roastedWeightKg / (weight / 1000));
            if (!margin || unitsApprox === 0) return null;
            return (<div key={weight}>
                <p className="text-xs text-text-secondary">
                  {unitsApprox} bolsas {weightLabels[weight]}
                </p>
                <p className="font-mono font-semibold text-text-primary">
                  {formatCurrency(price * unitsApprox, currency)}{""}
                  <span className="text-xs text-status-success font-normal">
                    ({formatPct(margin.marginPct)} margen)
                  </span>
                </p>
              </div>);
          })}
        </div>
      </div>

      <p className="text-xs text-text-secondary mt-3">
        Los precios se guardan automáticamente al salir de cada campo.
      </p>
    </div>);
}
