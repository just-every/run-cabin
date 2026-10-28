import type { Quote } from '../direct/types'
import { h,money } from '../ui/shared'
import { priceDetails } from './ui'
export function pricingBreakdown(q:Quote){
 const p=q.pricing!
 return `<dl class="price"><div><dt>${q.nights} nights at saved rates</dt><dd>${money(q.rentCents)}</dd></div>${p.discountKind?`<div><dt>${p.discountKind==='monthly'?'Monthly':'Weekly'} saving (${p.discountBps/100}%)</dt><dd>${money(p.lengthDiscountCents)} included</dd></div>`:''}${q.returningGuest?`<div><dt>Returning guest saving</dt><dd>${money(q.discountCents??0)} included</dd></div>`:q.coupon?`<div><dt>Coupon ${h(q.coupon.code)}</dt><dd>${money(q.coupon.discountCents)} included</dd></div>`:''}<div><dt>Cleaning fee</dt><dd>${money(q.cleaningCents)}</dd></div>${q.extraGuestCents?`<div><dt>Extra guests</dt><dd>${money(q.extraGuestCents)}</dd></div>`:''}${q.taxes.map(t=>`<div><dt>${h(t.label)} (${t.bps/100}%)</dt><dd>${money(t.amountCents)}</dd></div>`).join('')}<div class="total"><dt>Total · USD</dt><dd>${money(q.totalCents)}</dd></div><div><dt>Separate refundable damage authorization</dt><dd>${money(q.depositCents)}</dd></div></dl>${p.nights.some(n=>n.floorApplied)?'<p role="status">Floor conflict: the saved nightly floor was enforced.</p>':''}${priceDetails(p)}`
}
