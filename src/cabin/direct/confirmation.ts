import type { Bindings } from '../../auth.server'
import type { Context,GuestMessage } from '../model'
import { newId } from '../model'
import { unseal } from '../seal'
import type { DirectStay } from './types'
import { dateLabel,depositLabel } from './presentation'
const usd=(cents:number)=>`$${(cents/100).toFixed(2)}`
/** Queued in the same guarded commit as payment/confirmation, delivered by the Inbox transport. */
export async function queueConfirmation(env:Bindings,c:Context,s:DirectStay,kind:'payment'|'confirmation'){
 const field=kind==='payment'?'paymentMessageId':'confirmationMessageId';if(s[field])return
 const home=c.data.properties.find(p=>p.id===s.propertyId)?.name??'your home'
 const token=s.bookingLinkSealed?await unseal(env.SESSION_SECRET,'direct-booking-link',s.bookingLinkSealed):null
 const link=token?`${env.AUTH_ORIGIN}/book/stay/${token}`:null
 const text=[`${s.guestName}, ${kind==='confirmation'?'your stay is confirmed.':'we received your booking payment.'}`,`${home}: ${dateLabel(s.start)} to ${dateLabel(s.end)} (checkout).`,
  [`${s.quote.nights} nights × ${usd(s.quote.nightlyCents)}: ${usd(s.quote.baseRentCents??s.quote.rentCents)}`,s.quote.returningGuest?`Returning guest 10%: −${usd(s.quote.discountCents??0)}; rent after discount ${usd(s.quote.rentCents)}`:'',`Cleaning fee: ${usd(s.quote.cleaningCents)}`,s.quote.extraGuestCents?`Extra guests: ${usd(s.quote.extraGuestCents)}`:'',...s.quote.taxes.map(t=>`${t.label} (${t.bps/100}%): ${usd(t.amountCents)}`)].filter(Boolean).join('\n'),
  `Paid: ${usd(s.quote.totalCents)} USD${s.paymentMode==='live'?'':' in Stripe test mode (no real money)'}.`,
  s.requireIdentity&&s.identity?.status!=='verified'?'Your required ID check is still pending. Open your booking link to finish it.':'',
  `Damage authorization: ${depositLabel(s)}. A new hold may be needed if the authorization expires during your stay.`,
  link?`Keep your private booking link to see payment status, complete ID verification, authorize the damage deposit and download your signed agreement:\n${link}`:'Contact your host for your booking link.',
  'Your host will send arrival details separately.'].filter(Boolean).join('\n\n')
 const m:GuestMessage={id:newId(),revision:newId(),propertyId:s.propertyId,bookingId:s.bookingId,email:s.email,phone:null,ref:null,channel:'email',direction:'out',source:'scheduled',status:'pending',subject:`${home} · ${kind==='confirmation'?'stay confirmed':'booking payment received'}`,text,detail:null,replyTo:null,headerId:null,sentBy:null,approvalId:null,scheduledId:null,providerId:null,grounds:['stay dates','booking payment','signed agreement'],createdAt:c.now,sentAt:null}
 c.data.messages.push(m);s[field]=m.id
}
