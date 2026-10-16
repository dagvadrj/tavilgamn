"""Blender integration guards; run with --background --factory-startup --python-exit-code 1."""
import bpy
import bmesh
import importlib.util
import json
import sys,tempfile
from pathlib import Path
from types import SimpleNamespace
from mathutils import Vector

root=Path(__file__).resolve().parents[1]
file=root/'scripts/models/sofa-quality-bake.py'
spec=importlib.util.spec_from_file_location('sofa_quality_test',file)
quality=importlib.util.module_from_spec(spec);spec.loader.exec_module(quality)
bpy.ops.wm.read_factory_settings(use_empty=True)
from sofa_exterior import stitch_authored_seams
seams=bpy.data.meshes.new('Seam and opposite sheet guard')
seams.from_pydata([(0,0,0),(1,0,0),(1,1,0),(0,1,0),
    (1,0,0),(2,0,0),(2,1,0),(1,1,0),
    (0,0,0),(1,1,0),(1,0,0)],[],[(0,1,2,3),(4,5,6,7),(8,9,10)])
seams.update()
stitched=stitch_authored_seams(seams)
assert stitched['mergedVertices']==2, 'Only the co-oriented UV boundary should join'
assert len(seams.vertices)==9, 'Coincident opposite sheets must remain separate'
assert len(seams.polygons)==3
bpy.data.meshes.remove(seams)
grid=bpy.data.meshes.new('Open boundary guard')
topology=bmesh.new();bmesh.ops.create_grid(topology,x_segments=16,y_segments=16,size=1)
rim={tuple(round(c,7) for c in vertex.co) for edge in topology.edges if edge.is_boundary for vertex in edge.verts}
topology.to_mesh(grid);topology.free();grid.update()
for face in grid.polygons:face.use_smooth=True
authored_normal=(0,.3,.9539392014169457)
grid.normals_split_custom_set_from_vertices([authored_normal]*len(grid.vertices))
uv_layer=grid.uv_layers.new(name='OriginalUV')
for loop in grid.loops:
    position=grid.vertices[loop.vertex_index].co
    uv_layer.data[loop.index].uv=((position.x+1)/2,(position.y+1)/2)
plate=bpy.data.objects.new('Protected open plate',grid);bpy.context.scene.collection.objects.link(plate)
args=SimpleNamespace(exterior_only=True,keep_object=[],target_triangles=100,ratio=.4,samples=256,
                     max_error_mm=.1,weld_topology=False,protect_boundaries=True,keep_authored_surface=True)
low,attempts=quality.make_low(plate,args)
assert attempts[-1]['protectedVertices']>0
assert attempts[-1]['missingProtectedVertices']==0 and attempts[-1]['newGeometricOpenEdges']==0
remaining={tuple(round(c,7) for c in vertex.co) for vertex in low.data.vertices}
assert rim.issubset(remaining), 'Decimation must retain every protected open-rim position'
assert all((normal.vector-Vector(authored_normal)).length<.001
           for normal in low.data.corner_normals), 'Index-only rebuild must retain authored shading normals'
for loop in low.data.loops:
    position=low.data.vertices[loop.vertex_index].co
    assert (low.data.uv_layers.active.data[loop.index].uv-
            Vector(((position.x+1)/2,(position.y+1)/2))).length<.000001
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_cube_add(size=2)
outer=bpy.context.active_object
mesh=bmesh.new();mesh.from_mesh(outer.data)
bmesh.ops.subdivide_edges(mesh,edges=list(mesh.edges),cuts=8,use_grid_fill=True)
mesh.to_mesh(outer.data);mesh.free()
outer_triangles=quality.geometry.triangle_count(outer.data)
bpy.ops.mesh.primitive_cube_add(size=0.5)
inner=bpy.context.active_object
bpy.ops.object.select_all(action='DESELECT');outer.select_set(True);inner.select_set(True)
bpy.context.view_layer.objects.active=outer;bpy.ops.object.join()
positions=[tuple(v.co) for v in outer.data.vertices]
source_triangles=quality.geometry.triangle_count(outer.data)
args=SimpleNamespace(exterior_only=True,keep_object=[],target_triangles=1000,ratio=.4,samples=256,max_error_mm=.1)
low,attempts=quality.make_low(outer,args)
assert attempts[-1]['passed']
assert quality.geometry.triangle_count(low.data)==outer_triangles
assert source_triangles>outer_triangles
assert positions==[tuple(v.co) for v in outer.data.vertices]
assert attempts[-1]['surface']['maxMm']<.1

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=32,radius=1)
high=bpy.context.active_object
args=SimpleNamespace(exterior_only=False,low_mesh=None,ratio=.4,keep_object=[],samples=256,max_error_mm=.001,
                     rebake_uv=False,weld_topology=False,protect_boundaries=False)
low,attempts=quality.make_low(high,args)
assert not attempts[0]['passed']
assert attempts[-1]['ratio']==1 and attempts[-1]['passed']
assert quality.geometry.triangle_count(low.data)==quality.geometry.triangle_count(high.data)

namespace={'__file__':r'\Text.001','__name__':'virtual_text_test'}
scene_before=set(bpy.data.objects)
exec(compile(file.read_text(encoding='utf-8'),r'\Text.001','exec'),namespace)
assert namespace['HERE']==file.parent
assert set(bpy.data.objects)==scene_before
assert namespace['find_helper_directory'](r'\Text.001')==file.parent

with tempfile.TemporaryDirectory(prefix='sofa-cli-guard-') as temporary:
    source=Path(temporary)/'source.glb';source.write_bytes(b'glTF')
    previous_argv=sys.argv[:]
    try:
        sys.argv=['blender','--','--input',str(source),'--output',str(Path(temporary)/'new'),
                  '--exterior-only','--rebake-uv']
        parsed=quality.parse_args()
        assert parsed.weld_topology and parsed.protect_boundaries
        sys.argv.extend(['--no-weld-topology','--no-protect-boundaries'])
        parsed=quality.parse_args()
        assert not parsed.weld_topology and not parsed.protect_boundaries
        sys.argv=['blender','--','--input',str(source),'--output',str(Path(temporary)/'new'),
                  '--exterior-only','--keep-authored-surface']
        parsed=quality.parse_args()
        assert not parsed.weld_topology and parsed.protect_boundaries and not parsed.rebake_uv
        assert not parsed.generate_preview
        command,destination=quality.text_editor_command(str(source),temporary)
        assert '--keep-authored-surface' in command and '--no-weld-topology' in command
        assert '--protect-boundaries' in command
        assert command[command.index('--target-triangles')+1]=='70000'
        assert command[command.index('--orm-size')+1]=='2048'
        assert command[command.index('--orm-codec')+1]=='etc1s'
        assert not destination.exists()
    finally:sys.argv=previous_argv

print(json.dumps({'hiddenNestedGeometryRemoved':True,'originalInMemoryMeshPreserved':True,
    'geometryFallbackToOriginal':True,'virtualTextHelperLookup':True,
    'coOrientedSeamsStitchedOppositeSheetsPreserved':True,
    'openBoundaryCoordinatesPreserved':True,
    'authoredNormalsPreservedWithinPackedNormalPrecision':True,
    'originalUvRetainedWithoutProjection':True,
    'exteriorSeamProtectionDefaultsAndGuiRecipe':True}),flush=True)
