import { sharesCapacity } from '../capacity'
import type { Bindings } from '../../auth.server'
import { type Context,type Actor,manager,need,text,newId,exact,property } from '../model'
import { mutate } from '../storage'
import { homeSettings } from '../homes'
import { instant } from '../clock'
import { overlaps } from '../inventory'
import { day } from '../direct/rules'
import { stays,saveStay,homes,saveHome } from '../direct/store'
import { addDocument,agreementOf,currentDocument,newAgreement,templateVersion,recordCheckout } from './records'
import type { RentalTemplate } from './types'

const checked=(v:unknown)=>v===true||v==='true'||v==='on'||v==='yes'
const US_STATES=new Set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC AS GU MP PR VI'.split(' '))
export function publishTemplate(c:Context,input:Record<string,unknown>,origin:string){
 const propertyId=property(c,input.propertyId).id,old=c.data.rentalTemplates.find(t=>t.propertyId===propertyId)
 if('templateRevision' in input)need((old?.revision??'')===input.templateRevision,'Agreement rules changed. Reload before saving.',409)
 const body=text(input.agreement,'rental agreement',20_000),title=text(input.agreementTitle??old?.versions.find(v=>v.id===old.currentVersion)?.title??'Vacation rental agreement','agreement title',160)
 const state=text(input.agreementState??old?.versions.find(v=>v.id===old.currentVersion)?.state??'US','US state or US',2).toUpperCase();need(state==='US'||US_STATES.has(state),'Choose US or a valid US state or territory code')
 const required=input.agreementRequired===undefined?old?.required??true:checked(input.agreementRequired),blockAccess=input.agreementBlockAccess===undefined?old?.blockAccess??true:checked(input.agreementBlockAccess)
 const row:RentalTemplate=old??{id:newId(),revision:newId(),propertyId,origin,required,blockAccess,currentVersion:'',versions:[]}
 const last=old?.versions.find(v=>v.id===old.currentVersion)
 if(!last||last.text!==body||last.title!==title||last.state!==state||old?.required!==required||old?.blockAccess!==blockAccess){const v={id:newId(),required,blockAccess,title,state,text:body,at:c.now,by:c.actor.id};row.versions.push(v);row.currentVersion=v.id}
 Object.assign(row,{origin,required,blockAccess,revision:newId()});if(!old)c.data.rentalTemplates.push(row);c.entityId=row.id;return row
}
export async function agreementCommand(env:Bindings,actor:Actor,name:string,input:Record<string,unknown>){
 manager(actor)
 return mutate(env.DB,actor,name,async c=>{
  if(name==='direct.agreement.template'){
   const row=publishTemplate(c,input,env.AUTH_ORIGIN),home=(await homes(env.DB)).find(h=>h.propertyId===row.propertyId)
   if(home){home.agreement=templateVersion(row).text;home.revision=newId();saveHome(c,home)}return row
  }
  const b=c.data.bookings.find(b=>b.id===text(input.bookingId,'reservation'));need(b&&b.status==='confirmed'&&(b.kind??'stay')==='stay','Active reservation not found',404);need(!b.guestErasedAt,'This guest identity was erased',409)
  need(!c.data.messages.some(m=>m.bookingId===b.id&&m.status==='sending'),'A guest message is being sent. Wait before amending this stay.',409)
  const t=c.data.rentalTemplates.find(t=>t.propertyId===b.propertyId);need(t,'Save a rental agreement template for this property first',409)
  let a=agreementOf(c.data,b.id)
  if(name==='direct.agreement.request'){
   need(!a,'This reservation already has an agreement; amend its current version instead',409)
   const legacy=(await stays(env.DB)).find(s=>s.bookingId===b.id)
   if(legacy){await recordCheckout(c,legacy);return agreementOf(c.data,b.id)!}
   a=newAgreement(c,b,t);a.required=true;await addDocument(c,a,b,t,'Agreement requested by manager');return a
  }
  need(name==='direct.agreement.amend','Unknown agreement command',404);need(a,'Request an agreement for this reservation first',409);exact(a,input.revision)
  const reason=text(input.reason,'amendment reason',1000),extra=text(input.terms,'complete amended reservation terms',20_000),start=day(input.start??b.start.slice(0,10)),end=day(input.end??b.end.slice(0,10))
  need(end>start,'Checkout must follow arrival');need(Date.parse(end)-Date.parse(start)<=365*86_400_000,'A stay may span at most 365 nights')
  const changed=start!==b.start.slice(0,10)||end!==b.end.slice(0,10)
  need(!changed||b.source==='request','Change a channel reservation’s dates on that channel first; Cabin requests renewed consent after sync',409)
  need(!c.data.bookings.some(other=>other.id!==b.id&&sharesCapacity(c.data,other.propertyId,b.propertyId)&&other.status==='confirmed'&&overlaps(other,{start,end})),'These amended nights overlap another reservation or block',409)
  const direct=(await stays(env.DB)).find(s=>s.bookingId===b.id)
  if(direct){need(direct.phase==='confirmed'&&!direct.checkedOutAt,'Amend a direct stay after confirmation and before checkout',409);need(input.keepPrice==='yes','Confirm that the paid price and damage authorization amount stay unchanged')}
  if(changed)Object.assign(b,{start,end,revision:newId()})
  // Adopt the current template only when the manager explicitly requests it.
  const previous=currentDocument(a),selected=input.useCurrentTemplate==='yes'?t:{...t,currentVersion:previous.templateVersion,versions:[{id:previous.templateVersion,required:a.required,blockAccess:a.blockAccess,title:previous.title,state:previous.state,text:previous.templateText,at:previous.at,by:previous.by}]}
  await addDocument(c,a,b,selected,reason,extra,direct)
  if(direct){const s=homeSettings(c,b.propertyId);Object.assign(direct,{start,end,timeZone:s.timeZone,arrivalAt:new Date(instant(start+'T'+(b.arrivalTime??s.checkInTime),s.timeZone)).toISOString(),departureAt:new Date(instant(end+'T'+(b.departureTime??s.checkOutTime),s.timeZone)).toISOString()});direct.depositDueAt=new Date(Date.parse(direct.arrivalAt!)-48*3_600_000).toISOString();saveStay(c,direct)}
  return a
 })
}
