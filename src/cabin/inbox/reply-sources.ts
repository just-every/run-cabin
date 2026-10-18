import type { Booking, Data } from '../model'
import { facts, type Facts } from './render'
import { homeSettings } from '../homes'
import { homeReadiness } from '../readiness'
import { inboxSettings } from './settings'
import { redactSensitiveText } from '../connections/redaction'

/** AI cannot need a live capability to answer from a reservation's operational facts. */
export function safeFacts(f: Facts | null): Facts | null {
 if(!f)return null
 const secrets = [f.code.match(/^\d{4,10}\b/)?.[0] ?? '',f.stay_link].filter(v=>v && !v.startsWith('your host'))
 return Object.fromEntries(Object.entries(f).map(([key,value])=>[key,key==='code'||key==='stay_link'?'Ask your host for private access details':redactSensitiveText(value,secrets)])) as Facts
}
/** Source revisions keep drafts stale-safe without copying secrets into a message baseline. */
export function replySources(data: Data, origin: string, b: Booking) {
 const policy = inboxSettings(data).replyPolicies?.find(p=>p.propertyId===b.propertyId), home=data.properties.find(p=>p.id===b.propertyId)!
 const ready=homeReadiness(data,home,b.start.slice(0,10)),f=facts(data,origin,b)
 const secrets=[f.code.match(/^\d{4,10}\b/)?.[0]??'',f.stay_link].filter(v=>v && !v.startsWith('your host'))
 return {
  facts:safeFacts(f),
  instructions:policy?.instructions.map(i=>({...i,title:redactSensitiveText(i.title,secrets),answer:redactSensitiveText(i.answer,secrets)}))??[],
  operations:{readiness:ready.state,reasons:ready.reasons.map(reason=>redactSensitiveText(reason,secrets)),arrival:b.arrivalTime??homeSettings(data,b.propertyId).checkInTime},
  policyRevision:policy?.revision??'', bookingRevision:b.revision,
  accessRevisions:data.codes.filter(code=>code.bookingId===b.id&&code.holder==='guest').map(code=>({id:code.id,revision:code.revision,status:code.status})),
 }
}
