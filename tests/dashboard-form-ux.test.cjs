const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadSource } = require('./helpers/load-source.cjs');
const nodes = tree => React.isValidElement(tree) ? [tree, ...React.Children.toArray(tree.props.children).flatMap(nodes)] : [];

function harness(extra = {}) {
  const states = []; let cursor = 0;
  const react = {...React, useEffect(){}, useRef: value => ({current:value}), useCallback: fn=>fn,
    useState(value) {const index=cursor++;if(!(index in states))states[index]=typeof value==='function'?value():value;
      return [states[index],next=>{states[index]=typeof next==='function'?next(states[index]):next;}];}};
  const mocks = {react,
    '@/hooks/useDashboardDraft': {useDraftState:(_scope,_key,value)=>react.useState(value),useDraftStatus:()=>({loading:false}),clearDashboardDraft:async()=>{}},
    'next/dynamic':{default:()=>()=>null},
    '@/features/kitchen-planner/hooks/useKitchenCatalog':{useKitchenCatalog:()=>({moduleCatalog:[]})},
    '@/store/auth':{useAuth:{getState:()=>({user:{id:'owner'},role:'admin'})}},
    '@/store/catalog':{useCatalogStore:{getState:()=>({refresh:async()=>{}})}},...extra};
  return {mocks,render(fn){cursor=0;return fn();}};
}

test('optional sections start collapsed while retaining their named form values', () => {
  const { DashboardFormSection }=loadSource('src/features/dashboard/DashboardFormSection.tsx');
  const html=renderToStaticMarkup(React.createElement(DashboardFormSection,{title:'Extra',optional:true},React.createElement('input',{name:'saved-color',defaultValue:'oak'})));
  assert.match(html,/<details/);assert.doesNotMatch(html,/<details[^>]*\bopen/);
  assert.match(html,/name="saved-color" value="oak"/);
  const open=renderToStaticMarkup(React.createElement(DashboardFormSection,{title:'Edit',defaultOpen:true},'content'));
  assert.match(open,/<details[^>]*\bopen/);
});

test('validation reveals every ancestor section without opening unrelated sections', () => {
  const {revealDashboardField}=loadSource('src/features/dashboard/dashboardFormUx.ts');
  const outer={tagName:'DETAILS',open:false,parentElement:null};
  const inner={tagName:'DETAILS',open:false,parentElement:{tagName:'DIV',parentElement:outer}};
  const unrelated={open:false};
  revealDashboardField({parentElement:inner});
  assert.equal(inner.open,true);assert.equal(outer.open,true);assert.equal(unrelated.open,false);
});

test('legacy labels become associated, IDs stay unique and keyboard hints preserve explicit choices', t => {
  const previous=global.HTMLInputElement;
  class Input {constructor(step,inputMode){this.type='number';this.step=step;this.id='';this.mode=inputMode;this.attrs={};}
    hasAttribute(name){return name==='inputmode'&&this.mode!=null;}}
  global.HTMLInputElement=Input;t.after(()=>{global.HTMLInputElement=previous;});
  const label=()=>({tagName:'LABEL',attrs:{},hasAttribute(name){return name in this.attrs;},querySelector(){return null;},setAttribute(k,v){this.attrs[k]=v;}});
  const fields=[new Input('1'),new Input('0.01'),new Input('1','tel')];fields.forEach(c=>{c.previousElementSibling=label();});
  const root={querySelectorAll: selector=>selector==='input,select,textarea'?fields:[],ownerDocument:{querySelectorAll: selector=>fields.filter(c=>selector===`[id="${c.id}"]`)}};
  const {prepareDashboardFields}=loadSource('src/features/dashboard/dashboardFormUx.ts');
  prepareDashboardFields(root,'test-field');prepareDashboardFields(root,'test-field');
  assert.equal(new Set(fields.map(c=>c.id)).size,3);
  assert.equal(fields[0].inputMode,'numeric');assert.equal(fields[1].inputMode,'decimal');assert.equal(fields[2].inputMode,undefined);
  fields.forEach(c=>assert.equal(c.previousElementSibling.attrs.for,c.id));
});

test('admin dimensions accept millimetres and save metres without changing optional values', async () => {
  let saved;
  const h=harness({'@/features/admin-products/saveProductWithModel':{saveProductWithModel:async options=>{saved=options.product;}}});
  const {ProductEditor,blank}=loadSource('src/features/admin-products/ProductEditor.tsx',h.mocks);
  const product={...blank(),id:'product',name:'Cabinet',image:'/test.jpg',dimensions:{w:.8,h:.84,d:.6},roomTypes:['living'],stockQuantity:2,specifications:{style:'Classic'}};
  const render=()=>h.render(()=>ProductEditor({owner:'owner',product,create:false,close(){}}));
  let tree=render();const input=nodes(tree).find(n=>n.props.id==='product-dimension-w');
  assert.equal(input.props.value,800);input.props.onChange({target:{valueAsNumber:600}});
  tree=render();assert.equal(nodes(tree).find(n=>n.props.id==='product-dimension-w').props.value,600);
  await tree.props.onSubmit({preventDefault(){}});
  assert.equal(saved.dimensions.w,.6);assert.equal(saved.dimensions.h,.84);assert.equal(saved.specifications.style,'Classic');
});

test('store photo file uploads once and survives a failed store save without another upload', async () => {
  let uploads=0,saves=0,payload;
  const h=harness({
    '@/lib/authFetch':{authFetch:async()=>{uploads++;return {ok:true,json:async()=>({url:'https://res.cloudinary.com/demo/image/upload/store.jpg'})};}},
    '@/features/merchant/merchantApi':{isOwner:()=>true,merchantRequest:async(_url,_owner,init)=>{payload=JSON.parse(init.body);if(++saves===1)throw Error('retry');return {store:{id:'store'}};}}
  });
  const {StoreProfile}=loadSource('src/features/merchant/StoreProfile.tsx',h.mocks);
  const store={id:'store',name:'Store',city:'Улаанбаатар',address:'Address',phone:'99112233',categories:['sofa']};
  const render=()=>h.render(()=>StoreProfile({owner:'owner',store,onSave(){}}));
  let tree=render();nodes(tree).find(n=>n.type==='input'&&n.props.type==='file').props.onChange({target:{files:[new File(['png'],'store.png',{type:'image/png'})]}});
  tree=render();await tree.props.onSubmit({preventDefault(){}});
  tree=render();await tree.props.onSubmit({preventDefault(){}});
  assert.equal(uploads,1);assert.equal(saves,2);assert.match(payload.image,/cloudinary/);
});

test('new kitchen materials generate an ID while keeping editable optical defaults', async () => {
  let payload;
  const h=harness({'@/lib/authFetch':{authFetch:async(_url,init)=>{payload=JSON.parse(init.body);return {ok:true,json:async()=>({material:{...payload,active:true}})};}}});
  const {AdminKitchenMaterials}=loadSource('src/components/AdminKitchenMaterials.tsx',h.mocks);
  const render=()=>h.render(()=>AdminKitchenMaterials({owner:'owner'}));
  let tree=render();nodes(tree).find(n=>n.type==='input'&&n.props.maxLength===120).props.onChange({target:{value:'Oak'}});
  tree=render();await nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
  assert.match(payload.id,/^material_[a-f0-9]{32}$/);assert.equal(payload.name,'Oak');assert.equal(payload.roughness,.65);assert.equal(payload.metalness,0);
});
