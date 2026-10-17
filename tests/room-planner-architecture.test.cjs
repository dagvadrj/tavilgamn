const test = require("node:test");
const assert = require("node:assert/strict");
const THREE = require("three");
const { loadSource } = require("./helpers/load-source.cjs");
const policy = loadSource("src/lib/roomCatalogPolicy.ts");
const polygon = loadSource("src/lib/roomPolygon.ts");
const builder = loadSource("src/lib/roomBuilderDraft.ts");
const { getRoomGeometry } = loadSource("src/lib/roomGeometry.ts");
const openings = loadSource("src/lib/roomOpenings.ts");
const attachment = loadSource("src/lib/furnitureAttachment.ts");
const { isPlacementValid, dimsFor } = loadSource("src/three/collision.ts");
const { roomPlacementContext } = loadSource("src/three/roomPlacement.ts");
const { syncDesignRooms } = loadSource("src/lib/roomDesign.ts");
const camera = loadSource("src/lib/cameraTransition.ts");
const metadata = loadSource("src/lib/placementMetadata.ts");
const room = () => ({ width: 5, depth: 4, height: 2.7, outline: polygon.roomTemplateOutline("rectangle", 5, 4), openings: [] });
const piece = (id, w = .8, d = .3, h = .4) => ({ instanceId: id, productId: id, x: 0, z: 0, rotation: 0, color: "#fff000", material: "wood", details: { name: id, dimensions: { w, d, h } } });
const design = (shape, pieces = []) => syncDesignRooms({ ...shape, id: "test", activeRoomId: "r", name: "Test", roomType: "living", size: "80", wallColor: "#ffffff", floorColor: "#ffffff", pieces, createdAt: 0, updatedAt: 0 });

test("one catalog policy scopes photos and models, supports shared metadata, counts and explicit all-room search", () => {
  const items = ["sofa", "bed", "dresser", "nightstand", "desk"].map(category => ({ name: category, description: "", category, inStock: true, stockQuantity: 3 }));
  items.push({ name: "shared", description: "", category: "chair", roomTypes: ["living", "bedroom"], inStock: true, stockQuantity: 2 });
  const options = { roomType: "bedroom", scope: "room", category: "sofa", query: "" };
  const result = policy.roomCatalogPolicy(items, options);
  assert.equal(result.category, "all"); assert.deepEqual(result.products.map(p => p.name), ["bed", "dresser", "nightstand", "shared"]);
  assert.deepEqual(result.categories.slice(0, 4).map(c => c.id), ["bed", "wardrobe", "dresser", "nightstand"]);
  assert.equal(result.categories.find(c => c.id === "chair").count, 1);
  assert.equal(policy.roomCatalogPolicy(items, { ...options, category: "all", query: "sofa" }).products.length, 0);
  assert.equal(policy.roomCatalogPolicy(items, { ...options, scope: "all", category: "all", query: "sofa" }).products.length, 1);
  const unavailable = { ...items[0], stockQuantity: 0 };
  assert.equal(policy.roomCatalogPolicy([unavailable], { ...options, scope: "all", category: "all" }).products.length, 0);
});

test("six canonical templates preserve vertex/edge IDs and actual diagonal geometry through save and room switching", () => {
  const counts = [4, 6, 5, 8, 8, 6];
  Object.keys(polygon.ROOM_TEMPLATES).forEach((template, i) => {
    const shape = { width: 5, depth: 4, height: 2.7, outline: polygon.roomTemplateOutline(template, 5, 4) };
    assert.equal(polygon.validateRoomPolygon(shape), null, template);
    const saved = syncDesignRooms(JSON.parse(JSON.stringify(design(shape))));
    assert.deepEqual(saved.outline, shape.outline); assert.deepEqual(saved.rooms[0].outline, shape.outline);
    const g = getRoomGeometry(saved); assert.equal(g.segments.length, counts[i]);
    assert.equal(new Set(g.segments.map(s => s.id)).size, counts[i]);
    if (["cut", "beveled"].includes(template)) assert.ok(g.segments.some(s => s.a.x !== s.b.x && s.a.z !== s.b.z));
  });
});

test("builder draft is independent; reflections/rotation preserve opening wall identity and inverse transforms", () => {
  const initial = design(room()); initial.pieces = [piece("existing")];
  const draft = builder.createRoomBuilderDraft(initial);
  assert.equal("pieces" in draft, false); assert.equal("id" in draft, false);
  const opening = { ...openings.createOpening("window-fixed", "north", .3), segmentId: draft.outline[0].segmentId };
  draft.openings = [opening]; assert.equal(builder.validateRoomBuilder(draft), null);
  const before = structuredClone(draft), rotated = builder.transformRoomBuilder(draft, "rotate");
  assert.equal(builder.validateRoomBuilder(rotated), null);
  assert.equal(rotated.openings[0].segmentId, opening.segmentId);
  const a = openings.openingWorldTransform(draft, opening), b = openings.openingWorldTransform(rotated, rotated.openings[0]);
  assert.ok(Math.abs(a.x - b.z) < 1e-7 && Math.abs(a.z + b.x) < 1e-7);
  assert.deepEqual(builder.transformRoomBuilder(builder.transformRoomBuilder(draft, "flip-x"), "flip-x"), before);
  assert.deepEqual(draft, before); assert.equal(initial.openings.length, 0);
  const reset = builder.chooseRoomTemplate(draft, "cut"); assert.equal(reset.openings.length, 0); assert.deepEqual(reset.wallMaterials, {});
});

test("invalid polygons and missing wall IDs roll back instead of becoming rectangular rooms", () => {
  const shape = room(); const crossed = structuredClone(shape); [crossed.outline[1], crossed.outline[2]] = [crossed.outline[2], crossed.outline[1]];
  assert.ok(polygon.validateRoomPolygon(crossed)); assert.throws(() => getRoomGeometry(crossed));
  const opening = { ...openings.createOpening("door-single", "north"), segmentId: "missing" };
  assert.match(openings.validateOpening(shape, opening), /хана/);
  const mounted = attachment.wallAttachedPiece({ ...piece("shelf"), placement: { surfaces: ["wall"] } }, shape, "r", shape.outline[0].segmentId, 2, 1.4);
  assert.throws(() => attachment.resolveFurnitureAttachments([mounted], { ...shape, outline: polygon.roomTemplateOutline("rectangle", 5, 4) }, "r"), /хана/);
});

test("diagonal and concave walls reject outside footprints in direct and persisted planner placement", () => {
  const shape = { ...room(), outline: polygon.roomTemplateOutline("cut", 5, 4) };
  const outside = { ...piece("outside", .3, .3), x: 2.3, z: 1.8 };
  assert.equal(isPlacementValid(outside, [], shape), false);
  const context = roomPlacementContext(design(shape));
  assert.equal(isPlacementValid(outside, [], context.room), false);
  const inside = { ...piece("inside", .5, .5), x: 0, z: 0 };
  assert.equal(isPlacementValid(inside, [], context.room), true);
  const concave = { ...shape, outline: polygon.roomTemplateOutline("u", 5, 4) };
  assert.equal(isPlacementValid(piece("notch", 4, 3), [], concave), false);
});

test("wall rear anchor clamps endpoints/height, supports arbitrary wall angles and rejects opening conflicts", () => {
  const shape = { ...room(), outline: polygon.roomTemplateOutline("cut", 5, 4) };
  const wall = getRoomGeometry(shape).segments[2];
  const shelf = { ...piece("shelf"), placement: { surfaces: ["wall"], gap: .02 } };
  const mounted = attachment.wallAttachedPiece(shelf, shape, "r", wall.id, 0, 20);
  assert.equal(mounted.elevation, shape.height - dimsFor(shelf).h);
  assert.ok(mounted.attachment.along >= dimsFor(shelf).w / 2);
  const face = { x: mounted.x - wall.nx * mounted.attachment.offset, z: mounted.z - wall.nz * mounted.attachment.offset };
  assert.ok(Math.abs((face.x - wall.a.x) * wall.nx + (face.z - wall.a.z) * wall.nz) < 1e-7);
  assert.equal(isPlacementValid(mounted, [], shape), true);
  const moved=attachment.moveAttachedFurniture(mounted,wall.b.x,wall.b.z,shape,"r",[mounted]);
  assert.ok(moved.attachment.along>mounted.attachment.along);
  assert.equal(moved.attachment.segmentId,mounted.attachment.segmentId);
  const rectangular = room(), window = { ...openings.createOpening("window-fixed", "north"), segmentId: rectangular.outline[0].segmentId };
  rectangular.openings = [window];
  assert.throws(() => attachment.wallAttachedPiece(shelf, rectangular, "r", window.segmentId, 2.5, 1.4), /цонх/);
  assert.equal(metadata.normalizePlacementMetadata({ requiresWallContact: false }).surfaces[0], "floor");
  assert.equal(attachment.findInitialFurniturePlacement(shelf, [], room(), "r").attachment.kind, "wall");
});

test("vertical collisions distinguish shelf/desk and reject ceiling overflow", () => {
  const shape = room(), desk = piece("desk", 1.2, .6, .75), shelf = { ...piece("shelf"), elevation: 1.4 };
  assert.equal(isPlacementValid(shelf, [desk], shape), true);
  assert.equal(isPlacementValid({ ...shelf, elevation: .6 }, [desk], shape), false);
  assert.equal(isPlacementValid({ ...shelf, elevation: 2.5 }, [desk], shape), false);
});

test("support-local attachments follow parent translation/rotation and reject cycles/edge overflow", () => {
  const shape = room(), parent = { ...piece("table", 1.5, 1, .8), placement: { surfaces: ["floor"], supportSurfaces: [{ id: "top", width: 1.5, depth: 1, elevation: .8 }] } };
  const child = { ...piece("object", .2, .2, .3), placement: { surfaces: ["surface"] }, attachment: { kind: "surface", parentInstanceId: parent.instanceId, surfaceId: "top", localPosition: [.3, .8, .1], localQuaternion: [0, 0, 0, 1] } };
  const resolved = attachment.resolveFurnitureAttachments([{ ...parent, x: 1, rotation: Math.PI / 2 }, child], shape, "r");
  assert.ok(Math.abs(resolved[1].x - 1.1) < 1e-7); assert.ok(Math.abs(resolved[1].z + .3) < 1e-7); assert.equal(resolved[1].elevation, .8);
  assert.equal(isPlacementValid(resolved[1], resolved, shape), true);
  assert.throws(() => attachment.resolveFurnitureAttachments([parent, { ...child, attachment: { ...child.attachment, localPosition: [1, .8, 0] } }], shape, "r"), /илүү/);
  assert.throws(() => attachment.resolveFurnitureAttachments([{ ...child, attachment: { ...child.attachment, parentInstanceId: child.instanceId } }], shape, "r"), /тойрог/);
});

test("camera interpolation is time-based, interrupted/replaced cleanly, and reduced motion finishes immediately", () => {
  const c = new THREE.PerspectiveCamera(40, 1, .1, 300), controls = { target: new THREE.Vector3(), update() {} };
  c.position.set(5, 4, 5); c.lookAt(controls.target);
  const from = camera.cameraPose(c, controls.target), to = { ...from, position: new THREE.Vector3(0, 8, .001), up: new THREE.Vector3(0, 0, -1), fov: 35 };
  camera.beginCameraTransition(c, from, to); assert.deepEqual(c.position.toArray(), from.position.toArray());
  assert.equal(camera.advanceCameraTransition(c, controls, .2), true); assert.notDeepEqual(c.position.toArray(), to.position.toArray());
  const intermediate = c.position.clone(); camera.cancelCameraTransition(c); assert.equal(camera.advanceCameraTransition(c, controls, 1), false); assert.deepEqual(c.position.toArray(), intermediate.toArray());
  camera.beginCameraTransition(c, camera.cameraPose(c, controls.target), to); camera.advanceCameraTransition(c, controls, 10);
  assert.ok(c.position.distanceTo(to.position) < 1e-6); assert.equal(c.fov, 35);
  const shifted = { ...from, position: from.position.clone().addScalar(1) };
  camera.beginCameraTransition(c, to, shifted, true); assert.deepEqual(c.position.toArray(), shifted.position.toArray());
  assert.equal(camera.advanceCameraTransition(c, controls, 1), false);
});

test("polygon union coverage preserves open-seam placement without admitting cut-away corners", () => {
  const left=polygon.roomTemplateOutline("cut",4,4),right=polygon.roomTemplateOutline("rectangle",4,4).map(p=>({...p,x:p.x+4}));
  assert.equal(polygon.polygonsCoverPolygon([[left],[right]],[{x:1.8,z:-.5},{x:2.2,z:-.5},{x:2.2,z:.5},{x:1.8,z:.5}]),true);
  assert.equal(polygon.polygonsCoverPolygon([[left],[right]],[{x:1.7,z:1.5},{x:2.3,z:1.5},{x:2.3,z:1.8},{x:1.7,z:1.8}]),false);
});

test("builder commits and attached-piece gestures have one history entry; save/reload and room copies retain canonical attachments", () => {
  const oldStorage=global.localStorage,oldWindow=global.window,saved=new Map();
  global.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};global.window={localStorage:global.localStorage};
  try {
    const {useDesigns:store}=loadSource("src/store/designs.ts");
    const draft=builder.createRoomBuilderDraft(room());
    store.getState().createNew("40","Attached","living",draft,draft);
    const initial=store.getState().current,roomId=initial.activeRoomId;
    assert.equal(store.getState().past.length,0);assert.deepEqual(initial.outline,draft.outline);
    const shelf=attachment.wallAttachedPiece({...piece("saved-shelf"),placement:{surfaces:["wall"]}},initial,roomId,initial.outline[0].segmentId,1.2,1.4);
    store.getState().updatePieces([shelf]);const before=store.getState().current.pieces[0],history=store.getState().past.length;
    store.getState().beginEdit();
    for(const along of [1.4,1.6,1.8])store.getState().updatePieces([attachment.wallAttachedPiece(before,initial,roomId,before.attachment.segmentId,along,1.5)]);
    store.getState().endEdit();assert.equal(store.getState().past.length,history+1);
    store.getState().undo();assert.deepEqual(store.getState().current.pieces[0],before);
    store.getState().redo();assert.equal(store.getState().current.pieces[0].attachment.along,1.8);
    store.getState().saveCurrent();
    const serialized=JSON.parse(saved.get("casa-designs-guest")).state.current;
    assert.deepEqual(serialized.pieces[0].attachment,store.getState().current.pieces[0].attachment);
    assert.deepEqual(syncDesignRooms(serialized).outline,initial.outline);
    store.getState().duplicateRoom(roomId);
    const duplicate=store.getState().current;
    assert.notEqual(duplicate.activeRoomId,roomId);assert.equal(duplicate.pieces[0].attachment.roomId,duplicate.activeRoomId);
    assert.notEqual(duplicate.pieces[0].instanceId,before.instanceId);
  }finally{global.localStorage=oldStorage;global.window=oldWindow;}
});
