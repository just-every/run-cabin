import type { Data,GuestMessage } from '../model'
import { accessBlocked } from './records'
/** Recognize access-bearing messages, including a draft written before consent was withdrawn. */
export function accessMessage(data:Data,m:GuestMessage){
 if(!m.bookingId||m.grounds.includes('rental agreement'))return false
 const schedule=m.scheduledId&&data.scheduled.find(s=>s.id===m.scheduledId)
 if(schedule&&schedule.rule==='checkin')return true
 if(m.grounds.some(g=>['door code','stay page','check-in time'].includes(g)))return true
 return data.codes.some(c=>c.bookingId===m.bookingId&&c.holder==='guest'&&(new RegExp(`(?:^|\\D)${c.code}(?:$|\\D)`).test(m.text)||!!c.link&&m.text.includes('/stay/'+c.link)))
}
export const messageAccessBlocked=(data:Data,m:GuestMessage)=>!!m.bookingId&&accessBlocked(data,m.bookingId)&&accessMessage(data,m)
