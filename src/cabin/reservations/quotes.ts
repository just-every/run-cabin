import type { Bindings } from '../../auth.server'
import { type Context, type Data, type Actor, need, text, newId, sha, manager } from '../model'
import { mutate, load, SYSTEM } from '../storage'
import { homes, stay } from '../direct/store'
import type { DirectHome, Quote } from '../direct/types'
import { quote } from '../direct/rules'
import { homeSettings } from '../homes'
import { localDay } from '../clock'
import { managementFor } from '../properties/terms'
import { seal, unseal } from '../seal'
import { assertContactsAllowed } from '../privacy/contacts'
export interface StaffQuoteVersion { revision:string; price:Quote; home:DirectHome; baseline:string; expiresAt:string; hold:boolean; at:string; actorId:string }
export interface StaffQuote { id:string; revision:string; propertyId:string; guestName:string; email:string; createdBy:string; tokenHash:string; tokenSealed:string; status:'issued'|'accepted'|'expired'; versions:StaffQuoteVersion[]; holdBookingId?:string; bookingId?:string; stayId?:string; acceptedAt?:string; acceptedRevision?:string; messageId?:string }
export const currentQuote=(row:StaffQuote)=>row.versions[row.versions.length-1]
function release(c:Context,row:StaffQuote){const b=c.data.bookings.find(b=>b.id===row.holdBookingId);if(b&&b.status==='confirmed'){b.status='cancelled';b.cancelled=true;b.revision=newId()}}
export function expireQuotes(c:Context){for(const row of c.data.staffQuotes)if(row.status==='issued'&&Date.parse(currentQuote(row).expiresAt)<=Date.parse(c.now)){release(c,row);row.status='expired';row.revision=newId();const m=c.data.messages.find(m=>m.id===row.messageId);if(m?.status==='pending')m.status='discarded'}}
export async function sweepQuotes(env:Bindings){const data=await load(env.DB);if(data.staffQuotes.some(r=>r.status==='issued'&&Date.parse(currentQuote(r).expiresAt)<=Date.now()))await mutate(env.DB,SYSTEM,'quote.expired',c=>expireQuotes(c))}
async function baseline(data:Data,home:DirectHome,start:string){return sha(JSON.stringify({home,template:data.rentalTemplates.find(t=>t.propertyId===home.propertyId),settings:homeSettings(data,home.propertyId),occupancy:data.propertyProfiles.find(p=>p.propertyId===home.propertyId)?.occupancyLimit,capacity:data.propertyProfiles.map(p=>[p.propertyId,p.inventoryUnits]),management:managementFor(data,home.propertyId,start)}))}
export async function quoteByToken(data:Data,token:unknown){need(typeof token==='string'&&/^[a-f0-9-]{72}$/.test(token),'Quote not found',404);const hash=await sha(token),row=data.staffQuotes.find(r=>r.tokenHash===hash);need(row,'Quote not found',404);return row}
export async function validateQuote(c:Pick<Context,'data'|'db'|'now'>,row:StaffQuote,revision?:unknown){
 need(row.status==='issued'&&Date.parse(currentQuote(row).expiresAt)>Date.parse(c.now),'This quote expired or was already accepted. Ask the host for a new quote.',409)
 need(!revision||row.revision===revision,'This quote changed. Review the latest terms before signing.',409)
 const v=currentQuote(row),home=(await homes(c.db)).find(h=>h.enabled&&h.propertyId===row.propertyId);need(home,'This home is no longer available',409)
 need(v.baseline===await baseline(c.data,home,v.price.start),'The home’s terms changed. Ask the host for a revised quote before payment.',409)
 const price=quote(home,c.data.bookings.filter(b=>b.id!==row.holdBookingId),{...v.price},localDay(Date.parse(c.now),homeSettings(c.data,home.propertyId).timeZone),undefined,c.data);price.managementVersion=managementFor(c.data,home.propertyId,price.start).id
 need(JSON.stringify(price)===JSON.stringify(v.price),'The price changed. Ask the host for a revised quote before payment.',409)
 await assertContactsAllowed(c.db,[row.email]);return {home,price}
}
export function acceptQuote(c:Context,row:StaffQuote,revision:unknown,bookingId:string,stayId:string){need(row.revision===revision,'This quote changed. Review the latest terms.',409);release(c,row);row.status='accepted';row.acceptedAt=c.now;row.acceptedRevision=row.revision;row.bookingId=bookingId;row.stayId=stayId}
export async function acceptedQuote(env:Bindings,token:unknown){const row=await quoteByToken(await load(env.DB),token);if(row.status!=='accepted')return null;const s=await stay(env.DB,row.stayId!);need(!s.restored&&s.bookingLinkSealed&&s.email,'This booking link is unavailable',410);const saved=await unseal(env.SESSION_SECRET,'direct-booking-link',s.bookingLinkSealed);need(saved,'This booking link is unavailable',410);return {id:s.id,token:saved,url:env.AUTH_ORIGIN+'/book/stay/'+saved,bookingUrl:env.AUTH_ORIGIN+'/book/stay/'+saved}}
export async function staffQuoteCommand(env:Bindings,actor:Actor,name:string,p:Record<string,unknown>){
 manager(actor);need(!actor.isAgent,'Human staff required',403)
 return mutate(env.DB,actor,name,async c=>{
  expireQuotes(c)
  need(name==='quote.issue'||name==='quote.revise'||name==='quote.expire','Unknown quote command',404)
  let row=name==='quote.issue'?undefined:c.data.staffQuotes.find(r=>r.id===p.id)
  if(name!=='quote.issue'){need(row&&row.status==='issued'&&row.revision===p.revision,'Quote changed or is no longer open',409);need(!c.data.messages.some(m=>m.id===row!.messageId&&m.status==='sending'),'Quote email is being sent. Wait for its result.',409)}
  if(name==='quote.expire'){release(c,row!);row!.status='expired';row!.revision=newId();const m=c.data.messages.find(m=>m.id===row!.messageId);if(m?.status==='pending')m.status='discarded';return row}
  const home=(await homes(c.db)).find(h=>h.enabled&&h.propertyId===(row?.propertyId??p.propertyId));need(home,'Publish this home’s direct booking page first',409)
  const guestName=row?.guestName??text(p.guestName,'guest name',120),email=row?.email??text(p.email,'guest email',254).toLowerCase();need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Enter a valid guest email');await assertContactsAllowed(c.db,[email])
  const expiry=String(p.expiresAt??''),ms=Date.parse(expiry);need(/(?:Z|[+-]\d{2}:\d{2})$/.test(expiry)&&Number.isFinite(ms)&&ms>Date.parse(c.now),'Enter a future quote expiry with a time zone');const expiresAt=new Date(ms).toISOString()
  const price=quote(home,c.data.bookings.filter(b=>b.id!==row?.holdBookingId),p,localDay(Date.parse(c.now),homeSettings(c.data,home.propertyId).timeZone),undefined,c.data);price.managementVersion=managementFor(c.data,home.propertyId,price.start).id
  const profile=c.data.propertyProfiles.find(v=>v.propertyId===home.propertyId);need(!profile||price.guests<=profile.occupancyLimit,'Guest count exceeds the property occupancy limit')
  const token=row?await unseal(env.SESSION_SECRET,'staff-quote',row.tokenSealed):newId()+newId();need(token,'Quote link unavailable',410)
  if(row){release(c,row);const m=c.data.messages.find(m=>m.id===row!.messageId);if(m?.status==='pending')m.status='discarded'}
  else{row={id:newId(),revision:newId(),propertyId:home.propertyId,guestName,email,createdBy:actor.id,tokenHash:await sha(token),tokenSealed:await seal(env.SESSION_SECRET,'staff-quote',token),status:'issued',versions:[]};c.data.staffQuotes.push(row)}
  row.revision=newId();const hold=p.hold==='yes'||p.hold===true;row.versions.push({revision:row.revision,price,home:structuredClone(home),baseline:await baseline(c.data,home,price.start),expiresAt,hold,at:c.now,actorId:actor.id})
  if(hold){const id=newId();row.holdBookingId=id;c.data.bookings.push({id,revision:newId(),uid:'quote-'+id,quoteId:row.id,propertyId:home.propertyId,channel:'direct',kind:'block',start:price.start,end:price.end,summary:'Quote inventory hold',status:'confirmed',cancelled:false,approvedAt:c.now,source:'request'})}else delete row.holdBookingId
  const id=newId();row.messageId=id
  c.data.messages.push({id,revision:newId(),propertyId:home.propertyId,bookingId:null,email,phone:null,ref:null,channel:'email',direction:'out',source:'host',status:'pending',subject:'Your vacation rental quote',text:`${guestName}, review your itemized USD quote and cancellation terms: ${env.AUTH_ORIGIN}/book/quote/${token}\nTotal: USD ${(price.totalCents/100).toFixed(2)}. Expires ${expiresAt}. ${hold?'Nights are held until expiry.':'Nights are not held until checkout.'}`,detail:null,replyTo:null,headerId:null,sentBy:actor.id,approvalId:null,scheduledId:null,providerId:null,grounds:[],createdAt:c.now,sentAt:null})
  c.entityId=row.id;return row
 })
}
