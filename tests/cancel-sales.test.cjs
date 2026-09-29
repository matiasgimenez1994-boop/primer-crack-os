const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
let db;
const uid = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const sqlId = n => `'${uid(n)}'`;
before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table roasters(id uuid primary key, user_id uuid not null);
    create table orders(id uuid primary key, roaster_id uuid references roasters, status text default 'pending', inventory_committed_at timestamptz, confirmed_at timestamptz);
    create table order_items(id uuid primary key, order_id uuid references orders on delete cascade, product_type text);
    create table green_coffees(id uuid primary key, roaster_id uuid references roasters, current_stock_kg numeric not null check(current_stock_kg>=0), status text);
    create table roast_batches(id uuid primary key, roaster_id uuid references roasters, current_stock_kg numeric not null check(current_stock_kg>=0));
    create table inventory_movements(id uuid primary key default gen_random_uuid(), roaster_id uuid references roasters not null, order_id uuid references orders on delete cascade, order_item_id uuid references order_items on delete set null, green_coffee_id uuid references green_coffees, roast_batch_id uuid references roast_batches, product_type text check(product_type in ('green','roasted')), movement_type text check(movement_type in ('sale_commit','manual_adjustment')), quantity_kg numeric, notes text);
    insert into roasters values (${sqlId(1)},${sqlId(101)}),(${sqlId(2)},${sqlId(102)});
    select set_config('request.jwt.claim.sub',${sqlId(101)},false);
  `);
  await db.exec(fs.readFileSync('supabase/migrations/20260929_cancel_sales_restore_inventory.sql','utf8'));
});
after(async () => db?.close());
async function fixture(n, options={}) {
  await db.exec(`insert into orders(id,roaster_id,status,inventory_committed_at) values (${sqlId(n)},${sqlId(1)},'confirmed',${options.uncommitted?'null':'now()'});`);
}
async function stock(n, type, qty, tenant=1) {
  const table=type==='green'?'green_coffees':'roast_batches';
  await db.exec(`insert into ${table}(id,roaster_id,current_stock_kg${type==='green'?',status':''}) values (${sqlId(n)},${sqlId(tenant)},${qty}${type==='green'?",'depleted'":''});`);
}
async function debit(order, product, type, qty, tenant=1) {
  await db.exec(`insert into inventory_movements(roaster_id,order_id,${type==='green'?'green_coffee_id':'roast_batch_id'},product_type,movement_type,quantity_kg) values (${sqlId(tenant)},${sqlId(order)},${sqlId(product)},'${type}','sale_commit',${qty});`);
}
async function amount(n,type) {return Number((await db.query(`select current_stock_kg from ${type==='green'?'green_coffees':'roast_batches'} where id=${sqlId(n)}`)).rows[0].current_stock_kg);}
const cancel=n=>db.query(`select (public.cancel_order_and_restore_inventory(${sqlId(n)})).*`);
test('mixed stock is restored exactly once, with retained debit and compensation', async () => {
  await fixture(10); await stock(20,'green',0); await stock(21,'roasted',4);
  await debit(10,20,'green',-2.5); await debit(10,20,'green',-0.75); await debit(10,21,'roasted',-1.25);
  const result=await cancel(10); assert.equal(result.rows[0].status,'cancelled'); assert.ok(result.rows[0].cancelled_at);
  assert.equal(await amount(20,'green'),3.25); assert.equal(await amount(21,'roasted'),5.25);
  await Promise.all([cancel(10),cancel(10)]);
  assert.equal(await amount(20,'green'),3.25); assert.equal(await amount(21,'roasted'),5.25);
  assert.equal((await db.query(`select count(*)::int as n from inventory_movements where order_id=${sqlId(10)}`)).rows[0].n,6);
  assert.equal((await db.query(`select status from green_coffees where id=${sqlId(20)}`)).rows[0].status,'active');
});
test('cancellation rolls back earlier stock updates if a later movement is invalid',async()=>{
  await fixture(30); await stock(31,'green',1); await stock(32,'roasted',2,2);
  await debit(30,31,'green',-3); await debit(30,32,'roasted',-4);
  await assert.rejects(cancel(30),/No se encontró/);
  assert.equal(await amount(31,'green'),1); assert.equal(await amount(32,'roasted'),2);
  assert.equal((await db.query(`select status from orders where id=${sqlId(30)}`)).rows[0].status,'confirmed');
  assert.equal((await db.query(`select count(*)::int n from inventory_movements where order_id=${sqlId(30)}`)).rows[0].n,2);
});
test('owner checks reject other users and anonymous requests',async()=>{
  await fixture(40);
  for(const user of [uid(102),'']) {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
    await assert.rejects(cancel(40),/sin permiso/);
  }
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid(101)]);
  const grants=(await db.query(`select has_function_privilege('anon','public.cancel_order_and_restore_inventory(uuid)','execute') as anon, has_function_privilege('authenticated','public.cancel_order_and_restore_inventory(uuid)','execute') as auth, has_function_privilege('authenticated','public.restore_order_inventory_internal(uuid,boolean)','execute') as internal`)).rows[0];
  assert.deepEqual(grants,{anon:false,auth:true,internal:false});
});
test('uncommitted and non-inventory sales cancel without changing stock',async()=>{
  await fixture(50,{uncommitted:true}); await fixture(51);
  const before=await amount(20,'green');
  assert.equal((await cancel(50)).rows[0].status,'cancelled');
  assert.equal((await cancel(51)).rows[0].status,'cancelled');
  assert.equal(await amount(20,'green'),before);
});
test('missing or invalid source movements fail instead of guessing quantities',async()=>{
  await fixture(60);
  await db.exec(`insert into order_items values (${sqlId(61)},${sqlId(60)},'green')`);
  await assert.rejects(cancel(60),/Faltan los movimientos/);
  await fixture(62); await debit(62,20,'green',2);
  await assert.rejects(cancel(62),/Movimiento de inventario inválido/);
});
test('old cancelled orders that still have committed stock can be restored once',async()=>{
  await fixture(70); await stock(71,'green',1); await debit(70,71,'green',-2);
  await db.exec(`update orders set status='cancelled' where id=${sqlId(70)}`);
  await cancel(70); await cancel(70); assert.equal(await amount(71,'green'),3);
});
test('stale edits cannot restore inventory twice or reactivate a cancelled sale',async()=>{
  await assert.rejects(db.query(`select release_order_inventory_for_edit(${sqlId(10)})`),/anulada no se puede editar/);
  await assert.rejects(db.exec(`update orders set status='confirmed' where id=${sqlId(10)}`),/anulada no se puede modificar/);
  await assert.rejects(db.exec(`insert into order_items values (${sqlId(80)},${sqlId(10)},'green')`),/anulada no se pueden modificar/);
  assert.equal(await amount(20,'green'),3.25);
});
test('edit release is atomic and idempotent, and later cancellation does not restore twice',async()=>{
  await fixture(90); await stock(91,'roasted',2); await debit(90,91,'roasted',-0.5);
  await db.query(`select release_order_inventory_for_edit(${sqlId(90)})`);
  await db.query(`select release_order_inventory_for_edit(${sqlId(90)})`);
  assert.equal(await amount(91,'roasted'),2.5);
  assert.equal((await db.query(`select inventory_committed_at from orders where id=${sqlId(90)}`)).rows[0].inventory_committed_at,null);
  await cancel(90); assert.equal(await amount(91,'roasted'),2.5);
});
