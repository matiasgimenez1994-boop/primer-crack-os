alter table public.expenses
  add column if not exists currency text not null default 'USD'
  check (currency in ('USD', 'UYU'));

comment on column public.expenses.currency is
  'Moneda original del gasto: USD o UYU';
