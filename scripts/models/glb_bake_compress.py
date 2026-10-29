"""Blender 4.2+/5.x: high-poly GLB -> low-poly web GLB with baked textures.

Хийх ажил (source файлыг хэзээ ч өөрчлөхгүй):
  1. Бүх mesh-ийг нэг "high" болгож нэгтгэнэ (transform apply).
  2. Copy-г weld хийгээд --target-triangles хүртэл decimate хийнэ ("low").
  3. Low дээр шинэ UV (Smart UV Project) үүсгэнэ.
  4. High -> low руу Cycles selected-to-active bake:
       base color (JPG), tangent normal (PNG/JPG), roughness (байвал).
  5. Хоёр GLB гаргана:
       web.glb      – web-д upload хийх шахагдсан хувилбар
       preview.glb  – ORIGINAL ба COMPRESSED-ийг зэрэгцүүлсэн, Blender-т
                      нүдээр харьцуулах зориулалттай (upload хийхгүй)
     мөн textures/, renders/compare-*.png, report.json.

blender --background --factory-startup --python-exit-code 1 \
    --python scripts/models/glb_bake_compress.py -- \
    --input C:/glb-test/input --output C:/glb-test/output --target-triangles 6000
"""

import argparse
import json
import math
from pathlib import Path
import random
import sys
import time
import traceback

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree


def log(message):
    print(f"[bake-compress] {message}", flush=True)


def activate(obj, *others):
    bpy.ops.object.select_all(action="DESELECT")
    for other in others:
        other.select_set(True)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def triangle_count(mesh):
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def world_bounds(objects):
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in objects
        for corner in obj.bound_box
    ]
    minimum = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    maximum = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    return minimum, maximum


# --------------------------------------------------------------------------
# Import / high / low
# --------------------------------------------------------------------------

def import_source(source):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))

    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        raise ValueError("Mesh олдсонгүй")
    if any(
        o.data.shape_keys or any(m.type == "ARMATURE" for m in o.modifiers)
        for o in meshes
    ):
        raise ValueError("Skinned/morph asset-ийг энэ pipeline дэмжихгүй")
    return meshes


def build_high(meshes):
    """Copy every mesh into world space and join into one object."""

    depsgraph = bpy.context.evaluated_depsgraph_get()
    copies = []
    for obj in meshes:
        data = bpy.data.meshes.new_from_object(
            obj.evaluated_get(depsgraph), depsgraph=depsgraph
        )
        data.transform(obj.matrix_world)
        copy = bpy.data.objects.new(f"HIGH_{obj.name}", data)
        bpy.context.scene.collection.objects.link(copy)
        copies.append(copy)

    activate(copies[0], *copies)
    if len(copies) > 1:
        bpy.ops.object.join()
    high = bpy.context.view_layer.objects.active
    high.name = "HIGH"
    return high


def warn_unsupported_materials(high):
    warnings = []
    for material in high.data.materials:
        if not material or not material.use_nodes:
            continue
        for node in material.node_tree.nodes:
            if node.type != "BSDF_PRINCIPLED":
                continue
            if node.inputs["Metallic"].is_linked:
                warnings.append(
                    f"{material.name}: metallic texture bake хийгдэхгүй, "
                    "дундаж утга ашиглана"
                )
            if node.inputs["Alpha"].is_linked or node.inputs["Alpha"].default_value < 1:
                warnings.append(f"{material.name}: alpha/transparency алдагдана")
    return warnings


def principled_inputs(high):
    """Constant metallic/roughness fallback and whether roughness is textured."""

    metallic = []
    roughness = []
    roughness_textured = False
    for material in high.data.materials:
        if not material or not material.use_nodes:
            continue
        for node in material.node_tree.nodes:
            if node.type == "BSDF_PRINCIPLED":
                metallic.append(node.inputs["Metallic"].default_value)
                roughness.append(node.inputs["Roughness"].default_value)
                roughness_textured |= node.inputs["Roughness"].is_linked
    average = lambda values, fallback: sum(values) / len(values) if values else fallback
    return average(metallic, 0.0), average(roughness, 0.5), roughness_textured


def build_low(high, target, diagonal, voxel_ratio):
    data = high.data.copy()
    low = bpy.data.objects.new("COMPRESSED", data)
    bpy.context.scene.collection.objects.link(low)

    # glTF import нь UV/normal заадал бүр дээр vertex-ийг салгадаг.
    # Weld хийхгүй бол decimate заадлаар нүх гаргана. UV-г дахин үүсгэх
    # тул хуучин UV алдагдах нь асуудалгүй.
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=diagonal * 1e-5)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=diagonal * 1e-6)
    bm.to_mesh(data)
    bm.free()

    for layer in list(data.uv_layers):
        data.uv_layers.remove(layer)
    for attribute in list(data.color_attributes):
        data.color_attributes.remove(attribute)
    data.materials.clear()

    # Scan/AI mesh-д давхцсан, дотоод, нээлттэй гадаргуу ихтэй тул шууд
    # collapse хийхэд эвдэрдэг. Voxel remesh нь нэг битүү гадаргуу үүсгэж,
    # decimate-ийг найдвартай болгоно. Нарийн хэсэг (< voxel) алдагдаж болно.
    if voxel_ratio:
        activate(low)
        remesh = low.modifiers.new("remesh", "REMESH")
        remesh.mode = "VOXEL"
        remesh.voxel_size = diagonal * voxel_ratio
        remesh.adaptivity = 0.0
        bpy.ops.object.modifier_apply(modifier=remesh.name)
        log(f"voxel remesh {diagonal * voxel_ratio * 1000:.1f}mm: {triangle_count(low.data):,} tri")

    # Нэг collapse pass хэт бага ratio дээр зогсдог (Luna: 297k -> 19k).
    # Үр дүн дээр нь дахин дахин collapse хийж target-д хүргэнэ.
    count = triangle_count(data)
    for _ in range(10):
        if count <= target * 1.02:
            break
        activate(low)
        modifier = low.modifiers.new("decimate", "DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = max(0.0001, min(1.0, target / count * 0.98))
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        previous, count = count, triangle_count(low.data)
        log(f"decimate pass: {previous:,} -> {count:,}")
        if count > previous * 0.99:
            log(f"WARNING decimate {count:,}-д зогсов, target {target:,} хүрсэнгүй")
            break

    if not count:
        raise ValueError("Decimate бүх face-ийг устгасан")

    low.data.shade_smooth()
    return low, count


def unwrap(low, margin):
    low.data.uv_layers.new(name="UVMap")
    activate(low)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(
        angle_limit=math.radians(66),
        island_margin=margin,
        area_weight=0.0,
        correct_aspect=True,
        scale_to_bounds=False,
    )
    bpy.ops.uv.pack_islands(rotate=True, margin=margin)
    bpy.ops.object.mode_set(mode="OBJECT")


# --------------------------------------------------------------------------
# Measurement
# --------------------------------------------------------------------------

def bvh_of(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    vertices = [obj.matrix_world @ v.co for v in mesh.vertices]
    triangles = [tuple(t.vertices) for t in mesh.loop_triangles]
    return vertices, BVHTree.FromPolygons(vertices, triangles, all_triangles=True)


def surface_error(high, low, samples=20000):
    """Two-way vertex-to-surface distance in model units (glTF = metres)."""

    rng = random.Random(7)
    high_vertices, high_tree = bvh_of(high)
    low_vertices, low_tree = bvh_of(low)

    def distances(points, tree):
        chosen = points if len(points) <= samples else rng.sample(points, samples)
        return sorted(tree.find_nearest(p)[3] for p in chosen)

    # high->low нь харагдахгүй дотоод гадаргууг ч тоолж хөөрөгддөг тул
    # bake cage-д зөвхөн low->high (shell хэр зөрсөн) ашиглана.
    low_to_high = distances(low_vertices, high_tree)
    values = sorted(distances(high_vertices, low_tree) + low_to_high)
    pick = lambda items, q: items[int((len(items) - 1) * q)]
    return {
        "p50": pick(values, 0.5),
        "p95": pick(values, 0.95),
        "p99": pick(values, 0.99),
        "max": values[-1],
        "lowToHighP95": pick(low_to_high, 0.95),
    }


# --------------------------------------------------------------------------
# Bake
# --------------------------------------------------------------------------

def new_image(name, size, color, non_color):
    image = bpy.data.images.new(name, width=size, height=size, alpha=False)
    image.generated_color = color
    image.colorspace_settings.name = "Non-Color" if non_color else "sRGB"
    return image


def build_low_material(low, color_size, normal_size, roughness_size, metallic, roughness):
    material = bpy.data.materials.new("COMPRESSED_baked")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness

    color = nodes.new("ShaderNodeTexImage")
    color.image = new_image("baked_color", color_size, (0.5, 0.5, 0.5, 1), False)
    links.new(color.outputs["Color"], principled.inputs["Base Color"])

    normal = nodes.new("ShaderNodeTexImage")
    normal.image = new_image("baked_normal", normal_size, (0.5, 0.5, 1, 1), True)
    normal_map = nodes.new("ShaderNodeNormalMap")
    links.new(normal.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])

    rough = None
    if roughness_size:
        rough = nodes.new("ShaderNodeTexImage")
        rough.image = new_image("baked_roughness", roughness_size, (roughness,) * 3 + (1,), True)
        # glTF roughness = metallicRoughness texture-ийн G channel.
        separate = nodes.new("ShaderNodeSeparateColor")
        links.new(rough.outputs["Color"], separate.inputs["Color"])
        links.new(separate.outputs["Green"], principled.inputs["Roughness"])

    low.data.materials.append(material)
    return material, {"color": color, "normal": normal, "roughness": rough}


def bake(kind, node, material, high, low, extrusion, ray, margin, samples):
    started = time.time()
    scene = bpy.context.scene
    scene.cycles.samples = samples
    nodes = material.node_tree.nodes
    for other in nodes:
        other.select = False
    node.select = True
    nodes.active = node

    activate(low, high)
    settings = dict(
        type=kind,
        use_selected_to_active=True,
        cage_extrusion=extrusion,
        max_ray_distance=ray,
        margin=margin,
        margin_type="EXTEND",
        use_clear=True,
    )
    if kind == "DIFFUSE":
        settings["pass_filter"] = {"COLOR"}
    if kind == "NORMAL":
        settings.update(normal_space="TANGENT")
    bpy.ops.object.bake(**settings)
    log(f"bake {kind}: {time.time() - started:.1f}s")


def bake_input_as_emission(input_name, node, material, high, low, extrusion, ray, margin, samples):
    """Bake a Principled input exactly, by routing it through Emission.

    DIFFUSE/COLOR bake нь Principled v2-ийн specular энергийг хасдаг тул
    base color 5-10% бараан гардаг. Emission нь утгыг өөрчлөхгүй.
    """

    restore = []
    for source in high.data.materials:
        if not source or not source.use_nodes:
            continue
        tree = source.node_tree
        principled = next((n for n in tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        output = next(
            (n for n in tree.nodes if n.type == "OUTPUT_MATERIAL" and n.is_active_output),
            None,
        )
        if principled is None or output is None:
            continue
        socket = principled.inputs[input_name]
        emission = tree.nodes.new("ShaderNodeEmission")
        emission.inputs["Strength"].default_value = 1.0
        if socket.is_linked:
            tree.links.new(socket.links[0].from_socket, emission.inputs["Color"])
        else:
            value = socket.default_value
            emission.inputs["Color"].default_value = (
                tuple(value) if hasattr(value, "__len__") else (value, value, value, 1.0)
            )
        surface = output.inputs["Surface"]
        previous = surface.links[0].from_socket if surface.is_linked else None
        tree.links.new(emission.outputs["Emission"], surface)
        restore.append((tree, emission, previous, surface))

    try:
        bake("EMIT", node, material, high, low, extrusion, ray, margin, samples)
    finally:
        for tree, emission, previous, surface in restore:
            tree.nodes.remove(emission)
            if previous is not None:
                tree.links.new(previous, surface)


def save_image(node, folder, stem, file_format, quality, non_color):
    image = node.image
    extension = "jpg" if file_format == "JPEG" else "png"
    path = folder / f"{stem}.{extension}"
    image.file_format = file_format
    image.save(filepath=str(path), quality=quality)

    # Disk дээрх файлыг дахин ачаалснаар glTF exporter (AUTO) яг тэр
    # JPG/PNG байтыг GLB руу хийнэ.
    loaded = bpy.data.images.load(str(path), check_existing=False)
    loaded.colorspace_settings.name = "Non-Color" if non_color else "sRGB"
    node.image = loaded
    bpy.data.images.remove(image)
    return path


# --------------------------------------------------------------------------
# Export / review
# --------------------------------------------------------------------------

def export_glb(path, objects):
    activate(objects[0], *objects)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_animations=False,
        export_image_format="AUTO",
        export_extras=False,
    )


def render_review(folder, objects, size):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = size * 2
    scene.render.resolution_y = size
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.render.image_settings.file_format = "PNG"

    world = bpy.data.worlds.new("review")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.8, 0.8, 0.8, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    scene.world = world

    sun_data = bpy.data.lights.new("review sun", "SUN")
    sun_data.energy = 3.0
    sun = bpy.data.objects.new("review sun", sun_data)
    sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(35))
    scene.collection.objects.link(sun)

    minimum, maximum = world_bounds(objects)
    center = (minimum + maximum) / 2
    extent = maximum - minimum

    camera_data = bpy.data.cameras.new("review")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = max(extent.x, extent.y * 2, extent.z * 2) * 1.15
    camera = bpy.data.objects.new("review", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera

    paths = []
    # front, front-high, closeup-ish back: камер нь хоёр объектыг зэрэг харна.
    for index, (azimuth, elevation) in enumerate([(-90, 10), (-60, 35), (-120, 25)]):
        a = math.radians(azimuth)
        e = math.radians(elevation)
        distance = extent.length * 3
        camera.location = center + Vector((
            math.cos(a) * math.cos(e),
            math.sin(a) * math.cos(e),
            math.sin(e),
        )) * distance
        camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
        path = folder / f"compare-{index + 1}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        paths.append(path.name)

    for datablock, store in [(camera, bpy.data.objects), (sun, bpy.data.objects)]:
        store.remove(datablock, do_unlink=True)
    return paths


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def process(source, destination, args):
    started = time.time()
    destination.mkdir(parents=True, exist_ok=False)
    textures = destination / "textures"
    textures.mkdir()

    originals = import_source(source)
    source_triangles = sum(triangle_count(o.data) for o in originals)
    minimum, maximum = world_bounds(originals)
    diagonal = (maximum - minimum).length
    log(f"{source.name}: {source_triangles:,} triangles, diagonal {diagonal:.3f}")

    high = build_high(originals)
    warnings = warn_unsupported_materials(high)
    for warning in warnings:
        log(f"WARNING {warning}")
    metallic, roughness, roughness_textured = principled_inputs(high)

    low, low_triangles = build_low(high, args.target_triangles, diagonal, args.voxel_ratio)
    log(f"decimate: {source_triangles:,} -> {low_triangles:,}")
    unwrap(low, args.uv_margin)

    error = surface_error(high, low)

    # Worker catalog хэмжээг ±5mm-ээр шалгадаг тул bounds хазайлтыг эндээ барина.
    low_minimum, low_maximum = world_bounds([low])
    bounds_drift = max(
        max(abs(low_minimum[i] - minimum[i]), abs(low_maximum[i] - maximum[i]))
        for i in range(3)
    )
    gate = {
        "boundsDriftMm": round(bounds_drift * 1000, 2),
        "shellErrorP95Mm": round(error["lowToHighP95"] * 1000, 2),
    }
    gate["passed"] = (
        gate["boundsDriftMm"] <= args.max_bounds_drift_mm
        and gate["shellErrorP95Mm"] <= args.max_shell_error_mm
    )
    log(f"gate: {gate}")
    if args.worker and not gate["passed"]:
        raise ValueError(f"Quality gate failed: {gate}")
    # Ray нь decimate-ийн хамгийн их хазайлтаас урт байх ёстой, гэхдээ
    # хэт урт бол эсрэг талын гадаргуу руу "үсэрнэ".
    extrusion = min(max(error["lowToHighP95"] * 1.5, diagonal * 0.003), diagonal * 0.02)
    ray = extrusion * 2.0
    log(
        "surface error mm: "
        + ", ".join(f"{k}={v * 1000:.2f}" for k, v in error.items())
        + f" | cage {extrusion * 1000:.1f}mm ray {ray * 1000:.1f}mm"
    )

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.view_settings.view_transform = "Standard"

    material, nodes = build_low_material(
        low,
        args.color_size,
        args.normal_size,
        args.roughness_size if roughness_textured else 0,
        metallic,
        roughness,
    )
    margin = max(4, args.color_size // 256)
    bake_input_as_emission("Base Color", nodes["color"], material, high, low, extrusion, ray, margin, args.bake_samples)
    bake("NORMAL", nodes["normal"], material, high, low, extrusion, ray, margin, 1)
    if nodes["roughness"]:
        bake("ROUGHNESS", nodes["roughness"], material, high, low, extrusion, ray, margin, 1)

    texture_files = [
        save_image(nodes["color"], textures, "color", "JPEG", args.jpg_quality, False),
        save_image(
            nodes["normal"],
            textures,
            "normal",
            "PNG" if args.normal_format == "png" else "JPEG",
            args.normal_jpg_quality,
            True,
        ),
    ]
    if nodes["roughness"]:
        texture_files.append(
            save_image(nodes["roughness"], textures, "roughness", "JPEG", args.jpg_quality, True)
        )

    web = destination / ("delivery.glb" if args.worker else "web.glb")
    export_glb(web, [low])
    log(f"{web.name}: {web.stat().st_size / 1e6:.2f} MB")

    if args.worker:
        # optimize-glb.mjs болон worker.mjs-ийн хүлээдэг geometry-report хэлбэр
        # (blender_batch.py process_delivery-тэй адил, glTF Y-up тэнхлэг).
        size = low_maximum - low_minimum
        report = {
            "source": str(source),
            "sourceTriangles": source_triangles,
            "unit": "triangles",
            "preservedGeometry": False,
            "bakedSurface": True,
            "dimensionsM": {"w": size.x, "h": size.z, "d": size.y},
            "boundsM": {
                "min": [low_minimum.x, low_minimum.z, -low_maximum.y],
                "max": [low_maximum.x, low_maximum.z, -low_minimum.y],
            },
            "delivery": {"passed": True, "triangles": low_triangles},
            "gate": gate,
            "surfaceErrorMm": {k: round(v * 1000, 3) for k, v in error.items()},
            "warnings": warnings,
        }
        (destination / "geometry-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        log(f"DONE {source.name}: {source_triangles:,} -> {low_triangles:,} tri in {time.time() - started:.1f}s")
        return

    # Preview: original-ыг яг байрлалд нь, compressed-ийг +X тийш зэрэгцүүлнэ.
    bpy.data.objects.remove(high, do_unlink=True)
    offset = (maximum.x - minimum.x) * 1.2
    low.location.x += offset
    for obj in originals:
        obj.name = f"ORIGINAL_{obj.name}"
    low.name = f"COMPRESSED_{low_triangles}tri"
    preview = destination / "preview.glb"
    export_glb(preview, originals + [low])
    log(f"preview.glb: {preview.stat().st_size / 1e6:.2f} MB")

    renders = render_review(destination, originals + [low], args.render_size) if args.renders else []

    report = {
        "source": str(source),
        "sourceBytes": source.stat().st_size,
        "sourceTriangles": source_triangles,
        "webBytes": web.stat().st_size,
        "webTriangles": low_triangles,
        "sizeReduction": 1 - web.stat().st_size / source.stat().st_size,
        "dimensionsM": [round(v, 4) for v in (maximum - minimum)],
        "surfaceErrorMm": {k: round(v * 1000, 3) for k, v in error.items()},
        "gate": gate,
        "bake": {
            "cageExtrusionMm": round(extrusion * 1000, 2),
            "maxRayDistanceMm": round(ray * 1000, 2),
            "margin": margin,
            "colorSize": args.color_size,
            "normalSize": args.normal_size,
            "roughnessBaked": bool(nodes["roughness"]),
            "metallic": metallic,
            "roughness": roughness,
        },
        "textures": {p.name: p.stat().st_size for p in texture_files},
        "renders": renders,
        "warnings": warnings,
        "seconds": round(time.time() - started, 1),
    }
    (destination / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    log(
        f"DONE {source.name}: {source_triangles:,} -> {low_triangles:,} tri, "
        f"{source.stat().st_size / 1e6:.1f}MB -> {web.stat().st_size / 1e6:.2f}MB "
        f"in {report['seconds']}s"
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path, help="GLB файл эсвэл GLB-тэй хавтас")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--target-triangles", type=int, default=6000)
    parser.add_argument("--color-size", type=int, default=2048)
    parser.add_argument("--normal-size", type=int, default=2048)
    parser.add_argument("--roughness-size", type=int, default=1024)
    parser.add_argument("--normal-format", choices=["png", "jpg"], default="png")
    parser.add_argument("--jpg-quality", type=int, default=85)
    parser.add_argument("--normal-jpg-quality", type=int, default=95)
    parser.add_argument("--voxel-ratio", type=float, default=1 / 500,
                        help="Voxel хэмжээ = diagonal * ratio; 0 бол remesh хийхгүй")
    parser.add_argument("--uv-margin", type=float, default=0.004)
    parser.add_argument("--bake-samples", type=int, default=8)
    parser.add_argument("--render-size", type=int, default=640)
    parser.add_argument("--renders", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--max-bounds-drift-mm", type=float, default=3.0)
    parser.add_argument("--max-shell-error-mm", type=float, default=10.0)
    parser.add_argument("--worker", action="store_true",
                        help="pipeline.mjs: <output>/<stem>/delivery.glb + geometry-report.json; "
                             "preview/render хийхгүй, gate унавал алдаа өгнө")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])

    if not 500 <= args.target_triangles <= 200000:
        parser.error("--target-triangles 500..200000")

    source_root = args.input.resolve()
    output_root = args.output.resolve()
    if output_root == source_root or source_root in output_root.parents:
        parser.error("Output нь input хавтас дотор байж болохгүй")

    files = (
        [source_root]
        if source_root.is_file()
        else sorted(p for p in source_root.glob("*") if p.suffix.lower() == ".glb")
    )
    if not files:
        parser.error("GLB олдсонгүй")

    failed = []
    for source in files:
        name = source.stem if args.worker else f"{source.stem}_{time.strftime('%Y%m%d-%H%M%S')}"
        try:
            process(source, output_root / name, args)
        except Exception as error:
            traceback.print_exc()
            failed.append({"file": str(source), "error": str(error)})

    if failed:
        raise RuntimeError(f"{len(failed)} GLB амжилтгүй: {failed}")


if __name__ == "__main__":
    main()
