import { paymentBalance } from '../reservations/finance'
import type { Booking, Data } from '../model'
/** Channel transaction exports record reservation receipts, never merely the net host payout. */
export async function portalBalance(env:{DB:D1Database},data:Data,booking:Booking){
 const balance=await paymentBalance({db:env.DB,data},booking)
 const channelPaidCents=booking.channel==='direct'||booking.channel==='ical'?0:data.payouts.filter(p=>p.bookingId===booking.id&&p.propertyId===booking.propertyId&&p.match==='matched'&&p.source===booking.channel).reduce((n,p)=>n+p.grossCents,0)
 const paidCents=balance.paidCents+channelPaidCents
 return {...balance,paidCents,channelPaidCents,balanceCents:balance.totalCents===null?null:balance.totalCents-paidCents}
}
