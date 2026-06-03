"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { FirstCrackIcon } from "@/components/ui/FirstCrackIcon";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const schema = z
  .object({
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "Mínimo 6 caracteres"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const [showPwd, setShowPwd] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    const emailRedirectTo = `${window.location.origin}/auth/confirm?next=/onboarding`;
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { emailRedirectTo },
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    if (!signUpData.session) {
      setPendingEmail(data.email);
      toast.success("Cuenta creada. Confirmá tu email para continuar.");
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  if (pendingEmail) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-brand-dark flex items-center justify-center mx-auto mb-4">
              <FirstCrackIcon className="w-7 h-7 text-accent-green" />
            </div>
            <h1 className="text-2xl font-semibold text-text-primary">Confirmá tu email</h1>
            <p className="text-sm text-text-secondary mt-1">Tu cuenta ya está casi lista</p>
          </div>

          <div className="card p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <MailCheck className="w-6 h-6 text-status-success" />
            </div>
            <p className="text-sm text-text-primary">
              Te enviamos un enlace a <span className="font-medium">{pendingEmail}</span>.
            </p>
            <p className="text-sm text-text-secondary mt-2">
              Abrilo para activar tu cuenta y seguir con la configuración de tu tostadería.
            </p>
            <Link href="/login" className="btn-secondary w-full mt-5">
              Ir al ingreso
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-brand-dark flex items-center justify-center mx-auto mb-4">
            <FirstCrackIcon className="w-7 h-7 text-accent-green" />
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">Crear cuenta</h1>
          <p className="text-sm text-text-secondary mt-1">Empezá a gestionar tu tostadería</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="card p-6 flex flex-col gap-4">
          <div>
            <label className="label-base">Email</label>
            <input type="email" className="input-base" placeholder="tu@email.com" {...register("email")} />
            {errors.email && <p className="text-xs text-status-danger mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label-base">Contraseña</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                className="input-base pr-10"
                placeholder="Mínimo 6 caracteres"
                {...register("password")}
              />
              <button
                type="button"
                aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-status-danger mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="label-base">Confirmar contraseña</label>
            <input
              type={showPwd ? "text" : "password"}
              className="input-base"
              placeholder="Repetí tu contraseña"
              {...register("confirm")}
            />
            {errors.confirm && <p className="text-xs text-status-danger mt-1">{errors.confirm.message}</p>}
          </div>

          <button type="submit" className="btn-primary w-full mt-1" disabled={isSubmitting}>
            {isSubmitting ? "Creando cuenta..." : "Crear cuenta gratis"}
          </button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-5">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="text-accent-green font-medium hover:underline">
            Ingresá
          </Link>
        </p>
      </div>
    </div>
  );
}
