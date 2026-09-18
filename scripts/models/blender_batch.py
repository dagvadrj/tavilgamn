"""Blender 4.2+/5.x:
FBX/OBJ/GLB -> validated, triangulated high GLB.

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
    return (
        min(1.0, max(0.0, target_triangles / source_triangles))
        if source_triangles
        else 1.0
    )


def allocate_budgets(counts, target):
    """Preserve tiny modules; distribute the remainder by each object's source count."""

    if sum(counts) <= target:
        return counts[:]

    floors = [min(count, 4) for count in counts]

    if sum(floors) > target:
        raise ValueError(
            "Too many separate parts for this budget; "
            "merge/simplify modules first."
        )

    weights = [
        count - floor
        for count, floor in zip(counts, floors)
    ]

    available = target - sum(floors)

    exact = [
        available * weight / sum(weights)
        for weight in weights
    ]

    budgets = [
        floor + int(value)
        for floor, value in zip(floors, exact)
    ]

    for i in sorted(
        range(len(counts)),
        key=lambda i: exact[i] % 1,
        reverse=True,
    )[: target - sum(budgets)]:
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
        bpy.ops.import_scene.fbx(
            filepath=str(source)
        )

    elif suffix == ".obj":
        bpy.ops.wm.obj_import(
            filepath=str(source)
        )

    else:
        bpy.ops.import_scene.gltf(
            filepath=str(source)
        )

    meshes = [
        o
        for o in bpy.context.scene.objects
        if o.type == "MESH"
    ]

    if not meshes:
        raise ValueError("No mesh objects found.")

    if any(
        o.animation_data
        or o.data.shape_keys
        or any(
            m.type == "ARMATURE"
            for m in o.modifiers
        )
        for o in meshes
    ):
        raise ValueError(
            "Animated/skinned/morph assets require "
            "a separate artist-reviewed pipeline."
        )

    depsgraph = (
        bpy.context.evaluated_depsgraph_get()
    )

    sources = []

    for obj in meshes:
        world = obj.matrix_world.copy()

        evaluated = (
            bpy.data.meshes.new_from_object(
                obj.evaluated_get(depsgraph),
                depsgraph=depsgraph,
            )
        )

        obj.modifiers.clear()
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)

        evaluated.transform(world)
        evaluated.update()

        obj.data = evaluated

        activate(obj)

        triangulate = obj.modifiers.new(
            "Pipeline triangulation",
            "TRIANGULATE",
        )

        bpy.ops.object.modifier_apply(
            modifier=triangulate.name
        )
        cleanup_mesh(obj)
        sources.append(
            (obj, obj.data.copy())
        )

    return sources


def mesh_surface(mesh):
    mesh.calc_loop_triangles()

    vertices = [
        v.co.copy()
        for v in mesh.vertices
    ]

    triangles = [
        tuple(t.vertices)
        for t in mesh.loop_triangles
    ]

    normals = [
        tuple(
            mesh.corner_normals[i].vector.copy()
            for i in t.loops
        )
        for t in mesh.loop_triangles
    ]

    return (
        vertices,
        triangles,
        BVHTree.FromPolygons(
            vertices,
            triangles,
            all_triangles=True,
        ),
        normals,
    )


def surface_samples(
    vertices,
    triangles,
    normals,
    count=384,
):
    rng = random.Random(742)

    areas = []
    total = 0.0

    for a, b, c in triangles:
        total += (
            (
                vertices[b] - vertices[a]
            ).cross(
                vertices[c] - vertices[a]
            ).length
            / 2
        )

        areas.append(total)

    if not total:
        return

    for _ in range(count):
        index = min(
            bisect.bisect_left(
                areas,
                rng.random() * total,
            ),
            len(triangles) - 1,
        )

        a, b, c = [
            vertices[i]
            for i in triangles[index]
        ]

        u = math.sqrt(rng.random())
        v = rng.random()

        na, nb, nc = normals[index]

        yield (
            a * (1 - u)
            + b * (u * (1 - v))
            + c * (u * v),
            (
                na * (1 - u)
                + nb * (u * (1 - v))
                + nc * (u * v)
            ).normalized(),
        )


def validate_surface(
    before,
    after,
    diagonal,
    level,
):
    a = mesh_surface(before)
    b = mesh_surface(after)

    angles = []
    distances = []

    for source, target in [
        (a, b),
        (b, a),
    ]:
        for point, normal in surface_samples(
            source[0],
            source[1],
            source[3],
        ):
            hit, _, face, distance = (
                target[2].find_nearest(point)
            )

            if hit is None:
                return {
                    "passed": False,
                    "reason": (
                        "No corresponding surface"
                    ),
                }

            distances.append(
                distance / max(diagonal, 1e-9)
            )

            va, vb, vc = [
                target[0][i]
                for i in target[1][face]
            ]

            hit_normal = barycentric_transform(
                hit,
                va,
                vb,
                vc,
                *target[3][face],
            ).normalized()

            angles.append(
                math.degrees(
                    math.acos(
                        max(
                            -1,
                            min(
                                1,
                                normal.dot(
                                    hit_normal
                                ),
                            ),
                        )
                    )
                )
            )

    if not angles:
        return {
            "passed": False,
            "reason": "Degenerate surface",
        }

    def percentile(values):
        return sorted(values)[
            int(
                (len(values) - 1)
                * 0.95
            )
        ]

    distance_limit, normal_limit = {
        "high": (0.015, 25),
        "medium": (0.025, 35),
        "low": (0.05, 50),
    }[level]

    bbox_error = max(
        abs(
            min(
                v[axis]
                for v in a[0]
            )
            - min(
                v[axis]
                for v in b[0]
            )
        )
        for axis in range(3)
    )

    bbox_error = max(
        bbox_error,
        max(
            abs(
                max(
                    v[axis]
                    for v in a[0]
                )
                - max(
                    v[axis]
                    for v in b[0]
                )
            )
            for axis in range(3)
        ),
    ) / max(diagonal, 1e-9)

    surface_passed = (
        percentile(distances)
        <= distance_limit
        and max(distances)
        <= distance_limit * 3
        and bbox_error
        <= distance_limit
    )

    return {
        "passed": (
            surface_passed
            and percentile(angles)
            <= normal_limit
        ),
        "surfacePassed": surface_passed,
        "distanceP95Ratio": (
            percentile(distances)
        ),
        "distanceMaxRatio": (
            max(distances)
        ),
        "normalP95Degrees": (
            percentile(angles)
        ),
        "boundsDriftRatio": bbox_error,
        "samples": len(angles),
        "distanceLimit": distance_limit,
        "normalLimitDegrees": normal_limit,
    }


def render_views(
    destination,
    label,
    minimum,
    maximum,
):
    """Fixed solid-studio views: silhouettes, holes and normal/shading changes.

    This is a geometry comparison, not a texture-bake quality assessment.
    """

    scene = bpy.context.scene

    scene.render.engine = (
        "BLENDER_WORKBENCH"
    )

    scene.render.resolution_x = 384
    scene.render.resolution_y = 384
    scene.render.resolution_percentage = 100

    scene.render.image_settings.file_format = (
        "PNG"
    )

    scene.render.image_settings.color_mode = (
        "RGBA"
    )

    scene.render.film_transparent = True

    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = (
        "SINGLE"
    )

    scene.display.shading.single_color = (
        0.65,
        0.65,
        0.65,
    )

    scene.display.shading.show_backface_culling = (
        True
    )

    camera_data = bpy.data.cameras.new(
        "Validation camera"
    )

    camera = bpy.data.objects.new(
        "Validation camera",
        camera_data,
    )

    scene.collection.objects.link(camera)
    scene.camera = camera

    camera_data.type = "ORTHO"

    camera_data.ortho_scale = (
        (maximum - minimum).length
        * 1.1
    )

    center = (
        minimum + maximum
    ) / 2

    radius = (
        maximum - minimum
    ).length * 2

    frames = []

    for index, angle in enumerate(
        [45, 135, 225, 315]
    ):
        radians = math.radians(angle)

        camera.location = (
            center
            + Vector(
                (
                    math.cos(radians),
                    math.sin(radians),
                    0.65,
                )
            )
            * radius
        )

        camera.rotation_euler = (
            center - camera.location
        ).to_track_quat(
            "-Z",
            "Y",
        ).to_euler()

        filepath = (
            destination
            / f"{label}-view-{index + 1}.png"
        )

        scene.render.filepath = str(
            filepath
        )

        bpy.ops.render.render(
            write_still=True
        )

        image = bpy.data.images.load(
            str(filepath),
            check_existing=False,
        )

        frames.append(
            np.array(
                image.pixels[:],
                dtype=np.float32,
            ).reshape(-1, 4)
        )

        bpy.data.images.remove(image)

    bpy.data.objects.remove(
        camera,
        do_unlink=True,
    )

    bpy.data.cameras.remove(
        camera_data
    )

    return frames


def compare_views(
    before,
    after,
    level,
):
    ious = []
    errors = []

    for a, b in zip(
        before,
        after,
    ):
        ma = a[:, 3] > 0.5
        mb = b[:, 3] > 0.5

        union = np.logical_or(
            ma,
            mb,
        )

        ious.append(
            float(
                np.logical_and(
                    ma,
                    mb,
                ).sum()
                / max(
                    1,
                    union.sum(),
                )
            )
        )

        errors.append(
            float(
                np.abs(
                    a[:, :3]
                    * a[:, 3:4]
                    - b[:, :3]
                    * b[:, 3:4]
                )[union].mean()
            )
        )

    minimum_iou, maximum_error = {
        "high": (0.98, 0.022),
        "medium": (0.975, 0.022),
        "low": (0.97, 0.028),
    }[level]

    return {
        "passed": (
            min(ious) >= minimum_iou
        ),
        "shadingPassed": (
            max(errors) <= maximum_error
        ),
        "silhouetteIoU": ious,
        "shadingMAE": errors,
        "minimumIoU": minimum_iou,
        "maximumMAE": maximum_error,
        "mode": (
            "four fixed solid-studio views; "
            "texture quality requires "
            "separate review"
        ),
    }
def cleanup_mesh(obj):
    activate(obj)

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")

    bpy.ops.mesh.normals_make_consistent(
        inside=False
    )

    bpy.ops.object.mode_set(mode="OBJECT")

    obj.data.update()

def simplify_object(
    obj,
    original,
    budget,
):
    ratio = decimate_ratio(
        triangle_count(original),
        budget,
    )

    # Blender Decimate яг requested count дээр
    # заавал буудаггүй тул бага зэрэг aggressively эхлүүлнэ.
    ratio *= 0.97

    last_count = None

    # 6 → 12
    for _ in range(12):
        previous = obj.data
        obj.data = original.copy()

        if previous.users == 0:
            bpy.data.meshes.remove(previous)

        activate(obj)

        if ratio < 1:
            modifier = obj.modifiers.new(
                "Web triangle budget",
                "DECIMATE",
            )

            modifier.decimate_type = "COLLAPSE"
            modifier.ratio = max(
                0.0001,
                min(1.0, ratio),
            )

            modifier.use_collapse_triangulate = True

            bpy.ops.object.modifier_apply(
                modifier=modifier.name
            )

        count = triangle_count(obj.data)
        last_count = count

        if 0 < count <= budget:
            return count, ratio

        if not count:
            raise ValueError(
                f"{obj.name}: "
                "simplification removed all faces"
            )

        ratio *= (
            budget / count * 0.97
        )

    # 5% дотор байвал low LOD дээр
    # exact target биш байсан ч ашиглана.
    tolerance = math.ceil(
        budget * 1.05
    )

    if (
        last_count is not None
        and 0 < last_count <= tolerance
    ):
        print(
            f"[geometry-warning] "
            f"{obj.name}: requested={budget}, "
            f"actual={last_count}",
            flush=True,
        )

        return last_count, ratio

    raise ValueError(
        f"{obj.name}: could not reach "
        f"{budget} triangles; "
        f"closest={last_count}"
    )
def get_principled(material):
    material.use_nodes = True
    nodes = material.node_tree.nodes

    for node in nodes:
        if node.type == "BSDF_PRINCIPLED":
            return node

    principled = nodes.new("ShaderNodeBsdfPrincipled")
    output = next(
        (
            node
            for node in nodes
            if node.type == "OUTPUT_MATERIAL"
        ),
        None,
    )

    if output is None:
        output = nodes.new("ShaderNodeOutputMaterial")

    material.node_tree.links.new(
        principled.outputs["BSDF"],
        output.inputs["Surface"],
    )

    return principled


def prepare_normal_bake_target(
    obj,
    level,
    texture_size=2048,
):
    if not obj.data.uv_layers:
        raise ValueError(
            f"{obj.name}: Normal Map bake хийх UV байхгүй"
        )

    # Existing UV-г өөрчлөхгүй.
    # Scan texture-ийн UV layout хэвээр үлдэнэ.
    obj.data.uv_layers.active_index = 0

    if not obj.data.materials:
        material = bpy.data.materials.new(
            name=f"{obj.name}_{level}_Material"
        )
        material.use_nodes = True
        obj.data.materials.append(material)

    images = []

    for index in range(len(obj.data.materials)):
        original_material = obj.data.materials[index]

        if original_material:
            material = original_material.copy()
        else:
            material = bpy.data.materials.new(
                name=f"{obj.name}_{level}_Material_{index}"
            )
            material.use_nodes = True

        material.name = (
            f"{obj.name}_{level}_material_{index}"
        )

        # Original material-ийг өөрчлөхгүй.
        # LOD тус бүр өөрийн material copy авна.
        obj.data.materials[index] = material

        material.use_nodes = True

        nodes = material.node_tree.nodes
        links = material.node_tree.links

        principled = get_principled(material)

        image = bpy.data.images.new(
            name=(
                f"{obj.name}_{level}_normal_{index}"
            ),
            width=texture_size,
            height=texture_size,
            alpha=False,
            float_buffer=False,
        )

        image.generated_color = (
            0.5,
            0.5,
            1.0,
            1.0,
        )

        image.colorspace_settings.name = "Non-Color"

        texture_node = nodes.new(
            "ShaderNodeTexImage"
        )

        texture_node.name = (
            f"PIPELINE_NORMAL_{level}_{index}"
        )

        texture_node.label = (
            f"Baked Normal {level}"
        )

        texture_node.image = image
        texture_node.interpolation = "Linear"

        # Blender bake хийхдээ active Image Texture node
        # руу бичдэг.
        nodes.active = texture_node
        texture_node.select = True

        normal_node = nodes.new(
            "ShaderNodeNormalMap"
        )

        normal_node.space = "TANGENT"
        normal_node.inputs["Strength"].default_value = 1.0

        # Existing normal connection байвал LOD copy дээр л солино.
        normal_input = principled.inputs["Normal"]

        for link in list(normal_input.links):
            links.remove(link)

        links.new(
            texture_node.outputs["Color"],
            normal_node.inputs["Color"],
        )

        links.new(
            normal_node.outputs["Normal"],
            normal_input,
        )

        images.append(image)

    return images

def bake_normal_for_object(
    target_obj,
    original_mesh,
    level,
    diagonal,
    texture_size=2048,
):
    images = prepare_normal_bake_target(
        target_obj,
        level,
        texture_size,
    )

    # High-detail original mesh-ээр түр object үүсгэнэ.
    source_mesh = original_mesh.copy()

    source_obj = bpy.data.objects.new(
        f"{target_obj.name}_BAKE_SOURCE",
        source_mesh,
    )

    bpy.context.scene.collection.objects.link(
        source_obj
    )

    source_obj.matrix_world = Matrix.Identity(4)

    scene = bpy.context.scene

    # Normal bake-д Cycles ашиглана.
    scene.render.engine = "CYCLES"

    # Normal bake noise шаарддаггүй.
    scene.cycles.samples = 1

    bake = scene.render.bake

    bake.use_selected_to_active = True
    bake.use_clear = True
    bake.margin = 16

    if hasattr(bake, "margin_type"):
        bake.margin_type = "EXTEND"

    # Furniture хэмжээнээс proportional ray distance.
    bake.cage_extrusion = max(
        diagonal * 0.003,
        0.0005,
    )

    bake.max_ray_distance = max(
        diagonal * 0.015,
        0.002,
    )

    try:
        bpy.ops.object.select_all(
            action="DESELECT"
        )

        source_obj.select_set(True)
        target_obj.select_set(True)

        # Low/LOD нь ACTIVE байх ёстой.
        bpy.context.view_layer.objects.active = (
            target_obj
        )

        bpy.ops.object.bake(
            type="NORMAL"
        )

        for image in images:
            # GLB дотор embed хийхэд найдвартай.
            image.pack()

        return {
            "baked": True,
            "textureSize": texture_size,
            "maps": [
                image.name
                for image in images
            ],
        }

    finally:
        bpy.ops.object.select_all(
            action="DESELECT"
        )

        bpy.data.objects.remove(
            source_obj,
            do_unlink=True,
        )

        if source_mesh.users == 0:
            bpy.data.meshes.remove(
                source_mesh
            )
def bake_level_normals(
    sources,
    level,
    diagonal,
    texture_size=2048,
):
    results = []

    for obj, original in sources:
        result = bake_normal_for_object(
            obj,
            original,
            level,
            diagonal,
            texture_size,
        )

        results.append({
            "object": obj.name,
            **result,
        })

        print(
            f"[normal-bake] "
            f"{level} / {obj.name}: PASS",
            flush=True,
        )

    return results

def get_gltf_material_output_group():
    group = bpy.data.node_groups.get(
        "glTF Material Output"
    )

    if group is None:
        group = bpy.data.node_groups.new(
            "glTF Material Output",
            "ShaderNodeTree",
        )

    has_occlusion = any(
        getattr(item, "item_type", None) == "SOCKET"
        and getattr(item, "in_out", None) == "INPUT"
        and item.name == "Occlusion"
        for item in group.interface.items_tree
    )

    if not has_occlusion:
        group.interface.new_socket(
            name="Occlusion",
            in_out="INPUT",
            socket_type="NodeSocketFloat",
        )

    return group


def prepare_ao_bake_target(
    obj,
    level,
    texture_size=2048,
):
    if not obj.data.uv_layers:
        raise ValueError(
            f"{obj.name}: AO bake хийх UV байхгүй"
        )

    obj.data.uv_layers.active_index = 0

    group = get_gltf_material_output_group()

    images = []

    for index, material in enumerate(
        obj.data.materials
    ):
        if material is None:
            continue

        material.use_nodes = True

        nodes = material.node_tree.nodes
        links = material.node_tree.links

        # Өмнөх active texture node-уудыг цэвэрлэнэ.
        for node in nodes:
            node.select = False

        image = bpy.data.images.new(
            name=(
                f"{obj.name}_{level}_ao_{index}"
            ),
            width=texture_size,
            height=texture_size,
            alpha=False,
            float_buffer=False,
        )

        # AO default = white = occlusion байхгүй.
        image.generated_color = (
            1.0,
            1.0,
            1.0,
            1.0,
        )

        image.colorspace_settings.name = (
            "Non-Color"
        )

        texture_node = nodes.new(
            "ShaderNodeTexImage"
        )

        texture_node.name = (
            f"PIPELINE_AO_{level}_{index}"
        )

        texture_node.label = (
            f"Baked AO {level}"
        )

        texture_node.image = image
        texture_node.interpolation = "Linear"

        texture_node.select = True
        nodes.active = texture_node

        gltf_node = nodes.new(
            "ShaderNodeGroup"
        )

        gltf_node.node_tree = group
        gltf_node.name = (
            f"PIPELINE_GLTF_OUTPUT_{level}_{index}"
        )

        occlusion_input = (
            gltf_node.inputs.get("Occlusion")
        )

        if occlusion_input is None:
            raise ValueError(
                "glTF Material Output "
                "Occlusion socket олдсонгүй"
            )

        links.new(
            texture_node.outputs["Color"],
            occlusion_input,
        )

        images.append(image)

    if not images:
        raise ValueError(
            f"{obj.name}: AO bake material олдсонгүй"
        )

    return images

def bake_ao_for_object(
    target_obj,
    level,
    texture_size=2048,
):
    images = prepare_ao_bake_target(
        target_obj,
        level,
        texture_size,
    )

    scene = bpy.context.scene

    scene.render.engine = "CYCLES"

    # AO-д хэт өндөр sample хэрэггүй.
    # 16 бол furniture web asset-д боломжийн.
    scene.cycles.samples = 16

    try:
        bpy.ops.object.select_all(
            action="DESELECT"
        )

        target_obj.select_set(True)

        bpy.context.view_layer.objects.active = (
            target_obj
        )

        bpy.ops.object.bake(
            type="AO",
            margin=16,
            margin_type="EXTEND",
            use_clear=True,
            use_selected_to_active=False,
        )

        for image in images:
            image.pack()

        return {
            "baked": True,
            "textureSize": texture_size,
            "maps": [
                image.name
                for image in images
            ],
        }

    finally:
        bpy.ops.object.select_all(
            action="DESELECT"
        )
def bake_level_ao(
    sources,
    level,
):
    texture_size = (
        1024
        if level == "low"
        else 2048
    )

    results = []

    for obj, _ in sources:
        result = bake_ao_for_object(
            obj,
            level,
            texture_size,
        )

        results.append({
            "object": obj.name,
            **result,
        })

        print(
            f"[ao-bake] "
            f"{level} / {obj.name}: PASS",
            flush=True,
        )

    return results

def process(
    source,
    destination,
    targets,
):
    destination.mkdir(
        parents=True,
        exist_ok=False,
    )

    sources = import_asset(source)

    counts = [
        triangle_count(mesh)
        for _, mesh in sources
    ]

    vertices = [
        vertex.co
        for _, mesh in sources
        for vertex in mesh.vertices
    ]

    minimum = Vector(
        tuple(
            min(
                v[i]
                for v in vertices
            )
            for i in range(3)
        )
    )

    maximum = Vector(
        tuple(
            max(
                v[i]
                for v in vertices
            )
            for i in range(3)
        )
    )

    diagonal = (
        maximum - minimum
    ).length

    # Identical origin/bounds are embedded
    # in every LOD so transitions never
    # resize the product.
    bounds = {
        "min": [
            minimum.x,
            minimum.z,
            -maximum.y,
        ],
        "max": [
            maximum.x,
            maximum.z,
            -minimum.y,
        ],
    }

    report = {
        "source": str(source),
        "sourceTriangles": sum(counts),
        "unit": "triangles",
        "levels": {},
    }

    reference_views = render_views(
        destination,
        "source",
        minimum,
        maximum,
    )

    for level, target in [
        ("high", target[0]),
    ]:
        requested = target

        ceiling = min(
            sum(counts),
            requested,
        )

        target = min(
            target,
            ceiling,
        )

        while True:
            budgets = allocate_budgets(
                counts,
                target,
            )

            objects = []

            for (
                (obj, original),
                count,
                budget,
            ) in zip(
                sources,
                counts,
                budgets,
            ):
                actual, ratio = (
                    simplify_object(
                        obj,
                        original,
                        budget,
                    )
                )

                validation = (
                    validate_surface(
                        original,
                        obj.data,
                        diagonal,
                        level,
                    )
                )

                objects.append(
                    {
                        "name": obj.name,
                        "before": count,
                        "budget": budget,
                        "after": actual,
                        "ratio": ratio,
                        "validation": validation,
                    }
                )

            visual = compare_views(
                reference_views,
                render_views(
                    destination,
                    level,
                    minimum,
                    maximum,
                ),
                level,
            )

            passed = (
                all(
                    item[
                        "validation"
                    ].get(
                        "surfacePassed",
                        False,
                    )
                    for item in objects
                )
                and visual["passed"]
            )

            if (
                passed
                or target >= ceiling
            ):
                break

            target = min(
                ceiling,
                max(
                    target + 1,
                    math.ceil(
                        target * 1.4
                    ),
                ),
            )

        entry = {
            "requestedTarget": requested,
            "target": target,
            "triangles": sum(
                item["after"]
                for item in objects
            ),
            "passed": passed,
            "objects": objects,
            "visual": visual,
            "normalWarning": not all(
                item[
                    "validation"
                ]["passed"]
                for item in objects
            ),
        }

        report["levels"][level] = entry

        if passed:
            bpy.ops.object.select_all(
                action="DESELECT"
            )

            for obj, _ in sources:
                obj.select_set(True)

            bpy.context.scene[
                "pipelineBounds"
            ] = bounds

            bpy.context.scene[
                "pipelineAssetId"
            ] = hashlib.sha256(
                source.read_bytes()
            ).hexdigest()

            output_file = (
                destination
                / "high.glb"
            )

            print(
                "[DEBUG EXPORT] "
                f"path={output_file}",
                flush=True,
            )

            bpy.ops.export_scene.gltf(
                filepath=str(output_file),
                export_format="GLB",
                use_selection=True,
                export_extras=True,
                export_animations=False,
                export_yup=True,
                export_texcoords=True,
                export_normals=True,
                export_tangents=True,
            )

        (
            destination
            / "geometry-report.json"
        ).write_text(
            json.dumps(
                report,
                indent=2,
            ),
            encoding="utf-8",
        )

        print(
            f"[geometry] "
            f"{source.name} "
            f"{level}: "
            f"{sum(counts):,} -> "
            f"{entry['triangles']:,}, "
            f"validation="
            f"{'PASS' if passed else 'REVIEW'}",
            flush=True,
        )

    if not all(
        level["passed"]
        for level
        in report["levels"].values()
    ):
        raise ValueError(
            "Surface deviation exceeded "
            "limits. See "
            "geometry-report.json; "
            "rejected LODs were not "
            "exported."
        )


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--input",
        required=True,
        type=Path,
    )

    parser.add_argument(
        "--output",
        required=True,
        type=Path,
    )

    parser.add_argument(
        "--high",
        type=int,
        default=80000,
    )

    args = parser.parse_args(
        sys.argv[
            sys.argv.index("--") + 1:
        ]
    )

    if (
        not 10000
        <= args.high
        <= 100000
        or not 4
        <= args.high
    ):
        parser.error(
            "Require high=10000..100000"
            "and "
            "4 <= low <= medium <= high"
        )

    source_root = (
        args.input.resolve()
    )

    output_root = (
        args.output.resolve()
    )

    if (
        output_root == source_root
        or source_root
        in output_root.parents
    ):
        parser.error(
            "Output must be outside "
            "the input tree"
        )

    files = (
        [source_root]
        if source_root.is_file()
        else sorted(
            p
            for p
            in source_root.rglob("*")
            if p.suffix.lower()
            in {
                ".fbx",
                ".obj",
                ".glb",
            }
        )
    )

    if not files:
        parser.error(
            "No FBX, OBJ or GLB "
            "inputs found"
        )

    failed = []

    for source in files:
        relative = (
            Path(source.stem)
            if source_root.is_file()
            else (
                source
                .relative_to(source_root)
                .with_suffix("")
            )
        )

        try:
            process(
                source,
                output_root / relative,
                [
                    args.high,
                ],
            )

        except Exception as error:
            failed.append(
                {
                    "file": str(source),
                    "error": str(error),
                }
            )

            traceback.print_exc()

    output_root.mkdir(
        parents=True,
        exist_ok=True,
    )

    (
        output_root
        / "batch-errors.json"
    ).write_text(
        json.dumps(
            failed,
            indent=2,
        ),
        encoding="utf-8",
    )

    if failed:
        raise RuntimeError(
            f"{len(failed)} asset(s) "
            "failed; source files were "
            "not modified"
        )


if __name__ == "__main__":
    main()