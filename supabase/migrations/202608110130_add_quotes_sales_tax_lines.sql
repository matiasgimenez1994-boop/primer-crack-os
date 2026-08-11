-- ============================================================
-- Primer crack OS - Cotizaciones, IVA/moneda y renglones de venta
-- Aplicar manualmente en Supabase SQL Editor.
--
-- Alcance:
-- - quote_price_catalog
-- - quotations
-- - quotation_items
-- - sale_items
-- - columnas opcionales en sales para moneda, IVA y origen de cotizacion
-- - RLS, policies, triggers e indices necesarios
--
-- No incluye cambios de Artisan.
-- No borra datos existentes.
-- ============================================================

create extension if not exists "uuid-ossp";

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Catalogo editable de precios sugeridos para cotizaciones
-- ============================================================

create table if not exists public.quote_price_catalog (
  id uuid primary key default uuid_generate_v4(),
  roaster_id uuid references public.roasters(id) on delete cascade not null,
  category text not null check (category in ('green_coffee', 'brand_creation', 'machines')),
  item_kind text not null check (item_kind in ('green_coffee', 'roast_service', 'machine', 'destoner', 'other')),
  green_coffee_id uuid references public.green_coffees(id) on delete set null,
  name text not null,
  description text,
  unit_label text not null default 'unidad',
  suggested_unit_price numeric not null default 0 check (suggested_unit_price >= 0),
  machine_capacity_kg numeric,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- Cotizaciones y renglones historicos
-- ============================================================

create table if not exists public.quotations (
  id uuid primary key default uuid_generate_v4(),
  roaster_id uuid references public.roasters(id) on delete cascade not null,
  quote_number text not null,
  category text not null check (category in ('green_coffee', 'brand_creation', 'machines')),
  status text not null default 'draft' check (status in ('draft', 'issued', 'accepted', 'rejected', 'invoiced')),
  client_id uuid,
  client_name text,
  client_email text,
  currency text not null default 'USD' check (currency in ('USD', 'UYU')),
  quote_date date not null default current_date,
  valid_until date,
  tax_enabled boolean not null default true,
  tax_rate numeric not null default 22 check (tax_rate >= 0),
  subtotal_amount numeric not null default 0 check (subtotal_amount >= 0),
  tax_amount numeric not null default 0 check (tax_amount >= 0),
  total_amount numeric not null default 0 check (total_amount >= 0),
  notes text,
  converted_sale_id uuid,
  issued_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.quotation_items (
  id uuid primary key default uuid_generate_v4(),
  quotation_id uuid references public.quotations(id) on delete cascade not null,
  catalog_item_id uuid references public.quote_price_catalog(id) on delete set null,
  green_coffee_id uuid references public.green_coffees(id) on delete set null,
  item_kind text not null check (item_kind in ('green_coffee', 'roast_service', 'machine', 'destoner', 'other')),
  description text not null,
  quantity numeric not null check (quantity > 0),
  unit_label text not null default 'unidad',
  unit_price numeric not null check (unit_price >= 0),
  line_subtotal numeric not null check (line_subtotal >= 0),
  tax_enabled boolean not null default true,
  tax_rate numeric not null default 0 check (tax_rate >= 0),
  tax_amount numeric not null default 0 check (tax_amount >= 0),
  line_total numeric not null default 0 check (line_total >= 0),
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

alter table if exists public.quotation_items add column if not exists tax_enabled boolean not null default true;
alter table if exists public.quotation_items add column if not exists tax_rate numeric not null default 0 check (tax_rate >= 0);
alter table if exists public.quotation_items add column if not exists tax_amount numeric not null default 0 check (tax_amount >= 0);
alter table if exists public.quotation_items add column if not exists line_total numeric not null default 0 check (line_total >= 0);

update public.quotation_items
set line_total = line_subtotal + coalesce(tax_amount, 0)
where line_total = 0
  and line_subtotal > 0;

-- ============================================================
-- Ventas: moneda, IVA, origen desde cotizacion y renglones
-- ============================================================

alter table if exists public.sales add column if not exists quotation_id uuid references public.quotations(id) on delete set null;
alter table if exists public.sales add column if not exists currency text;
alter table if exists public.sales add column if not exists subtotal_amount numeric;
alter table if exists public.sales add column if not exists tax_enabled boolean default false;
alter table if exists public.sales add column if not exists tax_rate numeric default 0;
alter table if exists public.sales add column if not exists tax_amount numeric default 0;
alter table if exists public.sales add column if not exists total_with_tax numeric;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sales'
      and column_name = 'currency'
  ) then
    update public.sales
    set currency = coalesce(currency, r.currency, 'USD')
    from public.roasters r
    where public.sales.roaster_id = r.id
      and public.sales.currency is null;
  end if;
end $$;

create table if not exists public.sale_items (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid references public.sales(id) on delete cascade not null,
  item_kind text not null default 'product' check (item_kind in ('roasted_coffee', 'green_coffee', 'roast_service', 'machine', 'destoner', 'other', 'product')),
  green_coffee_id uuid references public.green_coffees(id) on delete set null,
  description text not null,
  quantity numeric not null check (quantity > 0),
  unit_label text not null default 'unidad',
  unit_price numeric not null check (unit_price >= 0),
  line_subtotal numeric not null check (line_subtotal >= 0),
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

-- Compatibilidad con el flujo vigente de la app: ventas documentales en orders/order_items.
alter table if exists public.orders add column if not exists quotation_id uuid references public.quotations(id) on delete set null;

do $$
declare
  constraint_record record;
begin
  if to_regclass('public.order_items') is null then
    return;
  end if;

  for constraint_record in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'order_items'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%product_type%'
  loop
    execute format('alter table public.order_items drop constraint %I', constraint_record.conname);
  end loop;

  alter table public.order_items
    add constraint order_items_product_type_check
    check (product_type in ('roasted', 'green', 'service', 'product'));
end $$;

-- ============================================================
-- RLS y policies
-- ============================================================

alter table public.quote_price_catalog enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.sale_items enable row level security;

drop policy if exists "quote_price_catalog_own" on public.quote_price_catalog;
create policy "quote_price_catalog_own" on public.quote_price_catalog
  for all using (
    roaster_id in (select id from public.roasters where user_id = auth.uid())
  )
  with check (
    roaster_id in (select id from public.roasters where user_id = auth.uid())
  );

drop policy if exists "quotations_own" on public.quotations;
create policy "quotations_own" on public.quotations
  for all using (
    roaster_id in (select id from public.roasters where user_id = auth.uid())
  )
  with check (
    roaster_id in (select id from public.roasters where user_id = auth.uid())
  );

drop policy if exists "quotation_items_own" on public.quotation_items;
create policy "quotation_items_own" on public.quotation_items
  for all using (
    quotation_id in (
      select q.id
      from public.quotations q
      join public.roasters r on r.id = q.roaster_id
      where r.user_id = auth.uid()
    )
  )
  with check (
    quotation_id in (
      select q.id
      from public.quotations q
      join public.roasters r on r.id = q.roaster_id
      where r.user_id = auth.uid()
    )
  );

drop policy if exists "sale_items_own" on public.sale_items;
create policy "sale_items_own" on public.sale_items
  for all using (
    sale_id in (
      select s.id
      from public.sales s
      join public.roasters r on r.id = s.roaster_id
      where r.user_id = auth.uid()
    )
  )
  with check (
    sale_id in (
      select s.id
      from public.sales s
      join public.roasters r on r.id = s.roaster_id
      where r.user_id = auth.uid()
    )
  );

-- ============================================================
-- Triggers e indices
-- ============================================================

drop trigger if exists quote_price_catalog_updated_at on public.quote_price_catalog;
create trigger quote_price_catalog_updated_at
  before update on public.quote_price_catalog
  for each row execute function public.handle_updated_at();

drop trigger if exists quotations_updated_at on public.quotations;
create trigger quotations_updated_at
  before update on public.quotations
  for each row execute function public.handle_updated_at();

create index if not exists quote_price_catalog_roaster_id on public.quote_price_catalog(roaster_id);
create index if not exists quote_price_catalog_category on public.quote_price_catalog(category);
create index if not exists quotations_roaster_id on public.quotations(roaster_id);
create index if not exists quotations_quote_date on public.quotations(quote_date desc);
create unique index if not exists quotations_roaster_quote_number_idx on public.quotations(roaster_id, quote_number);
create index if not exists quotation_items_quotation_id on public.quotation_items(quotation_id);
create index if not exists sale_items_sale_id on public.sale_items(sale_id);
