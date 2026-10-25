/** One-time, guarded catalog correction requested by the owner on 2026-10-24. */
import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const modelId = 'f9dc384b-9e20-445b-9fc0-c23a561e92ef';
const moduleId = '387a0bae-2314-45eb-8e82-dffbd45d5ad8';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const checked = async query => { const result = await query; if (result.error) throw result.error; return result.data; };
const read = async () => {
  const [module, variants, model] = await Promise.all([
    checked(db.from('kitchen_modules').select('*').eq('id', moduleId).single()),
    checked(db.from('kitchen_module_variants').select('*').eq('module_id', moduleId)),
    checked(db.from('kitchen_models').select('id,name,cabinet_module_id').eq('id', modelId).single()),
  ]);
  return { module, variants, model };
};
const before = await read();
if (before.module.width_mm !== 800 || before.module.height_mm !== 740 || before.module.depth_mm !== 598 ||
  before.variants.length !== 1 || before.variants[0].furniture_model_id !== modelId || before.model.cabinet_module_id !== moduleId ||
  !['base', 'wall'].includes(before.module.cabinet_type)) throw new Error('Catalog changed; refusing to alter an unexpected model or shared module.');

console.log(JSON.stringify({ module: before.module.code, role: before.module.cabinet_type, model: before.model.name, apply: process.argv.includes('--apply') }));
if (!process.argv.includes('--apply')) process.exit(0);
await fs.mkdir('.research', { recursive: true });
await fs.writeFile(`.research/upper-cabinet-role-backup-${Date.now()}.json`, JSON.stringify(before, null, 2));
const variant = before.variants[0];
let moduleChanged = false;
try {
  // The database trigger validates the variant code against its module's current code.
  await checked(db.from('kitchen_modules').update({
    code: 'WALL-800-H740-D598', name: '800мм дээд шүүгээ · 740 × 598 мм', cabinet_type: 'wall',
  }).eq('id', moduleId).eq('code', before.module.code).eq('cabinet_type', before.module.cabinet_type).select().single());
  moduleChanged = true;
  await checked(db.from('kitchen_module_variants').update({
    variant_code: 'WALL-800-H740-D598-2-DOORS',
    configuration: { ...variant.configuration, catalogRoleCorrection: { from: 'base', to: 'wall' } },
  }).eq('furniture_model_id', modelId).eq('module_id', moduleId).select().single());
  await checked(db.from('kitchen_models').update({ name: '800мм дээд шүүгээ · 740 өндөртэй, 2 хаалгатай' }).eq('id', modelId).select('id').single());
} catch (error) {
  // Restore earlier writes if a later update fails; never leave a half-renamed product.
  if (moduleChanged) await checked(db.from('kitchen_modules').update({ code: before.module.code, name: before.module.name, cabinet_type: before.module.cabinet_type }).eq('id', moduleId).select().single());
  await checked(db.from('kitchen_module_variants').update({ variant_code: variant.variant_code, configuration: variant.configuration }).eq('furniture_model_id', modelId).select().single());
  await checked(db.from('kitchen_models').update({ name: before.model.name }).eq('id', modelId).select('id').single());
  throw error;
}
const after = await read();
if (after.module.cabinet_type !== 'wall' || after.variants[0].configuration.catalogRoleCorrection?.to !== 'wall') throw new Error('Verification failed.');
await fs.writeFile('.research/upper-cabinet-role-after-2026-10-24.json', JSON.stringify(after, null, 2));
console.log(JSON.stringify({ verified: true, role: after.module.cabinet_type, code: after.module.code, name: after.model.name }));
