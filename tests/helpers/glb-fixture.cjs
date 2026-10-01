function fixture(edit = () => {}) {
  const points = Array.from({length: 36}, (_, i) => [i % 2 ? -.35 : .35, i % 3 ? 0 : .84, i % 4 ? -.299 : .299]).flat();
  const bin = Buffer.alloc(points.length * 4); points.forEach((value, i) => bin.writeFloatLE(value, i * 4));
  const json = { asset: { version: '2.0' }, scene: 0, scenes: [{nodes: [0]}], nodes: [{mesh: 0}], meshes: [{name: 'carcass_1', primitives: [{attributes: {POSITION: 0}}]}], materials: [{name: 'carcass_wood'}], buffers: [{byteLength: bin.length}], bufferViews: [{buffer: 0, byteLength: bin.length}], accessors: [{bufferView: 0, componentType: 5126, count: 36, type: 'VEC3', min: [0,0,0], max: [1,1,1]}] };
  edit(json, bin);
  const raw = Buffer.from(JSON.stringify(json)); const padded = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32); raw.copy(padded);
  const result = Buffer.alloc(12 + 8 + padded.length + 8 + bin.length);
  result.writeUInt32LE(0x46546c67); result.writeUInt32LE(2,4); result.writeUInt32LE(result.length,8); result.writeUInt32LE(padded.length,12); result.writeUInt32LE(0x4e4f534a,16); padded.copy(result,20);
  result.writeUInt32LE(bin.length,20+padded.length); result.writeUInt32LE(0x004e4942,24+padded.length); bin.copy(result,28+padded.length);
  return result.buffer.slice(result.byteOffset,result.byteOffset+result.length);
}
module.exports = { fixture };

