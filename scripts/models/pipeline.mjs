import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { values } = parseArgs({ options: { input: { type: 'string' }, output: { type: 'string' }, blender: { type: 'string' }, 'ktx-bin': { type: 'string' },
  high: { type: 'string', default: '30000' }, medium: { type: 'string', default: '15000' }, low: { type: 'string', default: '5000' } } });
if (!values.input || !values.output) throw new Error('Use npm run models:pipeline -- --input source-folder --output new-output-folder');
const windowsBlender = 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe';
const blender = values.blender ?? process.env.BLENDER_BIN ?? (existsSync(windowsBlender) ? windowsBlender : 'blender');
const ktx = values['ktx-bin'] ?? (existsSync(path.join(root, '.tools/ktx/bin/ktx.exe')) ? path.join(root, '.tools/ktx/bin') : null);
const output = path.resolve(values.output), source = path.resolve(values.input);
if (output === source || output.startsWith(source + path.sep)) throw new Error('Output must be outside source directory');
if (existsSync(output)) throw new Error('Choose a new output directory; previous results are preserved');
async function run(executable, args) {
  await new Promise((resolve, reject) => {
    const process = spawn(executable, args, { stdio: 'inherit', shell: false, windowsHide: true, cwd: root });
    process.on('error', reject); process.on('exit', code => code === 0 ? resolve() : reject(new Error(`Pipeline stage failed (${code})`)));
  });
}
try {
  await run(blender, ['--background', '--python-exit-code', '1', '--python', path.join(root, 'scripts/models/blender_batch.py'), '--',
    '--input', source, '--output', path.join(output, 'geometry'), '--high', values.high, '--medium', values.medium, '--low', values.low]);
  await run(process.execPath, [path.join(root, 'scripts/models/optimize-glb.mjs'), '--input', path.join(output, 'geometry'), '--output', path.join(output, 'compressed'), ...(ktx ? ['--ktx-bin', ktx] : [])]);
} catch (error) { console.error(error.message); process.exitCode = 1; }
