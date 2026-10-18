import { newId,type Context,type GuestMessage } from '../model'
import type { DirectStay } from './types'
import type { Refund } from './refund-types'
const usd=(n:number)=>`USD ${(n/100).toFixed(2)}`
function queue(c:Context,s:DirectStay,subject:string,text:string){
 const m:GuestMessage={id:newId(),revision:newId(),propertyId:s.propertyId,bookingId:s.bookingId,email:s.email,phone:null,ref:null,channel:'email',direction:'out',source:'host',status:'pending',subject,text:`${s.guestName},\n\n${text}\n\nReservation ${s.id}. ${s.paymentMode==='live'?'':'Stripe test mode; no real money moves.'}`,detail:null,replyTo:null,headerId:null,sentBy:c.actor.id,approvalId:null,scheduledId:null,providerId:null,grounds:['provider-confirmed settlement'],createdAt:c.now,sentAt:null}
 c.data.messages.push(m);return m.id
}
export function refundReceipt(c:Context,s:DirectStay,r:Refund){
 if(r.messageId)return
 r.messageId=queue(c,s,'Your refund receipt',`Stripe confirmed refund ${r.providerId}.\n${r.reason}\n${r.terms}\nRent returned: ${usd(r.amounts.rentCents)}\nFees returned: ${usd(r.amounts.feesCents)}\n${r.amounts.taxes.map(t=>`${t.label} returned: ${usd(t.amountCents)}`).join('\n')}\nCaptured damage payment returned: ${usd(r.amounts.depositCents)}\nTotal returned to your original payment method: ${usd(r.amounts.totalCents)}. Your bank determines when it appears.`)
}
export function depositReceipt(c:Context,s:DirectStay){
 const d=s.deposit;if(!d||!['succeeded','canceled'].includes(d.status))return
 const key=d.id+':'+d.status;if(s.depositReceipts?.some(r=>r.key===key))return
 const captured=d.capturedCents??0
 const messageId=queue(c,s,'Your damage deposit settlement',`Damage authorization ${d.id}: ${usd(d.amountCents)}.\n${captured?`Approved damage charge: ${usd(captured)}. ${d.reason??''}\nEvidence: ${d.evidence??''}\n`:'No damage charge.\n'}Uncaptured authorization released or expired: ${usd(d.amountCents-captured)}. This is a release of a card hold, not a rent refund. Your bank determines when the hold disappears.`)
 ;(s.depositReceipts??=[]).push({key,messageId})
}
