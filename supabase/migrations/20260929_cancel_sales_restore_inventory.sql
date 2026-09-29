-- Cancel and restore stock in one transaction, serialized with confirmation.
alter table public.orders add column if not exists cancelled_at timestamptz;

create or replace function public.restore_order_inventory_internal(p_order_id uuid, p_cancel boolean)
returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_movement public.inventory_movements%rowtype;
  v_count integer := 0;
begin
  select o.* into v_order
  from public.orders o join public.roasters r on r.id = o.roaster_id
  where o.id = p_order_id and r.user_id = auth.uid()
  for update of o;
  if not found then
    raise exception 'Venta no encontrada o sin permiso';
  end if;
  if v_order.cancelled_at is not null then
    if p_cancel then return v_order; end if;
    raise exception 'Una venta anulada no se puede editar';
  end if;
  if not p_cancel and v_order.status = 'cancelled' then
    raise exception 'Una venta anulada no se puede editar';
  end if;

  if v_order.inventory_committed_at is not null then
    -- Lock original debits; compensation records are never restored again.
    for v_movement in
      select * from public.inventory_movements
      where order_id = p_order_id and movement_type = 'sale_commit'
      order by product_type, green_coffee_id, roast_batch_id, id
      for update
    loop
      if v_movement.roaster_id <> v_order.roaster_id
         or v_movement.quantity_kg is null or v_movement.quantity_kg >= 0 then
        raise exception 'Movimiento de inventario inválido; no se aplicaron cambios';
      end if;
      if v_movement.product_type = 'green' and v_movement.green_coffee_id is not null then
        update public.green_coffees
        set current_stock_kg = current_stock_kg - v_movement.quantity_kg,
            status = case when status = 'depleted' then 'active' else status end
        where id = v_movement.green_coffee_id and roaster_id = v_order.roaster_id;
      elsif v_movement.product_type = 'roasted' and v_movement.roast_batch_id is not null then
        update public.roast_batches
        set current_stock_kg = current_stock_kg - v_movement.quantity_kg
        where id = v_movement.roast_batch_id and roaster_id = v_order.roaster_id;
      else
        raise exception 'Producto de inventario inválido; no se aplicaron cambios';
      end if;
      if not found then
        raise exception 'No se encontró el producto para devolver el stock; no se aplicaron cambios';
      end if;
      v_count := v_count + 1;
      if p_cancel then
        insert into public.inventory_movements
          (roaster_id, order_id, order_item_id, green_coffee_id, roast_batch_id,
           product_type, movement_type, quantity_kg, notes)
        values
          (v_order.roaster_id, p_order_id, v_movement.order_item_id,
           v_movement.green_coffee_id, v_movement.roast_batch_id,
           v_movement.product_type, 'manual_adjustment', -v_movement.quantity_kg,
           'Stock devuelto por anulación de venta. Movimiento original: ' || v_movement.id);
      end if;
    end loop;
    if v_count = 0 and exists (
      select 1 from public.order_items where order_id = p_order_id and product_type in ('green', 'roasted')
    ) then
      raise exception 'Faltan los movimientos originales de inventario; no se aplicaron cambios';
    end if;
  end if;

  if p_cancel then
    -- Keep both the original commitment and its compensation for audit.
    update public.orders set status = 'cancelled', cancelled_at = now()
    where id = p_order_id returning * into v_order;
  else
    -- Existing edit flow replaces order items, then commits the new quantities.
    delete from public.inventory_movements
    where order_id = p_order_id and movement_type = 'sale_commit';
    update public.orders set inventory_committed_at = null, confirmed_at = null
    where id = p_order_id returning * into v_order;
  end if;
  return v_order;
end;
$$;
revoke all on function public.restore_order_inventory_internal(uuid, boolean) from public, anon, authenticated;

create or replace function public.cancel_order_and_restore_inventory(p_order_id uuid)
returns public.orders language sql security definer set search_path = public
as $$ select public.restore_order_inventory_internal(p_order_id, true); $$;
revoke all on function public.cancel_order_and_restore_inventory(uuid) from public, anon;
grant execute on function public.cancel_order_and_restore_inventory(uuid) to authenticated;

create or replace function public.release_order_inventory_for_edit(p_order_id uuid)
returns public.orders language sql security definer set search_path = public
as $$ select public.restore_order_inventory_internal(p_order_id, false); $$;
revoke all on function public.release_order_inventory_for_edit(uuid) from public, anon;
grant execute on function public.release_order_inventory_for_edit(uuid) to authenticated;

-- An old browser tab cannot reactivate or rewrite an already cancelled sale.
create or replace function public.protect_cancelled_order()
returns trigger language plpgsql set search_path = public
as $$
begin
  if old.cancelled_at is not null then
    raise exception 'Una venta anulada no se puede modificar ni eliminar';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create or replace trigger protect_cancelled_order
before update or delete on public.orders
for each row execute function public.protect_cancelled_order();

create or replace function public.protect_cancelled_order_items()
returns trigger language plpgsql set search_path = public
as $$
declare v_order_id uuid;
begin
  -- Lock the parent to serialize edits with cancellation and confirmation.
  for v_order_id in
    select id from public.orders
    where id in (case when tg_op <> 'INSERT' then old.order_id end,
                 case when tg_op <> 'DELETE' then new.order_id end)
    order by id for update
  loop
    if exists (select 1 from public.orders where id = v_order_id and (cancelled_at is not null or status = 'cancelled')) then
      raise exception 'Los productos de una venta anulada no se pueden modificar';
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create or replace trigger protect_cancelled_order_items
before insert or update or delete on public.order_items
for each row execute function public.protect_cancelled_order_items();

notify pgrst, 'reload schema';
