import assert from "node:assert/strict";
import { resetBusinessActivity } from "../lib/business-reset.js";
const id = "de2efc5b-d096-4cde-8ed5-88ded13c6d8f";
function clientFor(options = {}) {
  const calls = [], rpcCalls = [];
  const rounds = [...(options.pending || [[]])];
  const client = {
    from(table) {
      const query = {table, filters: [], updating: false};
      const chain = {
        select() { return this; }, eq(key,value) { query.filters.push([key,value]); return this; },
        lte(key,value) { query.filters.push([key,value]); return this; },
        not() { return this; }, or() { return this; }, order() { return this; }, limit() { return this; },
        update() { query.updating = true; return this; }, maybeSingle() { return this; },
        then(resolve,reject) {
          calls.push(query);
          let result;
          if (table === "businesses") result = options.lookup || {data:{id,name:"Business",slug:"fox"},error:null};
          else if (query.updating) result = options.cleared || {data:{id:"booking"},error:null};
          else result = {data:rounds.shift() || [],error:options.pendingError || null};
          return Promise.resolve(result).then(resolve,reject);
        }
      };
      return chain;
    },
    async rpc(name,args) {
      rpcCalls.push({name,args});
      return options.rpc || {data:{business_id:id,reset_at:args.p_cutoff,deleted:{analytics_events:8,events:2,appointments:1}},error:null};
    }
  };
  return {client,calls,rpcCalls};
}
async function run(body = {id,confirm_slug:"fox",confirm_reset:true}, options = {}, cancel = async()=>({ok:true})) {
  const state=clientFor(options);
  const res={statusCode:0,status(value){this.statusCode=value;return this;},json(body){this.body=body;return this;}};
  await resetBusinessActivity({body},res,state.client,"admin-1",cancel);
  return {...state,res};
}
for (const body of [{id,confirm_slug:"fox"}, {id:"invalid",confirm_slug:"fox",confirm_reset:true}, {id,confirm_slug:"",confirm_reset:true}]) {
  const result=await run(body);
  assert.equal(result.res.statusCode,400);
  assert.equal(result.calls.length,0);
  assert.equal(result.rpcCalls.length,0);
}
const mismatch=await run({id,confirm_slug:"other",confirm_reset:true});
assert.equal(mismatch.res.statusCode,400);assert.equal(mismatch.rpcCalls.length,0);
const missing=await run(undefined,{lookup:{data:null,error:null}});
assert.equal(missing.res.statusCode,404);
const lookupFailure=await run(undefined,{lookup:{data:null,error:{code:"error"}}});
assert.equal(lookupFailure.res.statusCode,500);
const pendingFailure=await run(undefined,{pendingError:{code:"error"}});
assert.equal(pendingFailure.res.statusCode,500);assert.equal(pendingFailure.rpcCalls.length,0);
const appointment={id:"booking",reminder_email_id:"mail-1",reminder_scheduled_for:"2099-01-01T00:00:00Z"};
const failedCancel=await run(undefined,{pending:[[appointment]]},async()=>({ok:false}));
assert.equal(failedCancel.res.statusCode,502);
assert.equal(failedCancel.rpcCalls.length,0);
assert.ok(!failedCancel.calls.some(call=>call.updating));
const stale=await run(undefined,{pending:[[appointment]],cleared:{data:null,error:null}});
assert.equal(stale.res.statusCode,409);assert.equal(stale.rpcCalls.length,0);
const success=await run(undefined,{pending:[[appointment],[]]});
assert.equal(success.res.statusCode,200);assert.equal(success.res.body.success,true);
assert.equal(success.res.body.cancelled_reminders,1);
assert.equal(success.rpcCalls.length,1);
assert.equal(success.rpcCalls[0].name,"reset_business_activity");
assert.equal(success.rpcCalls[0].args.p_business_id,id);
assert.equal(success.rpcCalls[0].args.p_actor_id,"admin-1");
for (const query of success.calls.filter(q=>q.table==="appointments")) {
  assert.ok(query.filters.some(([key,value])=>key==="business_id"&&value===id));
}
const rpcFailure=await run(undefined,{rpc:{data:null,error:{code:"P0001"}}});
assert.equal(rpcFailure.res.statusCode,409);assert.equal(rpcFailure.res.body.success,undefined);
console.log("Business reset checks passed: explicit confirmation, scoped business, missing data, provider failure, stale reminder, successful reset and RPC failure.");
