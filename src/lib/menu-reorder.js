// Move one product without changing its ID, prices, or the relative order of other entries.
export function moveMenuProduct(catalog, productId, categoryId, targetId = null, placement = 'before') {
  const product = catalog.products.find(p => p.id === productId);
  if (!product || product.type === 'heading' || !catalog.categories.some(c => c.id === categoryId) || targetId === productId) return catalog;
  const remaining = catalog.products.filter(p => p.id !== productId);
  let index;
  if (targetId !== null) {
    const target = remaining.find(p => p.id === targetId);
    if (!target || target.type === 'heading' || target.category_id !== categoryId) return catalog;
    index = remaining.findIndex(p => p.id === targetId) + (placement === 'after' ? 1 : 0);
  } else {
    const last = remaining.findLastIndex(p => p.category_id === categoryId);
    if (last >= 0) index = last + 1;
    else {
      const categoryIndex = catalog.categories.findIndex(c => c.id === categoryId);
      index = remaining.findIndex(p => catalog.categories.findIndex(c => c.id === p.category_id) > categoryIndex);
      if (index < 0) index = remaining.length;
    }
  }
  const moved = product.category_id === categoryId ? product : {...product, category_id: categoryId};
  const products = [...remaining.slice(0,index),moved,...remaining.slice(index)];
  if (product.category_id === categoryId && products.every((p,i) => p.id === catalog.products[i].id)) return catalog;
  return {...catalog,products};
}
