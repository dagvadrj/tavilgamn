const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");
const { NextRequest } = require("next/server");
const { loadSource } = require("./helpers/load-source.cjs");

const product = (id, extra = {}) => ({ id, name: "Сандал", category: "office", description: "",
  image: "/test.jpg", images: [], basePrice: 100, defaultColor: "oak",
  colors: [{ id: "oak", name: "Царс", hex: "#aaaaaa", priceDelta: 0 }],
  materials: [{ id: "wood", name: "Мод", priceDelta: 0 }], dimensions: { w: 1, d: 1, h: 1 },
  stockQuantity: 5, rating: 0, reviewCount: 0, storeIds: [], ...extra });

test("commerce validation uses canonical categories and rejects fabricated comparison data", () => {
  const { parseMerchantProduct, parseMerchantStore } = loadSource("src/lib/merchantValidation.ts");
  const valid = parseMerchantProduct(product("p", { compareAtPrice: 150, promotionLabel: "Намрын үнэ", promotionEndsAt: "2026-11-01T00:00:00+08:00", deliveryTerms: "Хүргэлтийн хугацааг баталгаажуулна." }), "p");
  assert.equal(valid.compareAtPrice, 150);
  assert.equal(valid.promotionEndsAt, "2026-10-31T16:00:00.000Z");
  for (const extra of [{ compareAtPrice: 100 }, { compareAtPrice: 99 }, { compareAtPrice: 150.5 }, { promotionLabel: "fake sale" }, { promotionEndsAt: "tomorrow" }, { compareAtPrice: 150, promotionEndsAt: "2026-11-01T00:00:00" }, { deliveryTerms: "x".repeat(1001) }]) {
    assert.throws(() => parseMerchantProduct(product("p", extra), "p"));
  }
  const { CATEGORIES } = loadSource("src/lib/catalogCategories.ts");
  assert.equal(parseMerchantStore({ name: "N", storeType: "retail", city: "UB", district: "", address: "A", phone: "123", description: "", image: "", categories: CATEGORIES.map(c => c.id) }).categories.length, CATEGORIES.length);
});

test("merchant product archive binds the actor and ignores forged store ownership", async () => {
  const calls = [];
  const route = loadSource("src/app/api/merchant/products/[id]/route.ts", {
    "@/lib/supabase/requireMerchant": { requireMerchant: async () => ({ userId: "verified", error: null }) },
    "@/lib/supabase/admin": { getSupabaseAdmin: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return { error: null }; } }) },
  });
  const patch = raw => route.PATCH(new NextRequest("http://local/api/merchant/products/p", { method: "PATCH", body: JSON.stringify(raw) }), { params: Promise.resolve({ id: "p" }) });
  assert.equal((await patch({ archived: "yes" })).status, 400);
  assert.equal(calls.length, 0);
  const response = await patch({ archived: true, actorId: "attacker", storeId: "foreign" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(calls[0], { name: "set_merchant_product_archived", args: { p_actor: "verified", p_product: "p", p_archived: true } });
});

test("catalog reads tolerate only specifically missing optional commerce columns", async () => {
  const { readProduct } = loadSource("src/lib/catalogServer.ts");
  const base = product("p");
  const row = { id: randomUUID(), product_id: "p", name: base.name, category: base.category, description: "", base_price:100,
    image_url:"/test.jpg",images:[], colors:base.colors,materials:base.materials,default_color:"oak",
    dimensions_w:1,dimensions_d:1,dimensions_h:1,in_stock:5,rating:0,review_count:0,store_ids:[],glb_path:null };
  const fields = [];
  const database = error => ({ from:() => ({ select(columns) {
    fields.push(columns);
    const query = { is:() => query,eq:() => query,maybeSingle:async () => columns.includes("compare_at_price") ? { error } : { data:row,error:null } };
    return query;
  } }) });
  const result = await readProduct("p",database({ code:"42703",message:"column furniture_models.compare_at_price does not exist" }));
  assert.equal(result.compareAtPrice,null); assert.equal(fields.length,2);
  fields.length=0;
  await assert.rejects(readProduct("p",database({ code:"42703",message:"column furniture_models.base_price does not exist" })));
  assert.equal(fields.length,1);
});

test("product ownership, gallery ledger, archive and metadata changes are atomic under service_role", async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.profiles(id uuid primary key,role text not null);
    create table public.merchant_stores(id text primary key,owner_id uuid references profiles(id),active boolean not null default true);
    create table public.furniture_models(id uuid primary key,product_id text unique,name text,category text,description text,base_price bigint,
      image_url text,images jsonb not null default '[]',glb_path text,scale float8,dimensions_w float8,dimensions_d float8,dimensions_h float8,
      colors jsonb,materials jsonb,default_color text,in_stock integer,rating numeric,review_count integer,badges jsonb,is_new boolean,is_best_seller boolean,
      store_ids jsonb,updated_at timestamptz,model_requested boolean not null default false,model_requested_at timestamptz,model_requested_by_store_id text,
      archived_at timestamptz,archived_by uuid references profiles(id),processing_job_id uuid,processing_status text not null default 'idle',processing_error text);
    create table public.orders(id uuid primary key default gen_random_uuid(),items jsonb,stock_reserved boolean default false);
    grant all on public.profiles,public.merchant_stores,public.furniture_models,public.orders to service_role;
  `);
  // Use real predecessor functions rather than a superuser-only RPC mock.
  const gallery = readFileSync("supabase/migrations/202609090001_product_gallery.sql", "utf8");
  await db.exec(gallery.slice(gallery.indexOf("create or replace function public.save_furniture_product"), gallery.indexOf("notify pgrst")));
  await db.exec(readFileSync("supabase/migrations/20260919130629_merchant_product_3d_request_save.sql", "utf8"));
  await db.exec("revoke all on function save_merchant_product_v2(uuid,jsonb,boolean,boolean,integer) from public,anon,authenticated; grant execute on function save_merchant_product_v2(uuid,jsonb,boolean,boolean,integer) to service_role;");
  await db.exec(readFileSync("supabase/migrations/20261002131913_marketplace_product_commerce.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/20261010114233_product_specifications_categories.sql", "utf8"));
  await db.exec("create trigger reserve_order_stock before insert on public.orders for each row execute function reserve_order_stock()");
  const alice = randomUUID(), bob = randomUUID(), customer = randomUUID();
  await db.query("insert into profiles values($1,'merchant'),($2,'merchant'),($3,'customer')", [alice,bob,customer]);
  await db.query("insert into merchant_stores values('alice',$1,true),('bob',$2,true)", [alice,bob]);
  await db.exec("set role service_role");
  const call = (sql,args=[]) => db.query(sql,args);
  const save = (actor,data,create=true,expected=null) => call("select save_merchant_product_v2($1,$2,$3,false,$4)", [actor,JSON.stringify(data),create,expected]);
  const archive = (actor,id,state) => call("select set_merchant_product_archived($1,$2,$3)",[actor,id,state]);
  await save(alice,product("alice",{ compareAtPrice: 200, promotionLabel: "Хямдрал", deliveryTerms: "UB 3 хоног", specifications: { assembly: "Боолттой" } }));
  await save(bob,product("bob"));
  let row = (await call("select * from furniture_models where product_id='alice'")).rows[0];
  assert.deepEqual(row.store_ids,["alice"]); assert.equal(Number(row.compare_at_price),200);
  assert.deepEqual(row.specifications, { assembly: "Боолттой" });
  // Changing sale/reference below the previous base price is a single transaction.
  await save(alice,product("alice",{ basePrice: 50, compareAtPrice: 75 }),false,5);
  row = (await call("select * from furniture_models where product_id='alice'")).rows[0];
  assert.equal(Number(row.compare_at_price),75);
  await assert.rejects(save(alice,product("alice",{ basePrice: 60, compareAtPrice: 90 }),false,4),{ code:"P0003" });
  assert.equal(Number((await call("select compare_at_price from furniture_models where product_id='alice'")).rows[0].compare_at_price),75);
  await assert.rejects(save(alice,product("bob"),false,5),{ code:"P0002" });
  await assert.rejects(archive(customer,"alice",true),{ code:"42501" });
  await assert.rejects(archive(bob,"alice",true),{ code:"P0002" });
  await archive(alice,"alice",true);
  assert.equal((await call("select * from read_merchant_products_v2($1,null,false)",[alice])).rows.length,0);
  assert.equal((await call("select * from read_merchant_products_v2($1,null,true)",[alice])).rows.length,1);
  await assert.rejects(save(alice,product("alice"),false,5),{ code:"P0002" });
  await archive(alice,"alice",false);
  const asset = randomUUID(), foreignAsset = randomUUID();
  const url = "https://res.cloudinary.com/demo/image/upload/alice.jpg", foreignUrl = "https://res.cloudinary.com/demo/image/upload/bob.jpg";
  await call("insert into product_media_assets(id,owner_id,public_id,url,state) values($1,$2,'alice-public',$3,'ready'),($4,$5,'bob-public',$6,'ready')",[asset,alice,url,foreignAsset,bob,foreignUrl]);
  await save(alice,product("alice",{ image:url }),false,5);
  assert.equal((await call("select state from product_media_assets where id=$1",[asset])).rows[0].state,"attached");
  await assert.rejects(save(alice,product("alice",{ image:foreignUrl }),false,5),{ code:"22023" });
  assert.equal((await call("select image_url from furniture_models where product_id='alice'")).rows[0].image_url,url);
  await save(alice,product("alice"),false,5);
  assert.equal((await call("select state from product_media_assets where id=$1",[asset])).rows[0].state,"retained");
  assert.equal((await call("select count(*)::int as n from product_media_assets")).rows[0].n,2);
  await save(alice,product("alice",{ deliveryTerms:"Үйлдвэрлэл 3 хоног",compareAtPrice:150,promotionLabel:"Бодит үнэ" }),false,5);
  const inserted=(await call("insert into orders(items) values($1) returning items,stock_reserved",[JSON.stringify([{ productId:"alice",color:"oak",material:"wood",qty:1,unitPrice:100,lineTotal:100,name:"FORGED",deliveryTerms:"FAKE",productCategory:"bad",storeIds:["bob"],dimensions:{w:999},compareAtPrice:999 }])])).rows[0];
  assert.equal(inserted.stock_reserved,true);
  assert.equal(inserted.items[0].name,"Сандал"); assert.equal(inserted.items[0].productCategory,"office");
  assert.equal(inserted.items[0].deliveryTerms,"Үйлдвэрлэл 3 хоног"); assert.equal(inserted.items[0].compareAtPrice,150);
  assert.deepEqual(inserted.items[0].dimensions,{w:1,d:1,h:1}); assert.deepEqual(inserted.items[0].storeIds,["alice"]);
  assert.equal((await call("select in_stock from furniture_models where product_id='alice'")).rows[0].in_stock,4);
  await archive(alice,"alice",true);
  await assert.rejects(call("insert into orders(items) values($1)",[JSON.stringify([{ productId:"alice",color:"oak",material:"wood",qty:1,unitPrice:100,lineTotal:100 }])]),{code:"P0004"});
  await archive(alice,"alice",false);
  await call("update furniture_models set store_ids='[\"alice\",\"bob\"]' where product_id='alice'");
  await assert.rejects(archive(alice,"alice",true),{ code:"P0002" });
  await db.exec("reset role; set role authenticated");
  await assert.rejects(call("select * from product_media_assets"),{ code:"42501" });
  await assert.rejects(archive(alice,"bob",true),{ code:"42501" });
  await db.exec("reset role");
});

test("gallery upload records an intent before storage and verifies the returned asset identity", async () => {
  const oldFetch = global.fetch;
  const oldEnv = [process.env.CLOUDINARY_CLOUD_NAME,process.env.CLOUDINARY_API_KEY,process.env.CLOUDINARY_API_SECRET];
  process.env.CLOUDINARY_CLOUD_NAME="demo"; process.env.CLOUDINARY_API_KEY="test"; process.env.CLOUDINARY_API_SECRET="test";
  const events = []; let intent;
  const query = {
    insert(value) { events.push("intent"); intent=value; return Promise.resolve({ error:null }); },
    update(value) { events.push(value.state); return query; }, eq() { return query; }, then(resolve,reject) { return Promise.resolve({ error:null }).then(resolve,reject); },
  };
  try {
    global.fetch = async (_url,init) => {
      events.push("upload"); assert.ok(intent.public_id.endsWith(intent.id));
      return { ok:true, json:async () => ({ public_id:init.body.get("public_id"), secure_url:`https://res.cloudinary.com/demo/image/upload/v1/${intent.public_id}.jpg` }) };
    };
    const route = loadSource("src/app/api/merchant/images/route.ts", {
      "@/lib/supabase/requireMerchant": { requireMerchant:async () => ({ userId:"verified-owner",error:null }) },
      "@/lib/supabase/admin": { getSupabaseAdmin:() => ({ from:() => query }) },
    });
    const form = new FormData(); form.set("file",new File(["jpg"],"test.jpg",{ type:"image/jpeg" }));
    const response = await route.POST(new NextRequest("http://local/api/merchant/images",{ method:"POST",body:form }));
    assert.equal(response.status,201); assert.deepEqual(events,["intent","upload","ready"]); assert.equal(intent.owner_id,"verified-owner");
    events.length=0;
    global.fetch=async () => ({ ok:true,json:async () => ({ public_id:"foreign",secure_url:"https://res.cloudinary.com/demo/image/upload/foreign.jpg" }) });
    assert.equal((await route.POST(new NextRequest("http://local/api/merchant/images",{ method:"POST",body:form }))).status,502);
    assert.deepEqual(events,["intent","failed"]);
  } finally {
    global.fetch=oldFetch;
    for (const [index,key] of ["CLOUDINARY_CLOUD_NAME","CLOUDINARY_API_KEY","CLOUDINARY_API_SECRET"].entries()) {
      if (oldEnv[index]===undefined) delete process.env[key]; else process.env[key]=oldEnv[index];
    }
  }
});
