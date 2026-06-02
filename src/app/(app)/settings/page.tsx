"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Upload, X, Eye, EyeOff } from "lucide-react";
import type { Roaster } from "@/types";

const settingsSchema = z.object({
  business_name: z.string().min(2),
  country: z.string().min(1),
  currency: z.string().min(1),
  low_stock_threshold: z.coerce.number().min(0),
  default_energy_cost_per_kg: z.coerce.number().min(0),
  default_packaging_cost_per_kg: z.coerce.number().min(0),
  default_labor_cost_per_kg: z.coerce.number().min(0),
});

const passwordSchema = z.object({
  current_password: z.string().min(6, "Ingresa tu contraseña actual"),
  new_password: z.string().min(6, "Mínimo 6 caracteres"),
  confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, {
  message: "Las contraseñas no coinciden",
  path: ["confirm_password"],
});

type SettingsData = z.infer<typeof settingsSchema>;
type PasswordData = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const supabase = createClient();
  const [roaster, setRoaster] = useState<Roaster | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } =
    useForm<SettingsData>({ resolver: zodResolver(settingsSchema) });

  const { register: regPwd, handleSubmit: handlePwd, reset: resetPwd,
    formState: { errors: pwdErrors, isSubmitting: pwdSubmitting } } =
    useForm<PasswordData>({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserEmail(user.email ?? "");
      supabase.from("roasters").select("*").eq("user_id", user.id).single()
        .then(({ data }) => {
          if (!data) return;
          setRoaster(data);
          setLogoUrl(data.logo_url ?? null);
          reset(data);
        });
    });
  }, []);

  async function onSaveSettings(data: SettingsData) {
    if (!roaster) return;
    const { error } = await supabase.from("roasters").update(data).eq("id", roaster.id);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Ajustes guardados");
    reset(data);
  }

  async function onChangePassword(data: PasswordData) {
    // Verificar contraseña actual intentando sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: data.current_password,
    });
    if (signInError) {
      toast.error("La contraseña actual es incorrecta");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: data.new_password });
    if (error) { toast.error("Error al cambiar la contraseña"); return; }
    toast.success("Contraseña actualizada correctamente");
    resetPwd();
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !roaster) return;

    // Validar tipo y tamaño
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imágenes");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen debe ser menor a 2MB");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${roaster.id}/logo.${ext}`;

    // Subir a Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      toast.error("Error al subir el logo");
      setUploading(false);
      return;
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl + `?t=${Date.now()}`; // cache bust

    // Guardar en roasters
    await supabase.from("roasters").update({ logo_url: urlData.publicUrl }).eq("id", roaster.id);
    setLogoUrl(publicUrl);
    toast.success("Logo actualizado");
    setUploading(false);
  }

  async function handleRemoveLogo() {
    if (!roaster || !confirm("¿Eliminar el logo?")) return;
    await supabase.from("roasters").update({ logo_url: null }).eq("id", roaster.id);
    setLogoUrl(null);
    toast.success("Logo eliminado");
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="text-xl font-semibold text-text-primary">Ajustes</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Logo de la tostadería */}
        <div className="card p-6 flex flex-col gap-4">
          <p className="section-title">Logo de la tostadería</p>
          <p className="text-xs text-text-secondary -mt-2">
            Se muestra en el dashboard. PNG, JPG o SVG. Máx 2MB.
          </p>

          <div className="flex items-center gap-4">
            {/* Preview */}
            <div className="w-20 h-20 rounded-xl border-2 border-border-default flex items-center justify-center overflow-hidden bg-[#F8FAFC] shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <div className="text-center">
                  <Upload className="w-6 h-6 text-text-secondary mx-auto mb-1" />
                  <p className="text-xs text-text-secondary">Sin logo</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-secondary text-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                {uploading ? "Subiendo..." : logoUrl ? "Cambiar logo" : "Subir logo"}
              </button>
              {logoUrl && (
                <button onClick={handleRemoveLogo} className="btn-ghost text-xs text-status-danger hover:bg-red-50">
                  <X className="w-3.5 h-3.5" /> Eliminar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Cambiar contraseña */}
        <div className="card p-6">
          <p className="section-title">Seguridad</p>
          <p className="text-xs text-text-secondary mb-4">
            Cuenta: <span className="font-medium text-text-primary">{userEmail}</span>
          </p>
          <form onSubmit={handlePwd(onChangePassword)} className="flex flex-col gap-3">
            <div>
              <label className="label-base">Contraseña actual</label>
              <div className="relative">
                <input type={showPwd ? "text" : "password"} className="input-base pr-10"
                  placeholder="••••••••" {...regPwd("current_password")} />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwdErrors.current_password && (
                <p className="text-xs text-status-danger mt-1">{pwdErrors.current_password.message}</p>
              )}
            </div>
            <div>
              <label className="label-base">Nueva contraseña</label>
              <input type={showPwd ? "text" : "password"} className="input-base"
                placeholder="Mínimo 6 caracteres" {...regPwd("new_password")} />
              {pwdErrors.new_password && (
                <p className="text-xs text-status-danger mt-1">{pwdErrors.new_password.message}</p>
              )}
            </div>
            <div>
              <label className="label-base">Confirmar nueva contraseña</label>
              <input type={showPwd ? "text" : "password"} className="input-base"
                placeholder="Repetí la nueva contraseña" {...regPwd("confirm_password")} />
              {pwdErrors.confirm_password && (
                <p className="text-xs text-status-danger mt-1">{pwdErrors.confirm_password.message}</p>
              )}
            </div>
            <button type="submit" className="btn-primary w-full justify-center mt-1" disabled={pwdSubmitting}>
              {pwdSubmitting ? "Cambiando..." : "Cambiar contraseña"}
            </button>
          </form>
        </div>

        {/* Tostadería */}
        <div className="card p-6 flex flex-col gap-4">
          <p className="section-title">Tu tostadería</p>
          <form onSubmit={handleSubmit(onSaveSettings)} className="flex flex-col gap-4">
            <div>
              <label className="label-base">Nombre de la tostadería</label>
              <input type="text" className="input-base" {...register("business_name")} />
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
                  <option>Peru</option>
                  <option>Mexico</option>
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
            <div>
              <label className="label-base">Alerta de stock bajo (kg)</label>
              <input type="number" step="0.5" className="input-base font-mono" {...register("low_stock_threshold")} />
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? "Guardando..." : "Guardar ajustes"}
            </button>
          </form>
        </div>

        {/* Costos default */}
        <div className="card p-6 flex flex-col gap-4">
          <p className="section-title">Costos por defecto / kg</p>
          <p className="text-xs text-text-secondary -mt-2">Se usan como valores iniciales en cada nuevo tueste</p>
          <form onSubmit={handleSubmit(onSaveSettings)} className="flex flex-col gap-4">
            <div>
              <label className="label-base">Costo de energia / kg tostado</label>
              <input type="number" step="0.01" className="input-base font-mono" {...register("default_energy_cost_per_kg")} />
            </div>
            <div>
              <label className="label-base">Costo de empaque / kg</label>
              <input type="number" step="0.01" className="input-base font-mono" {...register("default_packaging_cost_per_kg")} />
            </div>
            <div>
              <label className="label-base">Mano de obra / kg (opcional)</label>
              <input type="number" step="0.01" className="input-base font-mono" {...register("default_labor_cost_per_kg")} />
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? "Guardando..." : "Guardar costos"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
