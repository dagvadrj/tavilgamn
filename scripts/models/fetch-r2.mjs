// Read-only source download. Run with: node --env-file=.env.local scripts/models/fetch-r2.mjs --output model-work/source --limit 1
import { createClient } from '@supabase/supabase-js';
import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { parseArgs } from 'node:util';
import path from 'node:path';
const { values } = parseArgs({ options: { output: { type: 'string' }, limit: { type: 'string', default: '1' } } });
if (!values.output || !Number.isInteger(Number(values.limit)) || Number(values.limit) < 1) throw new Error('Use --output folder --limit positive-integer');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const client = new S3Client({ region: 'auto', endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
const bucket = process.env.R2_BUCKET_NAME;
try {
  const models = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await db.from('furniture_models').select('id,name,glb_path').order('id').range(offset, offset + 99);
    if (error) throw new Error(`Could not read model catalogue (${error.code})`);
    models.push(...data);
    if (data.length < 100) break;
  }
  const sources = [];
  for (const model of models) {
    if (!model.glb_path?.startsWith(`r2://${bucket}/`)) continue;
    const key = model.glb_path.slice(`r2://${bucket}/`.length);
    if (!/^models\/[0-9a-f-]{36}\/[a-zA-Z0-9.-]+\.glb$/.test(key)) continue;
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    if (head.ContentLength > 200 * 1024 * 1024) { console.log(`Skip oversized source: ${model.name}`); continue; }
    sources.push({ id: model.id, name: model.name, key, bytes: head.ContentLength });
  }
  sources.sort((a, b) => b.bytes - a.bytes);
  await mkdir(values.output, { recursive: true });
  const downloaded = [];
  for (const source of sources.slice(0, Number(values.limit))) {
    const file = path.join(values.output, `${source.id}.glb`);
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: source.key }));
    await pipeline(object.Body, createWriteStream(file, { flags: 'wx' }));
    downloaded.push({ ...source, file });
    console.log(`${source.name}: ${(source.bytes / 1048576).toFixed(2)} MiB -> ${file}`);
  }
  await writeFile(path.join(values.output, 'sources.json'), JSON.stringify(downloaded, null, 2), { flag: 'wx' });
  console.log(`Downloaded ${downloaded.length} source(s). Remote files unchanged.`);
} finally { client.destroy(); }
