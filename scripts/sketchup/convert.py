"""Kitchen planner GLB -> native SKP, using an installed/licensed SketchUp C SDK.
Run in a separate process: python convert.py input.glb output.skp --sdk path/SketchUpAPI.dll
The SDK binary is NOT distributed with this project. All C API calls run on the main thread.
"""
import argparse
import ctypes as c
import io
import json
import math
import os
from pathlib import Path
import struct
import tempfile
from PIL import Image

class Ref(c.Structure):
    _fields_ = [('ptr', c.c_void_p)]
class Point(c.Structure):
    _fields_ = [('x', c.c_double), ('y', c.c_double), ('z', c.c_double)]
class UV(c.Structure):
    _fields_ = [('x', c.c_double), ('y', c.c_double)]
class Color(c.Structure):
    _fields_ = [('red', c.c_ubyte), ('green', c.c_ubyte), ('blue', c.c_ubyte), ('alpha', c.c_ubyte)]
class MaterialInput(c.Structure):
    _fields_ = [('num_uv_coords', c.c_size_t), ('uv_coords', UV * 4), ('vertex_indices', c.c_size_t * 4), ('material', Ref)]

class API:
    def __init__(self, path):
        self.directory = os.add_dll_directory(str(Path(path).resolve().parent)) if os.name == 'nt' else None
        self.lib = c.CDLL(str(Path(path).resolve()))
        p = c.POINTER
        signatures = {
            'SUModelCreate': [p(Ref)], 'SUModelRelease': [p(Ref)], 'SUModelSaveToFile': [Ref, c.c_char_p],
            'SUModelCreateFromFile': [p(Ref), c.c_char_p], 'SUModelGetEntities': [Ref, p(Ref)],
            'SUGroupCreate': [p(Ref)], 'SUGroupSetName': [Ref, c.c_char_p], 'SUGroupGetEntities': [Ref, p(Ref)], 'SUEntitiesAddGroup': [Ref, Ref],
            'SUGeometryInputCreate': [p(Ref)], 'SUGeometryInputRelease': [p(Ref)], 'SUGeometryInputSetVertices': [Ref, c.c_size_t, p(Point)],
            'SULoopInputCreate': [p(Ref)], 'SULoopInputRelease': [p(Ref)], 'SULoopInputAddVertexIndex': [Ref, c.c_size_t],
            'SULoopInputEdgeSetSoft': [Ref, c.c_size_t, c.c_bool], 'SULoopInputEdgeSetSmooth': [Ref, c.c_size_t, c.c_bool],
            'SUGeometryInputAddFace': [Ref, p(Ref), p(c.c_size_t)],
            'SUGeometryInputFaceSetFrontMaterial': [Ref, c.c_size_t, p(MaterialInput)], 'SUGeometryInputFaceSetBackMaterial': [Ref, c.c_size_t, p(MaterialInput)],
            'SUEntitiesFill': [Ref, Ref, c.c_bool], 'SUMaterialCreate': [p(Ref)], 'SUMaterialSetName': [Ref, c.c_char_p],
            'SUMaterialSetColor': [Ref, p(Color)], 'SUMaterialSetOpacity': [Ref, c.c_double], 'SUMaterialSetUseOpacity': [Ref, c.c_bool],
            'SUMaterialSetType': [Ref, c.c_int], 'SUMaterialSetTexture': [Ref, Ref], 'SUTextureCreateFromFile': [p(Ref), c.c_char_p, c.c_double, c.c_double],
            'SUMaterialSetRoughnessEnabled': [Ref, c.c_bool], 'SUMaterialSetRoughnessFactor': [Ref, c.c_double],
            'SUMaterialSetMetalnessEnabled': [Ref, c.c_bool], 'SUMaterialSetMetallicFactor': [Ref, c.c_double],
            'SUModelAddMaterials': [Ref, c.c_size_t, p(Ref)], 'SUEntitiesGetNumFaces': [Ref, p(c.c_size_t)],
        }
        for name, args in signatures.items():
            fn = getattr(self.lib, name); fn.argtypes = args; fn.restype = c.c_int
        self.lib.SUInitialize()
    def call(self, name, *args):
        result = getattr(self.lib, name)(*args)
        if result: raise ValueError(f'{name} failed ({result})')
    def create(self, name):
        ref = Ref(); self.call(name, c.byref(ref)); return ref

IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
def multiply(a, b):
    return [sum(a[k * 4 + r] * b[col * 4 + k] for k in range(4)) for col in range(4) for r in range(4)]
def matrix(node):
    if 'matrix' in node: result = node['matrix']
    else:
        x, y, z, w = node.get('rotation', [0, 0, 0, 1]); sx, sy, sz = node.get('scale', [1, 1, 1]); tx, ty, tz = node.get('translation', [0, 0, 0])
        result = [(1-2*y*y-2*z*z)*sx, (2*x*y+2*z*w)*sx, (2*x*z-2*y*w)*sx, 0,
                  (2*x*y-2*z*w)*sy, (1-2*x*x-2*z*z)*sy, (2*y*z+2*x*w)*sy, 0,
                  (2*x*z+2*y*w)*sz, (2*y*z-2*x*w)*sz, (1-2*x*x-2*y*y)*sz, 0, tx, ty, tz, 1]
    if len(result) != 16 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in result): raise ValueError('Invalid transform')
    return result
def transform(m, v):
    x, y, z = [sum(m[k*4+r] * v[k] for k in range(3)) + m[12+r] for r in range(3)]
    if not all(math.isfinite(n) and abs(n) < 1000 for n in [x, y, z]): raise ValueError('Position out of range')
    return Point(x / .0254, -z / .0254, y / .0254)  # glTF Y-up meters -> SketchUp Z-up inches.
def srgb(linear):
    return max(0, min(255, round(255 * (12.92*linear if linear <= .0031308 else 1.055*linear**(1/2.4)-.055))))

class GLB:
    def __init__(self, data):
        if len(data) > 4*1024*1024 or len(data) < 28 or struct.unpack_from('<III', data) != (0x46546c67, 2, len(data)): raise ValueError('Invalid GLB')
        length, kind = struct.unpack_from('<II', data, 12)
        if kind != 0x4e4f534a or length > 1024*1024 or length+28 > len(data): raise ValueError('Invalid JSON chunk')
        self.json = json.loads(data[20:20+length]); bin_length, kind = struct.unpack_from('<II', data, 20+length)
        if kind != 0x004e4942 or 28+length+bin_length != len(data): raise ValueError('Invalid BIN chunk')
        self.bin = data[28+length:]
        j = self.json
        if any(item.get('uri') for item in j.get('buffers', []) + j.get('images', [])): raise ValueError('External resources are not accepted')
        if j.get('animations') or j.get('skins') or j.get('extensionsRequired'): raise ValueError('Only uncompressed static kitchen exports are accepted')
        if len(j.get('nodes', [])) > 5000 or len(j.get('meshes', [])) > 2000 or len(j.get('materials', [])) > 2000 or len(j.get('images', [])) > 512: raise ValueError('Too many objects')
        if not any(n.get('extras', {}).get('kitchenExport') is True for n in j.get('nodes', [])): raise ValueError('Kitchen export marker missing')
        self.cache = {}
    def view(self, index):
        v = self.json['bufferViews'][index]; start = v.get('byteOffset', 0); length = v['byteLength']
        if v.get('buffer', 0) != 0 or start < 0 or length < 0 or start+length > len(self.bin): raise ValueError('Invalid buffer view')
        return self.bin[start:start+length]
    def accessor(self, index):
        if index in self.cache: return self.cache[index]
        a = self.json['accessors'][index]
        if a.get('sparse') or a.get('normalized'): raise ValueError('Unsupported accessor')
        formats = {5121: 'B', 5123: 'H', 5125: 'I', 5126: 'f'}; sizes = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}
        fmt = '<'+formats[a['componentType']]*sizes[a['type']]; width = struct.calcsize(fmt)
        data = self.view(a['bufferView']); stride = self.json['bufferViews'][a['bufferView']].get('byteStride', width); offset = a.get('byteOffset', 0); count = a['count']
        if not isinstance(count, int) or not 0 < count <= 600000 or offset < 0 or stride < width or offset+(count-1)*stride+width > len(data): raise ValueError('Invalid accessor range')
        values = [struct.unpack_from(fmt, data, offset+i*stride) for i in range(count)]
        if not all(math.isfinite(n) for row in values for n in row): raise ValueError('Non-finite geometry')
        self.cache[index] = values; return values

def convert(source, destination, sdk):
    glb = GLB(Path(source).read_bytes()); j = glb.json; api = API(sdk)
    model = api.create('SUModelCreate'); counters = {'meshes': 0, 'triangles': 0, 'textures': 0, 'faces': 0}
    try:
        with tempfile.TemporaryDirectory(prefix='kitchen-skp-') as folder:
            # Native texture loader needs temporary images. Only this generated folder is removed.
            folder = Path(folder).resolve()
            if folder.parent != Path(tempfile.gettempdir()).resolve(): raise ValueError('Unexpected temporary folder')
            materials = []
            for index, item in enumerate(j.get('materials', [])):
                material = api.create('SUMaterialCreate'); api.call('SUModelAddMaterials', model, 1, c.byref(material))
                api.call('SUMaterialSetName', material, f"{item.get('name', 'Material')[:100]}-{index}".encode())
                pbr = item.get('pbrMetallicRoughness', {}); color = pbr.get('baseColorFactor', [1, 1, 1, 1])
                if len(color) != 4 or not all(isinstance(n, (int,float)) and math.isfinite(n) and 0 <= n <= 1 for n in color): raise ValueError('Invalid material color')
                api.call('SUMaterialSetColor', material, c.byref(Color(*[srgb(n) for n in color[:3]], 255)))
                tex = pbr.get('baseColorTexture')
                if tex:
                    if tex.get('texCoord', 0) != 0 or tex.get('extensions'): raise ValueError('Unsupported UV transform')
                    image = j['images'][j['textures'][tex['index']]['source']]
                    if image.get('mimeType') != 'image/png': raise ValueError('Kitchen textures must be embedded PNG')
                    with Image.open(io.BytesIO(glb.view(image['bufferView']))) as original:
                        if original.width > 2048 or original.height > 2048: raise ValueError('Texture exceeds limit')
                        rgba = original.convert('RGBA'); channels = list(rgba.split())
                        for channel, factor in enumerate(color[:3]):
                            channels[channel] = channels[channel].point([srgb((v/255/12.92 if v/255 <= .04045 else ((v/255+.055)/1.055)**2.4)*factor) for v in range(256)])
                        target = folder / f'texture-{index}.png'; Image.merge('RGBA', channels).save(target)
                    texture = Ref(); api.call('SUTextureCreateFromFile', c.byref(texture), str(target).encode(), 1.0, 1.0)
                    api.call('SUMaterialSetTexture', material, texture); api.call('SUMaterialSetType', material, 1)
                    counters['textures'] += 1
                else: api.call('SUMaterialSetType', material, 0)
                api.call('SUMaterialSetUseOpacity', material, item.get('alphaMode') == 'BLEND')
                api.call('SUMaterialSetOpacity', material, color[3])
                for enabled, setter, key, default in [('SUMaterialSetRoughnessEnabled', 'SUMaterialSetRoughnessFactor', 'roughnessFactor', 1), ('SUMaterialSetMetalnessEnabled', 'SUMaterialSetMetallicFactor', 'metallicFactor', 1)]:
                    factor = pbr.get(key, default)
                    if not isinstance(factor, (int,float)) or not math.isfinite(factor) or not 0 <= factor <= 1: raise ValueError('Invalid PBR factor')
                    api.call(enabled, material, True); api.call(setter, material, factor)
                materials.append(material)
            entities = Ref(); api.call('SUModelGetEntities', model, c.byref(entities))
            seen = set()
            def node(index, parent, world, depth=0):
                if depth > 50 or index in seen: raise ValueError('Invalid scene graph')
                seen.add(index); item = j['nodes'][index]; world = multiply(world, matrix(item))
                group = api.create('SUGroupCreate'); api.call('SUEntitiesAddGroup', parent, group)
                api.call('SUGroupSetName', group, str(item.get('name', f'Part-{index}'))[:150].encode())
                contents = Ref(); api.call('SUGroupGetEntities', group, c.byref(contents))
                if 'mesh' in item:
                    for primitive in j['meshes'][item['mesh']]['primitives']:
                        if primitive.get('mode', 4) != 4 or primitive.get('targets') or primitive.get('extensions'): raise ValueError('Unsupported primitive')
                        positions = glb.accessor(primitive['attributes']['POSITION'])
                        indices = [v[0] for v in glb.accessor(primitive['indices'])] if 'indices' in primitive else list(range(len(positions)))
                        if len(indices) % 3 or not all(isinstance(i, int) and 0 <= i < len(positions) for i in indices): raise ValueError('Invalid triangles')
                        counters['triangles'] += len(indices)//3; counters['meshes'] += 1
                        if counters['triangles'] > 200000: raise ValueError('Too many triangles')
                        uv = glb.accessor(primitive['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in primitive['attributes'] else None
                        normals = glb.accessor(primitive['attributes']['NORMAL']) if 'NORMAL' in primitive['attributes'] else None
                        if (uv and len(uv) != len(positions)) or (normals and len(normals) != len(positions)): raise ValueError('Mismatched attributes')
                        geo = api.create('SUGeometryInputCreate')
                        try:
                            points = (Point * len(positions))(*[transform(world, v) for v in positions])
                            api.call('SUGeometryInputSetVertices', geo, len(points), points)
                            keys = [tuple(round(v, 6) for v in position + (normals[i] if normals else ())) for i, position in enumerate(positions)]
                            edges = {}
                            for start in range(0, len(indices), 3):
                                tri = indices[start:start+3]
                                for a,b in zip(tri, tri[1:]+tri[:1]):
                                    edge = tuple(sorted([keys[a],keys[b]])); edges[edge] = edges.get(edge, 0)+1
                            for start in range(0, len(indices), 3):
                                tri = indices[start:start+3]; loop = api.create('SULoopInputCreate')
                                try:
                                    for vertex in tri: api.call('SULoopInputAddVertexIndex', loop, vertex)
                                    for e, (a,b) in enumerate(zip(tri, tri[1:]+tri[:1])):
                                        if normals and edges[tuple(sorted([keys[a],keys[b]]))] == 2:
                                            api.call('SULoopInputEdgeSetSoft', loop, e, True); api.call('SULoopInputEdgeSetSmooth', loop, e, True)
                                    face = c.c_size_t(); api.call('SUGeometryInputAddFace', geo, c.byref(loop), c.byref(face))
                                finally:
                                    if loop.ptr: api.call('SULoopInputRelease', c.byref(loop))
                                if 'material' in primitive:
                                    mat = MaterialInput(); mat.material = materials[primitive['material']]
                                    if uv:
                                        mat.num_uv_coords = 3
                                        for t, vertex in enumerate(tri): mat.vertex_indices[t] = vertex; mat.uv_coords[t] = UV(uv[vertex][0], 1-uv[vertex][1])
                                    api.call('SUGeometryInputFaceSetFrontMaterial', geo, face, c.byref(mat))
                                    if j['materials'][primitive['material']].get('doubleSided'):
                                        api.call('SUGeometryInputFaceSetBackMaterial', geo, face, c.byref(mat))
                            api.call('SUEntitiesFill', contents, geo, True)
                        finally: api.call('SUGeometryInputRelease', c.byref(geo))
                    count = c.c_size_t(); api.call('SUEntitiesGetNumFaces', contents, c.byref(count)); counters['faces'] += count.value
                for child in item.get('children', []): node(child, contents, world, depth+1)
            for index in j['scenes'][j.get('scene', 0)]['nodes']: node(index, entities, IDENTITY)
            if not counters['faces']: raise ValueError('No exportable faces')
            destination = Path(destination).resolve()
            if destination.exists(): raise ValueError('Output already exists')
            api.call('SUModelSaveToFile', model, str(destination).encode())
            # Reopen with the native SDK, proving a real SKP was serialized.
            check = Ref(); api.call('SUModelCreateFromFile', c.byref(check), str(destination).encode()); api.call('SUModelRelease', c.byref(check))
            return counters
    finally:
        api.call('SUModelRelease', c.byref(model)); api.lib.SUTerminate()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('input'); parser.add_argument('output'); parser.add_argument('--sdk', default=os.environ.get('SKETCHUP_API_PATH'))
    args = parser.parse_args()
    if not args.sdk: parser.error('Set SKETCHUP_API_PATH to your licensed SDK library')
    print(json.dumps(convert(args.input, args.output, args.sdk)))
