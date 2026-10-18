import type { Data } from '../model'
import type { GuestData, GuestProfile } from './types'
export type GuestSource = Pick<Data,'bookings'> & Partial<GuestData>
export function guestRoot(data:Pick<GuestSource,'guests'>,id:string):GuestProfile|undefined {
 const seen=new Set<string>();let profile=data.guests?.find(g=>g.id===id)
 if(profile?.erasedAt)return undefined
 while(profile?.mergedInto){if(profile.erasedAt||seen.has(profile.id))return undefined;seen.add(profile.id);profile=data.guests?.find(g=>g.id===profile!.mergedInto)}
 return profile?.erasedAt?undefined:profile
}
export function guestGroup(data:Pick<GuestSource,'guests'>,id:string) {
 const root=guestRoot(data,id);return root?(data.guests??[]).filter(g=>!g.erasedAt&&guestRoot(data,g.id)?.id===root.id):[]
}
export function guestBookings(data:GuestSource,id:string) {const ids=new Set(guestGroup(data,id).map(g=>g.bookingId));return data.bookings.filter(b=>ids.has(b.id))}
/** An explicit opt-out anywhere in the reviewed group wins; no consent is inferred from a booking. */
export function consent(data:Pick<GuestSource,'guests'>,id:string,propertyId:string,purpose:'preferences'|'offers') {
 const decisions=guestGroup(data,id).map(g=>[...g.consents].reverse().find(c=>c.propertyId===propertyId&&c.purpose===purpose)).filter(Boolean)
 return decisions.length>0&&decisions.every(c=>c!.allowed)
}
export function consentBaseline(data:Pick<GuestSource,'guests'>,id:string,propertyId:string) {
 return JSON.stringify(guestGroup(data,id).flatMap(g=>g.consents.filter(c=>c.propertyId===propertyId&&c.purpose==='offers').map(c=>[g.id,c.id,c.allowed])).sort((a,b)=>String(a[1]).localeCompare(String(b[1]))))
}
export function returningPreferences(data:GuestSource,id:string,propertyId:string) {
 if(!data.guestPolicies?.some(p=>p.propertyId===propertyId&&p.allowPreferences)||!consent(data,id,propertyId,'preferences'))return []
 return guestGroup(data,id).flatMap(g=>g.facts.filter(f=>f.kind==='preference'&&f.propertyIds.includes(propertyId)))
}
