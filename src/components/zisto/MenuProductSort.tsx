import {useDroppable} from '@dnd-kit/core';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import type {CSSProperties,ReactNode} from 'react';

export function MenuDropCategory({id,disabled,active,children}:{id:string;disabled:boolean;active:boolean;children:ReactNode}){
 const {setNodeRef,isOver}=useDroppable({id:'category:'+id,disabled,data:{kind:'category',categoryId:id}});
 return <section ref={setNodeRef} className={'mm-category'+(active||isOver?' mm-drop-category':'')}>{children}</section>;
}
export function MenuSortableProduct({id,categoryId,title,disabled,over,children}:{id:string;categoryId:string;title:string;disabled:boolean;over:boolean;children:ReactNode}){
 const {attributes,listeners,setNodeRef,setActivatorNodeRef,transform,transition,isDragging}=useSortable({id:'product:'+id,disabled,data:{kind:'product',productId:id,categoryId}});
 const style:CSSProperties={transform:CSS.Transform.toString(transform),transition,opacity:isDragging ? 0.3 : 1,position:'relative'};
 return <article ref={setNodeRef} style={style} className={'mm-product mm-sortable-product'+(over?' mm-drop-product':'')}>
  <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} disabled={disabled} className="mm-drag-handle" aria-label={'Μετακίνηση '+title} title={disabled?'Η μετακίνηση είναι διαθέσιμη χωρίς αναζήτηση':'Σύρε για αλλαγή σειράς ή κατηγορίας'}>
   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
  </button>{children}
 </article>;
}
