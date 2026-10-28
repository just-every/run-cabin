import { need, sha, type Data } from '../model'
import type { Config, Jurisdiction, Rule, TaxData, TaxLine, Profile, Obligation, TaxPeriod, TaxReport } from './types'
export function date(value:unknown,label='date') {const v=String(value??'');need(/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v,`Enter a valid ${label}`);return v}
export function month(value:unknown){const v=String(value??'');need(/^\d{4}-(0[1-9]|1[0-2])$/.test(v),'Choose a YYYY-MM month');return v}
/** Calendar dates are inclusive at start and exclusive at end; quarter totals reuse monthly cents. */
export function reviewPeriod(value:unknown,kind:unknown='month'):TaxPeriod {
 need(kind==='month'||kind==='quarter','Choose a monthly or quarterly review')
 const selected=month(value),year=Number(selected.slice(0,4)),m=Number(selected.slice(5,7)),first=kind==='quarter'?Math.floor((m-1)/3)*3+1:m
 const start=`${selected.slice(0,4)}-${String(first).padStart(2,'0')}-01`,end=new Date(Date.UTC(year,first-1+(kind==='quarter'?3:1),1)).toISOString().slice(0,10)
 return {kind,key:kind==='quarter'?`${selected.slice(0,4)}-Q${Math.ceil(m/3)}`:selected,start,end}
}
export const reportPeriod=(report:TaxReport)=>report.period??reviewPeriod(report.month)
const inPeriod=(value:string,period:TaxPeriod)=>value>=period.start.slice(0,7)&&value<period.end.slice(0,7)
export function priorReports(data:TaxData,propertyId:string,period:TaxPeriod,jurisdictionId?:string){
 return data.reports.filter(r=>{const previous=reportPeriod(r);return r.status==='approved'&&r.propertyId===propertyId&&previous.start<period.end&&previous.end>period.start&&(!jurisdictionId||!r.jurisdictionId||r.jurisdictionId===jurisdictionId)})
}
export function nights(start:string,end:string){start=date(start.slice(0,10));end=date(end.slice(0,10));const n=(Date.parse(end)-Date.parse(start))/86400000;need(n>0&&n<=1096,'Tax records support stays of 1 to 1096 nights');return Array.from({length:n},(_,i)=>new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10))}
export function jurisdictions(config:Config[],propertyId:string){return config.filter((r):r is Jurisdiction=>r.kind==='jurisdiction'&&r.propertyId===propertyId)}
export function activeRules(config:Config[],jurisdictionId:string,night:string){return config.filter((r):r is Rule=>r.kind==='rule'&&r.jurisdictionId===jurisdictionId&&r.from<=night&&r.until>=night)}
export function coverage(config:Config[],propertyId:string,dates:string[]):string[] {
 const p=config.find((r):r is Profile=>r.kind==='profile'&&r.propertyId===propertyId)
 if(!p)return ['US property jurisdiction has not been configured.']
 const issues:string[]=[]
 for(const level of ['state','county','city'] as const){const j=jurisdictions(config,propertyId).find(j=>j.level===level&&j.name===p[level]);if(!j){issues.push(`${level}: ${p[level]} is unsupported or unconfigured.`);continue}
  if(dates.some(d=>!activeRules(config,j.id,d).length))issues.push(`${j.name}: an effective tax rule or documented zero levy is missing for the stay dates.`)
 }
 return issues
}
/** Allocate cent remainders to earliest stay nights, then round each rule/month tax once. */
export function assess(config:Config[],propertyId:string,start:string,end:string,base:number,exempt:number) {
 const dates=nights(start,end);const missing=coverage(config,propertyId,dates);need(!missing.length,missing.join(' '),409)
 const profile=config.find((r):r is Profile=>r.kind==='profile'&&r.propertyId===propertyId)!
 const split=(n:number,i:number)=>Math.floor(n/dates.length)+(i<n%dates.length?1:0)
 const grouped=new Map<string,{jurisdiction:Jurisdiction;rule:Rule;month:string;baseCents:number;exemptCents:number}>()
 for(const j of jurisdictions(config,propertyId).filter(j=>j.name===profile[j.level]))for(const [i,night] of dates.entries())for(const rule of activeRules(config,j.id,night)){
  const key=rule.id+':'+night.slice(0,7),row=grouped.get(key)??{jurisdiction:j,rule,month:night.slice(0,7),baseCents:0,exemptCents:0}
  // Allocate taxable and exempt portions independently so no night's exemption exceeds its base.
  const exemptNight=split(exempt,i),taxableNight=split(base-exempt,i);row.baseCents+=exemptNight+taxableNight;row.exemptCents+=exemptNight;grouped.set(key,row)
 }
 return [...grouped.values()].map(r=>({...r,taxCents:Math.floor(((r.baseCents-r.exemptCents)*r.rule.bps+5000)/10000)}))
}
export function workItems(data:TaxData,operational:Data,propertyId?:string,period?:TaxPeriod):string[] {
 const issues:string[]=[]
 for(const home of operational.properties.filter(p=>!propertyId||p.id===propertyId)){
  const bookings=operational.bookings.filter(b=>b.propertyId===home.id&&b.kind!=='block'&&(!period||b.start<period.end&&b.end>period.start))
  const dates=bookings.flatMap(b=>nights(b.start,b.end).filter(d=>!period||d>=period.start&&d<period.end))
  issues.push(...coverage(data.config,home.id,dates).map(i=>`${home.name}: ${i}`))
  const superseded=new Set(data.sources.map(s=>s.supersedesSourceId))
  for(const b of bookings){const source=data.sources.find(s=>s.bookingId===b.id&&!superseded.has(s.id))
   if(!source){issues.push(`${home.name}: reservation ${b.channelRef??`${b.guestName??"Guest stay"} (${b.channel}, ${b.start} → ${b.end})`} needs a rent/fees source and per-levy collection evidence${b.status==='cancelled'?' (cancelled: document any retained charge or zero tax)':''}.`);continue}
   if(source.start!==b.start||source.end!==b.end)issues.push(`${home.name}: reservation ${b.channelRef??`${b.guestName??"Guest stay"} (${b.channel}, ${b.start} → ${b.end})`} stay dates changed after tax recording; record and review corrected evidence.`)
   if(b.status==='cancelled'&&data.lines.filter(l=>l.sourceId===source.id&&!l.originalLineId).some(original=>!data.lines.some(l=>l.originalLineId===original.id)))issues.push(`${home.name}: cancelled reservation ${b.channelRef??`${b.guestName??"Guest stay"} (${b.channel}, ${b.start} → ${b.end})`} needs a refund/cancellation adjustment for every levy, including zero if no tax is refundable.`)
  }
  for(const j of jurisdictions(data.config,home.id)){
   if(!['active','not-required'].includes(j.registrationStatus))issues.push(`${home.name}: ${j.name} registration is ${j.registrationStatus}.`)
   const finalDate=period?new Date(Date.parse(period.end+'T00:00:00Z')-86400000).toISOString().slice(0,10):new Date().toISOString().slice(0,10)
   if(j.registrationUntil&&j.registrationUntil<finalDate)issues.push(`${home.name}: ${j.name} registration evidence expires before this review period ends.`)
   if(!j.recipient||!j.partner)issues.push(`${home.name}: ${j.name} needs an accountant or approved filing partner recipient.`)
  }
 }
 return [...new Set(issues)]
}
export function obligations(data:TaxData,propertyId:string,period:TaxPeriod,jurisdictionId?:string):Obligation[]{
 // A source line can belong to only one approved review, across every period and jurisdiction selection.
 const used=new Set(data.reports.filter(r=>r.status==='approved'&&r.propertyId===propertyId).flatMap(r=>r.obligations.flatMap(o=>o.lines.map(l=>l.id))))
 const grouped=new Map<string,TaxLine[]>()
 for(const l of data.lines.filter(l=>l.propertyId===propertyId&&inPeriod(l.month,period)&&(!jurisdictionId||l.jurisdictionId===jurisdictionId)&&!used.has(l.id))){const rows=grouped.get(l.jurisdictionId)??[];rows.push(l);grouped.set(l.jurisdictionId,rows)}
 return [...grouped].map(([id,lines])=>{const jurisdiction=jurisdictions(data.config,propertyId).find(j=>j.id===id);need(jurisdiction,'Tax jurisdiction was removed',409);return {jurisdiction,lines,taxCents:lines.reduce((n,l)=>n+l.taxCents,0),channelCents:lines.reduce((n,l)=>n+l.channelCents,0),hostCents:lines.reduce((n,l)=>n+l.hostCents,0)}})
}
export async function baseline(data:TaxData,operational:Data,propertyId:string,period:TaxPeriod,jurisdictionId?:string){return sha(JSON.stringify({period,jurisdictionId,config:data.config.filter(r=>r.propertyId===propertyId),sources:data.sources.filter(r=>r.propertyId===propertyId),lines:data.lines.filter(r=>r.propertyId===propertyId&&inPeriod(r.month,period)&&(!jurisdictionId||r.jurisdictionId===jurisdictionId)),bookings:operational.bookings.filter(r=>r.propertyId===propertyId).map(b=>({id:b.id,start:b.start,end:b.end,status:b.status,kind:b.kind})),prior:priorReports(data,propertyId,period,jurisdictionId).map(r=>r.id),workItems:workItems(data,operational,propertyId,period)}))}
