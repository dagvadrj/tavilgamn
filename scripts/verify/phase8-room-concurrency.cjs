// Native PostgreSQL drill, restricted to an already prepared local fixture DB.
const assert=require('node:assert/strict');const {execFile}=require('node:child_process');const {promisify}=require('node:util');
const {readFileSync,mkdirSync,writeFileSync}=require('node:fs');const {randomUUID}=require('node:crypto');
const run=promisify(execFile),binary=process.env.PSQL_PATH||'psql';
assert.ok(['127.0.0.1','localhost'].includes(process.env.PGHOST),'Local fixture host required');
assert.match(process.env.PGDATABASE||'',/^phase8_fixture_[a-z0-9_]+$/,'Disposable Phase 8 database name required');
async function sql(text){return (await run(binary,['-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-c',text],{maxBuffer:2_000_000})).stdout.trim();}
(async()=>{
  const actor=randomUUID(),id=randomUUID(),doc={schemaVersion:1,design:{rooms:[{pieces:[]}],width:5}};
  await sql(`create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    insert into auth.users values('${actor}');`);
  await sql(readFileSync('supabase/migrations/20261003050000_room_cloud_projects.sql','utf8'));
  const save=(name,document,revision)=>`set role service_role; select save_room_project('${actor}','${id}','${name}','${JSON.stringify(document)}',${revision},'${randomUUID()}',null,false)->'project'->>'revision'`;
  assert.equal(await sql(save('Initial',doc,0)),'1');
  const results=await Promise.all(Array.from({length:10},async(_,n)=>{
    try{return {revision:await sql(save(`Native writer ${n}`,{...doc,design:{...doc.design,width:6+n/10}},1))};}
    catch(e){if(!e.stderr.includes('revision conflict'))throw e;return {conflict:true};}
  }));
  assert.equal(results.filter(r=>r.revision==='2').length,1);assert.equal(results.filter(r=>r.conflict).length,9);
  assert.equal(await sql('select count(*) from room_project_versions'),'2');
  const report={environment:'native local disposable PostgreSQL',server:await sql('show server_version'),writers:10,winners:1,conflicts:9,versions:2,results};
  mkdirSync('.tools/phase8-db',{recursive:true});writeFileSync('.tools/phase8-db/concurrency.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
