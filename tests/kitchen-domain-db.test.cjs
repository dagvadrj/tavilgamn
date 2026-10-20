const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync,readdirSync}=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const {randomUUID}=require('node:crypto');
const migration=readdirSync('supabase/migrations').find(name=>name.endsWith('_separate_kitchen_model_library.sql'));
const sql=readFileSync('supabase/migrations/'+migration,'utf8');
const referenceMigration=readdirSync('supabase/migrations').find(name=>name.endsWith('_kitchen_library_reference_guard.sql'));
const referenceSql=readFileSync('supabase/migrations/'+referenceMigration,'utf8');
const baseline=readFileSync('supabase/migrations/20261001131646_glb_cabinet_standard.sql','utf8');
const oldFunction=name=>baseline.match(new RegExp('create function public\\.'+name+'\\([\\s\\S]*?\\$\\$;'))[0];

async function fixture(){
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create table profiles(id uuid primary key,role text);
    create table merchant_stores(id uuid primary key);
    create table kitchen_modules(id uuid primary key,code text,cabinet_type text,width_mm int,height_mm int,depth_mm int,active boolean default true);
    create table furniture_models(id uuid primary key default gen_random_uuid(),product_id text unique,name text,category text,description text default '',base_price bigint default 0,
      dimensions_w double precision default .6,dimensions_h double precision default .84,dimensions_d double precision default .6,scale double precision default 1,
      glb_path text,preview_glb_path text,standard_glb_path text,source_glb_path text,thumbnail_path text,image_url text,images jsonb default '[]',store_ids jsonb default '[]',specifications jsonb default '{}',
      cabinet_module_id uuid,model_requested_by_store_id uuid,glb_validation jsonb,processing_status text default 'idle',processing_error text,processing_job_id uuid,processing_requested_at timestamptz,processing_updated_at timestamptz,
      export_status text default 'idle',export_error text,export_job_id uuid,export_requested_at timestamptz,export_updated_at timestamptz,archived_at timestamptz,archived_by uuid,created_at timestamptz default now(),updated_at timestamptz default now());
    create table model_assets(id uuid primary key default gen_random_uuid(),model_id uuid not null constraint model_assets_model_id_fkey references furniture_models(id),version_id uuid,role text,storage_path text unique,state text,validation jsonb,sha256 text,byte_size bigint,created_by uuid,created_at timestamptz default now(),updated_at timestamptz default now());
    create table product_media_refs(model_id uuid constraint product_media_refs_model_id_fkey references furniture_models(id),asset_id uuid,primary key(model_id,asset_id));
    create table kitchen_module_variants(furniture_model_id uuid primary key constraint kitchen_module_variants_furniture_model_id_fkey references furniture_models(id),module_id uuid,variant_code text,opening text,door_count int,drawer_count int,configuration jsonb default '{}',is_default boolean default false,sort_order int default 0,active boolean default true,unique(module_id,variant_code));
    create table orders(product_id text);
    create function protect_ordered_furniture() returns trigger language plpgsql as $$begin if exists(select 1 from orders where product_id=old.product_id) then raise exception using errcode='P0007',message='Ordered model cannot move';end if;return old;end$$;
    create trigger protect_ordered_furniture before delete on furniture_models for each row execute function protect_ordered_furniture();
    create function sync_product_media_refs() returns trigger language plpgsql as $$begin return new;end$$;
    grant all on all tables in schema public to service_role;`);
  await db.exec(oldFunction('protect_archived_model')+'\n'+oldFunction('sync_model_assets'));
  await db.exec('create trigger protect_archived_model before update or delete on furniture_models for each row execute function protect_archived_model();');
  const actor=randomUUID(),body=randomUUID(),retired=randomUUID(),sofa=randomUUID(),module=randomUUID();
  await db.query("insert into profiles values($1,'admin')",[actor]);
  await db.query("insert into kitchen_modules(id,code,cabinet_type,width_mm,height_mm,depth_mm) values($1,'BASE-600','base',600,840,600)",[module]);
  for(const [id,category,archived]of[[body,'kitchen-cabinet',null],[retired,'kitchen-cabinet','2026-10-19'],[sofa,'sofa',null]]) await db.query("insert into furniture_models(id,product_id,name,category,processing_status,glb_path,processing_job_id,archived_at) values($1::uuid,$1::text,'Model',$2,'ready',$3,$4,$5)",[id,category,`r2://bucket/models/${id}/model.glb`,randomUUID(),archived]);
  await db.query("insert into kitchen_module_variants(furniture_model_id,module_id,variant_code,opening,door_count,drawer_count) values($1,$2,'BASE-600-2-DOORS','doors',2,0)",[body,module]);
  await db.query("insert into model_assets(model_id,role,storage_path,state) values($1,'delivery',$2,'retired')",[body,`r2://bucket/models/${body}/old.glb`]);
  await db.query('insert into product_media_refs values($1,$2)',[body,randomUUID()]);
  return {db,actor,body,retired,sofa,module};
}

test('physical kitchen migration preserves rows, asset history, media and variant IDs while securing both domains',async t=>{
  const {db,actor,body,retired,sofa,module}=await fixture();t.after(()=>db.close());
  const before=(await db.query("select * from furniture_models where category='kitchen-cabinet' order by id")).rows;
  await db.exec('begin;'+sql+referenceSql+'commit;');
  assert.deepEqual((await db.query('select * from kitchen_models order by id')).rows,before);
  assert.deepEqual((await db.query('select id from furniture_models')).rows,[{id:sofa}]);
  assert.equal((await db.query('select count(*)::int n from model_records')).rows[0].n,3);
  assert.equal((await db.query('select model_id from model_assets')).rows[0].model_id,body);
  assert.equal((await db.query('select model_id from product_media_refs')).rows[0].model_id,body);
  assert.equal((await db.query('select furniture_model_id from kitchen_module_variants')).rows[0].furniture_model_id,body);
  await db.exec('set role anon');await assert.rejects(db.query('select * from kitchen_models'),{code:'42501'});await assert.rejects(db.query('select * from model_records'),{code:'42501'});await assert.rejects(db.query('select queue_kitchen_model_asset($1,$2,\'x\',\'x\',\'{}\')',[actor,body]),{code:'42501'});
  await db.exec('reset role;set role service_role');
  await db.query('select set_kitchen_model_archived($1,$2,false)',[actor,retired]);
  await assert.rejects(db.query('delete from kitchen_models where id=$1',[retired]),{code:'22023'});
  await assert.rejects(db.query('select set_kitchen_model_archived($1,$2,true)',[actor,sofa]),{code:'P0002'});
  await db.query("select save_kitchen_module_variant($1,$2,$3,'{\"variantCode\":\"BASE-600-2-DOORS\",\"opening\":\"doors\",\"doorCount\":2,\"drawerCount\":0}')",[actor,body,module]);
  await assert.rejects(db.query('update kitchen_models set model_requested_by_store_id=$1 where id=$2',[randomUUID(),body]),{code:'23503'});
  const next=randomUUID(),job=randomUUID();
  await db.query("insert into kitchen_models(id,product_id,name,category) values($1::uuid,$1::text,'Door','kitchen-cabinet')",[next]);
  assert.equal((await db.query('select domain from model_registry where id=$1',[next])).rows[0].domain,'kitchen');
  const path=`r2://bucket/models/${next}/source/${job}.glb`;
  await db.query("insert into model_assets(model_id,version_id,role,storage_path,state,created_by) values($1,$2,'source',$3,'pending',$4)",[next,job,path,actor]);
  await db.query("select queue_kitchen_model_asset($1,$2,$3,$4,'{}')",[actor,next,path,'a'.repeat(64)]);
  assert.equal((await db.query('select id from claim_kitchen_model_job()')).rows[0].id,next);
  assert.equal((await db.query('select processing_status from kitchen_models where id=$1',[next])).rows[0].processing_status,'processing');
  await assert.rejects(db.query("insert into furniture_models(id,product_id,category) values($1,'collision','sofa')",[next]),{code:'23505'});
  await db.query("update profiles set role='customer' where id=$1",[actor]);
  await assert.rejects(db.query('select set_kitchen_model_archived($1,$2,true)',[actor,body]),{code:'42501'});
});

test('a protected ordered kitchen row aborts relocation without losing the source or disabling guards',async t=>{
  const {db,body}=await fixture();t.after(()=>db.close());
  await db.query('insert into orders values($1)',[body]);
  await assert.rejects(db.exec('begin;'+sql+'commit;'),{code:'P0007'});await db.exec('rollback');
  assert.equal((await db.query('select count(*)::int n from furniture_models')).rows[0].n,3);
  assert.equal((await db.query("select tgenabled from pg_trigger where tgname='protect_archived_model'")).rows[0].tgenabled,'O');
  assert.equal((await db.query("select to_regclass('public.kitchen_models') target")).rows[0].target,null);
});
