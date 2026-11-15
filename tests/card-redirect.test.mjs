import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler from '../api/cards.ts';

process.env.SUPABASE_URL='https://database.test';
process.env.SUPABASE_SECRET_KEY='test-only';
const originalFetch=globalThis.fetch;
const token='98cecfce-9766-4790-b366-b1df8a7ad2ad';
async function scan({source='nfc',publicToken=token,card=true,pageActive=true,project=true,lookupError=false,destination='https://example.com/menu/?lang=el#dinner-gr'}={}) {
  let calls=0;
  globalThis.fetch=async (input,init)=>{
    calls++;
    assert.equal(init.method,'GET','Scans must not mutate data or record a second event');
    const url=new URL(input);
    if(url.pathname.endsWith('/cards')) {
      assert.equal(url.searchParams.get('public_token'),'eq.'+token);
      assert.equal(url.searchParams.get('is_active'),'eq.true');
      return new Response(JSON.stringify(card?[{public_token:token,landing_pages:{is_active:pageActive,locations:{business_id:'business-1'}}}]:[]),{status:lookupError?500:200});
    }
    assert.ok(url.pathname.endsWith('/connected_projects'));
    assert.equal(url.searchParams.get('business_id'),'eq.business-1');
    assert.equal(url.searchParams.get('status'),'eq.active');
    return new Response(JSON.stringify(project?[{live_url:destination}]:[]),{status:200});
  };
  const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(v){this.statusCode=v;return this;},json(v){this.body=v;return this;},end(){return this;}};
  await handler({method:'GET',url:'/api/cards?'+new URLSearchParams({public_token:publicToken,source}),headers:{host:'localhost'}},res);
  return {res,calls};
}
try {
  for(const source of ['nfc','qr']) {
    const {res,calls}=await scan({source});
    assert.equal(res.statusCode,302);
    const destination=new URL(res.headers.Location);
    assert.equal(destination.origin,'https://example.com');
    assert.equal(destination.hash,'#dinner-gr');
    assert.equal(destination.searchParams.get('lang'),'el');
    assert.equal(destination.searchParams.get('source'),source);
    assert.equal(destination.searchParams.get('card'),token);
    assert.equal(res.headers['Cache-Control'],'no-store');
    assert.equal(calls,2);
  }
  const invalid=await scan({publicToken:'invalid'});
  assert.equal(invalid.res.statusCode,404);
  assert.equal(invalid.calls,0);
  for(const options of [{card:false},{pageActive:false},{project:false}]) {
    const {res}=await scan(options);
    assert.equal(res.statusCode,404);
    assert.equal(res.headers.Location,undefined);
  }
  const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.deepEqual(config.rewrites.slice(0,2),[
    {source:'/n/:token',destination:'/api/cards?public_token=:token&source=nfc'},
    {source:'/q/:token',destination:'/api/cards?public_token=:token&source=qr'},
  ]);
  console.log('Short card link tests passed: NFC/QR attribution, destinations, invalid/disabled tokens, no caching or duplicate writes, route order.');
} finally {globalThis.fetch=originalFetch;}
