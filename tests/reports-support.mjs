import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
export const reportMonth='from=2026-10-01&until=2026-11-01'
export async function reportBooks(h,{many=false}={}){
 const p=await h.cmd('property.save',{name:'Pine Ridge Cabin',ownerName:'Morgan Owner',ownerEmail:'morgan@stay.example',commissionBps:2000}),other=await h.cmd('property.save',{name:'Lake Loft',ownerName:'Casey Owner',ownerEmail:'casey@stay.example',commissionBps:1000})
 for(const [home,timeZone] of [[p,'America/New_York'],[other,'America/Los_Angeles']]){await h.cmd('home.settings',{propertyId:home.id,address:'200 Synthetic Road',timeZone,checklist:['Ready']});await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Synthetic Cabin Trust'})}
 const create=(home,channel,start,end,rentCents,sourceId)=>h.cmd('reservation.create',{propertyId:home.id,method:channel==='direct'?'phone':'channel',channel,start,end,rentCents,sourceId,guestName:'Synthetic Cabin Guest',policyName:'50% cancellation charge',retainedBps:5000,noShowBps:10000})
 const air=await create(p,'airbnb','2026-10-01','2026-10-05',100000,'synthetic-cabin-1'),vrbo=await create(p,'vrbo','2026-10-07','2026-10-10',60000,'synthetic-cabin-2'),unpaid=await create(p,'direct','2026-10-15','2026-10-18',30000,'synthetic-cabin-3'),cancel=await create(p,'direct','2026-10-20','2026-10-22',20000,'synthetic-cabin-4'),second=await create(other,'direct','2026-10-04','2026-10-06',40000,'synthetic-cabin-5'),boundary=await create(other,'direct','2026-10-31','2026-11-03',10000,'synthetic-cabin-6')
 await h.cmd('reservation.end',{id:cancel.id,revision:cancel.revision,outcome:'cancelled',reason:'Synthetic guest cancelled by phone'})
 await h.cmd('reservation.request',{propertyId:p.id,start:'2026-10-10',end:'2026-10-12',kind:'block',purpose:'owner',note:'Owner use'})
 await h.cmd('reservation.request',{propertyId:p.id,start:'2026-10-24',end:'2026-10-25',kind:'block',purpose:'maintenance',note:'Repair window'})
 const csv='Date,Type,Confirmation code,Start date,Nights,Currency,Gross earnings,Host service fee,Amount,Payout ID\n10/06/2026,Reservation,synthetic-cabin-1,10/01/2026,4,USD,1000.00,30.00,970.00,synthetic-cabin-7\n10/08/2026,Refund,synthetic-cabin-1,10/01/2026,4,USD,-100.00,-3.00,-97.00,synthetic-cabin-8\n10/09/2026,Reservation,synthetic-cabin-unknown,10/28/2026,1,USD,10.00,0.00,10.00,synthetic-cabin-9\n'
 await h.cmd('payout.import',{propertyId:p.id,source:'airbnb',csv})
 if(many){const lines=Array.from({length:125},(_,i)=>`10/06/2026,Reservation,synthetic-cabin-1,10/01/2026,4,USD,1.00,0.00,1.00,synthetic-cabin-${i+100}`);await h.cmd('payout.import',{propertyId:p.id,source:'airbnb',csv:csv.split('\n')[0]+'\n'+lines.join('\n')+'\n'})}
 const post=(booking,operation,amountCents,date,source)=>h.cmd('ledger.post',{propertyId:booking.propertyId,bookingId:booking.id,operation,amountCents,effectiveDate:date,sourceId:'synthetic-cabin-'+source,sourceRevision:'1'})
 await post(vrbo,'earn',60000,'2026-10-10','10');await post(vrbo,'payment',30000,'2026-10-11','11');await post(vrbo,'commission',12000,'2026-10-11','12');await post(vrbo,'expense',5000,'2026-10-12','13');await post(vrbo,'hold',25000,'2026-10-12','14');await post(vrbo,'distribution',10000,'2026-10-13','15');await post(second,'earn',40000,'2026-10-06','16')
 // A cleaning invoice creates a payable, not invented cash. All setup uses real commands.
 let task=await h.cmd('task.raise',{propertyId:p.id,title:'Cleaning',note:'Synthetic cleaning invoice'})
 const act=async(name,input={})=>task=await h.cmd(name,{id:task.id,revision:task.revision,...input})
 await act('work.configure',{asset:'Cleaning',dueDate:'2026-10-25',spendLimitCents:7000,requiresInspection:false,unavailableStart:'2026-10-25',unavailableEnd:'2026-10-26'})
 await act('work.accept');const photo={photo:(await readFile('tests/fixtures/checklist.png')).toString('base64'),mimeType:'image/png'}
 await act('work.quote',{description:'Cleaning and photo evidence',amountCents:7000,photos:[photo]});await act('work.approveQuote');await act('work.invoice',{reference:'synthetic-cabin-17',amountCents:7000,photos:[photo]});await act('work.approveInvoice')
 const unknown=await h.cmd('reservation.request',{propertyId:p.id,channel:'booking.com',start:'2026-10-27',end:'2026-10-29',guestName:'Unpriced source stay'})
 const report=async(query=reportMonth,cookie=h.owner)=>{const response=await h.send('/api/cabin/reports.json?'+query,undefined,cookie);assert.equal(response.status,200,response.text);return response.value}
 return {p,other,air,vrbo,unpaid,cancel,second,boundary,task,unknown,report,post}
}
