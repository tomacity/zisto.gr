import {DndContext,DragOverlay,PointerSensor,KeyboardSensor,useSensor,useSensors,pointerWithin,closestCenter,type CollisionDetection,type DragEndEvent} from '@dnd-kit/core';
import {SortableContext,verticalListSortingStrategy,sortableKeyboardCoordinates} from '@dnd-kit/sortable';
import {createPortal} from 'react-dom';
import {MenuDropCategory,MenuSortableProduct} from './MenuProductSort';
import {moveMenuProduct} from '../../lib/menu-reorder.js';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {supabase} from '../../lib/supabase';
import './menu-management.css';
type Names={gr:string;en:string};
type Price={id:string;label:string;cents:number};
type Product={type?:'heading';id:string;category_id:string;names:Names;descriptions:Names;prices:Price[]};
type Catalog={categories:{id:string;section:string;names:Names}[];products:Product[]};
type Snapshot={catalog:Catalog;revision:number;updated_at:string};
const name=(n:Names)=>n.gr||n.en;
const money=(n:number)=>new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'}).format(n/100);
const variant=(s:string)=>s==='glass'?'Ποτήρι':s==='bottle'?'Φιάλη':s;
const menuCollision:CollisionDetection=(args)=>{
 if(args.pointerCoordinates){
  const hits=pointerWithin(args);
  const products=hits.filter(hit=>String(hit.id).startsWith('product:'));
  return products.length?products:hits;
 }
 const products=args.droppableContainers.filter(item=>item.data.current?.kind==='product');
 return closestCenter({...args,droppableContainers:products.length?products:args.droppableContainers});
};
export default function MenuManagement({businessId}:{businessId?:string|null}){
 const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const [search,setSearch]=useState(''),[category,setCategory]=useState(''),[draft,setDraft]=useState<Product|null>(null);
 const [priceTexts,setPriceTexts]=useState<string[]>([]),[saving,setSaving]=useState(false),[formError,setFormError]=useState(''),[message,setMessage]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),deleteDialog=useRef<HTMLDialogElement>(null),generation=useRef(0);
 const [removeTarget,setRemoveTarget]=useState<Product|null>(null);
 const [activeProductId,setActiveProductId]=useState<string|null>(null),[overId,setOverId]=useState<string|null>(null),[mounted,setMounted]=useState(false);
 const movePending=useRef(false);
 const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:8}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));
 useEffect(()=>{setMounted(true);},[]);
 const dragDisabled=saving||!!draft||!!removeTarget||search.trim().length>0;
 const endpoint='/api/cards?view=menu'+(businessId?'&business_id='+encodeURIComponent(businessId):'');
 async function request(method='GET',body?:unknown,signal?:AbortSignal){
  const {data:sessionData}=await supabase.auth.getSession();
  if(!sessionData.session)throw new Error('Η σύνδεσή σου έληξε. Συνδέσου ξανά.');
  const r=await fetch(endpoint,{method,signal,headers:{Authorization:'Bearer '+sessionData.session.access_token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const result=await r.json();if(!r.ok)throw new Error(result.error||'Δεν έγινε η αποθήκευση.');return result as Snapshot;
 }
 useEffect(()=>{const controller=new AbortController(),current=++generation.current;setData(null);setDraft(null);setCategory('');setSearch('');setMessage('');setLoading(true);setError('');
  request('GET',undefined,controller.signal).then(r=>{if(current===generation.current)setData(r);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(current===generation.current)setLoading(false);});
  return()=>{generation.current++;controller.abort();};
 },[businessId]);
 useEffect(()=>{if(draft&&!dialog.current?.open)dialog.current?.showModal();},[draft?.id]);
 useEffect(()=>{if(removeTarget&&!deleteDialog.current?.open)deleteDialog.current?.showModal();},[removeTarget?.id]);
 function edit(p:Product){setDraft(structuredClone(p));setPriceTexts(p.prices.map(v=>(v.cents/100).toFixed(2).replace('.',',')));setFormError('');setMessage('');}
 function add(){const cat=data?.catalog.categories.find(c=>c.id===category)||data?.catalog.categories[0];if(!cat)return;const id='p-'+crypto.randomUUID();edit({id,category_id:cat.id,names:{gr:'',en:''},descriptions:{gr:'',en:''},prices:[{id:id+'-0',label:'',cents:0}]});}
 function close(){if(!saving){dialog.current?.close();setDraft(null);}}
 async function publish(catalog:Catalog){if(!data)return;const current=generation.current;setSaving(true);setFormError('');setError('');try{const result=await request('PUT',{revision:data.revision,catalog});if(current!==generation.current)return;setData(result);setMessage('Οι αλλαγές αποθηκεύτηκαν και εμφανίζονται στο Smart Link.');dialog.current?.close();setDraft(null);return true;}catch(e){if(current===generation.current){setFormError((e as Error).message);setError((e as Error).message);}return false;}finally{if(current===generation.current)setSaving(false);}}
 async function finishMove(event:DragEndEvent){
  setActiveProductId(null);setOverId(null);
  if(!data||!event.over||dragDisabled||movePending.current)return;
  const productId=event.active.data.current?.productId as string|undefined;
  const destination=event.over.data.current;
  if(!productId||!destination?.categoryId)return;
  const targetId=destination.kind==='product'?destination.productId:null;
  const current=data.catalog.products.find(p=>p.id===productId);
  let placement:'before'|'after'='before';
  if(targetId){
   if(current?.category_id===destination.categoryId){
    placement=data.catalog.products.findIndex(p=>p.id===productId)<data.catalog.products.findIndex(p=>p.id===targetId)?'after':'before';
   }else{
    const rect=event.active.rect.current.translated;
    if(rect&&rect.top+rect.height/2>event.over.rect.top+event.over.rect.height/2)placement='after';
   }
  }
  const catalog=moveMenuProduct(data.catalog,productId,destination.categoryId,targetId,placement) as Catalog;
  if(catalog===data.catalog)return;
  const previous=data,version=generation.current;
  movePending.current=true;setData({...data,catalog});setMessage('');
  try{if(!await publish(catalog)&&version===generation.current)setData(previous);}
  finally{movePending.current=false;}
 }
 async function save(event:FormEvent){event.preventDefault();if(!draft||!data)return;
  if(!draft.names.gr.trim()&&!draft.names.en.trim()){setFormError('Συμπλήρωσε τουλάχιστον ένα όνομα.');return;}
  const values=priceTexts.map(s=>s.trim().replace(',','.'));
  if(values.some(s=>!/^\d+(\.\d{1,2})?$/.test(s)||Number(s)>100000)){setFormError('Συμπλήρωσε έγκυρη τιμή με έως δύο δεκαδικά.');return;}
  const p={...draft,prices:draft.prices.map((v,i)=>({...v,cents:Math.round(Number(values[i])*100)}))};
  const exists=data.catalog.products.some(x=>x.id===p.id);await publish({...data.catalog,products:exists?data.catalog.products.map(x=>x.id===p.id?p:x):[...data.catalog.products,p]});
 }
 function remove(p:Product){setRemoveTarget(p);setFormError('');}
 function cancelRemove(){if(!saving){deleteDialog.current?.close();setRemoveTarget(null);}}
 const shown=data?.catalog.products.filter(p=>p.type!=='heading'&&(!category||p.category_id===category)&&[...Object.values(p.names),...Object.values(p.descriptions)].some(s=>s.toLocaleLowerCase('el').includes(search.toLocaleLowerCase('el'))))||[];
 return <section className="menu-manager" aria-label="Διαχείριση μενού">
  <header className="mm-header"><div><p className="mm-eyebrow">ΜΕΝΟΥ</p><h1>Διαχείριση μενού</h1><p>Ενημέρωσε προϊόντα και τιμές. Οι αλλαγές περνούν απευθείας στο Smart Link.</p></div><button className="mm-primary" onClick={add} disabled={!data?.catalog.categories.length||saving||!!activeProductId}>+ Προσθήκη προϊόντος</button></header>
  {loading&&<p role="status">Φόρτωση καταλόγου…</p>}
  {error&&<p className="mm-error" role="alert">{error}</p>}
  {message&&<p className="mm-success" role="status">{message}</p>}
  {saving&&!draft&&!removeTarget&&<p role="status">Αποθήκευση αλλαγών…</p>}
  {data&&<><div className="mm-filters"><label>Αναζήτηση<input type="search" disabled={saving||!!activeProductId} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Όνομα προϊόντος…"/></label><label>Κατηγορία<select disabled={saving||!!activeProductId} value={category} onChange={e=>setCategory(e.target.value)}><option value="">Όλες οι κατηγορίες</option>{data.catalog.categories.map(c=><option key={c.id} value={c.id}>{c.section} · {name(c.names)}</option>)}</select></label><span>{shown.length} προϊόντα</span></div>
  <p className="mm-sort-hint">{search.trim()?'Καθάρισε την αναζήτηση για να μετακινήσεις προϊόντα.':category?'Σύρε από τις έξι τελείες για αλλαγή σειράς. Για μεταφορά σε άλλη κατηγορία, επίλεξε «Όλες οι κατηγορίες».':'Σύρε από τις έξι τελείες για αλλαγή σειράς ή μεταφορά σε άλλη κατηγορία. Οι αλλαγές αποθηκεύονται αυτόματα.'}</p>
  <DndContext sensors={sensors} collisionDetection={menuCollision} onDragStart={({active})=>{setActiveProductId(active.data.current?.productId||null);setMessage('');}} onDragOver={({over})=>setOverId(over?String(over.id):null)} onDragCancel={()=>{setActiveProductId(null);setOverId(null);}} onDragEnd={finishMove} accessibility={{screenReaderInstructions:{draggable:'Πάτησε Space για μετακίνηση. Χρησιμοποίησε τα βελάκια και πάτησε ξανά Space για τοποθέτηση ή Escape για ακύρωση.'}}}>
   {data.catalog.categories.filter(c=>(!category||c.id===category)&&(!search.trim()||shown.some(p=>p.category_id===c.id))).map(c=><MenuDropCategory key={c.id} id={c.id} disabled={dragDisabled} active={overId==='category:'+c.id}><header><p className="mm-eyebrow">{c.section}</p><h2>{name(c.names)}</h2></header>
    <SortableContext id={'menu-category:'+c.id} items={shown.filter(p=>p.category_id===c.id).map(p=>'product:'+p.id)} strategy={verticalListSortingStrategy}>
     {shown.filter(p=>p.category_id===c.id).map(p=><MenuSortableProduct key={p.id} id={p.id} categoryId={c.id} title={name(p.names)} disabled={dragDisabled} over={overId==='product:'+p.id&&activeProductId!==p.id}>
      <div><h3>{name(p.names)}</h3>{p.names.en&&p.names.en!==p.names.gr&&<p>{p.names.en}</p>}{name(p.descriptions)&&<p>{name(p.descriptions)}</p>}</div>
      <div className="mm-prices">{p.prices.map(v=><span key={v.id}>{variant(v.label)} {money(v.cents)}</span>)}</div>
      <div className="mm-actions"><button onClick={()=>edit(p)} disabled={saving||!!activeProductId} aria-label={'Επεξεργασία '+name(p.names)}>✎ Edit</button><button className="mm-delete" onClick={()=>remove(p)} disabled={saving||!!activeProductId} aria-label={'Αφαίρεση '+name(p.names)}>Αφαίρεση</button></div>
     </MenuSortableProduct>)}
    </SortableContext>
    {!shown.some(p=>p.category_id===c.id)&&<p className="mm-empty-drop">Σύρε ένα προϊόν εδώ ή πρόσθεσε νέο προϊόν.</p>}
   </MenuDropCategory>)}
   {mounted&&createPortal(<DragOverlay dropAnimation={null}>{activeProductId?<div className="mm-drag-preview">{name(data.catalog.products.find(p=>p.id===activeProductId)?.names||{gr:'',en:''})}</div>:null}</DragOverlay>,document.body)}
  </DndContext>
  {!shown.length&&<p>Δεν βρέθηκαν προϊόντα.</p>}</>}
  <dialog ref={deleteDialog} aria-label="Αφαίρεση προϊόντος" className="mm-dialog" onCancel={e=>{e.preventDefault();cancelRemove();}}><h2>Αφαίρεση προϊόντος</h2><p>Να αφαιρεθεί το «{removeTarget?name(removeTarget.names):''}» από το μενού;</p>{formError&&<p className="mm-error" role="alert">{formError}</p>}<footer><button type="button" disabled={saving} onClick={cancelRemove}>Ακύρωση</button><button type="button" className="mm-delete" disabled={saving} onClick={async()=>{if(!data||!removeTarget)return;if(await publish({...data.catalog,products:data.catalog.products.filter(p=>p.id!==removeTarget.id)})){deleteDialog.current?.close();setRemoveTarget(null);}}}>Αφαίρεση προϊόντος</button></footer></dialog>
  <dialog ref={dialog} aria-label="Επεξεργασία προϊόντος" className="mm-dialog" onCancel={e=>{e.preventDefault();close();}} onClose={()=>{if(!saving)setDraft(null);}}>
   {draft&&<form onSubmit={save}><header><h2>{data?.catalog.products.some(p=>p.id===draft.id)?'Επεξεργασία προϊόντος':'Νέο προϊόν'}</h2><button type="button" onClick={close} disabled={saving} aria-label="Κλείσιμο">×</button></header>
   <label>Κατηγορία<select value={draft.category_id} onChange={e=>setDraft({...draft,category_id:e.target.value})} disabled={saving}>{data?.catalog.categories.map(c=><option key={c.id} value={c.id}>{c.section} · {name(c.names)}</option>)}</select></label>
   <div className="mm-columns">{(['gr','en'] as const).map(lang=><div key={lang}><label>Όνομα ({lang==='gr'?'Ελληνικά':'English'})<input autoFocus={lang==='gr'} maxLength={180} value={draft.names[lang]||''} onChange={e=>setDraft({...draft,names:{...draft.names,[lang]:e.target.value}})} disabled={saving}/></label><label>Περιγραφή ({lang==='gr'?'Ελληνικά':'English'})<textarea maxLength={2000} value={draft.descriptions[lang]||''} onChange={e=>setDraft({...draft,descriptions:{...draft.descriptions,[lang]:e.target.value}})} disabled={saving}/></label></div>)}</div>
   <fieldset><legend>Τιμές σε €</legend>{draft.prices.map((v,i)=><div className="mm-price-row" key={v.id}><label>Επιλογή<input value={v.label} placeholder="π.χ. Ποτήρι" maxLength={80} disabled={saving} onChange={e=>setDraft({...draft,prices:draft.prices.map((x,j)=>i===j?{...x,label:e.target.value}:x)})}/></label><label>Τιμή (€)<input inputMode="decimal" required value={priceTexts[i]||''} onChange={e=>setPriceTexts(priceTexts.map((x,j)=>j===i?e.target.value:x))} disabled={saving}/></label>{draft.prices.length>1&&<button type="button" disabled={saving} aria-label={'Αφαίρεση τιμής '+(i+1)} onClick={()=>{setDraft({...draft,prices:draft.prices.filter((_,j)=>j!==i)});setPriceTexts(priceTexts.filter((_,j)=>j!==i));}}>×</button>}</div>)}<button type="button" disabled={saving||draft.prices.length>=8} onClick={()=>{setDraft({...draft,prices:[...draft.prices,{id:'v-'+crypto.randomUUID(),label:'',cents:0}]});setPriceTexts([...priceTexts,'']);}}>+ Επιπλέον τιμή</button></fieldset>
   {formError&&<p className="mm-error" role="alert">{formError}</p>}<footer><button type="button" onClick={close} disabled={saving}>Ακύρωση</button><button className="mm-primary" type="submit" disabled={saving}>{saving?'Αποθήκευση…':'Αποθήκευση αλλαγών'}</button></footer></form>}
  </dialog>
 </section>;
}
