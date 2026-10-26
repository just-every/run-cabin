import assert from 'node:assert/strict'
export async function rooms(h,whole){
 const a=await h.cmd('property.save',{name:'Room A',ownerName:'Morgan Owner',ownerEmail:'morgan@stay.example',commissionBps:2000})
 const b=await h.cmd('property.save',{name:'Room B',ownerName:'Morgan Owner',ownerEmail:'morgan@stay.example',commissionBps:2000})
 const profile=await h.cmd('property.profile',{propertyId:whole.id,inventoryUnits:[a.id,b.id],occupancyLimit:4,address:'20 Harbor Road, Ithaca, NY'})
 return {a,b,profile}
}
export const roomCalendar=(start,end,cancelled=false)=>'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'+(cancelled?'':`BEGIN:VEVENT\r\nUID:synthetic-cabin-room-sale\r\nDTSTART;VALUE=DATE:${start.replaceAll('-','')}\r\nDTEND;VALUE=DATE:${end.replaceAll('-','')}\r\nSUMMARY:Reserved\r\nEND:VEVENT\r\n`)+'END:VCALENDAR\r\n'
export async function sourceRoom(h,a,start,end,cancelled=false){
 const d=await h.cmd('calendar.prepare',{propertyId:a.id,channel:'airbnb',calendar:roomCalendar(start,end,cancelled)})
 await h.cmd('calendar.approve',{id:d.id,revision:d.revision});return d
}
export async function unavailable(h,whole,start,end){
 const refused=await h.send('/book/'+whole.slug+'/quote',{start,end,guests:2});assert.equal(refused.status,409,refused.text)
 const checkout=await h.send('/book/'+whole.slug+'/checkout',{start,end,guests:2,homeRevision:whole.revision,guestName:'Alex Rivera',email:'alex@stay.example',signature:'Alex Rivera',consent:'yes'});assert.equal(checkout.status,409,checkout.text)
 assert.equal(h.creates,0,'unavailable checkout makes no payment attempt')
}
