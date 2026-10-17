import type { DirectStay } from './types'
import { instant } from '../clock'
export const dateLabel=(date:string)=>new Date(date.slice(0,10)+'T00:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})
export const timeLabel=(value:string,zone='America/New_York')=>new Date(value).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:zone,timeZoneName:'short'})
export const identityLabel=(status?:string)=>({verified:'Verified',requires_input:'More information needed',processing:'Being checked',canceled:'Canceled'}[status??'']??'Required')
/** When the guest checks in: the instant recorded with the stay, or its arrival day at the home's check-in time. */
export const arrival=(s:DirectStay,home:{checkInTime:string;timeZone:string})=>s.arrivalAt?Date.parse(s.arrivalAt):instant(`${s.start}T${home.checkInTime}`,home.timeZone)
export function activeDeposit(s:DirectStay){return s.deposit?.status==='requires_capture'&&(!s.deposit.expiresAt||Date.parse(s.deposit.expiresAt)>Date.now())}
export function depositLabel(s:DirectStay){
 if(!s.quote.depositCents)return 'Not required'
 if(!s.paymentId)return 'Scheduled after payment'
 if(!s.deposit){
  if(s.depositDueAt&&Date.parse(s.depositDueAt)>Date.now())return `Scheduled for ${timeLabel(s.depositDueAt,s.timeZone)}; no funds held yet`
  // A hold Cabin could not place (the stay records why), or one the guest has started on Stripe, needs the guest; otherwise Cabin is placing it on the saved card.
  return s.depositCheckout?.status==='open'||s.error?'Not held yet — authorization needed':'Being placed on your saved card; no funds held yet'
 }
 if(s.deposit.status==='requires_capture')return s.deposit.expiresAt&&Date.parse(s.deposit.expiresAt)<=Date.now()?'Expired — no funds held':s.deposit.expiresAt?'Held on card':'Hold reported; expiry not supplied by Stripe — host review needed'
 return ({succeeded:'Damage amount charged',canceled:'Authorization closed — no funds held',capturing:'Damage charge pending',releasing:'Release pending',processing:'Processing',requires_action:'Guest authentication needed',requires_payment_method:'Another card needed'}[s.deposit.status]??'Host review needed')
}
/** Convert human amounts without rounding fractional cents or changing API units. */
export function decimalUnits(value:unknown,label:string){
 const raw=String(value??'').trim();if(!/^\d+(?:\.\d{1,2})?$/.test(raw))throw Object.assign(new Error(`Enter ${label} with up to two decimal places`),{status:400})
 const [whole,part='']=raw.split('.'),n=Number(whole)*100+Number(part.padEnd(2,'0'))
 if(!Number.isSafeInteger(n))throw Object.assign(new Error(`${label} is too large`),{status:400});return n
}
