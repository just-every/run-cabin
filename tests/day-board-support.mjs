// Synthetic business records created only through Cabin's public command door.
export async function dayBoardRequests(h) {
 const date = n => new Date(Date.now() + n * 86400000).toISOString().slice(0,10)
 const selected=date(30), requests=[], conflicts=[]
 for(const [name,timeZone,channel] of [['Eastern Cottage','America/New_York','vrbo'],['Island Cottage','Pacific/Honolulu','booking.com']]) {
  const home=await h.cmd('property.save',{name,ownerName:'Morgan',ownerEmail:'morgan@stay.example',commissionBps:2000})
  await h.cmd('home.settings',{propertyId:home.id,timeZone,address:'24 Test Lane',checklist:['Ready'],photosRequired:1})
  const conflict=await h.cmd('reservation.request',{propertyId:home.id,channel:'airbnb',guestName:'Existing guest',start:date(29),end:date(34)})
  conflicts.push(conflict)
  requests.push(await h.cmd('reservation.request',{propertyId:home.id,channel,guestName:'Requested guest <untrusted>',start:selected,end:date(32)}))
 }
 const propertyId=requests[0].propertyId
 const request=extra=>h.cmd('reservation.request',{propertyId,channel:'vrbo',guestName:'Outside selected nights',start:date(31),end:date(32),...extra})
 await request({start:date(29),end:selected}) // Checkout is end-exclusive.
 await request({channel:'direct',guestName:'Direct request excluded',start:selected})
 await request({kind:'block',note:'Maintenance block excluded',start:selected})
 // The selected source must remain reachable after leaving the recent 12.
 for(let i=0;i<13;i++)await request({guestName:'Later request '+i})
 await request({start:date(40),end:date(42),guestName:'Accepted request excluded'})
 const original=(await h.state()).bookings.find(b=>b.id===conflicts[0].bookingId)
 await h.cmd('reservation.cancel',{id:original.id,revision:original.revision})
 return {selected,requests,conflicts,date}
}
