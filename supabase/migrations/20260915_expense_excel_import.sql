-- Keep the period shown in financial source files without inventing a transaction day.
alter table public.expenses alter column expense_date drop not null;
alter table public.expenses add column if not exists period_label text;
alter table public.expenses add column if not exists date_precision text
  check (date_precision in ('exact', 'month', 'year'));
alter table public.expenses add column if not exists nature text;
alter table public.expenses add column if not exists source_ref text;
alter table public.expenses add column if not exists affects_profit boolean not null default true;

create unique index if not exists expenses_roaster_source_ref_unique
  on public.expenses (roaster_id, source_ref) where source_ref is not null;
