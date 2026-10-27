import type { Data,GuestMessage } from '../model'
import { accessBlocked } from './records'
import { portalBalance } from '../portal/balance'
/** Recognize access-bearing messages, including a draft written before consent was withdrawn. */
export function accessMessage(data:Data,m:GuestMessage){
 if(!m.bookingId||m.grounds.includes('rental agreement'))return false
 const schedule=m.scheduledId&&data.scheduled.find(s=>s.id===m.scheduledId)
 if(schedule&&schedule.rule==='checkin')return true
 if(m.grounds.some(g=>['door code','stay page','check-in time'].includes(g)))return true
 return data.codes.some(c=>c.bookingId===m.bookingId&&c.holder==='guest'&&(new RegExp(`(?:^|\\D)${c.code}(?:$|\\D)`).test(m.text)||!!c.link&&m.text.includes('/stay/'+c.link)))
}
export async function messageAccessBlocked(env:{DB:D1Database},data:Data,m:GuestMessage){
 if(!m.bookingId||!accessMessage(data,m))return false
 if(accessBlocked(data,m.bookingId))return true
 const booking=data.bookings.find(b=>b.id===m.bookingId),code=data.codes.find(c=>c.bookingId===m.bookingId&&c.holder==='guest'&&c.status==='issued')
 if(!booking||booking.status!=='confirmed'||!code||!['manual','set'].includes(code.lock.state))return true
 const balance=await portalBalance(env,data,booking)
 return balance.balanceCents!==null&&balance.balanceCents>0
}
