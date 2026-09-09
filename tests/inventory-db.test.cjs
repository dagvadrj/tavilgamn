const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");

test("inventory migration: reservation, rollback, cancellation, admin conflicts and contact privacy", async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table public.products(id text primary key, data jsonb not null, updated_at timestamptz default now());
    create table public.furniture_models(id uuid primary key, catalog_product_id text references public.products(id),
      name text not null,category text not null,description text not null default '',base_price bigint not null default 0,
      glb_path text not null,thumbnail_path text,scale double precision not null default 1,
      dimensions_w double precision not null,dimensions_d double precision not null,dimensions_h double precision not null,
      colors jsonb not null,materials jsonb not null,in_stock boolean not null default true);
    create function public.save_catalog_product(p_data jsonb, p_create boolean) returns void language plpgsql as $$
    begin
      if p_create then insert into public.products(id,data) values(p_data->>'id',p_data);
      else update public.products set data=p_data where id=p_data->>'id';
        if not found then raise exception using errcode='P0002', message='Not found'; end if;
      end if;
    end; $$;
  `);
  await db.exec(readFileSync("supabase/migrations/202609040001_orders.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/202609040002_payments.sql", "utf8"));
  const product = (id, qty) => ({id, name:id, category:"sofa", description:"", image:"/test.jpg",dimensions:{w:1,d:1,h:1},defaultColor:"oak", stockQuantity:qty, basePrice:100, colors:[{id:"oak",priceDelta:0},{id:"dark",priceDelta:0}], materials:[{id:"wood",priceDelta:0}]});
  await db.query("insert into products(id,data) values ('legacy', $1), ('empty', $2)", [JSON.stringify({...product("legacy",undefined),inStock:true}), JSON.stringify({...product("empty",undefined),inStock:false})]);
  await db.exec(readFileSync("supabase/migrations/202609060001_inventory_contact.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/202609090001_product_gallery.sql", "utf8"));
  const owner = randomUUID();
  await db.query("insert into auth.users values ($1)", [owner]);

  const stock = async id => (await db.query("select in_stock from furniture_models where product_id=$1", [id])).rows[0].in_stock;
  const addProduct = async (id, qty) => db.query("select save_furniture_product($1,true,null)", [JSON.stringify(product(id,qty))]);
  const line = (id, qty, color="oak") => ({productId:id,qty,color,material:"wood",unitPrice:100,lineTotal:100*qty});
  const insert = (items, key=randomUUID()) => db.query(`insert into orders(user_id,idempotency_key,request_hash,items,delivery,subtotal,shipping,total)
    values($1,$2,$3,$4,$5,$6,0,$6) returning id`, [owner,key,"a".repeat(64),JSON.stringify(items),JSON.stringify({name:"Fixture",phone:"99000000",address:"Fixture address"}),items.reduce((s,i)=>s+i.lineTotal,0)]);

  await t.test("legacy quantities remain unknown; unavailable products become zero", async () => {
    assert.equal(await stock("legacy"), null); assert.equal(await stock("empty"),0);
  });
  await t.test("stock is shared across variants and rolls back on shortage", async () => {
    await addProduct("shared",3);
    await assert.rejects(insert([line("shared",2),line("shared",2,"dark")]), {code:"P0004"});
    assert.equal(await stock("shared"),3);
    await insert([line("shared",1),line("shared",2,"dark")]);
    assert.equal(await stock("shared"),0);
    await assert.rejects(insert([line("shared",1)]), {code:"P0004"});
  });
  await t.test("duplicate order insert does not reserve twice", async () => {
    await addProduct("retry",5); const key=randomUUID(); await insert([line("retry",2)],key);
    await assert.rejects(insert([line("retry",2)],key), {code:"23505"});
    assert.equal(await stock("retry"),3);
  });
  await t.test("multi-product failure and changed price roll back every decrement", async () => {
    await addProduct("first",3); await addProduct("second",0);
    await assert.rejects(insert([line("first",1),line("second",1)]), {code:"P0004"});
    assert.equal(await stock("first"),3);
    await assert.rejects(insert([{...line("first",1),unitPrice:1}]), {code:"P0005"});
    assert.equal(await stock("first"),3);
  });
  await t.test("cancellation restores units once and cannot be reopened", async () => {
    await addProduct("cancel",4); const result=await insert([line("cancel",2)]); const id=result.rows[0].id;
    await db.query("update orders set status='cancelled' where id=$1",[id]);
    await db.query("update orders set status='cancelled' where id=$1",[id]);
    assert.equal(await stock("cancel"),4);
    await assert.rejects(db.query("update orders set status='paid' where id=$1",[id]));
  });
  await t.test("payment confirmation never decrements reserved stock again", async () => {
    await addProduct("paid",2); const result=await insert([line("paid",1)]); const id=result.rows[0].id;
    await db.query("insert into order_payments(order_id,method,callback_token) values($1,'qpay','fixture')",[id]);
    await db.query("select confirm_order_payment($1,'qpay','fixture-reference',100,null)",[id]);
    assert.equal(await stock("paid"),1);
  });
  await t.test("admin save rejects stale quantity and legacy metadata sync preserves stock", async () => {
    await addProduct("admin",8); await insert([line("admin",1)]);
    await assert.rejects(db.query("select save_furniture_product($1,false,8)",[JSON.stringify(product("admin",8))]), {code:"P0003"});
    assert.equal(await stock("admin"),7);
    await db.query("update furniture_models set description='Updated metadata' where product_id='admin'");
    assert.equal(await stock("admin"),7);
    await db.query("select save_furniture_product($1,false,7)",[JSON.stringify(product("admin",9))]);
    assert.equal(await stock("admin"),9);
    for (const qty of [-1,1.5,"2",1000001]) await assert.rejects(db.query("select save_furniture_product($1,true,null)",[JSON.stringify(product("invalid",qty))]));
  });
  await t.test("product gallery stores up to twelve additional images", async () => {
    const gallery = ["https://res.cloudinary.com/demo/image/upload/one.webp", "https://res.cloudinary.com/demo/image/upload/two.webp"];
    await db.query("select save_furniture_product($1,true,null)", [JSON.stringify({...product("gallery",4),images:gallery})]);
    assert.deepEqual((await db.query("select images from furniture_models where product_id='gallery'")).rows[0].images, gallery);
    await assert.rejects(db.query("select save_furniture_product($1,true,null)", [JSON.stringify({...product("gallery-overflow",4),images:Array.from({length:13},(_,i)=>`/image-${i}.jpg`)})]));
  });
  await t.test("all products live in furniture_models and legacy data is backed up", async () => {
    assert.equal((await db.query("select to_regclass('public.products') as name")).rows[0].name,null);
    assert.equal((await db.query("select count(*)::integer as count from products_legacy_backup")).rows[0].count,2);
    assert.equal((await db.query("select data_type from information_schema.columns where table_name='furniture_models' and column_name='in_stock'")).rows[0].data_type,"integer");
    await assert.rejects(db.query("delete from furniture_models where product_id='paid'"), {code:"P0007"});
  });
  await t.test("GLB replacement preserves quantity and supports products without models", async () => {
    await addProduct("glb",6);
    const id=(await db.query("select id from furniture_models where product_id='glb'")).rows[0].id;
    const file="r2://test/models/"+id+"/model-"+randomUUID()+".glb";
    assert.equal((await db.query("select replace_furniture_glb($1,'',$2) as changed",[id,file])).rows[0].changed,true);
    assert.equal(await stock("glb"),6);
    assert.equal((await db.query("select replace_furniture_glb($1,'',$2) as changed",[id,file])).rows[0].changed,false);
  });
  await t.test("contact storage limits repeat submissions and is private", async () => {
    for(let i=0;i<5;i++) await db.query("select submit_contact_message('Fixture','test@example.com','Test message content')");
    await assert.rejects(db.query("select submit_contact_message('Fixture','test@example.com','Test message content')"), {code:"P0006"});
    await db.exec("set role anon");
    await assert.rejects(db.query("select * from contact_messages"), {code:"42501"});
    await assert.rejects(db.query("select submit_contact_message('Fixture','test@example.com','Test message content')"), {code:"42501"});
    await db.exec("reset role");
  });
});
