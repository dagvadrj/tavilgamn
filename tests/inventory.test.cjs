const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const { availableStock, hasAvailableStock, quantityLimit } = loadSource("src/lib/inventory.ts");
test("cart limits aggregate colors and materials and enforce 99 per selection", () => {
  const items=[{id:"one",productId:"chair",color:"oak",material:"wood",qty:2},{id:"two",productId:"chair",color:"dark",material:"wood",qty:1}];
  assert.equal(quantityLimit({id:"chair",stockQuantity:4},items,{color:"oak",material:"wood"}),1);
  assert.equal(quantityLimit({id:"chair",stockQuantity:4},items,items[0],"one"),3);
  assert.equal(quantityLimit({id:"chair",stockQuantity:1000},items,items[0]),97);
  assert.equal(availableStock({stockQuantity:null}),0);
  assert.equal(hasAvailableStock({stockQuantity:1}),true);
  assert.equal(hasAvailableStock({stockQuantity:0}),false);
  assert.equal(hasAvailableStock({stockQuantity:null}),false);
});
test("cart repeat additions cannot exceed shared stock or selection cap", () => {
  const memory=new Map();global.window={localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)}};
  try {
    const {useCart}=loadSource("src/store/cart.ts");
    const item={productId:"chair",color:"oak",material:"wood",unitPrice:10,name:"Chair",image:"/test.jpg",stockQuantity:3};
    assert.equal(useCart.getState().add({...item,qty:2}),2);
    assert.equal(useCart.getState().add({...item,color:"dark",qty:2}),1);
    assert.equal(useCart.getState().add(item),0);
    assert.equal(useCart.getState().count(),3);
    useCart.getState().clear();
    assert.equal(useCart.getState().add({...item,stockQuantity:1000,qty:200}),99);
    assert.equal(useCart.getState().add({...item,stockQuantity:1000}),0);
  } finally {delete global.window;}
});
test("auth return destination is carried through registration and rejects external redirects", () => {
  const memory=new Map();global.sessionStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  global.window={location:{search:"?next=/checkout"}};
  try {
    const auth=loadSource("src/lib/authRedirect.ts");
    assert.equal(auth.rememberAuthDestination("?next=/checkout"),"/checkout");
    assert.equal(auth.rememberAuthDestination(""),"/checkout");
    assert.equal(auth.finishAuthDestination(),"/checkout");
    assert.equal(memory.size,0);
    assert.equal(auth.authDestination("?next=https://bad.example"),"/account");
  } finally {delete global.sessionStorage;delete global.window;}
});
test("contact form validation rejects blank or malformed fields", () => {
  const {parseContact}=loadSource("src/lib/contact.ts");
  assert.throws(()=>parseContact({name:" ",email:"broken",message:"short"}));
  assert.deepEqual(parseContact({name:" Test ",email:"TEST@example.com",message:" A test message "}),{name:"Test",email:"test@example.com",message:"A test message"});
});
test("contact endpoint only reports success when the database confirms storage", async () => {
  let error=null,calls=0;
  const route=loadSource("src/app/api/contact/route.ts",{"@/lib/supabase/admin":{getSupabaseAdmin:()=>({rpc:async()=>{calls++;return {error};}})}});
  const request=value=>new Request("https://shop.example/api/contact",{method:"POST",body:JSON.stringify(value)});
  const valid={name:"Test",email:"test@example.com",message:"A valid test message"};
  assert.equal((await route.POST(request({}))).status,400); assert.equal(calls,0);
  error={code:"unavailable"};assert.equal((await route.POST(request(valid))).status,503);
  error={code:"P0006"};assert.equal((await route.POST(request(valid))).status,429);
  error=null;assert.equal((await route.POST(request(valid))).status,201);
});

test("catalog outage leaves account and order controls available", () => {
  const React=require("react"),{renderToStaticMarkup}=require("react-dom/server");
  const state={user:{id:"fixture",name:"Fixture",email:"fixture@example.com"},role:"customer",initialized:true,initialize:async()=>{},signOut:async()=>{}};
  const Page=loadSource("src/app/account/page.tsx",{
    "@/components/SavedKitchenList":{SavedKitchenList:()=>null},
    "next/navigation":{useRouter:()=>({replace(){},refresh(){}})},
    "@/store/auth":{useAuth:selector=>selector(state)},
    "@/lib/authFetch":{authFetch:async()=>{throw Error("Unused");}},
    "@/store/catalog":{useCatalog:()=>({products:[],loading:false,ready:false,error:"Catalog offline",refresh:async()=>{}}),getProduct:()=>undefined},
  }).default;
  const html=renderToStaticMarkup(React.createElement(Page));
  assert.ok(html.includes("Гарах") && html.includes("Захиалга") && html.includes("Catalog offline"));
});
test("cards and the 3D viewer display numeric inventory including zero", () => {
  const React=require("react"),{renderToStaticMarkup}=require("react-dom/server");
  const {ProductCard}=loadSource("src/components/ProductCard.tsx");
  const product={id:"fixture",name:"Fixture",category:"sofa",image:"/test.jpg",basePrice:100,reviewCount:0,dimensions:{w:1,d:1,h:1},colors:[],stockQuantity:7,inStock:true};
  assert.ok(renderToStaticMarkup(React.createElement(ProductCard,{product})).includes("Үлдэгдэл: 7 ширхэг"));
  assert.ok(renderToStaticMarkup(React.createElement(ProductCard,{product:{...product,stockQuantity:0,inStock:false}})).includes("0 ширхэг"));
  const empty=()=>null;
  const {ProductViewer}=loadSource("src/three/ProductViewer.tsx",{
    "@react-three/fiber":{Canvas:empty},"@react-three/drei":{OrbitControls:empty,ContactShadows:empty,Environment:empty},
    "./FurnitureMesh":{FurnitureMesh:empty},"./GLBFurnitureMesh":{GLBFurnitureMesh:empty},
  });
  assert.ok(renderToStaticMarkup(React.createElement(ProductViewer,{category:"sofa",color:"#fff",material:"wood",dimensions:{w:1,d:1,h:1},stockQuantity:7})).includes("Үлдэгдэл: 7 ширхэг"));
});
test("furniture_models row is the sole source of catalog metadata and integer inventory", () => {
  const {productFromRow}=loadSource("src/lib/catalogServer.ts");
  const row={id:"12345678-1234-4234-8234-123456789abc",product_id:"old-product-link",name:"Fixture",category:"sofa",description:"",base_price:100,image_url:"/test.jpg",glb_path:"r2://test/models/fixture/model.glb",scale:1,
    dimensions_w:1,dimensions_d:1,dimensions_h:1,colors:[{id:"oak",name:"Oak",hex:"#123456"}],materials:[{id:"wood",name:"Wood",priceDelta:0}],default_color:"oak",in_stock:4};
  const product=productFromRow(row);
  assert.equal(product.id,"old-product-link");assert.equal(product.model.id,row.id);assert.equal(product.stockQuantity,4);assert.equal(product.inStock,true);
  assert.equal(productFromRow({...row,in_stock:0}).inStock,false);
  assert.throws(()=>productFromRow({...row,in_stock:true}),/migration/i);
});
