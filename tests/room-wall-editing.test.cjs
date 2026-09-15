const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const { getRoomWallTargets, moveRoomWall } = loadSource("src/lib/roomWallEditing.ts");
const { getRoomGeometry } = loadSource("src/lib/roomGeometry.ts");
const { openingWorldTransform } = loadSource("src/lib/roomOpenings.ts");
const rectangle = () => ({ width: 5, depth: 4, height: 2.7, wallFeatures: [], columns: [], openings: [] });
const targetFor = (room, wall, part) => getRoomWallTargets(room).find(target => target.wall === wall && (part ? target.featurePart === part : target.kind === "wall"));
const move = (room, wall, delta, part) => {
  const target = targetFor(room, wall, part);
  assert.ok(target, `${wall} ${part ?? "base"} target exists`);
  return moveRoomWall(room, target, delta);
};

test("rectangular wall targets follow numbered perimeter and movement axes", () => {
  const room = rectangle(), targets = getRoomWallTargets(room);
  assert.deepEqual(targets.map(target => [target.wall, target.axis, target.segmentIndex]), [
    ["north", "z", 0], ["east", "x", 1], ["south", "z", 2], ["west", "x", 3],
  ]);
  assert.equal(new Set(targets.map(target => target.id)).size, targets.length);
  assert.deepEqual(targets.map(target => target.segment), getRoomGeometry(room).segments);
});

test("base wall drags round to exact integer mm and preserve the input shape", () => {
  for (const [wall, key, expected] of [["north", "depth", 3.877], ["east", "width", 5.123], ["south", "depth", 4.123], ["west", "width", 4.877]]) {
    const room = rectangle(), before = structuredClone(room), result = move(room, wall, 0.12349);
    assert.equal(result.error, null);
    assert.equal(result.room[key], expected);
    assert.deepEqual(room, before);
    const bounds = getRoomGeometry(result.room).bounds;
    assert.equal(bounds.minX, -result.room.width / 2);
    assert.equal(bounds.minZ, -result.room.depth / 2);
  }
});

test("base wall size clamps to 1000–20000 mm and repeated gesture samples do not accumulate", () => {
  const room = rectangle(), target = targetFor(room, "east");
  assert.equal(moveRoomWall(room, target, 100).room.width, 20);
  assert.equal(moveRoomWall(room, target, -100).room.width, 1);
  for (let sample = 0; sample < 500; sample++) {
    const delta = sample / 10000;
    assert.equal(moveRoomWall(room, target, delta).room.width, (5000 + Math.round(delta * 1000)) / 1000);
  }
  assert.equal(moveRoomWall(room, target, 0.0001).room.width, 5);
});

test("every inset and recess orientation edits its visible face and both side walls", () => {
  for (const kind of ["inset", "recess"]) for (const wall of ["north", "east", "south", "west"]) {
    const room = { ...rectangle(), wallFeatures: [{ id: "feature", wall, kind, offset: 1, length: 1.2, depth: 0.4 }] };
    const targets = getRoomWallTargets(room).filter(target => target.kind === "feature");
    assert.deepEqual(targets.map(target => target.featurePart).sort(), ["end", "face", "start"]);
    const inward = wall === "north" || wall === "west" ? 1 : -1;
    const clockwise = wall === "north" || wall === "east" ? 1 : -1;
    const face = move(room, wall, .123 * inward * (kind === "inset" ? 1 : -1), "face");
    assert.equal(face.error, null);
    assert.equal(face.room.wallFeatures[0].depth, .523);
    const start = move(room, wall, .123 * clockwise, "start");
    assert.equal(start.error, null);
    assert.equal(start.room.wallFeatures[0].offset, 1.123);
    assert.equal(start.room.wallFeatures[0].length, 1.077);
    const end = move(room, wall, .123 * clockwise, "end");
    assert.equal(end.error, null);
    assert.equal(end.room.wallFeatures[0].offset, 1);
    assert.equal(end.room.wallFeatures[0].length, 1.323);
    assert.equal(room.wallFeatures[0].depth, .4);
  }
});

test("feature dimensions clamp at 50 mm, 3000 mm depth, and the selected wall's corners", () => {
  const room = { ...rectangle(), wallFeatures: [{ id: "f", wall: "north", kind: "recess", offset: 1, length: 1.2, depth: .4 }] };
  assert.equal(move(room, "north", 100, "face").room.wallFeatures[0].depth, .05);
  assert.equal(move(room, "north", -100, "face").room.wallFeatures[0].depth, 3);
  const shrinkStart = move(room, "north", 100, "start").room.wallFeatures[0];
  assert.equal(shrinkStart.offset, 2.15);
  assert.equal(shrinkStart.length, .05);
  const expandStart = move(room, "north", -100, "start").room.wallFeatures[0];
  assert.equal(expandStart.offset, 0);
  assert.equal(expandStart.length, 2.2);
  assert.equal(move(room, "north", -100, "end").room.wallFeatures[0].length, .05);
  assert.equal(move(room, "north", 100, "end").room.wallFeatures[0].length, 4);
});

test("merged corner recess side is split from the neighboring base wall", () => {
  const room = { ...rectangle(), wallFeatures: [{ id: "corner", wall: "north", kind: "recess", offset: 0, length: 1, depth: .5 }] };
  const targets = getRoomWallTargets(room), side = targetFor(room, "north", "start"), west = targetFor(room, "west");
  assert.ok(side && west);
  assert.equal(side.segmentIndex, west.segmentIndex);
  assert.equal(side.segment.length, .5);
  assert.equal(west.segment.length, 4);
  assert.equal(new Set(targets.map(target => target.id)).size, targets.length);
  assert.equal(moveRoomWall(room, side, .1).room.wallFeatures[0].offset, .1);
  assert.equal(moveRoomWall(room, west, -.1).room.width, 5.1);
});

test("merged adjoining feature faces remain individually editable", () => {
  const room = { ...rectangle(), wallFeatures: [
    { id: "first", wall: "north", kind: "inset", offset: 1, length: 1, depth: .4 },
    { id: "second", wall: "north", kind: "inset", offset: 2, length: 1, depth: .4 },
  ] };
  const faces = getRoomWallTargets(room).filter(target => target.featurePart === "face");
  assert.equal(faces.length, 2);
  assert.equal(faces[0].segmentIndex, faces[1].segmentIndex);
  assert.equal(faces[0].segment.length, 1);
  const result = moveRoomWall(room, faces[0], .1);
  assert.equal(result.error, null);
  assert.deepEqual(result.room.wallFeatures.map(feature => feature.depth), [.5, .4]);
});

test("column cuts cannot masquerade as editable walls, including a merged feature edge", () => {
  const room = { ...rectangle(), columns: [{ id: "column", x: 2, z: 0, width: .5, depth: .5 }] };
  const targets = getRoomWallTargets(room);
  assert.equal(targets.length, 5);
  assert.ok(targets.every(target => target.kind === "wall"));
  assert.equal(targets.filter(target => target.wall === "north").length, 2);
  assert.equal(new Set(targets.map(target => target.id)).size, 5);
  const merged = { ...room, wallFeatures: [{ id: "f", wall: "north", kind: "inset", offset: 1, length: 1, depth: .5 }] };
  const face = targetFor(merged, "north", "face");
  assert.equal(face.segment.length, 1);
  assert.equal(Math.max(face.segment.a.x, face.segment.b.x), -.5);
  const mergedTargets = getRoomWallTargets(merged);
  assert.equal(mergedTargets.reduce((total, target) => total + target.segment.length, 0), 18);
  assert.ok(!mergedTargets.some(target => target.segment.a.x === 0 && target.segment.b.x === 0));
  const hole = { ...rectangle(), columns: [{ id: "inside", x: 2, z: 1, width: .5, depth: .5 }] };
  assert.equal(getRoomWallTargets(hole).length, 4);
});

test("moves reject clipped columns and wall features without mutating the accepted room", () => {
  const columnRoom = { ...rectangle(), columns: [{ id: "c", x: 4, z: 1, width: .5, depth: .5 }] };
  const clipped = move(columnRoom, "east", -1);
  assert.ok(clipped.error);
  assert.equal(clipped.room, columnRoom);
  const featureRoom = { ...rectangle(), wallFeatures: [{ id: "f", wall: "north", kind: "inset", offset: 4, length: .8, depth: .3 }] };
  const cut = move(featureRoom, "east", -1);
  assert.ok(cut.error);
  assert.equal(cut.room, featureRoom);
});

test("door physical positions survive valid resize and insufficient frame space is rejected", () => {
  const door = { id: "door", kind: "door", templateId: "door-single", wallId: "north", position: .5,
    width: .9, height: 2.1, sillHeight: 0, hinge: "left", swing: "inward", open: false };
  const room = { ...rectangle(), openings: [door] };
  const valid = move(room, "east", 1.123);
  assert.equal(valid.error, null);
  assert.equal(valid.room.openings[0].position, 2500 / 6123);
  assert.equal(valid.room.openings[0].width, door.width);
  assert.deepEqual(room.openings, [door]);
  const tooSmall = move(room, "east", -100);
  assert.ok(tooSmall.error);
  assert.equal(tooSmall.room, room);
  const featured = { ...room, wallFeatures: [{ id: "f", wall: "north", kind: "inset", offset: 0, length: 1, depth: .4 }] };
  const intoDoor = move(featured, "north", 2, "end");
  assert.ok(intoDoor.error);
  assert.equal(intoDoor.room, featured);
});

test("base-wall movement returns the inverse center displacement for contents", () => {
  for (const [wall, delta, expected] of [["east", 1.123, { x: -.5615, z: 0 }], ["west", -1.123, { x: .5615, z: 0 }],
    ["north", -1.123, { x: 0, z: .5615 }], ["south", 1.123, { x: 0, z: -.5615 }]]) {
    const result = move(rectangle(), wall, delta);
    assert.equal(result.error, null);
    assert.deepEqual(result.contentShift, expected);
  }
  assert.deepEqual(move(rectangle(), "east", 100).contentShift, { x: -7.5, z: 0 });
  assert.deepEqual(move(rectangle(), "west", 100).contentShift, { x: -2, z: 0 });
});

test("columns remain stationary for every anchored wall resize", () => {
  for (const [wall, delta] of [["east", 1.123], ["west", -1.123], ["north", -1.123], ["south", 1.123]]) {
    const room = { ...rectangle(), columns: [{ id: "c", x: 2, z: 1, width: .5, depth: .5 }] };
    const result = move(room, wall, delta), column = result.room.columns[0];
    assert.equal(result.error, null);
    assert.ok(Math.abs(column.x - result.room.width / 2 - result.contentShift.x - (room.columns[0].x - room.width / 2)) < 1e-12);
    assert.ok(Math.abs(column.z - result.room.depth / 2 - result.contentShift.z - (room.columns[0].z - room.depth / 2)) < 1e-12);
  }
  const stationary = { ...rectangle(), columns: [{ id: "c", x: 4, z: 1, width: .5, depth: .5 }] };
  const shrink = move(stationary, "west", 3);
  assert.equal(shrink.error, null);
  assert.equal(shrink.room.columns[0].x, 1);
  assert.equal(shrink.room.width, 2);
});

test("door centers remain stationary on resized walls in every orientation", () => {
  for (const [wall, delta, others] of [["east", 1.123, ["north", "south"]], ["west", -1.123, ["north", "south"]],
    ["north", -1.123, ["east", "west"]], ["south", 1.123, ["east", "west"]]]) {
    const room = { ...rectangle(), openings: others.map((wallId, i) => ({ id: `d${i}`, kind: "door", templateId: "door-single", wallId, position: .371,
      width: .9, height: 2.1, sillHeight: 0, hinge: "left", swing: "inward", open: false })) };
    const result = move(room, wall, delta);
    assert.equal(result.error, null);
    room.openings.forEach((opening, index) => {
      const before = openingWorldTransform(room, opening), after = openingWorldTransform(result.room, result.room.openings[index]);
      assert.ok(Math.abs(after.x - result.contentShift.x - before.x) < 1e-12);
      assert.ok(Math.abs(after.z - result.contentShift.z - before.z) < 1e-12);
    });
  }
});

test("shrinking a distant wall preserves a door near the stationary endpoint", () => {
  for (const [wall, position] of [["east", .12], ["west", .88]]) {
    const room = { ...rectangle(), openings: [{ id: "d", kind: "door", templateId: "door-single", wallId: "north", position,
      width: .9, height: 2.1, sillHeight: 0, hinge: "left", swing: "inward", open: false }] };
    const result = move(room, wall, wall === "east" ? -3 : 3);
    assert.equal(result.error, null);
    assert.equal(result.room.width, 2);
    assert.ok(Math.abs(result.room.openings[0].position - (wall === "east" ? .3 : .7)) < 1e-12);
  }
});

test("interior perpendicular features preserve physical endpoints while a base wall moves", () => {
  for (const [wall, delta, others] of [["east", 1.123, ["north", "south"]], ["west", -1.123, ["north", "south"]],
    ["north", -1.123, ["east", "west"]], ["south", 1.123, ["east", "west"]]]) {
    const room = { ...rectangle(), wallFeatures: others.map((featureWall, i) => ({ id: `f${i}`, wall: featureWall, kind: "inset", offset: 1, length: .6, depth: .3 })) };
    const result = move(room, wall, delta);
    assert.equal(result.error, null);
    for (const feature of room.wallFeatures) {
      const before = targetFor(room, feature.wall, "face").segment, after = targetFor(result.room, feature.wall, "face").segment;
      for (const end of ["a", "b"]) {
        assert.ok(Math.abs(after[end].x - result.contentShift.x - before[end].x) < 1e-12);
        assert.ok(Math.abs(after[end].z - result.contentShift.z - before[end].z) < 1e-12);
      }
    }
  }
});

test("moving-corner features retain their size and full-span features stretch", () => {
  for (const [wall, delta, featureWall, originMoved] of [["east", 1, "south", true], ["west", -1, "north", true],
    ["north", -1, "east", true], ["south", 1, "west", true], ["east", 1, "north", false],
    ["west", -1, "south", false], ["north", -1, "west", false], ["south", 1, "east", false]]) {
    const span = featureWall === "north" || featureWall === "south" ? 5 : 4;
    const room = { ...rectangle(), wallFeatures: [{ id: "f", wall: featureWall, kind: "inset", offset: originMoved ? 0 : span - .6, length: .6, depth: .3 }] };
    const result = move(room, wall, delta);
    assert.equal(result.error, null);
    assert.equal(result.room.wallFeatures[0].length, .6);
    assert.equal(result.room.wallFeatures[0].offset, originMoved ? 0 : span + 1 - .6);
    const full = { ...room, wallFeatures: [{ ...room.wallFeatures[0], offset: 0, length: span }] };
    const stretched = move(full, wall, delta);
    assert.equal(stretched.error, null);
    assert.equal(stretched.room.wallFeatures[0].offset, 0);
    assert.equal(stretched.room.wallFeatures[0].length, span + 1);
  }
});

test("overlapping features and disconnected usable space are rejected", () => {
  const room = { ...rectangle(), wallFeatures: [
    { id: "north", wall: "north", kind: "inset", offset: 2, length: 1, depth: 1.5 },
    { id: "south", wall: "south", kind: "inset", offset: 2, length: 1, depth: 1.5 },
  ] };
  const disconnected = move(room, "north", 1, "face");
  assert.ok(disconnected.error);
  assert.equal(disconnected.room, room);
  const adjacent = { ...rectangle(), wallFeatures: [
    { id: "a", wall: "north", kind: "inset", offset: 1, length: 1, depth: .4 },
    { id: "b", wall: "north", kind: "inset", offset: 2.5, length: 1, depth: .4 },
  ] };
  const overlap = move(adjacent, "north", 1, "end");
  assert.ok(overlap.error);
  assert.equal(overlap.room, adjacent);
});

test("nonfinite movement and a stale target produce recoverable errors", () => {
  const room = rectangle(), target = targetFor(room, "east");
  assert.ok(moveRoomWall(room, target, NaN).error);
  assert.ok(moveRoomWall(room, target, Infinity).error);
  assert.ok(moveRoomWall(room, { ...target, id: "missing" }, .1).error);
  assert.ok(moveRoomWall(room, { ...target, axis: "z" }, .1).error);
});
