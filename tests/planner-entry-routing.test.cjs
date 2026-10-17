const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { loadSource } = require('./helpers/load-source.cjs');

function hooks() {
  const slots = []; let cursor = 0;
  return {
    react: { ...React,
      useState(initial) {
        const at = cursor++;
        if (!(at in slots)) slots[at] = typeof initial === 'function' ? initial() : initial;
        return [slots[at], value => { slots[at] = typeof value === 'function' ? value(slots[at]) : value; }];
      },
      useRef: initial => ({ current: initial }), useEffect() {},
    },
    render(fn) { cursor = 0; return fn(); },
  };
}
const nodes = tree => !React.isValidElement(tree) ? [] : [tree, ...React.Children.toArray(tree.props.children).flatMap(nodes)];

test('dedicated kitchen entry opens stage one of the seven-step kitchen flow; other rooms open RoomBuilder', () => {
  const h = hooks(), routes = [], saved = new Map(), previous = global.localStorage;
  global.localStorage = { setItem: (key, value) => saved.set(key, value) };
  const { RoomPlannerStart } = loadSource('src/features/room-planner/components/RoomPlannerStart.tsx', {
    react: h.react, 'next/navigation': { useRouter: () => ({ push: href => routes.push(href) }) },
    '@/store/auth': { useAuth: select => select({ user: { id: 'account' }, role: 'user' }) },
    './RoomMeasureUnit': { useRoomMeasureUnit: select => select({ unit: 'см' }), RoomMeasureUnit: 'units' },
    './RoomBuilder': { RoomBuilder: 'builder' }, './RoomTemplateGallery': { RoomTemplateGallery: 'gallery' },
    '@/components/KitchenSuggestionWizard': { KitchenSuggestionWizard: 'wizard' },
  });
  const props = { onStart() { throw Error('Kitchen must not create a generic room'); }, onResume() {}, onTemplate() {} };
  const render = () => h.render(() => RoomPlannerStart(props));
  try {
    let tree = render();
    nodes(tree).find(n => n.type === 'gallery').props.onKitchen();
    assert.equal(routes.length, 1);
    assert.match(routes[0], /^\/kitchen\?editor=1&space=1&draft=/);
    const payload = JSON.parse([...saved.values()][0]);
    assert.equal(payload.flowStage, 'room');
    assert.equal(saved.size, 1);
    assert.ok([...saved.keys()][0].startsWith('tavilga-kitchen-draft-account-'));
    assert.ok(payload.design.room.width >= 2000);
    tree = render(); assert.equal(nodes(tree).some(n => n.type === 'builder'), false);
    nodes(tree).find(n => n.type === 'gallery').props.onBuild('bedroom');
    tree = render(); assert.equal(tree.type, 'builder'); assert.equal(routes.length, 1);
  } finally { global.localStorage = previous; }
});

test('entry cards keep kitchen separate from the generic room-purpose selector', () => {
  const h = hooks(); let kitchens = 0, room;
  const { RoomTemplateGallery } = loadSource('src/features/room-planner/components/RoomTemplateGallery.tsx', {
    react: h.react, 'next/image': { default: 'image' },
  });
  const tree = h.render(() => RoomTemplateGallery({ onBuild: type => { room = type; }, onKitchen: () => kitchens++, onTemplate() {} }));
  const cards = nodes(tree).filter(n => n.type === 'article' && n.props.className.includes('room-custom-card'));
  assert.equal(cards.length, 2);
  const choices = nodes(cards[0]);
  assert.equal(choices.some(n => n.type === 'option' && n.props.value === 'kitchen'), false);
  choices.find(n => n.type === 'button').props.onClick(); assert.equal(room, 'living');
  nodes(cards[1]).find(n => n.type === 'button').props.onClick(); assert.equal(kitchens, 1);
});
