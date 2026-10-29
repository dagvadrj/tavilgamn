const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { loadSource } = require("./helpers/load-source.cjs");

const rectangle = () => ({ width: 5, depth: 4, height: 2.7, wallFeatures: [], columns: [], openings: [] });

// Exercise the real component's event callbacks and hook state without a DOM
// renderer. SVG coordinates and animation frames are the only platform stubs.
function componentHarness(initial = rectangle(), accept = () => null, extra = {}) {
  let room = structuredClone(initial), tree, plan, cursor = 0, frameId = 0;
  const slots = [], cleanups = [], frames = new Map(), captures = new Set(), changes = [];
  const previous = Object.fromEntries(["window", "DOMPoint", "requestAnimationFrame", "cancelAnimationFrame"].map(key => [key, global[key]]));
  global.window = { addEventListener() {}, removeEventListener() {} };
  const inverse = { a: .01, b: 0, c: 0, d: .01, e: -1, f: -2 };
  let currentInverse = inverse;
  global.DOMPoint = class {
    constructor(x, y) { this.x = x; this.y = y; }
    matrixTransform(m) { return { x: m.a * this.x + m.c * this.y + m.e, y: m.b * this.x + m.d * this.y + m.f }; }
  };
  global.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  global.cancelAnimationFrame = id => frames.delete(id);
  const hooks = {
    ...React,
    useRef: initialValue => {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: { current: initialValue } };
      return slots[index].value;
    },
    useState: initialValue => {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initialValue === "function" ? initialValue() : initialValue };
      return [slots[index].value, value => { slots[index].value = typeof value === "function" ? value(slots[index].value) : value; }];
    },
    useId: () => {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: `test-help-${index}` };
      return slots[index].value;
    },
    useEffect: (effect, dependencies) => {
      const index = cursor++;
      if (!slots[index] || !dependencies || dependencies.some((value, i) => value !== slots[index].dependencies?.[i])) {
        cleanups[index]?.();
        slots[index] = { dependencies };
        cleanups[index] = effect();
      }
    },
  };
  const { RoomWallPlan } = loadSource("src/components/RoomWallPlan.tsx", { react: hooks, "@/features/room-planner/components/RoomMeasureUnit": { useRoomMeasureUnit: select => select({unit:"см"}) } });
  const svg = {
    getScreenCTM: () => ({ inverse: () => currentInverse }),
    setPointerCapture: id => captures.add(id),
    hasPointerCapture: id => captures.has(id),
    releasePointerCapture: id => captures.delete(id),
  };
  const nodes = node => !node || typeof node !== "object" ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)];
  const render = () => {
    cursor = 0;
    tree = RoomWallPlan({ room, ...extra, onChange: (next, contentShift) => {
      const error = accept(next, contentShift);
      changes.push({ room: structuredClone(next), contentShift, error });
      if (!error) room = next;
      return error;
    } });
    plan = nodes(tree).find(node => node.props?.editing);
    assert.ok(plan, "interactive SVG props are rendered");
    plan.props.editing.svgRef.current = svg;
  };
  const event = (x, y = 200, pointerId = 1, extra = {}) => ({
    clientX: x, clientY: y, pointerId, button: 0,
    currentTarget: { focus() {} }, preventDefault() {}, stopPropagation() {}, ...extra,
  });
  const handle = wall => nodes(plan.props.editing.overlay).find(node => node.props?.role === "button" &&
    node.props["aria-label"].includes({ north: "AB ·", east: "BC ·", south: "CD ·", west: "DA ·" }[wall]));
  const dispatch = (name, x, y = 200, pointerId = 1) => {
    plan.props.editing.svgProps[name](event(x, y, pointerId));
    render();
  };
  render();
  return {
    get room() { return room; }, get changes() { return changes; }, get pendingFrames() { return frames.size; },
    get captured() { return captures.size; }, get editing() { return plan.props.editing; },
    panStart(x = 350, y = 200, pointerId = 1) { dispatch("onPointerDownCapture", x, y, pointerId); },
    start(wall, x = 350, y = 200, pointerId = 1) {
      const target = handle(wall);
      assert.ok(target, `${wall} wall is keyboard/pointer accessible`);
      target.props.onPointerDown(event(x, y, pointerId));
      render();
    },
    move(x, y = 200, pointerId = 1) { dispatch("onPointerMove", x, y, pointerId); },
    end(x, y = 200, pointerId = 1) { dispatch("onPointerUp", x, y, pointerId); },
    cancel(x = 99999, y = 99999) { dispatch("onPointerCancel", x, y); },
    loseCapture(x = 99999, y = 99999) { captures.clear(); dispatch("onLostPointerCapture", x, y); },
    key(wall, key, shiftKey = false) {
      let prevented = false;
      handle(wall).props.onKeyDown({ key, shiftKey, preventDefault() { prevented = true; }, stopPropagation() {} });
      render();
      return prevented;
    },
    flush() {
      const callbacks = [...frames.values()]; frames.clear();
      callbacks.forEach(callback => callback(0));
      render();
    },
    changeViewport() { currentInverse = { a: .02, b: 0, c: 0, d: .02, e: 5, f: 5 }; },
    cleanup() {
      cleanups.forEach(cleanup => cleanup?.());
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete global[key]; else global[key] = value;
      }
    },
  };
}

test("hand tool pans the SVG viewport without editing walls or furniture and survives cancellation", () => {
  const h = componentHarness(rectangle(), () => assert.fail("pan must not edit the room"), { handTool: true });
  try {
    assert.equal(h.editing.overlay, null, "editing hit targets are absent in hand mode");
    h.panStart(); assert.equal(h.captured, 1);
    assert.equal(h.editing.svgProps.style.cursor, "grabbing");
    h.move(400, 230);
    for (const [axis,value] of Object.entries({minX:-3,maxX:2,minZ:-2.3,maxZ:1.7})) assert.ok(Math.abs(h.editing.bounds[axis]-value)<1e-9);
    h.changeViewport();h.move(420,240);
    assert.ok(Math.abs(h.editing.bounds.minX+3.2)<1e-9,"gesture retains its original SVG transform");
    h.cancel();assert.equal(h.captured,0);
    assert.equal(h.editing.svgProps.style.cursor,"grab");
    const bounds=h.editing.bounds;h.move(800,800);assert.deepEqual(h.editing.bounds,bounds);
    assert.deepEqual(h.room,rectangle());assert.equal(h.changes.length,0);
  } finally { h.cleanup(); }
  const locked=componentHarness(rectangle(),()=>assert.fail(),{handTool:true,locked:true});
  try { locked.panStart();locked.move(500);assert.equal(locked.captured,0);assert.equal(locked.editing.bounds,undefined); }
  finally {locked.cleanup();}
});

test("wall pointer samples coalesce per frame and retain the gesture's original geometry and SVG transform", () => {
  const h = componentHarness();
  try {
    h.start("east");
    assert.equal(h.captured, 1);
    const originalBounds = h.editing.bounds;
    h.move(360); h.move(370);
    assert.equal(h.pendingFrames, 1);
    assert.equal(h.changes.length, 0, "no synchronous change for each raw pointer sample");
    h.flush();
    assert.equal(h.room.width, 5.2);
    assert.equal(h.changes.length, 1);
    h.changeViewport();
    h.move(380); h.flush();
    assert.equal(h.room.width, 5.3, "total baseline displacement, not 5.2 + .3");
    assert.deepEqual(h.editing.bounds, originalBounds);
    assert.equal(Math.round(h.editing.offset.x * 1000), 150);
    h.end(390);
    assert.equal(h.room.width, 5.4, "pointer-up consumes its own final sample");
    assert.deepEqual(h.changes.map(change => Math.round(change.contentShift.x * 1000)), [-100, -50, -50],
      "content translation is incremental between accepted frames, not cumulative from baseline");
    assert.equal(h.pendingFrames, 0);
    assert.equal(h.captured, 0);
    assert.equal(h.editing.bounds, undefined, "viewport can fit after the gesture ends");
  } finally { h.cleanup(); }
});

test("pointer-up replaces a pending frame sample and cannot be applied again by an old frame", () => {
  const h = componentHarness();
  try {
    h.start("east"); h.move(360); h.end(365.149);
    assert.equal(h.room.width, 5.151);
    assert.equal(h.changes.length, 1);
    assert.equal(h.pendingFrames, 0);
    h.flush();
    assert.equal(h.changes.length, 1);
  } finally { h.cleanup(); }
});

test("a rejected wall displacement retains the last accepted room and can recover in the same gesture", () => {
  const h = componentHarness(rectangle(), next => next.width < 4.8 ? "Furniture would cross the wall" : null);
  try {
    h.start("east"); h.move(340); h.flush();
    assert.equal(h.room.width, 4.9);
    h.move(320); h.flush();
    assert.equal(h.room.width, 4.9);
    assert.equal(h.changes.at(-1).error, "Furniture would cross the wall");
    h.move(335); h.flush();
    assert.equal(h.room.width, 4.85);
    assert.equal(h.changes.at(-1).error, null);
    assert.equal(Math.round(h.changes.at(-1).contentShift.x * 1000), 25,
      "a rejected frame must not advance the accepted content translation");
    h.end(335);
  } finally { h.cleanup(); }
});

test("cancel and lost capture retain the last real sample, ignore cancellation coordinates, and release the gesture", () => {
  for (const stop of ["cancel", "loseCapture"]) {
    const h = componentHarness();
    try {
      h.start("east"); h.move(360); h.flush();
      h.move(370);
      h[stop]();
      assert.equal(h.room.width, 5.2, `${stop} consumes only the last real pending move`);
      assert.equal(h.pendingFrames, 0);
      assert.equal(h.captured, 0);
      const count = h.changes.length;
      h.move(500); h.end(500); h.flush();
      assert.equal(h.changes.length, count, "orphan events after cancellation cannot mutate the room");
      h.start("east", 370); h.end(380);
      assert.equal(h.room.width, 5.3, "a new gesture starts from the accepted size");
    } finally { h.cleanup(); }
  }
});

test("secondary pointers cannot move or terminate the active wall gesture", () => {
  const h = componentHarness();
  try {
    h.start("east"); h.move(500, 200, 2); h.end(500, 200, 2); h.flush();
    assert.equal(h.changes.length, 0);
    assert.equal(h.captured, 1);
    h.move(360); h.flush(); h.end(360);
    assert.equal(h.room.width, 5.1);
  } finally { h.cleanup(); }
});

test("keyboard movement uses exact 1 mm and Shift 10 mm steps in the correct wall direction", () => {
  const h = componentHarness();
  try {
    assert.equal(h.key("east", "ArrowRight"), true);
    assert.equal(h.room.width, 5.001);
    h.key("east", "ArrowRight", true);
    assert.equal(h.room.width, 5.011);
    h.key("west", "ArrowRight");
    assert.equal(h.room.width, 5.01);
    h.key("north", "ArrowUp", true);
    assert.equal(h.room.depth, 4.01);
    h.key("south", "ArrowUp");
    assert.equal(h.room.depth, 4.009);
    const count = h.changes.length;
    assert.equal(h.key("east", "ArrowUp"), false);
    assert.equal(h.changes.length, count, "orthogonal keys are not stolen");
    h.start("east"); h.key("east", "ArrowRight");
    assert.equal(h.changes.length, count, "keyboard input cannot race an active pointer gesture");
    h.end(350);
  } finally { h.cleanup(); }
});

test("unmount cancels queued work before a detached component can update the room", () => {
  const h = componentHarness();
  h.start("east"); h.move(400);
  assert.equal(h.pendingFrames, 1);
  h.cleanup();
  assert.equal(h.pendingFrames, 0);
  assert.equal(h.changes.length, 0);
});

test("actual wall callbacks persist with room contents and multiple gestures form one editor undo session", () => {
  const previousStorage = global.localStorage, previousWindow = global.window;
  const saved = new Map();
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
  global.localStorage = storage; global.window = { localStorage: storage };
  let h;
  try {
    const { useDesigns } = loadSource("src/store/designs.ts");
    const state = () => useDesigns.getState();
    state().createNew("80", "Wall interaction", "living");
    state().updateRoom({ ...rectangle(), pieces: [{ instanceId: "furniture", productId: "chair", x: -2, z: 0,
      rotation: 0, color: "oak", material: "wood" }], lighting: { mode: "day", ambient: .65, sunlight: 1.8,
      fixtures: [{ id: "light", x: 0, z: 1, intensity: 1, color: "#ffffff" }] } });
    state().saveCurrent();
    const historyCount = state().past.length;
    state().beginEdit();
    h = componentHarness(state().current, (next, shift) => {
      const current = state().current;
      state().updateRoom({ ...next,
        pieces: current.pieces.map(piece => ({ ...piece, x: piece.x + shift.x, z: piece.z + shift.z })),
        lighting: { ...current.lighting, fixtures: current.lighting.fixtures.map(fixture => ({ ...fixture, x: fixture.x + shift.x, z: fixture.z + shift.z })) },
      });
      return null;
    });
    h.start("east"); h.move(360); h.flush(); h.move(370); h.flush(); h.end(380);
    h.start("east"); h.end(360);
    assert.equal(state().past.length, historyCount, "live updates do not create per-frame history entries");
    assert.equal(state().current.width, 5.4);
    assert.ok(Math.abs(state().current.pieces[0].x + 2.2) < 1e-12);
    assert.ok(Math.abs(state().current.lighting.fixtures[0].x + .2) < 1e-12);
    assert.equal(state().designs[0].width, 5, "saved copy is isolated from the active room");
    state().endEdit();
    assert.equal(state().past.length, historyCount + 1);
    state().undo();
    assert.equal(state().current.width, 5);
    assert.equal(state().current.pieces[0].x, -2);
    assert.equal(state().current.lighting.fixtures[0].x, 0);
    state().redo();
    assert.equal(state().current.width, 5.4);
    assert.ok(Math.abs(state().current.pieces[0].x + 2.2) < 1e-12);
    const persisted = JSON.parse(saved.get("casa-designs-guest")).state.current;
    assert.equal(persisted.width, 5.4);
    assert.equal(persisted.rooms.find(room => room.id === persisted.activeRoomId).width, 5.4);
  } finally {
    h?.cleanup();
    if (previousStorage === undefined) delete global.localStorage; else global.localStorage = previousStorage;
    if (previousWindow === undefined) delete global.window; else global.window = previousWindow;
  }
});


test("2D furniture drags keep their initial coordinates and recover after invalid destinations", () => {
  const moves=[];const piece={instanceId:'own',productId:'own',x:0,z:0,rotation:0,color:'#bbb',material:'wood',details:{name:'Desk',dimensions:{w:1,d:.6,h:.8}}};
  const extra={pieces:[piece],onSelectPiece(){},onMovePiece:(id,x,z)=>{if(x>1)return 'blocked';moves.push({id,x,z});extra.pieces=[{...piece,x,z}];return null;}};
  const h=componentHarness(rectangle(),()=>null,extra);
  const nodes=t=>!t||typeof t!=='object'?[]:[t,...React.Children.toArray(t.props?.children).flatMap(nodes)];
  try {
    const target=nodes(h.editing.overlay).find(n=>n.type==='rect'&&n.props.role==='button');
    target.props.onPointerDown({pointerId:1,button:0,clientX:100,clientY:200,stopPropagation(){},preventDefault(){}});
    h.move(150,200);assert.deepEqual(moves.at(-1),{id:'own',x:.5,z:0});
    h.move(300,200);assert.equal(moves.length,1);
    h.move(170,200);assert.deepEqual(moves.at(-1),{id:'own',x:.7,z:0});
    h.cancel();assert.deepEqual(moves.at(-1),{id:'own',x:0,z:0},'cancel restores the complete gesture baseline');
    h.move(190,200);assert.equal(moves.length,3,'the cancelled gesture cannot accept more samples');
    const nextTarget=nodes(h.editing.overlay).find(n=>n.type==='rect'&&n.props.role==='button');
    nextTarget.props.onPointerDown({pointerId:1,button:0,clientX:170,clientY:200,stopPropagation(){},preventDefault(){}});
    h.end(180,200);assert.deepEqual(moves.at(-1),{id:'own',x:.1,z:0});
  } finally {h.cleanup();}
});
