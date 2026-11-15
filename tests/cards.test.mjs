import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import handler from '../api/cards.ts';

process.env.SUPABASE_URL = 'https://database.test';
process.env.SUPABASE_SECRET_KEY = 'test-only';
const originalFetch = globalThis.fetch;
async function request(method, {locations = [{id:'location-1',name:'Main'}], pages = [{id:'page-1',name:'Smart Link',location_id:'location-1'}], project = true} = {}) {
  const writes = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(input);
    let data;
    if (url.pathname === '/auth/v1/user') data = {id:'user-1'};
    else if (url.pathname.endsWith('/zisto_admins')) data = [{user_id:'user-1'}];
    else if (url.pathname.endsWith('/business_members')) data = [];
    else if (url.pathname.endsWith('/connected_projects')) data = project ? [{live_url:'https://example.com/menu/#dinner-gr'}] : [];
    else if (url.pathname.endsWith('/locations')) data = locations;
    else if (url.pathname.endsWith('/landing_pages')) data = pages;
    else if (url.pathname.endsWith('/cards') && init.method === 'POST') {
      const body = JSON.parse(init.body);
      writes.push(body);
      data = [{id:'card-1',...body}];
    } else throw new Error('Unexpected database request: '+url);
    return new Response(JSON.stringify(data), {status:200});
  };
  const res = {statusCode:200,setHeader(){},status(value){this.statusCode=value;return this;},json(value){this.body=value;return this;}};
  await handler({method,url:'/api/cards?business_id=business-1',headers:{authorization:'Bearer test',host:'localhost'},body:{name:' Table 1 '}},res);
  return {res,writes};
}
try {
  for (const method of ['POST','PATCH','DELETE']) {
    const {res,writes} = await request(method,{locations:[]});
    assert.equal(res.statusCode,409,method+' must reject incomplete setup');
    assert.ok(res.body.error);
    assert.equal(writes.length,0);
  }
  const empty = await request('GET',{locations:[]});
  assert.equal(empty.res.statusCode,200);
  assert.deepEqual(empty.res.body,{business_id:'business-1',cards:[]});
  for (const setup of [{pages:[]},{project:false}]) {
    const {res,writes} = await request('POST',setup);
    assert.equal(res.statusCode,409);
    assert.equal(writes.length,0);
  }
  const {res,writes} = await request('POST');
  assert.equal(res.statusCode,201);
  assert.equal(writes.length,1);
  assert.equal(res.body.card.name,'Table 1');
  assert.equal(res.body.card.landing_page_name,'Smart Link');
  assert.equal(res.body.card.location_name,'Main');
  const tracking = new URL(res.body.card.tracking_url);
  assert.equal(tracking.origin,'https://zisto.app');
  assert.equal(tracking.pathname,'/n/'+res.body.card.public_token);
  assert.equal(Buffer.byteLength(tracking.href),56);

  // Exercise the actual createTable callback with the API's old empty-success response.
  const site = readFileSync(new URL('../src/components/zisto/Site.tsx',import.meta.url),'utf8');
  const start = site.indexOf('  async function createTable(');
  const end = site.indexOf('  async function toggleCard(',start);
  let createSource = site.slice(start,end)
    .replace('event: FormEvent<HTMLFormElement>','event')
    .replace('const createdCard: NfcCard','const createdCard');
  let error,createdCard,closed=false;
  const deps = {supabase:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}},fetch:async()=>new Response(JSON.stringify({cards:[]}),{status:200}),tableName:'Test',businessId:'business-1',cards:[],setCreateError:value=>{error=value;},setCreatingTable(){},onCardCreated:value=>{createdCard=value;},setTableName(){},setShowAddTable:()=>{closed=true;}};
  const createTable = new Function(...Object.keys(deps),createSource+'; return createTable;')(...Object.values(deps));
  await createTable({preventDefault(){}});
  assert.equal(error,'Απέτυχε η δημιουργία του τραπεζιού.');
  assert.equal(createdCard,undefined);
  assert.equal(closed,false);
  console.log('Table creation regression checks passed: missing setup, GET empty state, successful creation and tracking URL, frontend empty response.');
} finally {
  globalThis.fetch = originalFetch;
}
