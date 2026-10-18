import { type Booking,type Context,newId,sha,need } from '../model'
import { homeSettings } from '../homes'
import type { DirectStay } from '../direct/types'
import type { RentalAgreement,RentalDocument,RentalTemplate } from './types'
import { accessMessage } from './access'

export const agreementOf=(data:{rentalAgreements?:RentalAgreement[]},bookingId:string)=>data.rentalAgreements?.find(a=>a.bookingId===bookingId)
export const currentDocument=(a:RentalAgreement)=>a.documents.find(d=>d.id===a.currentVersion)!
export const accessBlocked=(data:{rentalAgreements?:RentalAgreement[]},bookingId:string)=>{
 const a=agreementOf(data,bookingId);return !!a?.required&&a.blockAccess&&!currentDocument(a)?.signature
}
export function templateVersion(t:RentalTemplate){const v=t.versions.find(v=>v.id===t.currentVersion);need(v,'Agreement template version is missing',409);return v}
export function newAgreement(c:Context,b:Booking,t:RentalTemplate):RentalAgreement {
 const a:RentalAgreement={id:newId(),revision:newId(),propertyId:b.propertyId,bookingId:b.id,required:t.required,blockAccess:t.blockAccess,token:newId()+newId(),origin:t.origin,currentVersion:'',documents:[]}
 c.data.rentalAgreements.push(a);return a
}
export async function addDocument(c:Context,a:RentalAgreement,b:Booking,t:RentalTemplate,reason:string,extraTerms='',direct?:DirectStay){
 need(!c.data.messages.some(m=>m.bookingId===b.id&&m.status==='sending'&&accessMessage(c.data,m)),'Guest access instructions are being sent. Wait before changing agreement terms.',409)
 const v=templateVersion(t),s=homeSettings(c,b.propertyId),home=c.data.properties.find(p=>p.id===b.propertyId)
 const arrivalTime=b.arrivalTime??s.checkInTime,departureTime=s.checkOutTime
 const text=[v.title,`US rental agreement · ${v.state}`,v.text,`Reservation: ${b.id}`,`Home: ${home?.name??b.propertyId}`,s.address?`Address: ${s.address}`:'',`Guest: ${b.guestName??b.summary}`,b.guestEmail?`Guest email: ${b.guestEmail}`:'',`Stay: ${b.start.slice(0,10)} to ${b.end.slice(0,10)} (checkout).`,`Check-in: ${arrivalTime}; checkout: ${departureTime}; time zone: ${s.timeZone}.`,direct?`Guests: ${direct.quote.guests}. Rent, fees and taxes: USD ${(direct.quote.totalCents/100).toFixed(2)}. Separate damage authorization: USD ${(direct.quote.depositCents/100).toFixed(2)}. The paid booking price is unchanged by this amendment.`:'',extraTerms?`Reservation amendment: ${extraTerms}`:''].filter(Boolean).join('\n\n')
 const d:RentalDocument={id:newId(),templateVersion:v.id,templateText:v.text,reservationTerms:extraTerms,title:v.title,state:v.state,text,sha256:await sha(text),at:c.now,by:c.actor.id,reason,start:b.start,end:b.end,guestName:b.guestName??b.summary,arrivalTime,departureTime,timeZone:s.timeZone}
 a.documents.push(d);a.currentVersion=d.id;a.revision=newId();c.entityId=a.id
 for(const m of c.data.messages.filter(m=>m.bookingId===b.id&&m.direction==='out'&&['pending','draft'].includes(m.status)&&accessMessage(c.data,m))){m.status=m.source==='scheduled'?'discarded':'draft';m.detail='Rental terms changed. Review and replace guest access instructions before sending.';m.revision=newId();if(m.control){m.control.automatic=false;m.control.needsHost=true}}
 queueSigning(c,a,b,d);return d
}
function queueSigning(c:Context,a:RentalAgreement,b:Booking,d:RentalDocument){
 if(!b.guestEmail)return
 c.data.messages.push({id:newId(),revision:newId(),propertyId:b.propertyId,bookingId:b.id,email:b.guestEmail,phone:null,ref:null,channel:'email',direction:'out',source:'scheduled',status:'pending',subject:`Rental agreement · ${d.reason}`,text:`${b.guestName??'Guest'}, please review and electronically sign the rental agreement for your stay.\n\n${d.reason}\n\n${a.origin}/book/stay/agreement/${a.token}\n\n${a.blockAccess?'Guest door access waits for your current signature.':'Your host has requested your agreement.'} Previous signed versions remain available at the same private link.`,detail:null,replyTo:null,headerId:null,sentBy:null,approvalId:null,scheduledId:null,providerId:null,grounds:['rental agreement'],createdAt:c.now,sentAt:null})
}
/** Keep the exact signed checkout text; later versions never overwrite it. */
export async function recordCheckout(c:Context,s:DirectStay){
 const b=c.data.bookings.find(b=>b.id===s.bookingId)!,t=c.data.rentalTemplates.find(t=>t.propertyId===b.propertyId)
 if(!t)return
 const a=newAgreement(c,{...b,guestName:s.guestName,guestEmail:s.email},t),v=t.versions.find(v=>v.id===s.signature.version),settings=homeSettings(c,b.propertyId)
 a.required=true // Direct checkout itself requires signing, independently of the rule for channel stays.
 const marker=s.signature.text.lastIndexOf('\n\nStay: ');need(v||marker>=0,'The original signed agreement needs manager review before migration',409)
 const d:RentalDocument={id:newId(),templateVersion:s.signature.version,templateText:v?.text??s.signature.text.slice(0,marker),reservationTerms:'',title:v?.title??'Original rental agreement',state:v?.state??'US',text:s.signature.text,sha256:s.signature.sha256,at:c.now,by:c.actor.id,reason:'Initial booking agreement',start:s.start,end:s.end,guestName:s.guestName,arrivalTime:settings.checkInTime,departureTime:settings.checkOutTime,timeZone:settings.timeZone,signature:{name:s.signature.name,email:s.email,at:s.signature.at,consent:s.signature.consent,method:'Guest booking checkout'}}
 a.documents.push(d);a.currentVersion=d.id
}
/** Runs before dispatch in every commit, so a changed stay cannot release access under old consent. */
export async function synchronizeAgreements(c:Context){
 for(const b of c.data.bookings){
  if((b.kind??'stay')!=='stay'||b.guestErasedAt||b.status!=='confirmed')continue
  const t=c.data.rentalTemplates.find(t=>t.propertyId===b.propertyId)
  let a=agreementOf(c.data,b.id)
  if(!a){if(!t?.required||c.before.bookings.some(old=>old.id===b.id))continue;a=newAgreement(c,b,t);await addDocument(c,a,b,t,'Required for this reservation');continue}
  const reinstated=!a.token
  if(reinstated){a.token=newId()+newId();a.revision=newId()}
  const d=currentDocument(a),s=homeSettings(c,b.propertyId)
  if(!reinstated&&d.start===b.start&&d.end===b.end&&d.guestName===(b.guestName??b.summary)&&d.arrivalTime===(b.arrivalTime??s.checkInTime)&&d.departureTime===s.checkOutTime&&d.timeZone===s.timeZone)continue
  need(!c.data.messages.some(m=>m.bookingId===b.id&&m.status==='sending'),'A guest message is being sent. Wait before amending this stay.',409)
  // A template edit does not alter an existing reservation. Automatic date changes retain its template text.
  const retained:RentalTemplate={id:'retained',revision:'',propertyId:b.propertyId,origin:a.origin,required:a.required,blockAccess:a.blockAccess,currentVersion:d.templateVersion,versions:[{id:d.templateVersion,required:a.required,blockAccess:a.blockAccess,title:d.title,state:d.state,text:d.templateText,at:d.at,by:d.by}]}
  await addDocument(c,a,b,retained,reinstated?'Reservation reinstated after cancellation':'Reservation dates, guest or check-in terms changed',d.reservationTerms)
 }
 for(const a of c.data.rentalAgreements){const b=c.data.bookings.find(b=>b.id===a.bookingId);if(a.token!==null&&(!b||b.guestErasedAt||b.status!=='confirmed')){a.token=null;a.revision=newId()}}
}
