# Brachi OS — Setup

## 1. Requisitos previos

- Node.js 18+ → https://nodejs.org
- Una cuenta en Supabase → https://supabase.com (gratis)
- Una cuenta en Vercel → https://vercel.com (gratis para deploy)

---

## 2. Instalar dependencias

```bash
cd brachi-os
npm install
```

---

## 3. Configurar Supabase

1. Crear proyecto en https://supabase.com
2. Ir a **SQL Editor** y ejecutar todo el contenido de `supabase/schema.sql`
3. En **Project Settings → API** copiar:
   - `Project URL`
   - `anon public key`

---

## 4. Variables de entorno

Copiar `.env.local.example` como `.env.local` y completar:

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

---

## 5. Correr en desarrollo

```bash
npm run dev
```

Abrir http://localhost:3000

---

## 6. Deploy en Vercel

```bash
npm install -g vercel
vercel
```

Agregar las mismas variables de entorno en el panel de Vercel.

---

## Flujo básico

1. Registrarse → `/register`
2. Completar onboarding (nombre tostadería, costos default)
3. Agregar primer café verde → `/inventory/new`
4. Registrar tueste → `/roasts/new`
5. Ver costos y rentabilidad → `/roasts/[id]`
