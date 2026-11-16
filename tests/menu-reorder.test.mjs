import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moveMenuProduct} from '../src/lib/menu-reorder.js';
const product=(id,category_id)=>({id,category_id,names:{gr:id,en:id},descriptions:{},prices:[{id:id+'-price',cents:250,label:''}]});
const fixture=()=>({categories:['a','b','empty','last'].map(id=>({id,section:'menu',names:{gr:id}})),products:[product('one','a'),product('two','a'),{...product('heading','b'),type:'heading',prices:[]},product('three','b'),product('four','b'),product('five','last')]});
const ids=c=>c.products.map(p=>p.id);
test('moves down and up within a category',()=>{
 const c=fixture();
 assert.deepEqual(ids(moveMenuProduct(c,'one','a','two','after')),['two','one','heading','three','four','five']);
 assert.deepEqual(ids(moveMenuProduct(c,'two','a','one')),['two','one','heading','three','four','five']);
 assert.deepEqual(ids(c),['one','two','heading','three','four','five']);
});
test('moves to a precise position in another category while retaining identity and prices',()=>{
 const c=fixture(),next=moveMenuProduct(c,'one','b','four');
 assert.deepEqual(ids(next),['two','heading','three','one','four','five']);
 const moved=next.products.find(p=>p.id==='one');
 assert.equal(moved.category_id,'b');
 assert.deepEqual(moved.prices,c.products[0].prices);
 assert.deepEqual(moved.names,c.products[0].names);
 assert.equal(c.products[0].category_id,'a');
 assert.equal(new Set(ids(next)).size,next.products.length);
});
test('appends to a category including empty destinations',()=>{
 const c=fixture();
 assert.deepEqual(ids(moveMenuProduct(c,'one','b')),['two','heading','three','four','one','five']);
 const next=moveMenuProduct(c,'three','empty');
 assert.equal(next.products.find(p=>p.id==='three').category_id,'empty');
 assert.deepEqual(ids(next),['one','two','heading','four','three','five']);
});
test('allows a category to become empty and accepts a product back',()=>{
 const c=fixture(),empty=moveMenuProduct(c,'five','a');
 assert.equal(empty.products.filter(p=>p.category_id==='last').length,0);
 const restored=moveMenuProduct(empty,'five','last');
 assert.deepEqual(ids(restored),ids(c));
 assert.equal(restored.products.at(-1).category_id,'last');
});
test('rejects unknown targets and heading moves; no-op drops do not write',()=>{
 const c=fixture();
 for(const args of [['missing','a'],['one','missing'],['heading','a'],['one','b','heading'],['one','b','two'],['one','a','one'],['one','a','two'],['two','a']]){
  assert.equal(moveMenuProduct(c,...args),c);
 }
});
