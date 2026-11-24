import { validateCatalog } from './menu-catalog.js';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function menuHandler(req, res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET','PUT'].includes(req.method)) return res.status(405).json({error:'Method not allowed'});
  const url = new URL(req.url,'https://zisto.app'), key = process.env.SUPABASE_SECRET_KEY, base = process.env.SUPABASE_URL;
  if (!key || !base) return res.status(500).json({error:'Server configuration error'});
  async function db(table, params, options={}) {
    const r=await fetch(base+'/rest/v1/'+table+'?'+new URLSearchParams(params),{...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...options.headers}});
    if(!r.ok) throw new Error('database');
    return r.status===204?null:r.json();
  }
  try {
    let businessId;
    const projectKey=url.searchParams.get('project_key');
    if(req.method==='GET' && projectKey) {
      if(!uuid.test(projectKey))return res.status(400).json({error:'Invalid project'});
      const [project]=await db('connected_projects',{project_key:'eq.'+projectKey,status:'eq.active',select:'business_id',limit:'1'});
      if(!project)return res.status(404).json({error:'Menu not found'});
      const [business]=await db('businesses',{id:'eq.'+project.business_id,select:'id,status,dashboard_modules',limit:'1'});
      if(!business || business.status!=='active' || !business.dashboard_modules?.includes('menu'))return res.status(404).json({error:'Menu not found'});
      businessId=business.id;
    } else {
      const token=req.headers.authorization;
      if(!token?.startsWith('Bearer '))return res.status(401).json({error:'Authentication required'});
      const auth=await fetch(base+'/auth/v1/user',{headers:{apikey:key,Authorization:token}});
      if(!auth.ok)return res.status(401).json({error:'Invalid session'});
      const user=await auth.json();
      const admins=await db('zisto_admins',{user_id:'eq.'+user.id,select:'user_id',limit:'1'});
      const requested=url.searchParams.get('business_id');
      if(requested&&!uuid.test(requested))return res.status(400).json({error:'Invalid business'});
      const members=await db('business_members',{user_id:'eq.'+user.id,...(requested?{business_id:'eq.'+requested}:{}),select:'business_id,role',limit:'1'});
      if(admins.length && requested)businessId=requested;
      else {
        const member=members[0];
        if(!member || (req.method==='PUT'&&!['owner','admin','manager'].includes(member.role)))return res.status(403).json({error:'Δεν έχεις δικαίωμα διαχείρισης αυτού του μενού.'});
        businessId=member.business_id;
      }
    }
    if(req.method==='GET') {
      const [row]=await db('business_menu_catalogs',{business_id:'eq.'+businessId,select:'catalog,revision,updated_at',limit:'1'});
      if(!row)return res.status(404).json({error:'Δεν έχει συνδεθεί ακόμη κατάλογος με αυτό το Smart Link.'});
      if(projectKey)row.catalog={...row.catalog,products:row.catalog.products.filter(product=>product.hidden!==true)};
      return res.status(200).json(row);
    }
    let body;
    try {body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'Μη έγκυρα δεδομένα.'});}
    if(!body || !Number.isSafeInteger(body.revision) || body.revision<1 || JSON.stringify(body).length>1500000)return res.status(400).json({error:'Μη έγκυρα δεδομένα.'});
    let catalog;try{catalog=validateCatalog(body.catalog);}catch(e){return res.status(400).json({error:e.message});}
    const saved=await db('business_menu_catalogs',{business_id:'eq.'+businessId,revision:'eq.'+body.revision,select:'catalog,revision,updated_at'},{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({catalog,revision:body.revision+1,updated_at:new Date().toISOString()})});
    if(!saved.length)return res.status(409).json({error:'Το μενού άλλαξε από άλλη συσκευή. Ανανέωσε τη σελίδα πριν δοκιμάσεις ξανά.'});
    return res.status(200).json(saved[0]);
  } catch(e) { console.error('Menu request failed',e.message);return res.status(503).json({error:'Το μενού δεν είναι διαθέσιμο. Δοκίμασε ξανά.'}); }
}
