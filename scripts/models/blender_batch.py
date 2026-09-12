"""Blender 4.2+/5.x: FBX/OBJ/GLB -> validated, triangulated high/medium/low GLBs.
blender --background --python scripts/models/blender_batch.py -- --input assets --output build/models
Budgets are per complete asset, including every repeated object (not per mesh).
"""
import argparse
import bisect
import json
import hashlib
import math
from pathlib import Path
import random
import sys
import traceback

import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform


def triangle_count(mesh):
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def decimate_ratio(source_triangles, target_triangles):
    return min(1.0, max(0.0, target_triangles / source_triangles)) if source_triangles else 1.0


def allocate_budgets(counts, target):
    """Preserve tiny modules; distribute the remainder by each object's source count."""
    if sum(counts) <= target:
        return counts[:]
    floors = [min(count, 4) for count in counts]
    if sum(floors) > target:
        raise ValueError("Too many separate parts for this budget; merge/simplify modules first.")
    weights = [count - floor for count, floor in zip(counts, floors)]
    available = target - sum(floors)
    exact = [available * weight / sum(weights) for weight in weights]
    budgets = [floor + int(value) for floor, value in zip(floors, exact)]
    for i in sorted(range(len(counts)), key=lambda i: exact[i] % 1, reverse=True)[:target - sum(budgets)]:
        budgets[i] += 1
    return budgets


def activate(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def import_asset(source):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    suffix = source.suffix.lower()
    if suffix == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(source))
    elif suffix == ".obj":
        bpy.ops.wm.obj_import(filepath=str(source))
    else:
        bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        raise ValueError("No mesh objects found.")
    if any(o.animation_data or o.data.shape_keys or any(m.type == "ARMATURE" for m in o.modifiers) for o in meshes):
        raise ValueError("Animated/skinned/morph assets require a separate artist-reviewed pipeline.")
    depsgraph = bpy.context.evaluated_depsgraph_get()
    sources = []
    for obj in meshes:
        world = obj.matrix_world.copy()
        evaluated = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph), depsgraph=depsgraph)
        obj.modifiers.clear()
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)
        evaluated.transform(world)
        evaluated.update()
        obj.data = evaluated
        activate(obj)
        triangulate = obj.modifiers.new("Pipeline triangulation", "TRIANGULATE")
        bpy.ops.object.modifier_apply(modifier=triangulate.name)
        sources.append((obj, obj.data.copy()))
    return sources


def mesh_surface(mesh):
    mesh.calc_loop_triangles()
    vertices = [v.co.copy() for v in mesh.vertices]
    triangles = [tuple(t.vertices) for t in mesh.loop_triangles]
    normals = [tuple(mesh.corner_normals[i].vector.copy() for i in t.loops) for t in mesh.loop_triangles]
    return vertices, triangles, BVHTree.FromPolygons(vertices, triangles, all_triangles=True), normals


def surface_samples(vertices, triangles, normals, count=384):
    rng = random.Random(742)
    areas, total = [], 0.0
    for a, b, c in triangles:
        total += (vertices[b] - vertices[a]).cross(vertices[c] - vertices[a]).length / 2
        areas.append(total)
    if not total:
        return
    for _ in range(count):
        index = min(bisect.bisect_left(areas, rng.random() * total), len(triangles) - 1)
        a, b, c = [vertices[i] for i in triangles[index]]
        u, v = math.sqrt(rng.random()), rng.random()
        na, nb, nc = normals[index]
        yield a * (1 - u) + b * (u * (1 - v)) + c * (u * v), (na * (1 - u) + nb * (u * (1 - v)) + nc * (u * v)).normalized()


def validate_surface(before, after, diagonal, level):
    a, b = mesh_surface(before), mesh_surface(after)
    angles, distances = [], []
    for source, target in [(a, b), (b, a)]:
        for point, normal in surface_samples(source[0], source[1], source[3]):
            hit, _, face, distance = target[2].find_nearest(point)
            if hit is None:
                return {"passed": False, "reason": "No corresponding surface"}
            distances.append(distance / max(diagonal, 1e-9))
            va, vb, vc = [target[0][i] for i in target[1][face]]
            hit_normal = barycentric_transform(hit, va, vb, vc, *target[3][face]).normalized()
            angles.append(math.degrees(math.acos(max(-1, min(1, normal.dot(hit_normal))))))
    if not angles:
        return {"passed": False, "reason": "Degenerate surface"}
    def percentile(values):
        return sorted(values)[int((len(values) - 1) * .95)]
    distance_limit, normal_limit = {"high": (.015, 25), "medium": (.025, 35), "low": (.05, 50)}[level]
    bbox_error = max(abs(min(v[axis] for v in a[0]) - min(v[axis] for v in b[0])) for axis in range(3))
    bbox_error = max(bbox_error, max(abs(max(v[axis] for v in a[0]) - max(v[axis] for v in b[0])) for axis in range(3))) / max(diagonal, 1e-9)
    surface_passed = percentile(distances) <= distance_limit and max(distances) <= distance_limit * 3 and bbox_error <= distance_limit
    return {"passed": surface_passed and percentile(angles) <= normal_limit, "surfacePassed": surface_passed,
            "distanceP95Ratio": percentile(distances), "distanceMaxRatio": max(distances), "normalP95Degrees": percentile(angles),
            "boundsDriftRatio": bbox_error, "samples": len(angles), "distanceLimit": distance_limit, "normalLimitDegrees": normal_limit}


def render_views(destination, label, minimum, maximum):
    """Fixed solid-studio views: silhouettes, holes and normal/shading changes.
    This is a geometry comparison, not a texture-bake quality assessment.
    """
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = scene.render.resolution_y = 384
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "SINGLE"
    scene.display.shading.single_color = (.65, .65, .65)
    scene.display.shading.show_backface_culling = True
    camera_data = bpy.data.cameras.new("Validation camera")
    camera = bpy.data.objects.new("Validation camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = (maximum - minimum).length * 1.1
    center = (minimum + maximum) / 2
    radius = (maximum - minimum).length * 2
    frames = []
    for index, angle in enumerate([45, 135, 225, 315]):
        radians = math.radians(angle)
        camera.location = center + Vector((math.cos(radians), math.sin(radians), .65)) * radius
        camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
        filepath = destination / f"{label}-view-{index + 1}.png"
        scene.render.filepath = str(filepath)
        bpy.ops.render.render(write_still=True)
        image = bpy.data.images.load(str(filepath), check_existing=False)
        frames.append(np.array(image.pixels[:], dtype=np.float32).reshape(-1, 4))
        bpy.data.images.remove(image)
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.cameras.remove(camera_data)
    return frames


def compare_views(before, after, level):
    ious, errors = [], []
    for a, b in zip(before, after):
        ma, mb = a[:, 3] > .5, b[:, 3] > .5
        union = np.logical_or(ma, mb)
        ious.append(float(np.logical_and(ma, mb).sum() / max(1, union.sum())))
        errors.append(float(np.abs(a[:, :3] * a[:, 3:4] - b[:, :3] * b[:, 3:4])[union].mean()))
    minimum_iou, maximum_error = {"high": (.98, .022), "medium": (.975, .022), "low": (.97, .028)}[level]
    return {"passed": min(ious) >= minimum_iou and max(errors) <= maximum_error, "silhouetteIoU": ious,
            "shadingMAE": errors, "minimumIoU": minimum_iou, "maximumMAE": maximum_error,
            "mode": "four fixed solid-studio views; texture quality requires separate review"}


def simplify_object(obj, original, budget):
    ratio = decimate_ratio(triangle_count(original), budget)
    for _ in range(6):
        previous = obj.data
        obj.data = original.copy()
        if previous.users == 0:
            bpy.data.meshes.remove(previous)
        activate(obj)
        if ratio < 1:
            modifier = obj.modifiers.new("Web triangle budget", "DECIMATE")
            modifier.decimate_type = "COLLAPSE"
            modifier.ratio = ratio
            modifier.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        count = triangle_count(obj.data)
        if 0 < count <= budget:
            return count, ratio
        if not count:
            raise ValueError(f"{obj.name}: simplification removed all faces")
        ratio *= budget / count * .98
    raise ValueError(f"{obj.name}: could not reach {budget} triangles safely")


def process(source, destination, targets):
    destination.mkdir(parents=True, exist_ok=False)
    sources = import_asset(source)
    counts = [triangle_count(mesh) for _, mesh in sources]
    vertices = [vertex.co for _, mesh in sources for vertex in mesh.vertices]
    minimum = Vector(tuple(min(v[i] for v in vertices) for i in range(3)))
    maximum = Vector(tuple(max(v[i] for v in vertices) for i in range(3)))
    diagonal = (maximum - minimum).length
    # Identical origin/bounds are embedded in every LOD so transitions never resize the product.
    bounds = {"min": [minimum.x, minimum.z, -maximum.y], "max": [maximum.x, maximum.z, -minimum.y]}
    report = {"source": str(source), "sourceTriangles": sum(counts), "unit": "triangles", "levels": {}}
    reference_views = render_views(destination, "source", minimum, maximum)
    for level, target in zip(["high", "medium", "low"], targets):
        requested = target
        previous_level = {"medium": "high", "low": "medium"}.get(level)
        ceiling = sum(counts) if sum(counts) <= target else min(sum(counts), 30000 if level == "high" else int(report["levels"][previous_level]["triangles"] * .95))
        target = min(target, ceiling)
        while True:
            budgets = allocate_budgets(counts, target)
            objects = []
            for (obj, original), count, budget in zip(sources, counts, budgets):
                actual, ratio = simplify_object(obj, original, budget)
                validation = validate_surface(original, obj.data, diagonal, level)
                objects.append({"name": obj.name, "before": count, "budget": budget, "after": actual, "ratio": ratio, "validation": validation})
            visual = compare_views(reference_views, render_views(destination, level, minimum, maximum), level)
            passed = all(item["validation"].get("surfacePassed", False) for item in objects) and visual["passed"]
            if passed or target >= ceiling:
                break
            target = min(ceiling, max(target + 1, math.ceil(target * 1.4)))
        entry = {"requestedTarget": requested, "target": target, "triangles": sum(item["after"] for item in objects), "passed": passed, "objects": objects, "visual": visual,
                 "normalWarning": not all(item["validation"]["passed"] for item in objects)}
        report["levels"][level] = entry
        if passed:
            bpy.ops.object.select_all(action="DESELECT")
            for obj, _ in sources:
                obj.select_set(True)
            bpy.context.scene["pipelineBounds"] = bounds
            bpy.context.scene["pipelineAssetId"] = hashlib.sha256(source.read_bytes()).hexdigest()
            bpy.ops.export_scene.gltf(filepath=str(destination / f"{level}.glb"), export_format="GLB", use_selection=True,
                                      export_extras=True, export_animations=False, export_yup=True)
        (destination / "geometry-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"[geometry] {source.name} {level}: {sum(counts):,} -> {entry['triangles']:,}, validation={'PASS' if passed else 'REVIEW'}", flush=True)
    if not all(level["passed"] for level in report["levels"].values()):
        raise ValueError("Surface deviation exceeded limits. See geometry-report.json; rejected LODs were not exported.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--high", type=int, default=30000)
    parser.add_argument("--medium", type=int, default=15000)
    parser.add_argument("--low", type=int, default=5000)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    if not 10000 <= args.high <= 30000 or not 4 <= args.low <= args.medium <= args.high:
        parser.error("Require high=10000..30000 and 4 <= low <= medium <= high")
    source_root, output_root = args.input.resolve(), args.output.resolve()
    if output_root == source_root or source_root in output_root.parents:
        parser.error("Output must be outside the input tree")
    files = [source_root] if source_root.is_file() else sorted(p for p in source_root.rglob("*") if p.suffix.lower() in {".fbx", ".obj", ".glb"})
    if not files:
        parser.error("No FBX, OBJ or GLB inputs found")
    failed = []
    for source in files:
        relative = Path(source.stem) if source_root.is_file() else source.relative_to(source_root).with_suffix("")
        try:
            process(source, output_root / relative, [args.high, args.medium, args.low])
        except Exception as error:
            failed.append({"file": str(source), "error": str(error)})
            traceback.print_exc()
    output_root.mkdir(parents=True, exist_ok=True)
    (output_root / "batch-errors.json").write_text(json.dumps(failed, indent=2), encoding="utf-8")
    if failed:
        raise RuntimeError(f"{len(failed)} asset(s) failed; source files were not modified")


if __name__ == "__main__":
    main()
