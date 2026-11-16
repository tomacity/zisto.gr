const idPattern = /^[a-zA-Z0-9_-]{1,100}$/;
function text(value, max) {
  if (typeof value !== 'string' || value.length > max) throw new Error('Μη έγκυρο κείμενο.');
  return value.trim();
}
function names(value, required, max = 180, subject = 'το όνομα του προϊόντος') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Μη έγκυρη μετάφραση.');
  const result = {gr: text(value.gr ?? '', max), en: text(value.en ?? '', max)};
  if (required && !result.gr && !result.en) throw new Error('Συμπλήρωσε '+subject+'.');
  return result;
}
export function validateCatalog(input) {
  if (!input || !Array.isArray(input.categories) || !Array.isArray(input.products) || input.categories.length > 100 || input.products.length > 2000) throw new Error('Μη έγκυρος κατάλογος.');
  const ids = new Set(), priceIds = new Set();
  const categories = input.categories.map(c => {
    if (!idPattern.test(c.id) || ids.has(c.id) || !idPattern.test(c.section)) throw new Error('Μη έγκυρη κατηγορία.');
    ids.add(c.id); return {id:c.id,section:c.section,names:names(c.names,true,180,'το όνομα της κατηγορίας «'+c.id+'»')};
  });
  const productIds = new Set();
  const products = input.products.map(p => {
    if (!idPattern.test(p.id) || productIds.has(p.id) || !ids.has(p.category_id) || !Array.isArray(p.prices) || (p.type === 'heading' ? p.prices.length !== 0 : p.prices.length < 1) || p.prices.length > 8) throw new Error('Μη έγκυρο προϊόν ή κατηγορία.');
    productIds.add(p.id);
    return {id:p.id,category_id:p.category_id,...(p.type==='heading'?{type:'heading'}:{}),names:names(p.names,true,180,'το όνομα για το προϊόν «'+p.id+'» του καταλόγου'),descriptions:names(p.descriptions ?? {},false,2000),prices:p.prices.map(v => {
      if (!idPattern.test(v.id) || priceIds.has(v.id) || !Number.isSafeInteger(v.cents) || v.cents < 0 || v.cents > 10000000) throw new Error('Η τιμή πρέπει να είναι θετική, με έως δύο δεκαδικά.');
      priceIds.add(v.id); return {id:v.id,label:text(v.label ?? '',80),cents:v.cents};
    })};
  });
  return {categories,products};
}

export function catalogProducts(catalog) {
  return Object.fromEntries(catalog.products.flatMap(p => p.prices.map(v => [v.id,{id:v.id,cents:v.cents,names:p.names,variant:v.label || null}])));
}
