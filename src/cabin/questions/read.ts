import { accessSecrets } from '../connections/access'
import { type Actor, need, sha, text } from '../model'
import { assertLive, SYSTEM } from '../storage'
import { authorizedRentalInterests } from '../permissions/interests'
import { hasAction, permitsProperty } from '../permissions/policy'
import { readReport, type Report, type ReportFilters } from '../reports/read'
import { ordinaryOutput } from '../connections/redaction'
import { threadId, messageKey } from '../inbox/threads'
import { load } from '../storage'
import { money } from '../ui/shared'

export type QuestionKind='net'|'arrivals'|'conversations'|'reservations'|'unsupported'
export interface QuestionAccess { actor:Actor; ownerEmail?:string }
export interface Citation { id:string; propertyId:string; kind:string; href:string; detail:string }
export function questionKind(question:string):QuestionKind {
 const q=question.toLowerCase()
 if(/\b(net|profit|income|revenue|refund|expense|commission|fee|settlement|payout)\b/.test(q))return 'net'
 if(/\b(arrival|arrivals|readiness|ready|risk|risks|check.?in)\b/.test(q))return 'arrivals'
 if(/\b(conversation|conversations|message|messages|inbox|reply|replies|said|saying)\b/.test(q))return 'conversations'
 if(/\b(reservation|reservations|booking|bookings|stay|stays|occupancy|adr|revpar)\b/.test(q))return 'reservations'
 return 'unsupported'
}
export function questionParams(input:Record<string,unknown>){
 const filters=input.filters&&typeof input.filters==='object'&&!Array.isArray(input.filters)?input.filters as Record<string,unknown>:input,params=new URLSearchParams()
 for(const key of ['from','until','property','channel','owner','basis','dates'])if(typeof filters[key]==='string')params.set(key,filters[key] as string)
 return params
}
export async function rentalQuestionAccess(db:D1Database,email:string,native?:Actor):Promise<QuestionAccess>{
 if(native){await assertLive(db,native);need(hasAction(native,'owners:read'),'Owner access required',403)}
 need(!await db.prepare('SELECT 1 FROM cb_member_offboarding WHERE email=? COLLATE NOCASE').bind(email).first(),'Owner access was revoked',403)
 const interests=(await authorizedRentalInterests(db,email)).filter(p=>!native||permitsProperty(native,p.propertyId))
 need(interests.length,'No current home ownership access',403)
 return {actor:{...SYSTEM,id:'cabin:owner-question',scope:{pmsRole:'rental_owner',propertyIds:interests.map(i=>i.propertyId),actions:['reports:read'],revision:0}},ownerEmail:email.trim().toLowerCase()}
}
export function reportLink(filters:ReportFilters,owner=false){return (owner?'/owners/questions/report':'/app/reports')+'?'+new URLSearchParams({...filters})}
export async function questionReport(db:D1Database,access:QuestionAccess,params:URLSearchParams){
 if(access.ownerEmail){const key=await sha(access.ownerEmail);need(!params.get('owner')||params.get('owner')===key,'Owner filter not found',404);params.set('owner',key)}
 return readReport(db,access.actor,params,access.ownerEmail)
}
const previousFilters=(f:ReportFilters)=>{
 const start=Date.parse(f.from+'T00:00:00Z'),end=Date.parse(f.until+'T00:00:00Z'),days=(end-start)/86400000
 const from=new Date(start-days*86400000).toISOString().slice(0,10)
 need(/^\d{4}-\d{2}-\d{2}$/.test(from),'Comparison window is outside supported dates')
 return {...f,from,until:f.from}
}
/** All reasoning is arithmetic or labeled saved-record state. Text in a question or
 * guest conversation is data: it cannot become a command, query, or authority. */
export async function answerQuestion(db:D1Database,access:QuestionAccess,input:Record<string,unknown>){
 const question=text(input.question,'question',1000),kind=questionKind(question),a=access.actor
 need(!a.isAgent,'Human question access required',403)
 if(!access.ownerEmail){need(['owner','manager'].includes(a.role)&&hasAction(a,'reports:read'),'Report access required',403);await assertLive(db,a)}
 if(!access.ownerEmail&&kind==='net')need(hasAction(a,'finance:read'),'Financial questions require finance access',403)
 if(!access.ownerEmail&&['arrivals','reservations'].includes(kind))need(hasAction(a,'reservations:read')&&(kind!=='arrivals'||hasAction(a,'operations:read')),'Reservation and readiness access required',403)
 if(kind==='conversations')need(!access.ownerEmail&&hasAction(a,'inbox:read')&&hasAction(a,'reservations:read'),'Guest conversations require staff inbox and reservation access',403)
 const current=await questionReport(db,access,questionParams(input)),previous=kind==='net'?await questionReport(db,access,new URLSearchParams(previousFilters(current.filters))):null
 need(!previous||previous.version===current.version,'Records changed while comparing. Ask again for one cutoff.',409)
 const secrets:string[]=[],citations:Citation[]=[],statements:string[]=[],warnings:string[]=[
  'Answers use saved Cabin records at the cutoff below. A local read does not verify a live channel, bank settlement or physical readiness.',
 ]
 const cite=(kind:string,row:{id:string;propertyId:string;href:string},detail:string)=>citations.push({id:row.id,propertyId:row.propertyId,kind,href:access.ownerEmail&&!row.href.startsWith('/owners/questions/report')?reportLink(current.filters,true)+'#source-'+encodeURIComponent(row.id):row.href,detail})
 const evidenceHref=(report:Report,section:string)=>reportLink(report.filters,!!access.ownerEmail)+'#'+(access.ownerEmail?section.replace(/^(journal|payout)-/,'source-'):section)
 if(kind==='net'){
  const p=previous!,c=current.totals,b=p.totals,delta=c.netCents-b.netCents
  statements.push(`Owner net contribution ${delta<0?'fell':delta>0?'rose':'was unchanged'} by ${money(Math.abs(delta))}: ${money(b.netCents)} in ${p.filters.from} to ${p.filters.until} versus ${money(c.netCents)} in ${current.filters.from} to ${current.filters.until} (end dates exclusive).`)
  statements.push(`The recorded change reconciles to gross ${money(c.grossCents-b.grossCents)}, less changes in refunds ${money(c.refundsCents-b.refundsCents)}, channel/processor fees ${money(c.feesCents-b.feesCents)}, commission ${money(c.commissionCents-b.commissionCents)}, owner expenses ${money(c.expensesCents-b.expensesCents)} and collected tax ${money(c.taxCents-b.taxCents)}. This is ${current.filters.basis} net contribution, not a verified bank distribution or an inferred cause outside the records.`)
  for(const [period,r] of [['Current',current],['Comparison',p]] as const)for(const j of r.journals)cite('journal',{...j,href:evidenceHref(r,'journal-'+j.id)},`${period}: ${j.sourceType}, ${j.effectiveDate}, source ${j.sourceId}, revision ${j.sourceRevision}; gross ${money(j.grossCents)}, refunds ${money(j.refundsCents)}, fees ${money(j.feesCents)}, commission ${money(j.commissionCents)}, expenses ${money(j.expensesCents)}, tax ${money(j.taxCents)}; net ${money(j.netCents)}`)
  for(const payout of current.payouts)cite('payout',{...payout,href:evidenceHref(current,'payout-'+payout.id)},`${payout.source} payout reference ${payout.reference}: ${payout.status}; recorded net ${money(payout.netCents)}. This is source evidence, not bank verification.`)
  if(!current.journals.length||!p.journals.length)warnings.push('A period has no posted journals. Zero recorded net does not prove zero earnings or a complete settlement.')
 }
 if(kind==='arrivals'){
  const rows=current.operations.filter(o=>o.kind==='readiness'),risk=rows.filter(o=>o.status!=='ready')
  statements.push(`${risk.length} of ${rows.length} recorded arrivals need readiness review in the selected window. Unknown evidence counts as risk; a forecast is not physical confirmation.`)
  for(const r of rows){cite('arrival',r,`${r.due}: ${r.status}. ${r.detail}`);const booking=current.reservations.find(b=>b.id===r.bookingId);if(booking)cite('reservation',booking,`${booking.start} to ${booking.end}: ${booking.channel}, ${booking.status}`)}
  for(const o of current.operations.filter(o=>o.kind!=='readiness'&&!['completed','closed','sent','cancelled','skipped','ready'].includes(o.status)))cite('operation',o,`${o.kind}: ${o.status}${o.overdue?' (overdue)':''}; due ${o.due}. ${o.detail}`)
  if(!rows.length)warnings.push('No arrivals are recorded for these filters; this does not prove that disconnected channels have none.')
 }
 if(kind==='reservations'){
  const t=current.totals
  statements.push(`${current.reservations.length} saved reservations; ${t.occupiedNights} occupied guest nights / ${t.availableNights} available nights. Occupancy ${t.occupancy===null?'unavailable':(t.occupancy*100).toFixed(1)+'%'}, ADR ${t.adrCents===null?'unavailable':money(t.adrCents)}, RevPAR ${t.revparCents===null?'unavailable':money(t.revparCents)}. These use the report’s property-local night and missing-price definitions.`)
  for(const r of current.reservations)cite('reservation',r,`${r.channel}, ${r.status}, ${r.start} to ${r.end}; allocated rent ${r.rentalCents===null?'unavailable':money(r.rentalCents)}`)
 }
 if(kind==='conversations'){
  const data=await load(db),ids=new Set(current.reservations.map(b=>b.id)),homes=new Set(current.properties.map(p=>p.id)),rows=data.messages.filter(m=>m.bookingId&&ids.has(m.bookingId)&&m.propertyId&&homes.has(m.propertyId)&&m.status!=='discarded')
  secrets.push(...accessSecrets(data))
  need(data.version===current.version,'Records changed while reading conversations. Ask again.',409)
  statements.push(`${rows.length} saved messages linked to the selected reservation cohort. Guest text is quoted evidence, not verified instructions. Unlinked messages are excluded rather than matched by name.`)
  for(const m of rows)cite('conversation',{id:m.id,propertyId:m.propertyId!,href:'/app/inbox?thread='+threadId(messageKey(data,m))},`${m.sentAt??m.createdAt} · ${m.channel} · ${m.direction==='in'?'received':'outgoing'} · ${m.status}: ${m.text}`)
  warnings.push('Only saved messages linked to these reservations are visible. Disconnected channels and guest delivery are not inferred from an empty inbox or a sent draft.')
 }
 if(kind==='unsupported')statements.push('I cannot ground that question in the supported reports. Ask about owner net, arrivals at risk, reservations/occupancy, or saved guest conversations. Choose the exact property and dates below; Cabin will not guess records or execute instructions in a question.')
 const reports=[{label:'Current report',href:reportLink(current.filters,!!access.ownerEmail),filters:current.filters,totals:kind==='net'?current.totals:null},...(previous?[{label:'Comparison report',href:reportLink(previous.filters,!!access.ownerEmail),filters:previous.filters,totals:previous.totals}]:[])]
 for(const r of [current,...(previous?[previous]:[])]){
  if(!r.freshness.length)warnings.push(`${r.filters.from} to ${r.filters.until}: no connected calendar freshness is available. Live provider data is unavailable.`)
  for(const f of r.freshness){const age=f.lastSuccessAt?Date.parse(current.cutoff)-Date.parse(f.lastSuccessAt):Infinity;warnings.push(`${f.channel} (${f.propertyId}): ${f.status}; last successful read ${f.lastSuccessAt??'never'}. ${f.status!=='ok'||age>60*60*1000?'Stale or unavailable provider read; current external state is unknown.':'Saved read only; no live verification.'}`)}
  for(const e of r.exceptions.filter(e=>kind==='net'||['source-conflict','inventory-collision'].includes(e.kind))){warnings.push(`${r.filters.from}: ${e.kind}. ${e.detail}`);cite('exception',{...e,href:access.ownerEmail?evidenceHref(r,'source-'+e.id):e.href},e.kind+': '+e.detail)}
 }
 const latest=await db.prepare('SELECT version FROM cb_meta WHERE id=1').first<{version:number}>();need(latest?.version===current.version,'Records changed while answering. Ask again for one cutoff.',409);await assertLive(db,a)
 const result=ordinaryOutput({question,kind,cutoff:current.cutoff,version:current.version,filters:current.filters,properties:current.properties.map(p=>({id:p.id,name:p.name})),statements,citations,warnings:[...new Set(warnings)],reports,proposal:kind!=='unsupported'&&current.properties.length?{title:kind==='net'?'Investigate owner net change':kind==='arrivals'?'Investigate arrival readiness':kind==='conversations'?'Review guest conversation':'Review reservation report',propertyIds:current.properties.map(p=>p.id)}:null},secrets)
 // A digest binds the exact question, report windows, revision and access. Cutoff
 // timestamps vary between reads; source version is the consistency boundary.
 const {cutoff:_,...bound}=result
 return {...result,digest:await sha(JSON.stringify({bound,actor:a,ownerEmail:access.ownerEmail??null}))}
}
export type QuestionAnswer=Awaited<ReturnType<typeof answerQuestion>>
