-- ============================================================
-- Primer crack OS - IVA por renglon en cotizaciones
--
-- Alcance:
-- - quotation_items.tax_enabled
-- - quotation_items.tax_rate
-- - quotation_items.tax_amount
-- - quotation_items.line_total
--
-- No borra datos existentes.
-- ============================================================

alter table if exists public.quotation_items add column if not exists tax_enabled boolean not null default true;
alter table if exists public.quotation_items add column if not exists tax_rate numeric not null default 0 check (tax_rate >= 0);
alter table if exists public.quotation_items add column if not exists tax_amount numeric not null default 0 check (tax_amount >= 0);
alter table if exists public.quotation_items add column if not exists line_total numeric not null default 0 check (line_total >= 0);

do $$
begin
  if to_regclass('public.quotation_items') is not null then
    update public.quotation_items
    set line_total = line_subtotal + coalesce(tax_amount, 0)
    where line_total = 0
      and line_subtotal > 0;
  end if;
end $$;
