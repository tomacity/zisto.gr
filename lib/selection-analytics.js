// Selections express interest, never confirmed orders or revenue.
const CART_ACTIONS = new Set(['cart_open','cart_add','cart_remove','cart_clear','cart_waiter_view','group_create','group_join','group_close','group_leave']);
export function selectionEventName(event) {
  const meta = event.metadata;
  return event.event_type === 'button_click' && meta?.component === 'selection_cart' && CART_ACTIONS.has(meta.action)
    ? meta.action : null;
}
export function summarizeSelections(events, now = new Date(), timeZone = 'Europe/Athens') {
  const dayKey = value => {
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  };
  const today = dayKey(now);
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const values = Object.fromEntries(parts.map(x=>[x.type,x.value]));
  const start = new Date(Date.UTC(Number(values.year),Number(values.month)-1,Number(values.day)-6));
  const startKey = start.toISOString().slice(0,10);
  const items = events.filter(e=>selectionEventName(e) && dayKey(e.created_at)>=startKey && dayKey(e.created_at)<=today && new Date(e.created_at)<=now);
  const sessions = new Set(items.filter(e=>e.metadata.action==='cart_add').map(e=>e.session_id).filter(Boolean));
  const products = new Map();
  let added=0,removed=0;
  for (const e of items) {
    const m=e.metadata;
    if(m.action==='cart_add' && m.quantity_delta===1) {
      added++;
      if(typeof m.product_id!=='string' || typeof m.product_name!=='string')continue;
      const id=m.product_id.slice(0,100);
      const product=products.get(id)||{id,name:m.product_name.slice(0,180),additions:0};
      product.additions++;products.set(id,product);
    } else if(m.action==='cart_remove' && m.quantity_delta===-1) removed++;
  }
  const count=action=>items.filter(e=>e.metadata.action===action).length;
  return {days:7,cart_opens:count('cart_open'),selection_sessions:sessions.size,items_added:added,items_removed:removed,
    groups_created:count('group_create'),group_joins:count('group_join'),waiter_views:count('cart_waiter_view'),
    top_products:[...products.values()].sort((a,b)=>b.additions-a.additions||a.id.localeCompare(b.id)).slice(0,5)};
}

