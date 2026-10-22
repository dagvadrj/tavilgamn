const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { loadSource } = require("./helpers/load-source.cjs");
const { createUnifiedKitchen } = loadSource("src/lib/kitchenAssembly.ts");
const { roomOutline } = loadSource("src/lib/kitchenRoomOutline.ts");
const { DEFAULT_KITCHEN_WALL_COLOR } = loadSource("src/lib/kitchenSpace.ts");

function nodes(node) {
  return !React.isValidElement(node)
    ? []
    : [node, ...React.Children.toArray(node.props.children).flatMap(nodes)];
}

function editor(initial, disabled = false) {
  const state = [];
  let cursor = 0;
  let kitchen = initial;
  const commits = [];
  const { KitchenSpaceEditor } = loadSource(
    "src/features/kitchen-planner/components/KitchenSpaceEditor.tsx",
    {
      react: {
        ...React,
        useEffect() {},
        useRef(initial) {
          return { current: initial };
        },
        useState(initial) {
          const index = cursor++;
          if (!(index in state)) state[index] = initial;
          return [
            state[index],
            (value) => {
              state[index] =
                typeof value === "function" ? value(state[index]) : value;
            },
          ];
        },
      },
    },
  );
  return {
    commits,
    render() {
      cursor = 0;
      return nodes(
        KitchenSpaceEditor({
          kitchen,
          disabled,
          onChange(next) {
            commits.push(next);
            kitchen = next;
            return true;
          },
          onClose() {},
          onReview() {},
          onSelectCabinet() {},
        }),
      );
    },
  };
}

const target = (tree) =>
  tree.find((node) => node.props["aria-label"] === "Будах хана");
const hex = (tree) =>
  tree.find((node) => node.props["aria-label"] === "Ханын өнгөний HEX код");
const apply = (tree) =>
  tree.find(
    (node) =>
      node.type === "button" &&
      React.Children.toArray(node.props.children).includes("Өнгийг хэрэглэх"),
  );

test("untouched paint controls show the renderer default and Apply creates no change", () => {
  const ui = editor(createUnifiedKitchen());
  assert.equal(hex(ui.render()).props.value, DEFAULT_KITCHEN_WALL_COLOR);
  apply(ui.render()).props.onClick();
  assert.equal(ui.commits.length, 0);
  target(ui.render()).props.onChange({ target: { value: "right" } });
  assert.equal(hex(ui.render()).props.value, DEFAULT_KITCHEN_WALL_COLOR);
  apply(ui.render()).props.onClick();
  assert.equal(ui.commits.length, 0);
});

test("a custom per-wall colour commits once on Apply and preserves the complete kitchen draft", () => {
  const kitchen = createUnifiedKitchen();
  kitchen.room.wallColors = { back: "#123456", right: "#eeddbb" };
  const original = structuredClone(kitchen);
  const ui = editor(kitchen);
  target(ui.render()).props.onChange({ target: { value: "right" } });
  assert.equal(hex(ui.render()).props.value, "#eeddbb");
  hex(ui.render()).props.onChange({ target: { value: "#123ABC" } });
  assert.equal(
    ui.commits.length,
    0,
    "picker/typing must not flood undo history",
  );
  apply(ui.render()).props.onClick();
  assert.equal(ui.commits.length, 1);
  assert.deepEqual(ui.commits[0].room.wallColors, {
    back: "#123456",
    right: "#123abc",
  });
  assert.deepEqual(ui.commits[0].cabinets, original.cabinets);
  assert.equal(ui.commits[0].room.width, original.room.width);
  assert.equal(ui.commits[0].room.depth, original.room.depth);
  assert.equal(ui.commits[0].room.height, original.room.height);
  assert.deepEqual(
    kitchen,
    original,
    "the saved draft must not be mutated in place",
  );
  apply(ui.render()).props.onClick();
  assert.equal(
    ui.commits.length,
    1,
    "reapplying the same colour creates no history entry",
  );
});

test("all-wall paint follows existing outline walls and preserves hidden-front colour and geometry", () => {
  const kitchen = createUnifiedKitchen();
  kitchen.room.outline = roomOutline(kitchen.room);
  kitchen.room.openFront = true;
  kitchen.room.items = [];
  kitchen.room.wallColors = { front: "#112233", right: "#778899" };
  const before = structuredClone(kitchen.room);
  const ui = editor(kitchen);
  assert.deepEqual(
    React.Children.toArray(target(ui.render()).props.children).map(
      (node) => node.props.value,
    ),
    ["all", "back", "left", "right"],
  );
  hex(ui.render()).props.onChange({ target: { value: "#aabbcc" } });
  apply(ui.render()).props.onClick();
  assert.equal(ui.commits.length, 1);
  const room = ui.commits[0].room;
  assert.deepEqual(room.wallColors, {
    front: "#112233",
    back: "#aabbcc",
    left: "#aabbcc",
    right: "#aabbcc",
  });
  assert.deepEqual(room.outline, before.outline);
  assert.deepEqual(room.items, before.items);
  assert.equal(room.openFront, true);
});

test("invalid colours and read-only editors cannot write a paint change", () => {
  const kitchen = createUnifiedKitchen();
  const ui = editor(kitchen);
  hex(ui.render()).props.onChange({ target: { value: "#xx" } });
  assert.equal(hex(ui.render()).props["aria-invalid"], true);
  assert.equal(apply(ui.render()).props.disabled, true);
  apply(ui.render()).props.onClick();
  assert.equal(ui.commits.length, 0);
  const locked = editor(kitchen, true);
  const section = locked
    .render()
    .find((node) => node.props.className === "kroom-paint");
  assert.equal(
    nodes(section).find((node) => node.type === "fieldset").props.disabled,
    true,
  );
  hex(locked.render()).props.onChange({ target: { value: "#abcdef" } });
  apply(locked.render()).props.onClick();
  assert.equal(locked.commits.length, 0);
  assert.equal(
    locked.render().find((node) => node.props.className === "kroom-paint-open")
      .props.disabled,
    true,
  );
});

test("paint settings open on demand without adding another sidebar or changing the room", (t) => {
  const previous = global.requestAnimationFrame;
  global.requestAnimationFrame = (callback) => {
    callback();
    return 1;
  };
  t.after(() => {
    global.requestAnimationFrame = previous;
  });
  const ui = editor(createUnifiedKitchen());
  assert.equal(
    ui.render().find((node) => node.props.id === "kroom-settings").props.hidden,
    true,
  );
  ui.render()
    .find((node) => node.props.className === "kroom-paint-open")
    .props.onClick();
  assert.equal(
    ui.render().find((node) => node.props.id === "kroom-settings").props.hidden,
    false,
  );
  assert.equal(ui.commits.length, 0);
});
