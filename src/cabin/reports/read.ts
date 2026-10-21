import { type Actor, type Booking, manager, need, sha } from '../model'
import { assertLive, load } from '../storage'
import { journals } from '../ledger/store'
import type { Journal } from '../ledger/types'
import { stays } from '../direct/store'
import { homeSettings } from '../homes'
import { localDay, wall } from '../clock'
import { homeReadiness } from '../readiness'
import { day } from '../direct/rules'

export interface ReportFilters { from:string; until:string; property:string; channel:string; owner:string; basis:'cash'|'accrual'; dates:'stay'|'booking' }
export function reportFilters(params:URLSearchParams):ReportFilters {
 const now=new Date(),from=day(params.get('from')||now.toISOString().slice(0,7)+'-01'),until=day(params.get('until')||new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1)).toISOString().slice(0,10))
 need(from<until,'The end date must follow the start date')
 const basis=params.get('basis')||'accrual',dates=params.get('dates')||'stay',channel=params.get('channel')||''
 need(basis==='cash'||basis==='accrual','Choose cash or accrual accounting');need(dates==='stay'||dates==='booking','Choose stay or booking dates')
 need(['','direct','airbnb','vrbo','booking.com','ical'].includes(channel),'Choose a supported channel')
 return {from,until,property:params.get('property')||'',channel,owner:params.get('owner')||'',basis,dates}
}
const countNights=(from:string,until:string)=>Math.max(0,Math.round((Date.parse(until+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000))
const net=(j:Journal,account:string)=>j.lines.filter(l=>l.account===account).reduce((n,l)=>n+l.creditCents-l.debitCents,0)
const sum=<T>(rows:T[],fn:(r:T)=>number)=>rows.reduce((n,r)=>n+fn(r),0)
/** Allocate integer cents to calendar nights, putting the remainder on the earliest nights. */
function nightly(amount:number,start:string,end:string,from:string,until:string){
 const n=countNights(start,end);if(!n)return 0
 const a=countNights(start,from>start?from:start),z=Math.min(n,countNights(start,until<end?until:end)),base=Math.floor(amount/n),remainder=amount-base*n
 return Math.max(0,z-a)*base+Math.max(0,Math.min(z,remainder)-Math.min(a,remainder))
}
export const semantics = {
 dates:'Start is inclusive; end and checkout are exclusive. Stay nights are calendar dates in each home’s time zone (including DST). Booking dates use the first saved reservation revision, never the last amendment. Booking-date mode selects that booking cohort; occupancy still counts only its nights inside the selected window.',
 occupancy:'Occupancy = distinct confirmed guest nights / (selected home calendar nights − distinct owner, maintenance and other blocked nights). Owner blocks take precedence over maintenance, then other blocks. Channel and owner filters select the guest cohort; blocked inventory is retained. Colliding guest nights are counted once per home; collisions are exceptions.',
 rates:'ADR = known, allocated rental cents / priced guest nights. RevPAR = the same rental cents / available nights. Fees and taxes are excluded. Missing prices are reported and excluded from ADR’s priced-night denominator, never treated as zero-priced stays. Integer-cent remainders go to the earliest nights.',
 accounting:'Financial rows use immutable journal effective dates in the selected window, independently of the reservation date cohort. Cash gross is actual trust-cash receipts (including advances) plus payout fees; cash net subtracts paid refunds, fees, commissions and owner expenses, excluding distributions, tax remittance and non-cash holds. Accrual gross is posted earned owner revenue plus manager commission reclassification; net subtracts posted refunds, fees, commissions and owner expenses. Reservation charges/advances are not earned revenue. A payout is earned evidence only when that reservation has no separate earn or direct-payment journal. Processor receipts appear in accrual and are separately marked unsettled until a trust receipt exists. Every value retains its journal source; unposted costs/earnings are exceptions, not estimates.',
 pace:'Booking pace groups the selected reservations by the property-local date of their first saved revision and shows full booked nights and known rental value; it is current recorded history, not an invented historical inventory snapshot.',
 cutoff:'The cutoff is the current saved Cabin revision. Provider freshness is shown separately; a successful local read does not claim live provider or bank verification.'
}
export async function readReport(db:D1Database,actor:Actor,params:URLSearchParams){
 manager(actor);need(!actor.isAgent,'Human manager access required',403);await assertLive(db,actor)
 const f=reportFilters(params),data=await load(db),all=await journals(db),direct=await stays(db),cutoff=new Date().toISOString()
 const version=data.version,inside=(date:string)=>date>=f.from&&date<f.until,keys=new Map<string,string>(),names=new Map<string,string>()
 for(const p of data.properties){const key=await sha(p.ownerEmail.trim().toLowerCase());keys.set(p.id,key);names.set(key,p.ownerName)}
 const bookingKeys=new Map<string,string>()
 for(const b of data.bookings){const email=b.managementTerms?.ownerEmail??data.properties.find(p=>p.id===b.propertyId)?.ownerEmail??'',key=await sha(email.trim().toLowerCase());bookingKeys.set(b.id,key);names.set(key,b.managementTerms?.ownerName??data.properties.find(p=>p.id===b.propertyId)?.ownerName??'Retained owner')}
 const owners=[...new Set([...keys.values(),...bookingKeys.values(),...all.map(j=>j.ownerKey)])].sort().map(id=>({id,name:names.get(id)??'Retained owner'}))
 need(!f.property||data.properties.some(p=>p.id===f.property),'Home not found',404);need(!f.owner||owners.some(o=>o.id===f.owner),'Owner reference not found',404)
 const homes=data.properties.filter(p=>(!f.property||p.id===f.property)&&(!f.owner||keys.get(p.id)===f.owner||data.bookings.some(b=>b.propertyId===p.id&&bookingKeys.get(b.id)===f.owner)||all.some(j=>j.propertyId===p.id&&j.ownerKey===f.owner))),homeIds=new Set(homes.map(p=>p.id)),byId=new Map(data.bookings.map(b=>[b.id,b]))
 const cohort=(b:Booking)=>(!f.channel||b.channel===f.channel)&&(!f.owner||bookingKeys.get(b.id)===f.owner)
 const bookedDate=(b:Booking)=>localDay(Date.parse(b.lifecycle?.history[0]?.at??b.approvedAt),homeSettings(data,b.propertyId).timeZone)
 const selected=data.bookings.filter(b=>homeIds.has(b.propertyId)&&b.kind!=='block'&&cohort(b)&&(f.dates==='booking'?inside(bookedDate(b)):b.start.slice(0,10)<f.until&&b.end.slice(0,10)>f.from))
 const exceptions:{id:string;propertyId:string;bookingId:string;kind:string;detail:string;href:string}[]=[]
 const exception=(id:string,propertyId:string,bookingId:string,kind:string,detail:string,href:string)=>exceptions.push({id,propertyId,bookingId,kind,detail,href})
 const reservations=selected.map(b=>{
  const paid=direct.find(s=>s.bookingId===b.id&&s.paymentId),price=b.lifecycle?.price??(paid?{rentCents:paid.quote.rentCents,feesCents:paid.quote.cleaningCents+paid.quote.extraGuestCents,taxCents:sum(paid.quote.taxes,t=>t.amountCents),totalCents:paid.quote.totalCents}:undefined),start=b.start.slice(0,10),end=b.end.slice(0,10),nights=b.status==='confirmed'?countNights(start>f.from?start:f.from,end<f.until?end:f.until):0
  const rentalCents=price&&b.status==='confirmed'?nightly(price.rentCents,start,end,f.from,f.until):price?0:null,href='/app/calendar?from='+start+'&reservation='+encodeURIComponent(b.id)
  if(!price)exception('price:'+b.id,b.propertyId,b.id,'missing-price','No saved rental price; ADR excludes these nights.',href)
  const receipts=data.payouts.filter(p=>p.bookingId===b.id&&p.match==='matched'),cash=all.filter(j=>j.bookingId===b.id).some(j=>j.lines.some(l=>l.account==='cash'&&l.debitCents>0))
  if(!receipts.length&&!cash)exception('settlement:'+b.id,b.propertyId,b.id,'missing-settlement','No matched payout or recorded trust-cash receipt. A processor receipt is not a bank receipt.',href)
  // Receivable balances are derived from immutable journals; unknown-price stays keep an explicit unknown collection state.
  const ledgerBalance=sum(all.filter(j=>j.bookingId===b.id),j=>-net(j,'receivable'))
  if(ledgerBalance>0)exception('collection:'+b.id,b.propertyId,b.id,'collection-due',`Posted guest receivable: ${ledgerBalance} USD cents.`,href)
  if(b.lifecycle?.sourceConflict)exception('conflict:'+b.id,b.propertyId,b.id,'source-conflict','A changed source reservation awaits reconciliation.',href)
  return {id:b.id,propertyId:b.propertyId,ownerKey:bookingKeys.get(b.id)!,channel:b.channel,start,end,bookedDate:bookedDate(b),status:b.lifecycle?.outcome??b.status,nights,pricedNights:price?nights:0,rentalCents,fullRentalCents:price?.rentCents??null,contractCents:b.lifecycle?.settledChargeCents??price?.totalCents??null,receivableCents:ledgerBalance,href}
 })
 const blockKind=(b:Booking)=>b.blockUse?.purpose??(data.tasks.some(t=>t.work?.blockId===b.id)?'maintenance':'other')
 const blocks=data.bookings.filter(b=>homeIds.has(b.propertyId)&&b.status==='confirmed'&&b.kind==='block'&&b.start.slice(0,10)<f.until&&b.end.slice(0,10)>f.from).map(b=>({id:b.id,propertyId:b.propertyId,kind:blockKind(b),start:b.start.slice(0,10),end:b.end.slice(0,10),reason:b.blockUse?.reason??b.summary,nights:countNights(b.start.slice(0,10)>f.from?b.start.slice(0,10):f.from,b.end.slice(0,10)<f.until?b.end.slice(0,10):f.until),href:'/app/calendar?from='+b.start.slice(0,10)+'&reservation='+b.id}))
 const properties=homes.map(p=>{
  const homeBlocks=blocks.filter(b=>b.propertyId===p.id),rows=reservations.filter(b=>b.propertyId===p.id),occupied=new Set<string>(),owner=new Set<string>(),maintenance=new Set<string>(),other=new Set<string>()
  const add=(set:Set<string>,start:string,end:string)=>{for(let d=start>f.from?start:f.from;d<end&&d<f.until;d=new Date(Date.parse(d+'T00:00:00Z')+86400000).toISOString().slice(0,10))set.add(d)}
  for(const b of homeBlocks)add(b.kind==='owner'?owner:b.kind==='maintenance'?maintenance:other,b.start,b.end)
  for(const d of owner){maintenance.delete(d);other.delete(d)}for(const d of maintenance)other.delete(d)
  for(const b of rows.filter(b=>b.status==='confirmed')){const before=occupied.size;add(occupied,b.start,b.end);if(occupied.size-before<b.nights)exception('collision:'+b.id,p.id,b.id,'inventory-collision','Guest nights overlap another selected stay.',b.href)}
  const blocked=new Set([...owner,...maintenance,...other]);for(const d of occupied)if(blocked.has(d))exception('blocked:'+p.id+':'+d,p.id,'','inventory-collision','A guest night also has a block on '+d,'/app/calendar?from='+d+'&home='+p.id)
  const calendarNights=countNights(f.from,f.until),availableNights=calendarNights-blocked.size,rentalCents=sum(rows,b=>b.rentalCents??0),pricedNights=sum(rows,b=>b.pricedNights)
  return {id:p.id,name:p.name,timeZone:homeSettings(data,p.id).timeZone,calendarNights,ownerNights:owner.size,maintenanceNights:maintenance.size,otherBlockedNights:other.size,availableNights,occupiedNights:occupied.size,pricedNights,rentalCents,occupancy:availableNights?occupied.size/availableNights:null,adrCents:pricedNights?Math.round(rentalCents/pricedNights):null,revparCents:availableNights?Math.round(rentalCents/availableNights):null,cancellations:rows.filter(b=>b.status==='cancelled'||b.status==='no_show').length}
 })
 const family=(j:Journal):string=>j.reversalOf?all.find(o=>o.id===j.reversalOf)?.sourceType??j.sourceType:j.sourceType
 const hasEarn=new Set(all.filter(j=>['earn','direct-payment'].includes(j.sourceType)).map(j=>j.bookingId))
 const financial=all.filter(j=>homeIds.has(j.propertyId)&&inside(j.effectiveDate)&&(!f.owner||j.ownerKey===f.owner)&&(!f.channel||byId.get(j.bookingId)?.channel===f.channel)).map(j=>{
  const type=family(j),payout=data.payouts.find(p=>p.id===(j.reversalOf?all.find(o=>o.id===j.reversalOf)?.sourceId:j.sourceId)),cash=-net(j,'cash'),owner=net(j,'ownerLiability'),managerRevenue=net(j,'managerRevenue'),sign=j.reversalOf?-1:1
  const fee=type==='payout'?(payout?.feeCents??0)*sign:type==='channelFee'?-owner:0,refund=type.includes('refund')?-owner:type==='payout'&&payout&&payout.grossCents<0?-payout.grossCents*sign:0
  const expense=['expense','maintenance-expense','agreement-expense','owner-use-cleaning'].includes(type)?-owner:0,commission=type==='commission'?managerRevenue:0
  const earned=['earn','direct-payment'].includes(type)||type==='payout'&&!hasEarn.has(j.bookingId)
  const gross=f.basis==='cash'?(type==='payout'&&payout?(payout.grossCents>0?payout.grossCents*sign:0):['payment','deposit'].includes(type)?cash:0):earned?(type==='payout'&&payout&&payout.grossCents<0?0:owner+fee+managerRevenue):0
  const included=f.basis==='accrual'||cash!==0,feesCents=included?fee:0,refundsCents=included?refund:0,expensesCents=included?expense:0,commissionCents=included?commission:0
  return {id:j.id,propertyId:j.propertyId,bookingId:j.bookingId,ownerKey:j.ownerKey,channel:byId.get(j.bookingId)?.channel??'',effectiveDate:j.effectiveDate,sourceType:j.sourceType,sourceId:j.sourceId,sourceRevision:j.sourceRevision,reversalOf:j.reversalOf??'',grossCents:gross,feesCents,refundsCents,expensesCents,commissionCents,netCents:gross-feesCents-refundsCents-expensesCents-commissionCents,ownerMovementCents:owner,cashMovementCents:cash,cleaningCents:type==='owner-use-cleaning'||data.tasks.some(t=>t.id===j.sourceId&&t.work?.asset==='Cleaning')?expensesCents:0,href:'/app/ledger#journal-'+j.id,lines:j.lines}
 })
 for(const r of reservations)if((r.status==='confirmed'||(r.contractCents??0)>0)&&!all.some(j=>j.bookingId===r.id&&['earn','direct-payment','payout'].includes(family(j))))exception('earn:'+r.id,r.propertyId,r.id,'unposted-earnings','No earned-revenue journal. Contracted rent is shown separately from accounting revenue.',r.href)
 const payouts=data.payouts.filter(p=>(p.propertyId?homeIds.has(p.propertyId):!f.property&&!f.owner)&&inside(p.date)&&(!f.channel||byId.get(p.bookingId??'')?.channel===f.channel||!p.bookingId&&p.source===f.channel)&&(!f.owner||bookingKeys.get(p.bookingId??'')===f.owner)).map(p=>({id:p.id,propertyId:p.propertyId??'',bookingId:p.bookingId??'',ownerKey:bookingKeys.get(p.bookingId??'')??'',date:p.date,source:p.source,reference:p.reference,status:p.match,grossCents:p.grossCents,feeCents:p.feeCents,netCents:p.netCents,href:'/app/reports?from='+p.date+'&until='+new Date(Date.parse(p.date+'T00:00:00Z')+86400000).toISOString().slice(0,10)+'#payout-'+p.id}))
 for(const p of payouts)if(p.status!=='matched')exception('unmatched:'+p.id,p.propertyId,p.bookingId,'unmatched-payout','Payout has no reviewed reservation match.',p.href)
 const operations:{id:string;propertyId:string;bookingId:string;kind:string;due:string;status:string;detail:string;href:string}[]=[]
 const allowedBooking=(id:string)=>{const b=byId.get(id);return !!b&&cohort(b)}
 for(const t of data.turnovers.filter(t=>homeIds.has(t.propertyId)&&inside(t.dueDate)&&allowedBooking(t.bookingId)))operations.push({id:t.id,propertyId:t.propertyId,bookingId:t.bookingId,kind:'turnover',due:t.windowEnd??t.dueDate,status:t.status,detail:t.status==='completed'?'Completed with retained evidence':!t.cleanerId?'No cleaner assigned':'Completion pending',href:'/app/turnovers#turnover-'+t.id})
 for(const t of data.tasks.filter(t=>homeIds.has(t.propertyId)&&t.work&&inside(t.work.dueDate)&&(!f.channel||allowedBooking(data.turnovers.find(r=>r.id===t.turnoverId)?.bookingId??''))&&(!f.owner||keys.get(t.propertyId)===f.owner)))operations.push({id:t.id,propertyId:t.propertyId,bookingId:data.turnovers.find(r=>r.id===t.turnoverId)?.bookingId??'',kind:'service',due:t.work!.dueDate,status:t.status,detail:t.title+(t.assigneeId?' · assigned':' · unassigned'),href:'/app/maintenance#task-'+t.id})
 for(const m of data.scheduled.filter(m=>homeIds.has(m.propertyId)&&allowedBooking(m.bookingId)&&inside(localDay(Date.parse(m.deadline),homeSettings(data,m.propertyId).timeZone))))operations.push({id:m.id,propertyId:m.propertyId,bookingId:m.bookingId,kind:'guest-message',due:m.deadline,status:m.status,detail:m.rule+(m.reason?' · '+m.reason:''),href:'/app/inbox'})
 for(const b of selected.filter(b=>b.status==='confirmed'&&inside(b.start.slice(0,10)))){const r=homeReadiness(data,homes.find(p=>p.id===b.propertyId)!,b.start.slice(0,10));operations.push({id:'readiness:'+b.id,propertyId:b.propertyId,bookingId:b.id,kind:'readiness',due:b.start.slice(0,10)+'T'+(b.arrivalTime??homeSettings(data,b.propertyId).checkInTime),status:r.state,detail:r.reasons.join('; ')||'All readiness evidence passed',href:'/app/readiness?from='+b.start.slice(0,10)})}
 const deadlines=operations.map(o=>({...o,overdue:!['completed','closed','sent','cancelled','skipped','ready'].includes(o.status)&&(o.due.endsWith('Z')?Date.parse(o.due)<Date.parse(cutoff):o.due.length===10?o.due<localDay(Date.parse(cutoff),homeSettings(data,o.propertyId).timeZone):o.due<wall(Date.parse(cutoff),homeSettings(data,o.propertyId).timeZone))}))
 const totals={calendarNights:sum(properties,p=>p.calendarNights),ownerNights:sum(properties,p=>p.ownerNights),maintenanceNights:sum(properties,p=>p.maintenanceNights),otherBlockedNights:sum(properties,p=>p.otherBlockedNights),availableNights:sum(properties,p=>p.availableNights),occupiedNights:sum(properties,p=>p.occupiedNights),pricedNights:sum(properties,p=>p.pricedNights),rentalCents:sum(properties,p=>p.rentalCents),cancellations:sum(properties,p=>p.cancellations),grossCents:sum(financial,j=>j.grossCents),feesCents:sum(financial,j=>j.feesCents),refundsCents:sum(financial,j=>j.refundsCents),expensesCents:sum(financial,j=>j.expensesCents),commissionCents:sum(financial,j=>j.commissionCents),netCents:sum(financial,j=>j.netCents),cleaningCents:sum(financial,j=>j.cleaningCents),ownerMovementCents:sum(financial,j=>j.ownerMovementCents),cashMovementCents:sum(financial,j=>j.cashMovementCents),occupancy:null as number|null,adrCents:null as number|null,revparCents:null as number|null}
 totals.occupancy=totals.availableNights?totals.occupiedNights/totals.availableNights:null;totals.adrCents=totals.pricedNights?Math.round(totals.rentalCents/totals.pricedNights):null;totals.revparCents=totals.availableNights?Math.round(totals.rentalCents/totals.availableNights):null
 const channels=[...new Set(reservations.map(b=>b.channel))].map(channel=>{const rows=reservations.filter(b=>b.channel===channel);return {channel,reservations:rows.length,nights:sum(rows,b=>b.nights),rentalCents:sum(rows,b=>b.rentalCents??0),share:totals.occupiedNights?sum(rows,b=>b.nights)/totals.occupiedNights:null}})
 const pace=[...new Set(reservations.map(b=>b.bookedDate))].sort().map(date=>{const rows=reservations.filter(b=>b.bookedDate===date);return {date,bookings:rows.length,cancellations:rows.filter(b=>b.status!=='confirmed').length,bookedNights:sum(rows,b=>countNights(b.start,b.end)),rentalCents:sum(rows,b=>b.fullRentalCents??0)}})
 const performance=owners.filter(o=>!f.owner||o.id===f.owner).map(o=>{const rows=financial.filter(j=>j.ownerKey===o.id);return {...o,grossCents:sum(rows,j=>j.grossCents),netCents:sum(rows,j=>j.netCents),ownerMovementCents:sum(rows,j=>j.ownerMovementCents),cashMovementCents:sum(rows,j=>j.cashMovementCents),cleaningCents:sum(rows,j=>j.cleaningCents),journalIds:rows.map(j=>j.id)}}).filter(o=>o.journalIds.length||reservations.some(b=>b.ownerKey===o.id))
 const freshness=data.connections.filter(c=>homeIds.has(c.propertyId)&&(!f.channel||c.channel===f.channel)).map(c=>({id:c.id,propertyId:c.propertyId,channel:c.channel,status:c.status,lastSuccessAt:c.lastSuccessAt,error:c.error}))
 await assertLive(db,actor);const latest=await db.prepare('SELECT version FROM cb_meta WHERE id=1').first<{version:number}>();need(latest?.version===version,'Records changed while generating this report. Refresh for one consistent cutoff.',409)
 return {filters:f,cutoff,version,semantics,totals,properties,owners,channels,pace,performance,reservations,blocks,journals:financial,payouts,operations:deadlines,exceptions,freshness}
}
export type Report=Awaited<ReturnType<typeof readReport>>
