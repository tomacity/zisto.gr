import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCatalog,catalogProducts} from '../lib/menu-catalog.js';
import handler from '../lib/menu-api.js';
const business='de2efc5b-d096-4cde-8ed5-88ded13c6d8f',other='021c48d4-fccc-4ccb-b37c-d42c2e341aa0';
const sample={categories:[{id:'food',section:'dinner',names:{gr:'Φαγητό',en:'Food'}}],products:[{id:'test',category_id:'food',names:{gr:'Δοκιμή',en:'Test'},descriptions:{gr:'',en:''},prices:[{id:'test-0',label:'',cents:1234}]}]};
assert.equal(catalogProducts(validateCatalog(sample))['test-0'].cents,1234);
for(const change of [s=>s.products[0].prices[0].cents=-1,s=>s.products[0].prices[0].cents=1.1,s=>s.products.push(s.products[0]),s=>s.products[0].category_id='missing',s=>s.products[0].names={gr:'',en:''}]){const s=structuredClone(sample);change(s);assert.throws(()=>validateCatalog(s));}
process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SECRET_KEY='server-only';
let role='owner',admin=false,revision=1,catalog=sample,patches=0;
globalThis.fetch=async(url,options={})=>{
 const u=new URL(url);const json=(data,status=200)=>new Response(JSON.stringify(data),{status});
 if(u.pathname==='/auth/v1/user')return options.headers.Authorization==='Bearer valid'?json({id:'user'}):json({},401);
 if(u.pathname.endsWith('/zisto_admins'))return json(admin?[{user_id:'user'}]:[]);
 if(u.pathname.endsWith('/business_members'))return json(u.searchParams.get('business_id')==='eq.'+other?[]:[{business_id:business,role}]);
 if(u.pathname.endsWith('/connected_projects'))return json([{business_id:business}]);
 if(u.pathname.endsWith('/businesses'))return json([{id:business,status:'active',dashboard_modules:['menu']}]);
 if(u.pathname.endsWith('/business_menu_catalogs')){
  assert.equal(u.searchParams.get('business_id'),'eq.'+business);
  if(options.method==='PATCH'){patches++;if(u.searchParams.get('revision')!=='eq.'+revision)return json([]);const body=JSON.parse(options.body);catalog=body.catalog;revision=body.revision;}
  return json([{catalog,revision,updated_at:'2026-11-16'}]);
 }
 throw Error('Unexpected URL '+url);
};
async function request(method,query='',body,auth='valid') {const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(data){this.body=data;return this;},end(){return this;}};await handler({method,url:'/api/cards?view=menu'+query,headers:{authorization:auth?'Bearer '+auth:undefined},body},res);return res;}
assert.equal((await request('GET','',undefined,'')).statusCode,401);
assert.equal((await request('GET','',undefined,'expired')).statusCode,401);
assert.equal((await request('GET','&business_id='+other)).statusCode,403);
assert.equal((await request('GET','&project_key=d007b558-b9d8-487f-b64e-6b9b76b01810',undefined,'')).statusCode,200);
assert.equal((await request('PUT','&business_id='+other,{catalog:sample,revision})).statusCode,403);
role='viewer';assert.equal((await request('PUT','',{catalog:sample,revision})).statusCode,403);role='owner';
const edited=structuredClone(sample);edited.products[0].names.gr='Νέο όνομα';edited.products[0].prices[0].cents=999;
let response=await request('PUT','',{catalog:edited,revision:1});assert.equal(response.statusCode,200);assert.equal(response.body.catalog.products[0].prices[0].cents,999);
assert.equal((await request('PUT','',{catalog:sample,revision:1})).statusCode,409);
response=await request('PUT','',{catalog:{...edited,products:[]},revision:2});assert.equal(response.statusCode,200);assert.equal(response.body.catalog.products.length,0);
assert.equal((await request('PUT','',{catalog:sample,revision:3})).statusCode,200);
assert.equal((await request('DELETE')).statusCode,405);
console.log('Menu checks passed: schema, integer prices, duplicates, public read, authentication, tenant isolation, role checks, edits, add/remove and version conflict.');
