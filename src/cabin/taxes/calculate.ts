import { need, sha, type Data } from '../model'
import type { Config, Jurisdiction, Rule, TaxData, TaxLine, Profile, Obligation } from './types'
export function date(value:unknown,label='date') {const v=String(value??'');need(/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v,`Enter a valid ${label}`);return v}
export function month(value:unknown){const v=String(value??'');need(/^\d{4}-(0[1-9]|1[0-2])$/.test(v),'Choose a YYYY-MM month');return v}
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
export function workItems(data:TaxData,operational:Data,propertyId?:string,period?:string):string[] {
 const issues:string[]=[]
 for(const home of operational.properties.filter(p=>!propertyId||p.id===propertyId)){
  const bookings=operational.bookings.filter(b=>b.propertyId===home.id&&b.kind!=='block'&&(!period||b.start<period+'-32'&&b.end>period+'-01'))
  const dates=bookings.flatMap(b=>nights(b.start,b.end).filter(d=>!period||d.startsWith(period)))
  issues.push(...coverage(data.config,home.id,dates).map(i=>`${home.name}: ${i}`))
  const superseded=new Set(data.sources.map(s=>s.supersedesSourceId))
  for(const b of bookings){const source=data.sources.find(s=>s.bookingId===b.id&&!superseded.has(s.id))
   if(!source){issues.push(`${home.name}: reservation ${b.channelRef??`${b.guestName??"Guest stay"} (${b.channel}, ${b.start} → ${b.end})`} needs a rent/fees source and per-levy collection evidence${b.status==='cancelled'?' (cancelled: document any retained charge or zero tax)':''}.`);continue}
   if(source.start!==b.start||source.end!==b.end)issues.push(`${home.name}: reservation ${b.channelRef??`${b.guestName??"Guest stay"} (${b.channel}, ${b.start} → ${b.end})`} stay dates changed after tax recording; record and review corrected evidence.`)
   if(b.status==='cancelled'&&data.lines.filter(l=>l.sourceId===source.id&&!l.originalLineId).some(original=>!data.lines.some(l=>l.originalLineId===original.id)))issues.push(`${home.name}: cancelled reservation ${b.channelRef??`${b.guestName??"Guest stay"} (${b.channel}, ${b.start} → ${b.end})`} needs a refund/cancellation adjustment for every levy, including zero if no tax is refundable.`)
  }
  for(const j of jurisdictions(data.config,home.id)){
   if(!['active','not-required'].includes(j.registrationStatus))issues.push(`${home.name}: ${j.name} registration is ${j.registrationStatus}.`)
   const finalDate=period?new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5,7)),0)).toISOString().slice(0,10):new Date().toISOString().slice(0,10)
   if(j.registrationUntil&&j.registrationUntil<finalDate)issues.push(`${home.name}: ${j.name} registration evidence expires before this review period ends.`)
   if(!j.recipient||!j.partner)issues.push(`${home.name}: ${j.name} needs an accountant or approved filing partner recipient.`)
  }
 }
 return [...new Set(issues)]
}
export function obligations(data:TaxData,propertyId:string,period:string):Obligation[]{
 const prior=data.reports.filter(r=>r.status==='approved'&&r.propertyId===propertyId&&r.month===period),used=new Set(prior.flatMap(r=>r.obligations.flatMap(o=>o.lines.map(l=>l.id))))
 const grouped=new Map<string,TaxLine[]>()
 for(const l of data.lines.filter(l=>l.propertyId===propertyId&&l.month===period&&!used.has(l.id))){const rows=grouped.get(l.jurisdictionId)??[];rows.push(l);grouped.set(l.jurisdictionId,rows)}
 return [...grouped].map(([id,lines])=>{const jurisdiction=jurisdictions(data.config,propertyId).find(j=>j.id===id);need(jurisdiction,'Tax jurisdiction was removed',409);return {jurisdiction,lines,taxCents:lines.reduce((n,l)=>n+l.taxCents,0),channelCents:lines.reduce((n,l)=>n+l.channelCents,0),hostCents:lines.reduce((n,l)=>n+l.hostCents,0)}})
}
export async function baseline(data:TaxData,operational:Data,propertyId:string,period:string){return sha(JSON.stringify({config:data.config.filter(r=>r.propertyId===propertyId),sources:data.sources.filter(r=>r.propertyId===propertyId),lines:data.lines.filter(r=>r.propertyId===propertyId&&r.month===period),bookings:operational.bookings.filter(r=>r.propertyId===propertyId).map(b=>({id:b.id,start:b.start,end:b.end,status:b.status,kind:b.kind})),prior:data.reports.filter(r=>r.propertyId===propertyId&&r.month===period&&r.status==='approved').map(r=>r.id),workItems:workItems(data,operational,propertyId,period)}))}
