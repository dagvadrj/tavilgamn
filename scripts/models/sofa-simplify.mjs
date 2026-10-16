// Offline index-only simplification. Open borders stay locked; positions never move.
import { readFile, writeFile } from 'node:fs/promises';
import { MeshoptSimplifier } from 'meshoptimizer';

const [input, output] = process.argv.slice(2);
if (!input || !output || input === output) throw Error('Supply distinct input/output JSON paths');
const data = JSON.parse(await readFile(input, 'utf8'));
if (!Array.isArray(data.positions) || !data.positions.length || data.positions.length % 3 ||
    data.positions.some(value => !Number.isFinite(value)) ||
    !Array.isArray(data.indices) || data.indices.length % 3 ||
    data.indices.some(index => !Number.isInteger(index) || index < 0 || index >= data.positions.length / 3) ||
    !Number.isInteger(data.targetTriangles) || data.targetTriangles < 1 ||
    !(data.maxErrorM > 0 && Number.isFinite(data.maxErrorM))) throw Error('Invalid simplifier input');
await MeshoptSimplifier.ready;
const positions = new Float32Array(data.positions);
const scale = MeshoptSimplifier.getScale(positions, 3);
if (!(scale > 0)) throw Error('Degenerate mesh scale');
const [indices, error] = MeshoptSimplifier.simplify(new Uint32Array(data.indices), positions, 3,
  Math.min(data.targetTriangles * 3, data.indices.length), data.maxErrorM / scale, ['LockBorder']);
await writeFile(output, JSON.stringify({ indices: Array.from(indices), errorM: error * scale,
  method: 'Meshopt index-only simplify with LockBorder; existing vertex positions only' }), { flag: 'wx' });
