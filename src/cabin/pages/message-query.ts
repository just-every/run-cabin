import { inIds } from './core'
/** Matches native messageKey without loading message bodies or merging contacts. */
export function messageSelection(keys:[string,string][],key:string,scope:string,scopeParams:unknown[]) {
 const ids=keys.filter(([,k])=>k===key).map(([id])=>id)
 const missing=`NOT EXISTS(SELECT 1 FROM cb_records b WHERE b.kind='bookings' AND b.id=json_extract(r.data,'$.bookingId'))`
 const contact=key.startsWith('e:')?`json_extract(r.data,'$.email')=?`:key.startsWith('p:')?`json_extract(r.data,'$.email') IS NULL AND json_extract(r.data,'$.phone')=?`:key.startsWith('r:')?`json_extract(r.data,'$.email') IS NULL AND json_extract(r.data,'$.phone') IS NULL AND COALESCE(json_extract(r.data,'$.ref'),'unknown')=?`:'0'
 const params:unknown[]=[JSON.stringify(ids)]
 if(contact!=='0')params.push(key.slice(2))
 // scope uses k for the aggregate's join, while direct reads can resolve the
 // same permitted booking set from the explicit selection.
 const directScope=scope.replace('k.booking IS NOT NULL',inIds("json_extract(r.data,'$.bookingId')"))
 const directParams=[...scopeParams]
 if(scope.includes('k.booking IS NOT NULL'))directParams.push(JSON.stringify(keys.map(([id])=>id)))
 const identity=contact==='0'?inIds("json_extract(r.data,'$.bookingId')"):`(${inIds("json_extract(r.data,'$.bookingId')")} OR (${missing} AND ${contact}))`
 return {where:`r.kind='messages' AND json_extract(r.data,'$.status')!='discarded' AND ${identity}${directScope}`,params:[...params,...directParams]}
}
