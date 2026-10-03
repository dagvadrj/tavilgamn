const http=require('node:http');
const id='11111111-1111-4111-8111-111111111111';
const userId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const storeId='22222222-2222-4222-8222-222222222222';
const row={id,product_id:'fixture-chair',name:'Норд модон сандал',category:'dining-table',description:'Өдөр тутмын хэрэглээнд зориулсан модон сандал.',base_price:250000,image_url:'/image.png',images:[],thumbnail_path:null,glb_path:null,preview_glb_path:null,processing_status:'idle',scale:1,dimensions_w:0.5,dimensions_d:0.55,dimensions_h:0.85,colors:[{id:'oak',name:'Царс',hex:'#c9a37a',priceDelta:0}],materials:[{id:'wood',name:'Мод',priceDelta:0}],default_color:'oak',in_stock:5,rating:4.7,review_count:12,badges:[],is_new:false,is_best_seller:true,store_ids:[storeId],archived_at:null,compare_at_price:null,promotion_label:null,promotion_ends_at:null,delivery_terms:'3–5 ажлын өдөр'};
const rows=[row,{...row,id:'33333333-3333-4333-8333-333333333333',product_id:'fixture-sofa',name:'Тухтай буйдан',category:'sofa'}];
const user={id:userId,aud:'authenticated',role:'authenticated',email:'fixture@example.test',user_metadata:{name:'Тест хэрэглэгч'},app_metadata:{provider:'email',providers:['email']},created_at:'2026-10-02T00:00:00Z'};
function token(){const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');return `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:userId,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}.fixture-signature`;}
function createFixtureServer(options = {}){
  const requests=[];
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1:45432');requests.push({method:req.method,path:url.pathname,query:url.search});
    res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:3001');res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,x-supabase-api-version');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Content-Type','application/json');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    if(options.handle){
      let raw='';for await(const chunk of req)raw+=chunk;
      const custom=await options.handle(req,url,raw);
      if(custom){res.statusCode=custom.status??200;res.end(JSON.stringify(custom.body));return;}
    }
    let output=[];
    if(url.pathname==='/auth/v1/token')output={access_token:token(),refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user};
    else if(url.pathname==='/auth/v1/user')output=user;
    else if(url.pathname==='/rest/v1/rpc/consume_api_rate_limit')output={allowed:true,retryAfter:60};
    else if(url.pathname==='/rest/v1/rpc/phase6_readiness')output=true;
    else if(url.pathname==='/rest/v1/rpc/phase8_readiness')output=true;
    else if(url.pathname==='/rest/v1/furniture_models')output=rows;
    else if(url.pathname==='/rest/v1/profiles')output=[{id:userId,role:'customer'}];
    else if(url.pathname==='/rest/v1/merchant_stores')output=[{id:storeId,name:'Норд тавилга',store_type:'factory',city:'Улаанбаатар',district:'Хан-Уул',address:'Хан-Уул дүүрэг',phone:'99000000',description:'Модон тавилга үйлдвэрлэл',image:'/image.png',categories:['sofa','dining-table'],active:true,owner_id:userId}];
    if(Array.isArray(output)){
      for(const [key,value] of url.searchParams){
        if(value.startsWith('eq.'))output=output.filter(row=>String(row[key])===value.slice(3));
        else if(value.startsWith('neq.'))output=output.filter(row=>String(row[key])!==value.slice(4));
        else if(value.startsWith('gt.'))output=output.filter(row=>row[key]>value.slice(3));
        else if(value==='is.null')output=output.filter(row=>row[key]==null);
      }
      const limit=Number(url.searchParams.get('limit'));if(limit>0)output=output.slice(0,limit);
      if(req.headers.accept?.includes('vnd.pgrst.object'))output=output[0]??null;
    }
    res.end(JSON.stringify(output));
  });
  return {server,requests};
}
module.exports={createFixtureServer};
