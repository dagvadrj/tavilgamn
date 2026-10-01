// Run in Codex cua_repl with an already selected Tab; never read auth/storage.
// A fresh authenticated wizard creates only a clearly named test project.
import assert from 'node:assert/strict';
const button=(tab,name)=>tab.playwright.getByRole('button',{name,exact:true});
const snapshot=tab=>tab.playwright.domSnapshot();
export async function verifyWizard(tab,{layout='U хэлбэр Гурван ханын дагуу',name='Phase 3 MVP E2E'}={}) {
  assert.match(await snapshot(tab),/Зуухаа хаана байрлуулах вэ/);
  await button(tab,'Үргэлжлүүлэх').click();await tab.playwright.getByRole('heading',{name:'Утаа сорогч хэрэгтэй юу?',exact:true}).waitFor({state:'visible'});assert.match(await snapshot(tab),/Утаа сорогч хэрэгтэй юу/);
  await button(tab,'Үргэлжлүүлэх').click();await tab.playwright.getByRole('heading',{name:'Хөргөгчөө хэрхэн байрлуулах вэ?',exact:true}).waitFor({state:'visible'});assert.match(await snapshot(tab),/Хөргөгчөө хэрхэн байрлуулах вэ/);
  await button(tab,'Үргэлжлүүлэх').click();await tab.playwright.getByRole('heading',{name:'Гал тогооны үндсэн хэлбэрээ сонгоно уу',exact:true}).waitFor({state:'visible'});assert.match(await snapshot(tab),/Гал тогооны үндсэн хэлбэр/);
  await button(tab,layout).click();await button(tab,'Үргэлжлүүлэх').click();await tab.playwright.getByRole('heading',{name:'Таны гал тогооны санал',exact:true}).waitFor({state:'visible'});assert.match(await snapshot(tab),/Таны гал тогооны санал/);
  await button(tab,'Planner-аа нээх').click();
  await tab.playwright.getByRole('textbox',{name:'Загварын нэр',exact:true}).waitFor({state:'visible'});
  await tab.playwright.getByRole('textbox',{name:'Загварын нэр',exact:true}).fill(name);
  assert.match(await snapshot(tab),/Буцаах.*disabled/);
  assert.match(await tab.url(),/editor=1&draft=/);
  return {step:'wizard',url:await tab.url()};
}
export async function verifyHistoryRestore(tab,{current=2,restore=1}={}) {
  await tab.playwright.getByLabel('Нэмэлт үйлдэл',{exact:true}).click();
  await button(tab,`Хувилбарын түүх · v${current}`).click();
  await button(tab,`v${restore} сэргээх`).waitFor({state:'visible',timeoutMs:20000});
  assert.match(await snapshot(tab),new RegExp(`v${current} сэргээх`));
  await button(tab,`v${restore} сэргээх`).click();
  await tab.playwright.getByText('Өмнөх хувилбар редакторт ачааллаа. Хадгалахад шинэ хувилбар болно.',{exact:true}).waitFor({state:'visible',timeoutMs:20000});
  await tab.playwright.getByLabel('Нэмэлт үйлдэл',{exact:true}).click();
  await button(tab,'Хадгалах').last().click();
  // CUA sessions are step-based: confirm the asynchronous upload on a later call.
  return {step:'restore-save-pending',expectedRevision:current+1,dom:await snapshot(tab)};
}
export async function verifySaved(tab,{revision}={}) {
  assert.ok(await tab.playwright.getByText('Гарнитур болон 3D нүүр зураг хадгалагдлаа.',{exact:true}).isVisible());
  assert.ok(await button(tab,'Хадгалах').last().isEnabled());
  await tab.playwright.getByLabel('Нэмэлт үйлдэл',{exact:true}).click();
  assert.ok(await button(tab,`Хувилбарын түүх · v${revision}`).isVisible());
  return {step:'restore-save-verified',revision};
}
export async function openLibrary(tab) {
  await tab.playwright.getByRole('link',{name:'Өөрийн гарнитурууд',exact:true}).click();
  return {step:'library-pending'};
}
export async function verifyReopen(tab,{name}={}) {
  assert.ok(await tab.playwright.getByRole('heading',{name,exact:true}).isVisible());
  const card=tab.playwright.locator('article').filter({hasText:name});
  assert.equal(await card.count(),1);
  assert.ok(await card.getByRole('img').isVisible());
  const edit=card.getByRole('link',{name:'Засах',exact:true});
  const href=await edit.getAttribute('href');assert.match(href,/\/kitchen\?design=/);
  await edit.click();
  return {step:'reopen-pending',href};
}
export async function verifyOpened(tab,{name}={}) {
  assert.ok(await tab.playwright.getByRole('textbox',{name:'Загварын нэр',exact:true}).isVisible());
  assert.equal(await tab.playwright.getByRole('textbox',{name:'Загварын нэр',exact:true}).getAttribute('value'),name);
  return {step:'reopen',url:await tab.url()};
}
export async function verifyReview(tab,{extraName}={}) {
  await button(tab,'2D план').click();
  const dom=await snapshot(tab);
  assert.match(dom,/Байрлал зөв байна/);assert.match(dom,/BOM болон үнийн тооцоо/);
  assert.match(dom,/BOM CSV татах/);assert.match(dom,/PDF \/ Хэвлэх/);assert.match(dom,/SKP татах.*disabled/);
  if(extraName)assert.ok(await button(tab,extraName).isVisible());
  return {step:'review',dom};
}
