// Only SELECT and GET: leaves database and R2 objects unchanged.
import { createClient } from '@supabase/supabase-js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder } from 'meshoptimizer';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const id = process.argv[2], output = process.argv[3];
if (!/^[0-9a-f-]{36}$/i.test(id) || !output) throw new Error('Use model-uuid new-output-directory');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data: model, error } = await db.from('furniture_models').select('id,name,dimensions_w,dimensions_h,dimensions_d,glb_path').eq('id', id).single();
if (error) throw new Error(`Model SELECT failed (${error.code})`);
const bucket = process.env.R2_BUCKET_NAME, prefix = `r2://${bucket}/models/${id}/`;
if (!model.glb_path?.startsWith(prefix)) throw new Error('Unexpected model storage path');
const client = new S3Client({ region: 'auto', endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
try {
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: model.glb_path.slice(`r2://${bucket}/`.length) }));
  if (!object.Body || object.ContentLength > 209715200) throw new Error('Invalid object size');
  const bytes = await object.Body.transformToByteArray();
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule(), 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.readBinary(bytes), scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const bounds = getBounds(scene);
  const report = { id, name: model.name, bytes: bytes.byteLength, databaseMm: [model.dimensions_w, model.dimensions_h, model.dimensions_d].map(value => value * 1000), decodedMm: [0, 1, 2].map(axis => (bounds.max[axis] - bounds.min[axis]) * 1000), bounds };
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, `${id}.glb`), bytes, { flag: 'wx' });
  await writeFile(path.join(output, `${id}.json`), JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(report, null, 2));
} finally { client.destroy(); }
