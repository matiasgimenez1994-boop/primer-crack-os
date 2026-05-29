-- ============================================================
-- Brachi OS · Supabase Schema
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Extensiones
create extension if not exists "uuid-ossp";

-- ============================================================
-- ROASTERS (perfil de tostadería)
-- ============================================================
create table public.roasters (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  business_name text not null,
  country text default 'Uruguay',
  currency text default 'USD',
  low_stock_threshold numeric default 2.0,
  default_energy_cost_per_kg numeric default 0.50,
  default_packaging_cost_per_kg numeric default 0.30,
  default_labor_cost_per_kg numeric default 0.00,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- GREEN COFFEES (inventario café verde)
-- ============================================================
create table public.green_coffees (
  id uuid primary key default uuid_generate_v4(),
  roaster_id uuid references public.roasters(id) on delete cascade not null,
  name text not null,
  origin_country text,
  farm_producer text,
  variety text,
  process text,
  score numeric check (score >= 0 and score <= 100),
  purchase_price_per_kg numeric not null check (purchase_price_per_kg > 0),
  initial_stock_kg numeric not null check (initial_stock_kg >= 0),
  current_stock_kg numeric not null check (current_stock_kg >= 0),
  purchase_date date,
  supplier text,
  tasting_notes text,
  status text default 'active' check (status in ('active', 'depleted', 'reserved')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ROAST BATCHES (tuestes)
-- ============================================================
create table public.roast_batches (
  id uuid primary key default uuid_generate_v4(),
  roaster_id uuid references public.roasters(id) on delete cascade not null,
  green_coffee_id uuid references public.green_coffees(id) on delete restrict not null,
  roast_date date not null,
  green_weight_kg numeric not null check (green_weight_kg > 0),
  roasted_weight_kg numeric not null check (roasted_weight_kg > 0),
  -- merma calculada como columna generada
  shrinkage_pct numeric generated always as (
    round(((green_weight_kg - roasted_weight_kg) / green_weight_kg * 100)::numeric, 2)
  ) stored,
  roast_duration_min numeric,
  charge_temp_celsius numeric,
  first_crack_time_min numeric,
  development_time_min numeric,
  -- desarrollo % calculado
  development_pct numeric generated always as (
    case
      when roast_duration_min > 0 and development_time_min is not null
      then round((development_time_min / roast_duration_min * 100)::numeric, 1)
      else null
    end
  ) stored,
  roast_level text check (roast_level in ('light', 'medium', 'medium_dark', 'dark')),
  sensory_result text,
  roaster_notes text,
  status text default 'production' check (status in ('trial', 'production', 'discarded')),
  -- costos guardados al momento del tueste
  packaging_cost_per_kg numeric default 0.30,
  energy_cost_per_kg numeric default 0.50,
  labor_cost_per_kg numeric default 0.00,
  -- costo total por kg tostado (calculado y guardado)
  total_cost_per_kg_roasted numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- SELLING PRICES (precios de venta por presentación)
-- ============================================================
create table public.selling_prices (
  id uuid primary key default uuid_generate_v4(),
  roast_batch_id uuid references public.roast_batches(id) on delete cascade not null,
  weight_grams integer not null check (weight_grams > 0),
  price numeric not null check (price > 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(roast_batch_id, weight_grams)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.roasters enable row level security;
alter table public.green_coffees enable row level security;
alter table public.roast_batches enable row level security;
alter table public.selling_prices enable row level security;

-- Roasters: solo el dueño
create policy "roasters_own" on public.roasters
  for all using (auth.uid() = user_id);

-- Green coffees: solo tuestes de la propia tostadería
create policy "green_coffees_own" on public.green_coffees
  for all using (
    roaster_id in (select id from public.roasters where user_id = auth.uid())
  );

-- Roast batches: idem
create policy "roast_batches_own" on public.roast_batches
  for all using (
    roaster_id in (select id from public.roasters where user_id = auth.uid())
  );

-- Selling prices: via roast_batch ownership
create policy "selling_prices_own" on public.selling_prices
  for all using (
    roast_batch_id in (
      select rb.id from public.roast_batches rb
      join public.roasters r on r.id = rb.roaster_id
      where r.user_id = auth.uid()
    )
  );

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger roasters_updated_at before update on public.roasters
  for each row execute function public.handle_updated_at();

create trigger green_coffees_updated_at before update on public.green_coffees
  for each row execute function public.handle_updated_at();

create trigger roast_batches_updated_at before update on public.roast_batches
  for each row execute function public.handle_updated_at();

create trigger selling_prices_updated_at before update on public.selling_prices
  for each row execute function public.handle_updated_at();

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
create index green_coffees_roaster_id on public.green_coffees(roaster_id);
create index green_coffees_status on public.green_coffees(status);
create index roast_batches_roaster_id on public.roast_batches(roaster_id);
create index roast_batches_green_coffee_id on public.roast_batches(green_coffee_id);
create index roast_batches_roast_date on public.roast_batches(roast_date desc);
create index selling_prices_batch_id on public.selling_prices(roast_batch_id);
