"""View-sampled exterior reduction for opaque, static furniture only.

This is not exhaustive visibility detection. Hidden surfaces may become visible
from untested viewpoints, so multi-view review remains required.
"""
import bpy
import bmesh
import json,subprocess,tempfile,shutil
import os
from collections import Counter
from pathlib import Path
from mathutils import Vector

SOURCE_NORMALS='_sofa_source_shading_normal'


def vertex_normals(mesh):
    attribute=mesh.attributes.get(SOURCE_NORMALS)
    if attribute is not None:
        return {index:item.vector.normalized() for index,item in enumerate(attribute.data)}
    result={}
    for loop in mesh.loops:
        result.setdefault(loop.vertex_index,mesh.corner_normals[loop.index].vector.copy())
    return result


def save_source_normals(mesh):
    normals=vertex_normals(mesh)
    attribute=mesh.attributes.new(SOURCE_NORMALS,'FLOAT_VECTOR','POINT')
    attribute.data.foreach_set('vector',[value for vertex in mesh.vertices
        for value in normals.get(vertex.index,vertex.normal)])


def directions():
    return [Vector((x,y,z)).normalized() for x in [-1,0,1] for y in [-1,0,1]
            for z in [-1,0,1] if x or y or z]


def stitch_authored_seams(mesh):
    """Join coincident, co-oriented UV splits; never join opposite scan sheets."""
    authored=vertex_normals(mesh)
    topology=bmesh.new();topology.from_mesh(mesh);topology.verts.ensure_lookup_table()
    groups={};targets={}
    for vertex in topology.verts:
        key=tuple(round(value/0.000001) for value in vertex.co)
        peers=groups.setdefault(key,[])
        normal=authored.get(vertex.index,vertex.normal)
        match=next((peer for peer in peers if normal.dot(authored.get(peer.index,peer.normal))>.996),None)
        if match is None:peers.append(vertex)
        else:targets[vertex]=match
    before=len(topology.verts)
    bmesh.ops.weld_verts(topology,targetmap=targets)
    result={'mergedVertices':before-len(topology.verts),
            'boundaryEdges':sum(edge.is_boundary for edge in topology.edges),
            'nonManifoldEdges':sum(not edge.is_manifold for edge in topology.edges)}
    topology.to_mesh(mesh);topology.free();mesh.update()
    return result


def simplify_locked_border(base, budget, args):
    node=getattr(args,'node',None) or shutil.which('node')
    if not node:raise FileNotFoundError('Node.js is required for locked-border simplification')
    base.calc_loop_triangles()
    payload={'positions':[value for vertex in base.vertices for value in vertex.co],
        'indices':[index for triangle in base.loop_triangles for index in triangle.vertices],
        'targetTriangles':budget,'maxErrorM':args.max_error_mm/1000}
    with tempfile.TemporaryDirectory(prefix='sofa-locked-border-') as temporary:
        source=Path(temporary)/'mesh.json';output=Path(temporary)/'simplified.json'
        source.write_text(json.dumps(payload),encoding='utf-8')
        subprocess.run([node,
            str(Path(__file__).with_name('sofa-simplify.mjs')),str(source),str(output)],check=True,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
        result=json.loads(output.read_text(encoding='utf-8'))
    indices=result['indices'];used=sorted(set(indices));remap={value:i for i,value in enumerate(used)}
    authored=vertex_normals(base)
    source_uv={}
    if getattr(args,'keep_authored_surface',False):
        if len(base.uv_layers)!=1:raise ValueError('Authored surface profile requires exactly one source UV set')
        for loop in base.loops:
            uv=tuple(base.uv_layers.active.data[loop.index].uv)
            if loop.vertex_index in source_uv and source_uv[loop.vertex_index]!=uv:
                raise ValueError('Source UVs must be split per vertex before index-only simplification')
            source_uv[loop.vertex_index]=uv
    mesh=bpy.data.meshes.new('Exterior locked-border candidate')
    mesh.from_pydata([base.vertices[index].co[:] for index in used],[],
        [tuple(remap[index] for index in indices[offset:offset+3]) for offset in range(0,len(indices),3)])
    for material in base.materials:mesh.materials.append(material)
    for face in mesh.polygons:face.use_smooth=True
    mesh.update()
    mesh.normals_split_custom_set_from_vertices([authored[index] for index in used])
    if source_uv:
        layer=mesh.uv_layers.new(name=base.uv_layers.active.name)
        for loop in mesh.loops:layer.data[loop.index].uv=source_uv[used[loop.vertex_index]]
    return mesh,result['errorM']*1000


def open_boundaries(mesh):
    """Geometric open edges, excluding coincident UV/normal seams with two sides."""
    def point(vertex):return tuple(vertex.co)
    edges=Counter(tuple(sorted((point(mesh.vertices[edge.vertices[0]]),
                                point(mesh.vertices[edge.vertices[1]])))) for edge in mesh.edges)
    topology=bmesh.new();topology.from_mesh(mesh)
    boundaries={tuple(sorted((point(edge.verts[0]),point(edge.verts[1]))))
                for edge in topology.edges if edge.is_boundary}
    topology.free()
    return {edge for edge in boundaries if edges[edge]==1}


def visible_error(before,after,samples,geometry):
    surfaces=[geometry.mesh_surface(before),geometry.mesh_surface(after)]
    bounds=[[min(v[k] for v in s[0]) for k in range(3)]+[max(v[k] for v in s[0]) for k in range(3)] for s in surfaces]
    ray_length=max((Vector(bound[3:])-Vector(bound[:3])).length for bound in bounds)*2
    tolerance=0.00002  # 0.02mm: avoid treating a nearby occluding sheet as the sample.
    errors=[];counts=[]
    views=directions()
    for source,target in [surfaces,surfaces[::-1]]:
        count=0
        for point,_ in geometry.surface_samples(source[0],source[1],source[3],count=samples):
            for direction in views:
                hit=source[2].ray_cast(point+direction*ray_length,-direction,ray_length+tolerance)
                if hit[0] is not None and (hit[0]-point).length<tolerance:
                    break
            else: continue
            errors.append(target[2].find_nearest(point)[3]*1000)
            count+=1
        counts.append(count)
    if min(counts)<64:
        raise ValueError("Insufficient visible samples for exterior comparison")
    errors.sort()
    return {'sampleCount':len(errors),'candidateSampleCount':samples*2,'visibleCounts':counts,
        'p95Mm':errors[int((len(errors)-1)*.95)],'p99Mm':errors[int((len(errors)-1)*.99)],
        'maxMm':errors[-1],'boundsDriftMm':max(abs(a-b) for a,b in zip(*bounds))*1000,
        'method':'Bidirectional area-weighted samples visible from 26 exterior directions; hidden source surfaces excluded; not an exhaustive visibility or shading guarantee'}


def make_candidate(high,args,geometry):
    low=high.copy();low.data=high.data.copy();low.parent=None
    low.matrix_world=high.matrix_world.copy();bpy.context.scene.collection.objects.link(low)
    if high.name in args.keep_object:
        return low,[{'triangles':geometry.triangle_count(low.data),'preservedObject':True,'passed':True}]
    save_source_normals(low.data)
    vertices,triangles,tree,normals=geometry.mesh_surface(high.data)
    span=(Vector([max(v[k] for v in vertices) for k in range(3)])-
          Vector([min(v[k] for v in vertices) for k in range(3)])).length*2
    views=directions();visible=set()
    high.data.calc_loop_triangles()
    for index,triangle in enumerate(triangles):
        point=sum((vertices[i] for i in triangle),Vector())/3
        authored=sum(normals[index],Vector()).normalized()
        for direction in [authored,*views]:
            if direction.length_squared<0.5: continue
            hit=tree.ray_cast(point+direction*span,-direction,span+0.00002)
            if hit[0] is not None and (hit[0]-point).length<0.00002:
                visible.add(high.data.loop_triangles[index].polygon_index)
                break
        if index%50000==0:
            print('[exterior]',index,'/',len(triangles),'visible faces',len(visible),flush=True)
    topology=bmesh.new();topology.from_mesh(low.data);topology.faces.ensure_lookup_table()
    keep={face for face in topology.faces if face.index in visible}
    # Retain collars around partial occlusion boundaries and narrow openings.
    for _ in range(2):
        keep|={other for face in keep for vertex in face.verts for other in vertex.link_faces}
    bmesh.ops.delete(topology,geom=[face for face in topology.faces if face not in keep],context='FACES')
    topology.to_mesh(low.data);topology.free()
    low.data.validate(clean_customdata=False)
    stitching=stitch_authored_seams(low.data) if getattr(args,'weld_topology',False) else None
    normals=vertex_normals(low.data)
    low.data.normals_split_custom_set_from_vertices([normals[index] for index in range(len(low.data.vertices))])
    locking=getattr(args,'protect_boundaries',False)
    protected=0;protected_positions=set();original_boundaries=set()
    if locking:
        original_boundaries=open_boundaries(low.data)
        protected_positions={point for edge in original_boundaries for point in edge}
        protected=len(protected_positions)
    base=low.data.copy();count=geometry.triangle_count(base)
    if not count: raise ValueError("Exterior extraction produced no triangles")
    target=args.target_triangles or max(1000,round(count*args.ratio))
    targets=sorted({min(count,round(target*factor)) for factor in [1,1.5,2,3]}|{count})
    attempts=[]
    for budget in targets:
        old=low.data
        simplifier_error=None
        if budget<count and locking:
            low.data,simplifier_error=simplify_locked_border(base,budget,args)
        else:low.data=base.copy()
        if old.users==0 and old!=base:bpy.data.meshes.remove(old)
        geometry.activate(low)
        if budget<count and not locking:
            modifier=low.modifiers.new('Exterior quality candidate','DECIMATE')
            modifier.ratio=budget/count;modifier.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        repaired=low.data.validate(clean_customdata=False)
        missing_boundaries=len(protected_positions-{tuple(vertex.co) for vertex in low.data.vertices})
        new_open_edges=len(open_boundaries(low.data)-original_boundaries) if locking else 0
        error=visible_error(high.data,low.data,args.samples,geometry)
        passed=(error['maxMm']<=args.max_error_mm and error['p95Mm']<=args.max_error_mm/2
                and error['boundsDriftMm']<=args.max_error_mm and missing_boundaries==0 and new_open_edges==0)
        attempts.append({'mode':'exterior','visibleCentroidFaces':len(visible),
            'exteriorWithTwoRingCollarTriangles':count,'targetTriangles':budget,
            'seamStitching':stitching,'protectedVertices':protected,
            'missingProtectedVertices':missing_boundaries,'simplifierErrorMm':simplifier_error,
            'newGeometricOpenEdges':new_open_edges,
            'triangles':geometry.triangle_count(low.data),'meshValidationRepaired':repaired,
            'surface':error,'passed':passed})
        print('[exterior gate]',attempts[-1],flush=True)
        if passed:
            bpy.data.meshes.remove(base)
            return low,attempts
    raise ValueError("Exterior extraction failed quality gate even without further simplification")
