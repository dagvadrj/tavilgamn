const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const { kitchenDesignSuggestions } = loadSource("src/lib/kitchenDesignSuggestions.ts");
const { createSuggestedKitchen, DEFAULT_KITCHEN_SUGGESTION } = loadSource("src/lib/kitchenSuggestions.ts");
const { parseKitchen } = loadSource("src/lib/kitchenAssembly.ts");

test("room drafting shows water and power controls without furniture or decoration tools", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { KitchenSpaceEditor } = loadSource("src/features/kitchen-planner/components/KitchenSpaceEditor.tsx");
  const html = renderToStaticMarkup(React.createElement(KitchenSpaceEditor, {
    kitchen: createSuggestedKitchen(DEFAULT_KITCHEN_SUGGESTION), disabled: false,
    onChange() { return true; }, onClose() {}, onReview() {}, onSelectCabinet() {},
  }));
  assert.match(html, /Цэвэр\/бохир ус/);
  assert.match(html, /Цахилгааны холболт/);
  assert.match(html, /data-room-point/);
  assert.doesNotMatch(html, /kroom-catalog|Тавцан ба фасад|Багана нэмэх|ХААЛГА, ЦОНХ|Өнгө сонгох/);
});

test("five proposals preserve the user's room and cabinet identities without mutating their draft", () => {
  for (const size of [2, 3, 5]) {
    const kitchen = createSuggestedKitchen(DEFAULT_KITCHEN_SUGGESTION, { width: size, depth: 3, height: 2.7 });
    const before = structuredClone(kitchen);
    const proposals = kitchenDesignSuggestions(kitchen);
    assert.equal(proposals.length, 5);
    for (const proposal of proposals) {
      assert.deepEqual(proposal.design.room, before.room);
      assert.deepEqual(proposal.design.cabinets.map(c => c.id).sort(), before.cabinets.map(c => c.id).sort());
      assert.equal(proposal.issue, undefined);
      assert.doesNotThrow(() => parseKitchen(proposal.design));
      if (!proposal.fits) assert.deepEqual(proposal.design.cabinets.map(c => c.position), before.cabinets.map(c => c.position));
    }
    assert.deepEqual(kitchen, before);
  }
});
