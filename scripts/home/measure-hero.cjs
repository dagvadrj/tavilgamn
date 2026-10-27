/* Production-only comparison. Chromium software rendering is not device FPS. */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../../.tools/rea-runtime/node_modules/playwright-core');
const url = process.env.HERO_URL || 'http://localhost:3122';
const output = process.env.HERO_REPORT || path.join(process.env.TEMP, 'hero-baseline.json');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    // Do not use Playwright routing here: it disables HTTP caching and would
    // turn the purported warm run into another cold network load.
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      window.heroMeasure = { compile: [], frames: [], textureBytes: 0 };
      const allocation = new Map();
      const contexts = new WeakMap();
      const account = () => { window.heroMeasure.textureBytes = [...allocation.values()].reduce((s, t) => s + [...t.values()].reduce((a,b) => a+b, 0), 0); };
      for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
        for (const key of ['activeTexture', 'bindTexture', 'texImage2D', 'texStorage2D', 'generateMipmap', 'deleteTexture']) {
          const original = proto[key]; if (!original) continue;
          proto[key] = function (...a) {
            let c = contexts.get(this); if (!c) { c = { unit: 0x84c0, bound: new Map() }; contexts.set(this,c); }
            const target = a[0] >= 0x8515 && a[0] <= 0x851a ? 0x8513 : a[0];
            const texture = c.bound.get(`${c.unit}:${target}`);
            if (key === 'activeTexture') c.unit = a[0];
            if (key === 'bindTexture') c.bound.set(`${c.unit}:${target}`, a[1]);
            if (key === 'deleteTexture') allocation.delete(a[0]);
            if (texture && ['texImage2D','texStorage2D','generateMipmap'].includes(key)) {
              let sizes = allocation.get(texture); if (!sizes) { sizes = new Map(); allocation.set(texture,sizes); }
              if (key === 'texImage2D') { const image = a.length === 6 ? a[5] : null, type = image ? a[4] : a[7]; const width = image?.width || a[3], height = image?.height || a[4]; sizes.set(`${a[0]}:${a[1]}`, width * height * 4 * (type === 0x1406 ? 4 : [0x140b,0x8d61].includes(type) ? 2 : 1)); }
              if (key === 'texStorage2D') { sizes.clear(); for (let i=0;i<a[1];i++) sizes.set(`${a[0]}:${i}`, Math.max(1,a[3]>>i)*Math.max(1,a[4]>>i)*([0x881a,0x881b].includes(a[2])?8:4)); }
              if (key === 'generateMipmap') sizes.set('generated-mips', [...sizes.entries()].filter(([k]) => k.endsWith(':0')).reduce((s,[,n]) => s+n/3,0));
            }
            account(); return original.apply(this,a);
          };
        }
        for (const key of ['compileShader', 'linkProgram']) {
          const fn = proto[key]; proto[key] = function (...args) { const t = performance.now(); const r = fn.apply(this, args); window.heroMeasure.compile.push({ key, ms: performance.now() - t }); return r; };
        }
      }
      new MutationObserver(records => { if (records.some(r => r.attributeName === 'data-render-frame')) window.heroMeasure.frames.push(performance.now()); }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-render-frame'] });
    });
    const runs = [];
    for (const cache of ['cold', 'warm']) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForFunction(() => document.querySelector('.scroll-room')?.dataset.ready === 'true', {}, { timeout: 90000 });
      await page.waitForTimeout(10000);
      await page.waitForFunction(() => document.querySelector('.scroll-room')?.dataset.sofaStatus === 'ready', {}, { timeout: 90000 });
      await page.waitForTimeout(2000);
      const read = () => page.locator('.scroll-room canvas').evaluate(c => ({ ...c.dataset, width: c.width, height: c.height }));
      const idle = await read(); await page.waitForTimeout(1500); const afterIdle = await read();
      const preparation = await page.evaluate(() => ({ shaderSubmissionCalls: window.heroMeasure.compile.length, shaderSubmissionCpuMs: window.heroMeasure.compile.reduce((sum, call) => sum + call.ms, 0), firstRenderedFrameMs: window.heroMeasure.frames[0], estimatedTextureAllocationBytes: window.heroMeasure.textureBytes }));
      await page.screenshot({ path: output.replace('.json', `-${cache}.png`) });
      await page.evaluate(() => { window.heroMeasure.frames = []; window.heroMeasure.compile = []; });
      await page.getByRole('button', { name: 'Буйдан · Дэлгэрэнгүй', exact: true }).click();
      await page.waitForTimeout(4500);
      await page.screenshot({ path: output.replace('.json', `-${cache}-focus.png`) });
      const focus = await read();
      const measure = await page.evaluate(() => {
        const f = window.heroMeasure.frames, deltas = f.slice(1).map((t, i) => t - f[i]).sort((a, b) => a - b);
        const resources = performance.getEntriesByType('resource').filter(r => /interior|models\/files|\.glb|\.hdr/.test(r.name));
        return { estimatedTextureAllocationBytes: window.heroMeasure.textureBytes, frameSamples: deltas.length, medianMs: deltas[Math.floor(deltas.length * .5)], p95Ms: deltas[Math.floor(deltas.length * .95)], over100ms: deltas.filter(n => n > 100).length, shaderCallsDuringFocus: window.heroMeasure.compile, resources: resources.map(r => ({ path: new URL(r.name).pathname, transferred: r.transferSize, encoded: r.encodedBodySize, durationMs: r.duration })) };
      });
      runs.push({ cache, preparation, idle, idleStopped: idle.renderFrame === afterIdle.renderFrame, focus, ...measure });
    }
    fs.writeFileSync(output, JSON.stringify({ renderer: 'Chromium SwiftShader; same machine, viewport and DPR; not physical-device FPS', url, runs, errors }, null, 2));
    console.log(JSON.stringify({ output, runs: runs.map(({ cache, idle, focus, idleStopped, medianMs, p95Ms, over100ms }) => ({ cache, idle, focus, idleStopped, medianMs, p95Ms, over100ms })), errors }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
