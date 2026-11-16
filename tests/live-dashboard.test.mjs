import assert from "node:assert/strict";
import { startLiveRefresh } from "../src/lib/live-refresh.js";
import { countUpValue } from "../src/lib/count-up.js";
class Surface {
  listeners = new Map(); timers = new Map(); next = 0; visibilityState = "visible";
  addEventListener(name,fn) { const list=this.listeners.get(name)||new Set();list.add(fn);this.listeners.set(name,list); }
  removeEventListener(name,fn) { this.listeners.get(name)?.delete(fn); }
  emit(name) { for(const fn of this.listeners.get(name)||[])fn(); }
  setTimeout(fn,delay) { const id=++this.next;this.timers.set(id,{fn,delay});return id; }
  clearTimeout(id) {this.timers.delete(id);}
  async tick(delay) {
    const timers=[...this.timers].filter(([,t])=>t.delay===delay);
    for(const [id,timer] of timers){if(!this.timers.delete(id))continue;await timer.fn();}
    await flush();
  }
}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
{
  const windowTarget=new Surface(),documentTarget=new Surface(),calls=[];
  const stop=startLiveRefresh(async context=>{calls.push(context);},{windowTarget,documentTarget});
  await flush();
  assert.equal(calls.length,1);assert.equal(calls[0].initial,true);
  await windowTarget.tick(5000);
  assert.equal(calls.length,2);assert.equal(calls[1].initial,false);
  documentTarget.visibilityState="hidden";documentTarget.emit("visibilitychange");
  await windowTarget.tick(5000);assert.equal(calls.length,2);
  documentTarget.visibilityState="visible";documentTarget.emit("visibilitychange");await flush();
  assert.equal(calls.length,3);
  windowTarget.emit("online");await flush();assert.equal(calls.length,4);
  stop();await windowTarget.tick(5000);windowTarget.emit("focus");await flush();
  assert.equal(calls.length,4);assert.equal(windowTarget.timers.size,0);
}
{
  const windowTarget=new Surface(),documentTarget=new Surface();let releases=[],calls=0,active=0,max=0,lastSignal;
  const stop=startLiveRefresh(async({signal})=>{calls++;lastSignal=signal;active++;max=Math.max(max,active);await new Promise(r=>releases.push(r));active--;},{windowTarget,documentTarget});
  windowTarget.emit("focus");windowTarget.emit("online");windowTarget.emit("focus");
  assert.equal(calls,1);
  releases.shift()();await flush();
  assert.equal(calls,2);assert.equal(max,1);
  stop();assert.equal(lastSignal.aborted,true);
  releases.shift()();await flush();assert.equal(windowTarget.timers.size,0);
}
{
  const windowTarget=new Surface(),documentTarget=new Surface();documentTarget.visibilityState="hidden";let calls=0;
  const stop=startLiveRefresh(async()=>{calls++;},{windowTarget,documentTarget});
  await flush();assert.equal(calls,0);stop();
}
for(const [from,to] of [[0,100],[100,0],[10,20],[20,10],[0,0]]) {
  assert.equal(countUpValue(from,to,0),from);
  assert.equal(countUpValue(from,to,800),to);
  assert.equal(countUpValue(from,to,1600),to);
  const midpoint=countUpValue(from,to,400);
  assert.ok(midpoint>=Math.min(from,to)&&midpoint<=Math.max(from,to));
}
console.log("Live dashboard checks passed: polling, hidden pause, focus/online refresh, non-overlap, abort and cleanup, count up/down and exact targets.");
