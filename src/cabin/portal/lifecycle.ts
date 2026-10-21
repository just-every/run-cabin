import { instant } from '../clock'
import { homeSettings } from '../homes'
import { newId, query, sha, type Context, type Data } from '../model'
import { event } from '../audit/write'
import { LINK_GRACE_MS, type GuestPortalLink } from './types'

export const portalToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2,'0')).join('')
export const savedEmail = (email:string|undefined) => (email??'').trim().toLowerCase()
export const recipientHint = (email:string) => { const [local,domain] = email.split('@'); return local&&domain ? `${local[0]}***@${domain[0]}***` : '' }
export const portalLinks = (data:Data):GuestPortalLink[] => data.guestPortalLinks
export function endPortalSessions(c:Context,link:GuestPortalLink,reason:string) {
 link.sessionEpoch=newId();link.revision=newId()
 c.queries.push(query('DELETE FROM cb_guest_challenges WHERE booking_id=?',link.bookingId),query('DELETE FROM cb_guest_sessions WHERE booking_id=?',link.bookingId))
 const booking=c.data.bookings.find(b=>b.id===link.bookingId)
 c.queries.push(event(c.actor,'guest.portal.session.end',c.now,{kind:'guestPortalLinks',id:link.id,propertyId:link.propertyId,bookingId:link.bookingId,result:reason,facts:{guestRecipient:recipientHint(savedEmail(booking?.guestEmail))}}))
}
/** Called after dispatch, before message rendering, inside the ordinary guarded commit. */
export async function syncPortal(c:Context) {
 const rows=portalLinks(c.data)
 for(const booking of c.data.bookings){
  if((booking.kind??'stay')!=='stay'||!c.data.properties.some(p=>p.id===booking.propertyId))continue
  let row=rows.find(r=>r.bookingId===booking.id)
  const active=booking.status==='confirmed'&&!booking.guestErasedAt&&!booking.restorePaused
  if(!row&&!active)continue
  const settings=homeSettings(c,booking.propertyId),expiresAt=new Date(instant(`${booking.end.slice(0,10)}T${booking.departureTime??settings.checkOutTime}`,settings.timeZone)+LINK_GRACE_MS).toISOString(),emailHash=await sha(savedEmail(booking.guestEmail))
  if(!row){
   const oldCode=c.data.codes.find(code=>code.bookingId===booking.id&&code.holder==='guest'&&code.status==='issued'&&code.link)
   row={id:newId(),revision:newId(),bookingId:booking.id,propertyId:booking.propertyId,token:oldCode?.link??portalToken(),expiresAt,emailHash,sessionEpoch:newId(),status:'active'};rows.push(row)
  }else{
   if(row.emailHash!==emailHash){endPortalSessions(c,row,'email_changed');row.emailHash=emailHash}
   if(!active&&row.status==='active'){endPortalSessions(c,row,booking.guestErasedAt?'erased':booking.restorePaused?'restored':'cancelled');row.status='revoked';row.token=null}
   if(active&&(row.status!=='active'||!row.token)){endPortalSessions(c,row,'fresh_link');row.token=portalToken();row.status='active'}
   if(row.propertyId!==booking.propertyId){endPortalSessions(c,row,'home_changed');row.propertyId=booking.propertyId}
   if(row.expiresAt!==expiresAt){row.expiresAt=expiresAt;row.revision=newId()}
  }
  for(const code of c.data.codes.filter(code=>code.bookingId===booking.id&&code.holder==='guest'&&code.status==='issued'))if(code.link!==row.token){code.link=row.token;code.revision=newId()}
 }
 for(const row of rows)if(!c.data.bookings.some(b=>b.id===row.bookingId)&&row.status==='active'){endPortalSessions(c,row,'erased');row.status='revoked';row.token=null}
}
