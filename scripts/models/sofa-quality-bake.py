"""Blender 5.x: quality-first static sofa GLB derivative, never edits the source.

Run with Blender --background --factory-startup --python-exit-code 1 --python
this_file.py -- --input source.glb --output NEW_DIRECTORY --ktx-bin KTX_DIRECTORY
Uses sibling sofa-quality-compress.mjs and installed project dependencies.
"""
import argparse
from datetime import datetime
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile
import traceback
import uuid

import bpy
from mathutils import Vector

# Blender Text Editor uses a virtual __file__ such as "\\Text.001".
# Keep these paths editable for a different machine/project location.
TEXT_EDITOR_PROJECT_ROOT = Path(r"C:\Users\HiTech\Desktop\ProjectN2")
TEXT_EDITOR_INPUT_GLB = ""  # Blank: use the single GLB in C:\GLB_BAKE\input.
TEXT_EDITOR_INPUT_FOLDER = Path(r"C:\GLB_BAKE\input")
TEXT_EDITOR_OUTPUT_ROOT = Path(r"C:\GLB_BAKE\output")
TEXT_EDITOR_EXTERIOR_ONLY = True  # Opaque static furniture; set False to retain all hidden geometry.
TEXT_EDITOR_REBAKE_SURFACE = False  # Keep source UV/PBR for Luna; rebaking needs separate visual approval.


def find_helper_directory(script_file=None, cwd=None, project_root=None):
    candidates = []
    if script_file and Path(script_file).is_file():
        candidates.append(Path(script_file).resolve().parent)
    configured = os.environ.get("SOFA_PROJECT_ROOT")
    for root in [configured, project_root or TEXT_EDITOR_PROJECT_ROOT]:
        if root:
            candidates.append(Path(root).expanduser().resolve() / "scripts/models")
    current = Path(cwd or Path.cwd()).resolve()
    for root in [current, *current.parents]:
        candidates.extend([root, root / "scripts/models"])
    for directory in candidates:
        if all((directory / name).is_file() for name in ["blender_batch.py", "sofa-quality-compress.mjs", "sofa_exterior.py", "sofa-simplify.mjs"]):
            return directory
    raise FileNotFoundError(
        "Sofa helpers were not found. Set TEXT_EDITOR_PROJECT_ROOT at the top "
        "of this script (or SOFA_PROJECT_ROOT) to the ProjectN2 folder. "
        "The Python script is not a single-file standalone tool."
    )


HERE = find_helper_directory(globals().get("__file__"))
sys.path.insert(0,str(HERE))
spec = importlib.util.spec_from_file_location("sofa_geometry_helpers", HERE / "blender_batch.py")
geometry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geometry)


def text_editor_command(input_glb=None, output_root=None):
    """Build a background job; no changes to the currently open Blender scene."""
    selected = input_glb or TEXT_EDITOR_INPUT_GLB
    if selected:
        source = Path(selected).expanduser().resolve(strict=True)
    else:
        files = sorted(p for p in TEXT_EDITOR_INPUT_FOLDER.glob("*") if p.is_file() and p.suffix.lower() == ".glb")
        if len(files) != 1:
            raise ValueError(
                f"Found {len(files)} GLBs in {TEXT_EDITOR_INPUT_FOLDER}. "
                "Set TEXT_EDITOR_INPUT_GLB at the top to the exact GLB path."
            )
        source = files[0].resolve()
    if source.suffix.lower() != ".glb":
        raise ValueError("Select a .glb input file")
    suffix = datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
    destination = Path(output_root or TEXT_EDITOR_OUTPUT_ROOT).expanduser().resolve() / f"{source.stem}_quality_{suffix}"
    command = [bpy.app.binary_path, "--background", "--factory-startup", "--python-exit-code", "1",
               "--python", str(HERE / "sofa-quality-bake.py"), "--", "--input", str(source),
               "--output", str(destination), "--ktx-bin", str(HERE.parents[1] / ".tools/ktx/bin"),
               "--geometry-codec", "meshopt", "--normal-size", "1024", "--orm-size", "512"]
    if TEXT_EDITOR_EXTERIOR_ONLY:
        command.extend(["--exterior-only","--protect-boundaries","--samples","8192"])
        if TEXT_EDITOR_REBAKE_SURFACE:
            command.extend(["--rebake-uv","--target-triangles","24000","--weld-topology",
                            "--margin","8","--cage-ratio","0.0005","--ray-ratio","0.002"])
        else:
            command.extend(["--keep-authored-surface","--no-weld-topology","--target-triangles","70000"])
            command[command.index('--orm-size')+1]='2048'
            command.extend(['--orm-codec','etc1s'])
    return command, destination


def start_text_editor_job(input_glb=None, output_root=None, notify=True):
    command, destination = text_editor_command(input_glb, output_root)
    if not Path(bpy.app.binary_path).is_file():
        raise FileNotFoundError("Blender executable path is unavailable")
    with tempfile.NamedTemporaryFile(prefix="sofa-quality-", suffix=".log", delete=False) as log:
        process = subprocess.Popen(command, cwd=str(HERE.parents[1]), stdout=log,
                                   stderr=subprocess.STDOUT,
                                   creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        log_path = Path(log.name)
    print(f"[sofa job] PID={process.pid}\nOutput: {destination}\nLog: {log_path}", flush=True)
    if notify and not bpy.app.background:
        def draw(menu, _context):
            menu.layout.label(text="Background bake started; current scene is unchanged.")
            menu.layout.label(text=f"Output: {destination}")
            menu.layout.label(text=f"Log: {log_path}")
        bpy.context.window_manager.popup_menu(draw, title="Sofa quality bake", icon="INFO")
    return process, destination, log_path


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def glb_json(path):
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF" or struct.unpack_from("<I", data, 4)[0] != 2:
        raise ValueError("Input must be binary glTF 2.0")
    length, kind = struct.unpack_from("<I4s", data, 12)
    if kind != b"JSON":
        raise ValueError("Missing GLB JSON chunk")
    return json.loads(data[20:20 + length])


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True, help="New output directory; existing outputs are refused")
    parser.add_argument("--ratio", type=float, default=0.4)
    parser.add_argument("--normal-size", type=int, default=2048)
    parser.add_argument("--color-size", type=int, default=2048)
    parser.add_argument("--orm-size", type=int, default=1024)
    parser.add_argument("--orm-codec",choices=['uastc','etc1s'],default='uastc')
    parser.add_argument("--color-quality", type=int, default=92)
    parser.add_argument("--profile", choices=["balanced", "gpu"], default="balanced")
    parser.add_argument("--geometry-codec", choices=["draco", "meshopt"], default="draco")
    parser.add_argument("--max-error-mm", type=float, default=2.0)
    parser.add_argument("--samples", type=int, default=4096, help="Surface samples in each direction, per mesh")
    parser.add_argument("--keep-object", action="append", default=[], help="Exact original mesh object name to retain without decimation")
    parser.add_argument("--cage-ratio", type=float, default=0.0018)
    parser.add_argument("--ray-ratio", type=float, default=0.0135)
    parser.add_argument("--margin", type=int, default=16)
    parser.add_argument("--rebake-uv", action="store_true", help="Repack low UVs and reproject color/roughness/metallic; one material per mesh only")
    parser.add_argument("--keep-authored-surface", action="store_true",
                        help="Keep original UV/PBR and shading normals; no projection or normal bake")
    parser.add_argument("--exterior-only", action="store_true", help="View-sampled removal of opaque static hidden surfaces; requires --rebake-uv and multi-view review")
    parser.add_argument("--target-triangles", type=int, help="Exterior mode target; quality gate can retain more")
    parser.add_argument("--generate-preview", action=argparse.BooleanOptionalAction, default=False,
                        help="Legacy opt-in only: generate a smaller texture preview with exactly the delivery geometry")
    parser.add_argument("--bake-ao", action=argparse.BooleanOptionalAction, default=True,
                        help="Reproject local occlusion into ORM red when rebuilding UVs")
    parser.add_argument("--ao-distance", type=float, default=0.12, help="Local occlusion radius in metres")
    parser.add_argument("--weld-topology", action=argparse.BooleanOptionalAction, default=None,
                        help="Stitch co-oriented coincident seams; enabled by default in exterior mode")
    parser.add_argument("--protect-boundaries", action=argparse.BooleanOptionalAction, default=None,
                        help="Lock geometric open borders; enabled by default in exterior mode")
    parser.add_argument("--low-mesh", type=Path, help="Optional artist/simplifier low GLB for a single-mesh source; checked against source before baking")
    parser.add_argument("--render-size", type=int, default=768)
    parser.add_argument("--render-samples", type=int, default=24)
    installed_node = Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "nodejs/node.exe"
    parser.add_argument("--node", default=shutil.which("node") or (str(installed_node) if installed_node.is_file() else None))
    parser.add_argument("--ktx-bin", type=Path, default=HERE.parents[1] / ".tools/ktx/bin")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    if args.weld_topology is None: args.weld_topology=args.exterior_only and not args.keep_authored_surface
    if args.protect_boundaries is None: args.protect_boundaries=args.exterior_only
    if any(not math.isfinite(v) for v in [args.ratio,args.max_error_mm,args.cage_ratio,args.ray_ratio]):
        parser.error("Numeric settings must be finite")
    if not 0 < args.ratio <= 1 or not 0 < args.max_error_mm <= 100:
        parser.error("ratio must be (0,1]; max-error-mm must be (0,100]")
    if args.samples < 256 or args.render_size < 128 or args.render_samples < 1:
        parser.error("samples>=256, render-size>=128, render-samples>=1 required")
    if args.margin < 0 or args.cage_ratio <= 0 or args.ray_ratio <= 0:
        parser.error("margin must be nonnegative; cage/ray ratios must be positive")
    if not math.isfinite(args.ao_distance) or not .005<=args.ao_distance<=.5:
        parser.error("ao-distance must be 0.005..0.5 metres")
    for size in [args.color_size, args.orm_size, args.normal_size]:
        if size not in [512, 1024, 2048, 4096]:
            parser.error("texture sizes must be 512/1024/2048/4096")
    if not 1 <= args.color_quality <= 100 or not args.node:
        parser.error("color-quality must be 1..100 and Node.js must be available")
    args.input = args.input.resolve(strict=True)
    if args.keep_authored_surface and (not args.exterior_only or args.rebake_uv or args.weld_topology):
        parser.error("--keep-authored-surface requires exterior mode without rebake-uv or topology welding")
    if args.exterior_only and (not (args.rebake_uv or args.keep_authored_surface) or args.low_mesh):
        parser.error("--exterior-only requires rebake-uv or keep-authored-surface and cannot use --low-mesh")
    if args.target_triangles is not None and (not args.exterior_only or args.target_triangles<1000):
        parser.error("--target-triangles >=1000 requires --exterior-only")
    if args.low_mesh:
        args.low_mesh = args.low_mesh.resolve(strict=True)
        low_metadata = glb_json(args.low_mesh)
        if low_metadata.get("skins") or low_metadata.get("animations") or any(
            p.get("targets") for m in low_metadata.get("meshes",[]) for p in m["primitives"]):
            parser.error("low-mesh must also be static")
    args.output = args.output.resolve()
    if args.output.exists():
        parser.error("Choose a NEW output directory; previous results are never overwritten")
    if args.input.suffix.lower() != ".glb":
        parser.error("Only static GLB input is supported")
    return args


def sampled_error(before, after, samples):
    surfaces = [geometry.mesh_surface(before), geometry.mesh_surface(after)]
    distances = []
    for source, target in [surfaces, surfaces[::-1]]:
        for point, _ in geometry.surface_samples(source[0], source[1], source[3], count=samples):
            hit = target[2].find_nearest(point)
            if hit[0] is None:
                raise ValueError("Cannot compare an empty surface")
            distances.append(float(hit[3]) * 1000)
    if not distances:
        raise ValueError("Degenerate surface")
    distances.sort()
    bounds = [[min(v[k] for v in s[0]) for k in range(3)] +
              [max(v[k] for v in s[0]) for k in range(3)] for s in surfaces]
    drift = max(abs(a-b) for a, b in zip(*bounds)) * 1000
    return {"sampleCount":len(distances), "p95Mm":distances[int((len(distances)-1)*0.95)],
            "maxMm":distances[-1], "boundsDriftMm":drift,
            "method":"deterministic bidirectional area-weighted surface sampling; not exhaustive or a shading/UV certificate"}


def make_low(high, args):
    if args.exterior_only:
        from sofa_exterior import make_candidate
        return make_candidate(high,args,geometry)
    if args.low_mesh:
        previous = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(args.low_mesh))
        candidates = [o for o in bpy.data.objects if o not in previous and o.type == "MESH"]
        if len(candidates) != 1:
            raise ValueError("low-mesh must contain exactly one mesh object")
        low = candidates[0]
        matrix = low.matrix_world.copy()
        low.parent = None
        low.matrix_world = matrix
        geometry.activate(low)
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        if len(low.data.uv_layers) != 1 or not low.data.materials:
            raise ValueError("low-mesh requires one UV set and explicit materials")
        error = sampled_error(high.data,low.data,args.samples)
        passed = (error["maxMm"] <= args.max_error_mm and error["p95Mm"] <= args.max_error_mm/2
                  and error["boundsDriftMm"] <= args.max_error_mm)
        if not passed:
            raise ValueError(f"Supplied low-mesh failed surface gate: {error}")
        return low,[{"source":str(args.low_mesh),"sourceSha256":sha(args.low_mesh),
                     "triangles":geometry.triangle_count(low.data),"surface":error,"passed":True}]
    low = high.copy()
    low.data = high.data.copy()
    low.parent = None
    low.matrix_world = high.matrix_world.copy()
    bpy.context.scene.collection.objects.link(low)
    low.name = high.name + "_DELIVERY"
    attempts = []
    ratios = sorted(set([args.ratio] + [r for r in [0.12, 0.2, 0.3, 0.4, 0.65, 0.85, 1.0] if r > args.ratio]))
    if high.name in args.keep_object or geometry.triangle_count(high.data) < 2000:
        ratios = [1.0]
    for ratio in ratios:
        previous = low.data
        low.data = high.data.copy()
        if previous.users == 0:
            bpy.data.meshes.remove(previous)
        geometry.activate(low)
        welded = 0
        if args.rebake_uv or args.weld_topology:
            # glTF splits vertices at UV/normal boundaries. Rebuild geometric
            # adjacency before simplification and charting, on the derivative only.
            import bmesh
            mesh = bmesh.new()
            mesh.from_mesh(low.data)
            mesh.verts.ensure_lookup_table()
            before_count = len(mesh.verts)
            # A scan can contain two coincident sides with opposite normals.
            # Position-only welding joins those sheets and creates folded faces.
            authored = {}
            for loop in low.data.loops:
                authored.setdefault(loop.vertex_index,low.data.corner_normals[loop.index].vector.copy())
            buckets = {}
            targets = {}
            for vertex in mesh.verts:
                key = tuple(round(value/0.000001) for value in vertex.co)
                group = buckets.setdefault(key,[])
                normal = authored.get(vertex.index,vertex.normal)
                match = next((other for other in group if normal.dot(authored.get(other.index,other.normal)) > 0.996),None)
                if match is None: group.append(vertex)
                else: targets[vertex] = match
            bmesh.ops.weld_verts(mesh,targetmap=targets)
            welded = before_count - len(mesh.verts)
            mesh.to_mesh(low.data)
            mesh.free()
        protected = 0
        if args.protect_boundaries:
            import bmesh
            topology = bmesh.new()
            topology.from_mesh(low.data)
            topology.verts.ensure_lookup_table()
            pinned = {v.index for edge in topology.edges if not edge.is_manifold for v in edge.verts}
            # Keep a one-ring collar so adjacent collapses cannot fold the opening.
            pinned |= {other.index for vertex in topology.verts if vertex.index in pinned
                       for edge in vertex.link_edges for other in edge.verts}
            topology.free()
            protected = len(pinned)
            group = low.vertex_groups.get("DeliveryCollapsible") or low.vertex_groups.new(name="DeliveryCollapsible")
            group.add([v.index for v in low.data.vertices],1.0,"REPLACE")
            if pinned: group.add(list(pinned),0.0,"REPLACE")
        if ratio < 1:
            modifier = low.modifiers.new("Quality candidate", "DECIMATE")
            modifier.decimate_type = "COLLAPSE"
            modifier.ratio = ratio
            modifier.use_collapse_triangulate = True
            if args.protect_boundaries:
                modifier.vertex_group = group.name
                modifier.vertex_group_factor = 1
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        validated = low.data.validate(verbose=False, clean_customdata=False)
        low.data.update()
        count = geometry.triangle_count(low.data)
        if count == 0:
            raise ValueError(f"{high.name}: empty decimated mesh")
        error = sampled_error(high.data, low.data, args.samples)
        passed = (error["maxMm"] <= args.max_error_mm and
                  error["p95Mm"] <= args.max_error_mm/2 and
                  error["boundsDriftMm"] <= args.max_error_mm)
        attempts.append({"ratio":ratio,"triangles":count,"weldedVertices":welded,"protectedVertices":protected,"meshValidationRepaired":validated,"surface":error,"passed":passed})
        if passed:
            return low, attempts
    raise ValueError(f"{high.name}: no geometry candidate passed, including original")


def bake(high, low, diagonal, args, folder, index):
    # Reuse existing material/UV helper; actual source remains the imported high object.
    images = geometry.prepare_normal_bake_target(low, "sofa", args.normal_size)
    # The existing helper connects the destination image immediately. Disconnect
    # that input while baking to avoid reading the same image we are writing.
    normal_links = []
    for material in low.data.materials:
        for node in material.node_tree.nodes:
            if node.type == "BSDF_PRINCIPLED":
                for link in list(node.inputs["Normal"].links):
                    normal_links.append((material,link.from_socket,link.to_socket))
                    material.node_tree.links.remove(link)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    for obj in scene.objects:
        if obj.type == "MESH":
            obj.hide_render = obj not in [high, low]
    high.hide_render = low.hide_render = False
    bpy.ops.object.select_all(action="DESELECT")
    high.select_set(True)
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    cage = max(diagonal * args.cage_ratio, 0.0001)
    ray = max(diagonal * args.ray_ratio, 0.001)
    bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT", use_selected_to_active=True,
                        use_clear=True, cage_extrusion=cage, max_ray_distance=ray, margin=args.margin)
    for material, source, target in normal_links:
        material.node_tree.links.new(source,target)
    outputs = []
    for slot, image in enumerate(images):
        destination = folder / f"normal-{index}-{slot}.png"
        image.filepath_raw = str(destination)
        image.file_format = "PNG"
        image.save()
        image.pack()
        outputs.append(destination.name)
    return {"maps":outputs,"size":args.normal_size,"cageExtrusionM":cage,
            "maxRayDistanceM":ray,"marginPixels":args.margin,"space":"TANGENT"}


def repack_material(high, low, diagonal, args, folder, index):
    """Build a coherent low-mesh atlas; source UVs/materials remain untouched."""
    import numpy as np
    if len(high.data.materials) != 1:
        raise ValueError("--rebake-uv currently supports one core PBR material per mesh")
    original_material = high.data.materials[0]
    principled = next((n for n in original_material.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if principled is None:
        raise ValueError("--rebake-uv requires a Principled PBR source")
    low_material = original_material.copy()
    low.data.materials[0] = low_material
    geometry.activate(low)
    for layer in list(low.data.uv_layers):
        low.data.uv_layers.remove(layer)
    low.data.uv_layers.new(name="DeliveryUV")
    low.data.uv_layers.active_index = 0
    low.data.uv_layers[0].active_render = True
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    margin_fraction = 0.002
    try:
        bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=margin_fraction,
                                 margin_method="FRACTION",scale_to_bounds=True)
        bpy.ops.uv.pack_islands(rotate=True,rotate_method="ANY",scale=True,
            margin_method="FRACTION",margin=margin_fraction,shape_method="CONCAVE")
    finally:
        bpy.ops.object.mode_set(mode="OBJECT")
    low.data.calc_loop_triangles()
    uv = low.data.uv_layers.active.data
    uv_area = sum(abs((uv[t.loops[1]].uv-uv[t.loops[0]].uv).cross(
        uv[t.loops[2]].uv-uv[t.loops[0]].uv))/2 for t in low.data.loop_triangles)
    print("[UV]", len(low.data.vertices), "vertices, occupied area", uv_area, flush=True)
    if uv_area < 0.05 or uv_area > 1.001:
        raise ValueError(f"UV charting produced an unusable atlas (area={uv_area})")
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    for obj in scene.objects:
        if obj.type == "MESH":
            obj.hide_render = obj not in [high,low]
    bpy.ops.object.select_all(action="DESELECT")
    high.select_set(True)
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    images = {}
    try:
        roles = [
            ("color","Base Color",args.color_size,"sRGB"),
            ("roughness","Roughness",max(1024,args.orm_size),"Non-Color"),
            ("metallic","Metallic",max(1024,args.orm_size),"Non-Color"),
        ]
        if args.bake_ao: roles.append(("ao",None,max(1024,args.orm_size),"Non-Color"))
        for role, socket_name, size, color_space in roles:
            source_material = original_material.copy()
            high.data.materials[0] = source_material
            source_bsdf = next(n for n in source_material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            emission = source_material.node_tree.nodes.new("ShaderNodeEmission")
            source_socket = source_bsdf.inputs[socket_name] if socket_name else None
            if role == "ao":
                occlusion = source_material.node_tree.nodes.new("ShaderNodeAmbientOcclusion")
                occlusion.inputs["Distance"].default_value = args.ao_distance
                occlusion.only_local = True
                occlusion.samples = 32
                source_material.node_tree.links.new(occlusion.outputs["AO"],emission.inputs["Color"])
            elif source_socket.is_linked:
                source_material.node_tree.links.new(source_socket.links[0].from_socket,emission.inputs["Color"])
            else:
                value = source_socket.default_value
                emission.inputs["Color"].default_value = tuple(value) if role == "color" else (value,value,value,1)
            output = next(n for n in source_material.node_tree.nodes if n.type == "OUTPUT_MATERIAL" and n.is_active_output)
            source_material.node_tree.links.new(emission.outputs[0],output.inputs["Surface"])
            image = bpy.data.images.new(f"delivery_{role}_{index}",width=size,height=size,alpha=True)
            image.colorspace_settings.name = color_space
            image.generated_color = (0,0,0,0)
            node = low_material.node_tree.nodes.new("ShaderNodeTexImage")
            node.image = image
            for other in low_material.node_tree.nodes:
                other.select = False
            node.select = True
            low_material.node_tree.nodes.active = node
            print("[material bake]",role,flush=True)
            bpy.ops.object.bake(type="EMIT",use_selected_to_active=True,use_clear=True,
                cage_extrusion=max(diagonal*args.cage_ratio,0.0001),
                max_ray_distance=max(diagonal*args.ray_ratio,0.001),margin=args.margin)
            images[role] = image
            high.data.materials[0] = original_material
            bpy.data.materials.remove(source_material)
    finally:
        high.data.materials[0] = original_material
    size = max(1024,args.orm_size)
    roughness = np.empty(size*size*4,dtype=np.float32)
    metallic = np.empty_like(roughness)
    images["roughness"].pixels.foreach_get(roughness)
    images["metallic"].pixels.foreach_get(metallic)
    pixels = np.zeros((size*size,4),dtype=np.float32)
    if args.bake_ao:
        ao = np.empty_like(roughness)
        images["ao"].pixels.foreach_get(ao)
        pixels[:,0] = ao.reshape(-1,4)[:,0]
    else:
        pixels[:,0] = 1
    pixels[:,1] = roughness.reshape(-1,4)[:,0]
    pixels[:,2] = metallic.reshape(-1,4)[:,0]
    pixels[:,3] = 1
    orm = bpy.data.images.new(f"delivery_orm_{index}",width=size,height=size,alpha=False)
    orm.colorspace_settings.name = "Non-Color"
    orm.pixels.foreach_set(pixels.ravel())
    orm.update()
    target = next(n for n in low_material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    for socket_name in ["Base Color","Roughness","Metallic"]:
        for link in list(target.inputs[socket_name].links):
            low_material.node_tree.links.remove(link)
    color_node = low_material.node_tree.nodes.new("ShaderNodeTexImage")
    color_node.image = images["color"]
    orm_node = low_material.node_tree.nodes.new("ShaderNodeTexImage")
    orm_node.image = orm
    split = low_material.node_tree.nodes.new("ShaderNodeSeparateColor")
    low_material.node_tree.links.new(color_node.outputs["Color"],target.inputs["Base Color"])
    low_material.node_tree.links.new(orm_node.outputs["Color"],split.inputs["Color"])
    low_material.node_tree.links.new(split.outputs["Green"],target.inputs["Roughness"])
    low_material.node_tree.links.new(split.outputs["Blue"],target.inputs["Metallic"])
    if args.bake_ao:
        from io_scene_gltf2.blender.com.material_helpers import create_settings_group, get_gltf_node_name
        output = low_material.node_tree.nodes.new("ShaderNodeGroup")
        name = get_gltf_node_name()
        output.node_tree = bpy.data.node_groups.get(name) or create_settings_group(name)
        low_material.node_tree.links.new(split.outputs["Red"],output.inputs["Occlusion"])
    for role, image in [("color",images["color"]),("orm",orm)]:
        image.filepath_raw = str(folder/f"{role}-{index}.png")
        image.file_format = "PNG"
        image.save()
        image.pack()
    # Unused bake targets and old image nodes must not become exported textures.
    for node in list(low_material.node_tree.nodes):
        if node.type == "TEX_IMAGE" and not any(socket.is_linked for socket in node.outputs):
            low_material.node_tree.nodes.remove(node)
    return {"repacked":True,"angleDegrees":66,"uvMarginFraction":margin_fraction,
            "colorSize":args.color_size,"ormBakeSize":size,"normalSize":args.normal_size,
            "aoRadiusM":args.ao_distance if args.bake_ao else None,
            "method":"selected-to-active emission reprojection; linear R local occlusion/G roughness/B metallic packing"}


def render_review(groups, bounds, args, folder):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = args.render_samples
    scene.cycles.seed = 123
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 4
    scene.render.resolution_x = args.render_size
    scene.render.resolution_y = round(args.render_size*5/6)
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = 0
    world = bpy.data.worlds.new("Quality review world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.2,0.2,0.2,1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.5
    scene.world = world
    center = (bounds[0]+bounds[1])/2
    size = bounds[1]-bounds[0]
    span = max(size.x,size.y,size.z,0.01)
    def aim(obj):
        obj.rotation_euler = (center-obj.location).to_track_quat("-Z","Y").to_euler()
    for name, offset, energy in [("Key",(-1.1,1,1.4),450),("Fill",(1,-0.9,1),200)]:
        data = bpy.data.lights.new(name,"AREA")
        data.energy = energy*span*span/4
        data.shape = "DISK"
        data.size = span*1.2
        obj = bpy.data.objects.new(name,data)
        scene.collection.objects.link(obj)
        obj.location = center + Vector(offset)*span
        aim(obj)
    data = bpy.data.cameras.new("Quality camera")
    camera = bpy.data.objects.new("Quality camera",data)
    scene.collection.objects.link(camera)
    data.type = "ORTHO"
    data.ortho_scale = span*1.3
    scene.camera = camera
    outputs = []
    all_meshes = [o for o in scene.objects if o.type == "MESH"]
    for label, objects in groups:
        for obj in all_meshes:
            obj.hide_render = obj not in objects
        for view, offset in [("front",(0.3,-1.5,0.425)),("back",(0.3,1.5,0.425)),
                             ("left",(-1.5,0.3,0.425)),("right",(1.5,-0.3,0.425))]:
            camera.location = center + Vector(offset)*span
            aim(camera)
            scene.render.filepath = str(folder/f"{label}-{view}.png")
            print("[review]",label,view,flush=True)
            bpy.ops.render.render(write_still=True)
            outputs.append({"variant":label,"view":view,"file":Path(scene.render.filepath).name})
    return outputs


def main():
    args = parse_args()
    original_hash = sha(args.input)
    metadata = glb_json(args.input)
    if args.rebake_uv and any(m.get("emissiveTexture") or m.get("occlusionTexture") or m.get("extensions")
                             for m in metadata.get("materials",[])):
        raise ValueError("UV reprojection currently supports core color/metallic/roughness/normal only; source AO/emissive textures and material extensions require a separate bake")
    if args.exterior_only and any(m.get("alphaMode","OPAQUE")!="OPAQUE" or
        m.get("extensions",{}).get("KHR_materials_transmission",{}).get("transmissionFactor",0)>0
        for m in metadata.get("materials",[])):
        raise ValueError("Exterior extraction refuses transparent/transmissive materials")
    if metadata.get("animations") or metadata.get("skins") or any(
        p.get("targets") for m in metadata.get("meshes",[]) for p in m["primitives"]):
        raise ValueError("Static furniture only; rigged/animated/morph assets are refused")
    if any(i.get("mimeType") == "image/ktx2" for i in metadata.get("images",[])):
        raise ValueError("Use the high-quality PNG/JPEG/WebP source; Blender KTX2 import is not supported here")
    if not args.ktx_bin.is_dir():
        raise ValueError("KTX tools directory not found; specify --ktx-bin")
    args.output.mkdir(parents=True,exist_ok=False)
    report = {"source":str(args.input),"sourceSha256":original_hash,"sourceBytes":args.input.stat().st_size,
              "blender":bpy.app.version_string,"settings":{k:str(v) if isinstance(v,Path) else v for k,v in vars(args).items()},
              "status":"running","objects":[],"visualApproval":"required; generated renders are evidence, not automatic approval"}
    report_file = args.output/"bake-report.json"
    try:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(args.input))
        highs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
        if not highs:
            raise ValueError("No mesh found")
        if args.low_mesh and len(highs) != 1:
            raise ValueError("--low-mesh currently supports one source mesh only")
        for obj in highs:
            if obj.data.shape_keys or obj.find_armature() or len(obj.data.uv_layers) != 1:
                raise ValueError(f"{obj.name}: static meshes with exactly one UV set are currently required")
            if not obj.data.materials or any(m is None for m in obj.data.materials):
                raise ValueError(f"{obj.name}: explicit materials required")
            matrix = obj.matrix_world.copy()
            obj.parent = None
            obj.matrix_world = matrix
            geometry.activate(obj)
            bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        points = [v.co.copy() for o in highs for v in o.data.vertices]
        bounds = [Vector([min(p[k] for p in points) for k in range(3)]),
                  Vector([max(p[k] for p in points) for k in range(3)])]
        diagonal = (bounds[1]-bounds[0]).length
        del points
        report["originalTriangles"] = sum(geometry.triangle_count(o.data) for o in highs)
        lows=[]
        for index, high in enumerate(highs):
            print("[candidate]",high.name,flush=True)
            low, attempts = make_low(high,args)
            material_bake = repack_material(high,low,diagonal,args,args.output,index) if args.rebake_uv else None
            print("[bake]",high.name,"triangles",geometry.triangle_count(low.data),flush=True)
            baked = ({'skipped':True,'reason':'Preserve original UV/PBR and authored vertex normals'}
                     if args.keep_authored_surface else bake(high,low,diagonal,args,args.output,index))
            report["objects"].append({"name":high.name,"attempts":attempts,"bake":baked,
                "materialBake":material_bake})
            lows.append(low)
        report["deliveryTrianglesBeforeCompression"] = sum(geometry.triangle_count(o.data) for o in lows)
        bpy.ops.object.select_all(action="DESELECT")
        for obj in lows:
            obj.hide_render=False
            obj.select_set(True)
        bpy.context.view_layer.objects.active=lows[0]
        intermediate=args.output/"baked-source.glb"
        bpy.ops.export_scene.gltf(filepath=str(intermediate),export_format="GLB",use_selection=True,
            export_materials="EXPORT",export_texcoords=True,export_normals=True,export_tangents=True,
            export_image_format="AUTO",export_animations=False,export_draco_mesh_compression_enable=False)
        env=os.environ.copy()
        env["PATH"]=str(args.ktx_bin.resolve())+os.pathsep+env.get("PATH","")
        command=[args.node,str(HERE/"sofa-quality-compress.mjs"),"--input",str(intermediate),
            "--output",str(args.output/"delivery.glb"),"--color-size",str(args.color_size),
            "--orm-size",str(args.orm_size),"--normal-size",str(args.normal_size),
            "--orm-codec",args.orm_codec,
            "--color-quality",str(args.color_quality),"--profile",args.profile,"--codec",args.geometry_codec]
        if args.rebake_uv and args.bake_ao:
            command.extend(["--local-ao-radius",str(args.ao_distance)])
        subprocess.run(command,check=True,env=env,cwd=str(HERE.parents[1]))
        if args.generate_preview:
            preview_folder = args.output/"preview"
            preview_folder.mkdir()
            preview_command = command[:]
            for flag,value in [("--output",str(preview_folder/"delivery.glb")),
                ("--color-size",str(min(args.color_size,1024))),
                ("--normal-size",str(min(args.normal_size,512))),
                ("--orm-size",str(min(args.orm_size,512)))]:
                preview_command[preview_command.index(flag)+1] = value
            subprocess.run(preview_command,check=True,env=env,cwd=str(HERE.parents[1]))
            delivery_info=json.loads((args.output/"compression-report.json").read_text(encoding="utf-8"))
            preview_info=json.loads((preview_folder/"compression-report.json").read_text(encoding="utf-8"))
            if delivery_info["geometrySha256"]!=preview_info["geometrySha256"]:
                raise ValueError("Preview geometry differs from delivery; motion-safe pair refused")
            shutil.copyfile(preview_folder/"delivery.glb",args.output/"preview.glb")
            report["preview"] = {"file":"preview.glb","bytes":(args.output/"preview.glb").stat().st_size,
                                 "sha256":sha(args.output/"preview.glb"),"geometry":"same baked source as delivery; texture budgets only"}
            report["preview"]["geometrySha256"]=preview_info["geometrySha256"]
        # Compressed geometry and textures are decoded into a review GLB by the helper.
        # RGBA texture review precedes hardware-specific GPU transcoding, not browser proof.
        previous=set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(args.output/"delivery-review.glb"))
        final=[o for o in bpy.data.objects if o not in previous and o.type=="MESH"]
        if not final:
            raise ValueError("Compressed output cannot be imported for review")
        groups = [("original",highs),("baked",lows),("compressed",final)]
        if args.generate_preview:
            previous=set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=str(args.output/"preview/delivery-review.glb"))
            preview_objects=[o for o in bpy.data.objects if o not in previous and o.type=="MESH"]
            if not preview_objects: raise ValueError("Preview read-back failed")
            groups.append(("preview",preview_objects))
        report["reviewRenders"]=render_review(groups,bounds,args,args.output)
        report["deliveryBytes"]=(args.output/"delivery.glb").stat().st_size
        report["status"]="ready-for-visual-review"
    except Exception as error:
        report["status"]="failed"
        report["error"]=str(error)
        raise
    finally:
        report["sourceUnchanged"]=sha(args.input)==original_hash
        report_file.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        if not report["sourceUnchanged"]:
            raise RuntimeError("Source hash changed during processing")
    print("[complete]",report["deliveryBytes"],"bytes; review required:",args.output,flush=True)


if __name__ == "__main__":
    try:
        if not bpy.app.background:
            # Run Script in Text Editor: keep the open scene and do the work in
            # a separate background Blender, using the tested compact profile.
            _sofa_background_job = start_text_editor_job()
        else:
            main()
    except Exception:
        traceback.print_exc()
        raise
