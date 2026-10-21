import { rentalInterests,authorizedRentalInterests } from '../../permissions/interests'
import { manager, need, sha, type Actor, type Data } from '../../model'
import { assertLive, load } from '../../storage'
import { hasAction, memberActor, permitsProperty } from '../../permissions/authority'
import type { ReportFilters } from '../read'
import type { Recipient, ReportSchedule, ReportScope } from './types'
const email=(s:string)=>s.trim().toLowerCase()
export function reportManager(a:Actor){manager(a);need(!a.isAgent&&hasAction(a,'reports:read')&&hasAction(a,'finance:read'),'Report and finance access required',403)}
export function selectedProperties(data:Data,a:Actor,f:ReportFilters){
 reportManager(a);need(!f.property||data.properties.some(p=>p.id===f.property),'Home not found',404)
 if(f.property)need(permitsProperty(a,f.property),'Home is outside your report scope',403)
 const ids=data.properties.filter(p=>(!f.property||p.id===f.property)&&permitsProperty(a,p.id)).map(p=>p.id).sort()
 need(ids.length,'No permitted homes in this report',403);return ids
}
export const sameIds=(a:string[],b:string[])=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort())
export async function currentActor(db:D1Database,snapshot:Actor){
 await assertLive(db,snapshot)
 if(snapshot.role==='owner')return snapshot
 const current=await memberActor(db,snapshot.id);need(current,'Report operator access changed',403)
 need(current.email===snapshot.email&&current.role===snapshot.role&&current.operatorVersion===snapshot.operatorVersion&&JSON.stringify(current.scope??null)===JSON.stringify(snapshot.scope??null),'Report operator access changed; review the schedule again',403)
 reportManager(current);return current
}
/** Only current property-owner identities have an unambiguous active rental-owner grant.
 * Retained statements and frozen former agreement interests are not current report grants. */
export async function ownerProperties(data:Data,ownerEmail:string,ids:string[]){
 const permitted=rentalInterests(data,ownerEmail).filter(p=>ids.includes(p.propertyId)&&(p.primary||data.members.some(m=>m.active&&email(m.email)===email(ownerEmail)&&m.scope?.pmsRole==='rental_owner'&&m.scope.propertyIds.includes(p.propertyId)&&m.scope.actions.includes('owners:read')))).map(p=>p.propertyId).sort()
 need(permitted.length,'Owner report access changed or is not established',403);return permitted
}
export async function recipientFor(db:D1Database,actor:Actor,input:Record<string,unknown>,ids:string[],data:Data):Promise<Recipient>{
 const kind=input.recipientKind??(input.recipient as any)?.kind
 if(kind==='owner'){
  need(actor.role==='owner','The installation owner manages rental-owner report recipients',403)
  const address=String(input.recipientEmail??(input.recipient as any)?.email??'').trim().toLowerCase()
  need(address.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address),'Choose an existing owner email')
  await ownerProperties(data,address,ids);return {kind:'owner',email:address}
 }
 need(kind==='member','Choose an existing owner or team recipient')
 const id=String(input.recipientMemberId??(input.recipient as any)?.memberId??''),member=data.members.find(m=>m.id===id&&m.active)
 need(member&&member.role==='manager','Choose an active team member with report access')
 const op=await db.prepare("SELECT id FROM oa_operators WHERE email=? COLLATE NOCASE AND status='active' AND role='member'").bind(member.email).first<{id:string}>()
 need(op,'The recipient must have active sign-in access',403)
 const recipient=await memberActor(db,op.id);need(recipient,'Recipient access is unavailable',403);reportManager(recipient)
 need(ids.every(id=>permitsProperty(recipient,id)),'The recipient cannot read every selected home',403)
 return {kind:'member',memberId:id,email:member.email,actor:recipient}
}
export async function runtimeScope(db:D1Database,s:ReportSchedule):Promise<ReportScope>{
 const creator=await currentActor(db,s.creator),data=await load(db),ids=selectedProperties(data,creator,s.filters)
 need(sameIds(ids,s.propertyIds),'Selected home access changed; review the schedule again',403)
 let propertyIds=ids,ownerKey:string|null=null
 if(s.recipient.kind==='owner'){
  need(creator.role==='owner','Rental-owner delivery requires the installation owner',403)
  need(!await db.prepare('SELECT 1 FROM cb_member_offboarding WHERE email=? COLLATE NOCASE').bind(s.recipient.email).first(),'Owner report access revoked',403)
  propertyIds=await ownerProperties(data,s.recipient.email,ids);ownerKey=await sha(email(s.recipient.email))
  need(!s.filters.owner||s.filters.owner===ownerKey,'Saved owner filter does not belong to this recipient',403)
  // Any lost owner interest invalidates the approved run, even when another home remains.
  need(sameIds(propertyIds,(s as ReportSchedule & {recipientPropertyIds?:string[]}).recipientPropertyIds??propertyIds),'Owner report access changed; review the schedule again',403)
 }else{
  const recipient=await currentActor(db,s.recipient.actor)
  need(recipient.email.toLowerCase()===s.recipient.email.toLowerCase()&&ids.every(id=>permitsProperty(recipient,id)),'Recipient report access changed',403)
 }
 return {propertyIds,ownerKey,creator,recipient:s.recipient}
}
