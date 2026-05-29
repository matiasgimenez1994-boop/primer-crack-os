"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronRight, Check } from "lucide-react";
import { FirstCrackIcon } from "@/components/ui/FirstCrackIcon";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const schema = z.object({
  business_name: z.string().min(2, "Ingresá el nombre de tu tostadería"),
  country: z.string().min(1),
  currency: z.string().min(1),
  default_energy_cost_per_kg: z.coerce.number().min(0),
  default_packaging_cost_per_kg: z.coerce.number().min(0),
  low_stock_threshold: z.coerce.number().min(0),
});

type FormData = z.infer<typeof schema>;

const steps = ["Tu tostadería", "Costos default", "¡Listo!"];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      country: "Uruguay",
      currency: "USD",
      default_energy_cost_per_kg: 0.5,
      default_packaging_cost_per_kg: 0.3,
      low_stock_threshold: 2,
    },
  });

  async function onSubmit(data: FormData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("roasters").upsert(
      { user_id: user.id, ...data },
      { onConflict: "user_id" }
    );

    if (error) {
      toast.error("Error al guardar. Intentá de nuevo.");
      return;
    }

    setStep(2);
    setTimeout(() => router.push("/dashboard"), 1500);
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-brand-dark flex items-center justify-center mx-auto mb-4">
            <FirstCrackIcon className="w-7 h-7 text-accent-green" />
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Configurá tu tostadería
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Solo necesitamos unos datos para empezar
          </p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  i < step
                    ? "bg-accent-olive text-white"
                    : i === step
                    ? "bg-brand-dark text-white"
                    : "bg-border-default text-text-secondary"
                }`}
              >
                {i < step ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`w-8 h-0.5 ${
                    i < step ? "bg-accent-olive" : "bg-border-default"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {step === 2 ? (
          <div className="card p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-status-success" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              ¡Todo listo!
            </h2>
            <p className="text-sm text-text-secondary">
              Redirigiendo a tu dashboard...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="card p-6">
            {step === 0 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-base font-semibold text-text-primary">
                  Tu tostadería
                </h2>

                <div>
                  <label className="label-base">
                    Nombre de la tostadería *
                  </label>
                  <input
                    type="text"
                    className="input-base"
                    placeholder="Ej: Café Brachi"
                    {...register("business_name")}
                  />
                  {errors.business_name && (
                    <p className="text-xs text-status-danger mt-1">
                      {errors.business_name.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-base">País</label>
                    <select className="input-base" {...register("country")}>
                      <option>Uruguay</option>
                      <option>Argentina</option>
                      <option>Chile</option>
                      <option>Colombia</option>
                      <option>Brasil</option>
                      <option>Perú</option>
                      <option>México</option>
                      <option>Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-base">Moneda</label>
                    <select className="input-base" {...register("currency")}>
                      <option value="USD">USD ($)</option>
                      <option value="UYU">UYU ($U)</option>
                      <option value="ARS">ARS ($)</option>
                      <option value="CLP">CLP ($)</option>
                      <option value="COP">COP ($)</option>
                      <option value="BRL">BRL (R$)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-primary w-full mt-2"
                >
                  Continuar <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">
                    Costos por defecto
                  </h2>
                  <p className="text-xs text-text-secondary mt-1">
                    Podés cambiarlos en cualquier tueste individual
                  </p>
                </div>

                <div>
                  <label className="label-base">
                    Costo de energía por kg tostado
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      className="input-base pr-12"
                      {...register("default_energy_cost_per_kg")}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary">
                      /kg
                    </span>
                  </div>
                </div>

                <div>
                  <label className="label-base">
                    Costo de empaque por kg
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      className="input-base pr-12"
                      {...register("default_packaging_cost_per_kg")}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary">
                      /kg
                    </span>
                  </div>
                </div>

                <div>
                  <label className="label-base">
                    Alerta de stock bajo (kg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    className="input-base"
                    {...register("low_stock_threshold")}
                  />
                  <p className="text-xs text-text-secondary mt-1">
                    Te avisamos cuando un café tenga menos de este stock
                  </p>
                </div>

                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="btn-secondary flex-1"
                  >
                    Atrás
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Guardando..." : "Empezar â†’"}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

