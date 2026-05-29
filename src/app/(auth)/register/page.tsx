"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { FirstCrackIcon } from "@/components/ui/FirstCrackIcon";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: "Las contraseñas no coinciden",
  path: ["confirm"],
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const [showPwd, setShowPwd] = useState(false);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-brand-dark flex items-center justify-center mx-auto mb-4">
            <FirstCrackIcon className="w-7 h-7 text-accent-green" />

          </div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Crear cuenta
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Empezá a gestionar tu tostadería
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="card p-6 flex flex-col gap-4"
        >
          <div>
            <label className="label-base">Email</label>
            <input
              type="email"
              className="input-base"
              placeholder="tu@email.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-status-danger mt-1">
                {errors.email.message}
              </p>
            )}
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
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-status-danger mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label className="label-base">Confirmar contraseña</label>
            <input
              type={showPwd ? "text" : "password"}
              className="input-base"
              placeholder="Repetí tu contraseña"
              {...register("confirm")}
            />
            {errors.confirm && (
              <p className="text-xs text-status-danger mt-1">
                {errors.confirm.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary w-full mt-1"
            disabled={isSubmitting}
          >
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
