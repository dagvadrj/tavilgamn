const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadSource } = require('./helpers/load-source.cjs');
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)] : [];

test('homepage room ideas link to supported catalog filters; seller and advertising actions open the corresponding contact topic', async () => {
  const { InteriorHome } = loadSource('src/features/home-interior/InteriorHome.tsx', {
    'next/dynamic': { default: () => () => null },
    'next/image': { default: () => null },
    'next/link': { default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) },
  });
  const html = renderToStaticMarkup(React.createElement(InteriorHome, { catalog: [], stores: [], paymentLabels: [] }));
  const { getRoomCatalogGroup } = loadSource('src/lib/catalogNavigation.ts');
  const CatalogPage = loadSource('src/app/(shop)/catalog/page.tsx', {
    '@/components/CatalogView': { CatalogView: 'catalog' },
  }).default;
  for (const room of ['living', 'bedroom', 'dining']) {
    assert.ok(html.includes(`href="/catalog?room=${room}"`));
    assert.ok(getRoomCatalogGroup(room));
    const page = await CatalogPage({ searchParams: Promise.resolve({ room }) });
    assert.equal(page.props.initialRoom, room);
  }
  assert.match(html, /href="\/\?topic=merchant#contact"[^>]*>Дэлгүүр бүртгүүлэх хүсэлт/);
  assert.match(html, /href="\/\?topic=advertising#contact"[^>]*>Сурталчилгааны талаар холбогдох/);
  assert.ok(html.includes('href="/stores"'));
  assert.ok(!html.includes('Бидний төслүүд') && !html.includes('interior-stats'));
});

test('legacy about destinations redirect to footer with only known contact topics', async () => {
  const About = loadSource('src/app/(shop)/about/page.tsx', {
    'next/navigation': { redirect: destination => { throw new Error(destination); } },
  }).default;
  for (const [topic, expected] of [['merchant', '/?topic=merchant#contact'], ['advertising', '/?topic=advertising#contact'], ['unknown', '/#contact'], [undefined, '/#contact']]) {
    await assert.rejects(About({ searchParams: Promise.resolve({ topic }) }), error => error.message === expected);
  }
});

test('footer contact selects known topics and defaults arbitrary input to general', () => {
  for (const [topic, expected] of [['merchant', 'merchant'], ['advertising', 'advertising'], ['unknown', 'general'], [null, 'general']]) {
    function Form() { return null; }
    const { FooterContact } = loadSource('src/components/FooterContact.tsx', {
      'next/navigation': { useSearchParams: () => new URLSearchParams(topic ? { topic } : {}) },
      '@/components/ContactForm': { ContactForm: Form },
      react: { ...React, useRef: () => ({ current: null }), useEffect() {} },
    });
    const tree = FooterContact();
    assert.equal(nodes(tree).find(node => node.type === Form).props.initialTopic, expected);
  }
});

test('contact topics reach the actual submitted message and duplicate clicks send one request', async t => {
  const slots = []; let cursor = 0;
  const { ContactForm } = loadSource('src/components/ContactForm.tsx', {
    react: { ...React,
      useState(initial) {
        const at = cursor++;
        if (!(at in slots)) slots[at] = initial;
        return [slots[at], value => { slots[at] = value; }];
      },
      useRef(initial) { const at = cursor++; return slots[at] ??= { current: initial }; },
    },
  });
  let sent;
  const previous = global.fetch;
  global.fetch = async (url, options) => {
    assert.equal(url, '/api/contact');
    assert.equal(sent, undefined, 'a double click must not send a second message');
    sent = JSON.parse(options.body);
    return new Response('{}');
  };
  t.after(() => { global.fetch = previous; });
  const render = () => { cursor = 0; return ContactForm({ initialTopic: 'merchant' }); };
  assert.equal(nodes(render()).find(node => node.type === 'select').props.value, 'merchant');
  assert.equal(sent, undefined, 'following a link never submits a request');
  for (const [autoComplete, value] of [['name', 'Test Seller'], ['email', 'seller@example.test']]) {
    nodes(render()).find(node => node.props?.autoComplete === autoComplete).props.onChange({ target: { value } });
  }
  nodes(render()).find(node => node.type === 'textarea').props.onChange({ target: { value: 'Please register my furniture store.' } });
  const form = render(), event = { preventDefault() {} };
  await Promise.all([form.props.onSubmit(event), form.props.onSubmit(event)]);
  assert.equal(sent.message, '[Дэлгүүр бүртгүүлэх хүсэлт]\nPlease register my furniture store.');
  assert.equal(sent.email, 'seller@example.test');
  assert.ok(nodes(render()).some(node => node.props?.role === 'status'));
});
