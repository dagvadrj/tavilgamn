"""Blender 4.2+/5.x: FBX/OBJ/GLB -> geometry-preserving delivery GLB.

blender --background --python scripts/models/blender_batch.py -- --input assets --output build/models --preserve-geometry

Also a helper module for sofa-quality-bake.py / sofa_exterior.py
(activate, triangle_count, mesh_surface, surface_samples, prepare_normal_bake_target).
Low-poly baking lives in glb_bake_compress.py.
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
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def triangle_count(mesh):
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def activate(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def import_delivery_asset(source):
    """Import without applying transforms or breaking shared mesh instances."""

    bpy.ops.wm.read_factory_settings(use_empty=True)
    suffix = source.suffix.lower()

    if suffix == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(source))
    elif suffix == ".obj":
        bpy.ops.wm.obj_import(filepath=str(source))
    else:
        bpy.ops.import_scene.gltf(filepath=str(source))

    meshes = [
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH"
    ]

    if not meshes:
        raise ValueError("No mesh objects found.")

    if any(
        obj.animation_data
        or obj.data.shape_keys
        or obj.modifiers
        for obj in meshes
    ):
        raise ValueError(
            "Animated, skinned, morph, or modifier-based assets require "
            "a separate artist-reviewed pipeline."
        )

    return meshes


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

def process_delivery(
    source,
    destination,
    max_triangles,
):
    """Normalize an asset without changing its authored mesh density."""

    destination.mkdir(
        parents=True,
        exist_ok=False,
    )

    objects = import_delivery_asset(source)
    counts = [triangle_count(obj.data) for obj in objects]
    total = sum(counts)

    unique_meshes = {obj.data for obj in objects}
    unique_total = sum(
        triangle_count(mesh)
        for mesh in unique_meshes
    )

    if total > max_triangles:
        raise ValueError(
            f"Asset has {total:,} triangles; "
            f"delivery limit is {max_triangles:,}. "
            "Reduce the source mesh before upload."
        )

    vertices = [
        obj.matrix_world @ vertex.co
        for obj in objects
        for vertex in obj.data.vertices
    ]
    minimum = Vector(
        tuple(min(v[i] for v in vertices) for i in range(3))
    )
    maximum = Vector(
        tuple(max(v[i] for v in vertices) for i in range(3))
    )

    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    # Preserve authored connector sockets used by modular furniture parts.
    for obj in bpy.context.scene.objects:
        if obj.type == "EMPTY":
            obj["kitchenAnchor"] = True
            obj.select_set(True)

    bpy.context.scene["pipelineBounds"] = {
        "min": [minimum.x, minimum.z, -maximum.y],
        "max": [maximum.x, maximum.z, -minimum.y],
    }
    bpy.context.scene["pipelineAssetId"] = hashlib.sha256(
        source.read_bytes()
    ).hexdigest()

    output_file = destination / "delivery.glb"
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

    report = {
        "source": str(source),
        "sourceTriangles": total,
        "uniqueTriangles": unique_total,
        "placedTriangles": total,
        "unit": "triangles",
        "preservedGeometry": True,
        "dimensionsM": {"w": maximum.x - minimum.x, "h": maximum.z - minimum.z, "d": maximum.y - minimum.y},
        "boundsM": {"min": [minimum.x, minimum.z, -maximum.y], "max": [maximum.x, maximum.z, -minimum.y]},
        "maxTriangles": max_triangles,
        "delivery": {
            "passed": True,
            "triangles": total,
        },
    }
    (destination / "geometry-report.json").write_text(
        json.dumps(report, indent=2),
        encoding="utf-8",
    )

    print(
        f"[geometry] {source.name} delivery: "
        f"{unique_total:,} unique / {total:,} placed triangles preserved",
        flush=True,
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

    # Хуучин дуудлагуудтай нийцүүлэх; одоо цорын ганц горим.
    parser.add_argument(
        "--preserve-geometry",
        action="store_true",
    )

    parser.add_argument(
        "--max-triangles",
        type=int,
        default=4000000,
    )

    args = parser.parse_args(
        sys.argv[
            sys.argv.index("--") + 1:
        ]
    )

    if not 10000 <= args.max_triangles <= 5000000:
        parser.error(
            "Require max-triangles=10000..5000000"
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
            process_delivery(
                source,
                output_root / relative,
                args.max_triangles,
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
