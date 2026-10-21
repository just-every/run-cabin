import type { Actor, Data } from '../model'
import { threadId, type Thread } from '../inbox/threads'
import { projectState } from '../permissions/projection'
import { messageSelection } from './message-query'
import { inIds, pageNumber, records, scoped } from './core'

export interface InboxPage {
 query:string; page:number; size:number; total:number; pages:number; threads:Thread[]; open?:Thread;
 messagePage:number; messageSize:number; messageTotal:number; messagePages:number; latestIncoming?:any;
}
const THREADS=25, MESSAGES=50
/** Search all retained messages in SQL; transfer only one explicit results page. */
export async function inboxData(db:D1Database,actor:Actor,data:Data,url:URL):Promise<InboxPage> {
 const query=(url.searchParams.get('q')??'').trim()
 if(query.length>200)throw Object.assign(new Error('Search with up to 200 characters'),{status:400})
 const page=pageNumber(url.searchParams.get('page'),'guest'), messagePage=pageNumber(url.searchParams.get('messages'),'message'), homes=scoped(data)
 const result=await db.batch<any>([
  db.prepare(`SELECT id,json_extract(data,'$.bookingId') bookingId,json_extract(data,'$.mergedInto') mergedInto,json_extract(data,'$.erasedAt') erasedAt FROM cb_records WHERE kind='guests'`),
  db.prepare(`SELECT id FROM cb_records WHERE kind='bookings' AND ${inIds("json_extract(data,'$.propertyId')")}`).bind(homes),
 ])
 const profiles=new Map<string,any>(result[0].results.map((g:any)=>[g.id,g])), origins=new Map<string,any>()
 for(const g of profiles.values())if(!g.erasedAt&&!origins.has(g.bookingId))origins.set(g.bookingId,g)
 const root=(g:any)=>{const seen=new Set<string>();let current=g;while(current?.mergedInto){if(current.erasedAt||seen.has(current.id))return g.id;seen.add(current.id);current=profiles.get(current.mergedInto)}return current&&!current.erasedAt?current.id:g.id}
 const keys: [string,string][]=result[1].results.map((b:any)=>{const g=origins.get(b.id);return [b.id,g?'g:'+root(g):'b:'+b.id]})
 const mapping=JSON.stringify(keys)
 const restricted=!!actor.scope&&!actor.scope.propertyIds.includes('*')
 const scope=restricted?` AND (${inIds("json_extract(r.data,'$.propertyId')")} OR (json_extract(r.data,'$.propertyId') IS NULL AND k.booking IS NOT NULL))`:''
 const scopeParams=restricted?[homes]:[]
 // A message with a missing booking retains its unmatched contact/ref thread,
 // exactly as the native inbox does; shared email alone never merges guests.
 const key=`COALESCE(k.key,CASE WHEN json_extract(r.data,'$.email') IS NOT NULL THEN 'e:'||json_extract(r.data,'$.email') WHEN json_extract(r.data,'$.phone') IS NOT NULL THEN 'p:'||json_extract(r.data,'$.phone') ELSE 'r:'||COALESCE(json_extract(r.data,'$.ref'),'unknown') END)`
 const cte=`WITH keys AS MATERIALIZED (SELECT json_extract(value,'$[0]') booking,json_extract(value,'$[1]') key FROM json_each(?)),
 message_rows AS (SELECT r.id,r.data,${key} key FROM cb_records r LEFT JOIN keys k ON k.booking=json_extract(r.data,'$.bookingId') WHERE r.kind='messages' AND json_extract(r.data,'$.status')!='discarded'${scope})`
 const needle=query.toLowerCase(), match=`instr(lower(COALESCE(json_extract(data,'$.text'),'')||' '||COALESCE(json_extract(data,'$.subject'),'')||' '||COALESCE(json_extract(data,'$.email'),'')||' '||COALESCE(json_extract(data,'$.phone'),'')||' '||COALESCE(json_extract(data,'$.ref'),'')),?)>0`
 const activity=`${cte}, activity AS (
 SELECT key,COALESCE(json_extract(data,'$.sentAt'),json_extract(data,'$.createdAt'),'') at,CASE WHEN json_extract(data,'$.status') IN ('draft','drafting') THEN 1 ELSE 0 END draft,CASE WHEN ?='' OR ${match} THEN 1 ELSE 0 END matched FROM message_rows
 UNION ALL SELECT k.key,COALESCE(json_extract(r.data,'$.approvedAt'),''),0,CASE WHEN ?='' OR instr(lower(COALESCE(json_extract(r.data,'$.guestName'),'')||' '||COALESCE(json_extract(r.data,'$.guestEmail'),'')||' '||COALESCE(json_extract(r.data,'$.guestPhone'),'')||' '||COALESCE(json_extract(r.data,'$.channelRef'),'')||' '||COALESCE(json_extract(r.data,'$.summary'),'')||' '||COALESCE(p.name,'')),?)>0 THEN 1 ELSE 0 END FROM cb_records r JOIN keys k ON k.booking=r.id LEFT JOIN cb_properties p ON p.id=json_extract(r.data,'$.propertyId') WHERE r.kind='bookings' AND COALESCE(json_extract(r.data,'$.kind'),'stay')='stay'
 UNION ALL SELECT k.key,COALESCE(json_extract(r.data,'$.sentAt'),''),0,0 FROM cb_records r JOIN keys k ON k.booking=json_extract(r.data,'$.bookingId') WHERE r.kind='scheduled'
 ), grouped AS (SELECT key,MAX(at) lastAt,SUM(draft) drafts FROM activity GROUP BY key HAVING MAX(matched)=1)`
 const params=[mapping,...scopeParams,needle,needle,needle,needle]
 const summary=await db.prepare(`${activity} SELECT (SELECT COUNT(*) FROM grouped) total, (SELECT json_group_array(json_object('key',key,'lastAt',lastAt,'drafts',drafts)) FROM (SELECT * FROM grouped ORDER BY (drafts>0) DESC,lastAt DESC,key LIMIT ? OFFSET ?)) rows`).bind(...params,THREADS,(page-1)*THREADS).first<{total:number;rows:string}>()
 const total=Number(summary?.total??0), pages=Math.max(1,Math.ceil(total/THREADS))
 if(page>pages)throw Object.assign(new Error('That guest page is no longer available. Search again from the first page.'),{status:400})
 const selected: {key:string;lastAt:string;drafts:number}[]=JSON.parse(summary?.rows??'[]')
 const requested=url.searchParams.get('thread')
 let openKey=requested?keys.find(([,key])=>threadId(key)===requested)?.[1]:selected[0]?.key
 // Unmatched conversations have no booking in keys; resolve their stable id
 // against distinct SQL keys without transferring any guest message body.
 if(requested&&!openKey){const candidates=await db.prepare(`${cte} SELECT DISTINCT key FROM message_rows`).bind(mapping,...scopeParams).all<{key:string}>();openKey=candidates.results.find(r=>threadId(r.key)===requested)?.key}
 const selectedKeys=new Set([...selected.map(r=>r.key),...(openKey?[openKey]:[])])
 const selectedBookings=JSON.stringify(keys.filter(([,key])=>selectedKeys.has(key)).map(([id])=>id))
 await records(db,data,['bookings'],inIds('id'),[selectedBookings])
 await records(db,data,['guests','scheduled'],inIds("json_extract(data,'$.bookingId')"),[selectedBookings])
 await records(db,data,['homeSettings','threadCases'],inIds("json_extract(data,'$.propertyId')"),[homes])
 await records(db,data,['inbox'])
 await records(db,data,['codes'],inIds("json_extract(data,'$.bookingId')"),[selectedBookings])
 const make=(key:string):Thread=>{
  const stays=data.bookings.filter(b=>keysByBooking.get(b.id)===key&&(b.kind??'stay')==='stay').sort((a,b)=>a.start.localeCompare(b.start)), named=[...stays].reverse().find(b=>b.guestName), first=stays[0]
  const email=key.startsWith('e:')?key.slice(2):stays.find(b=>b.guestEmail)?.guestEmail??null,phone=key.startsWith('p:')?key.slice(2):stays.find(b=>b.guestPhone)?.guestPhone??null
  const summary=selected.find(r=>r.key===key)
  return {id:threadId(key),key,name:named?.guestName??(email?email.split('@')[0]:phone??(first?.summary&&!/^(reserved|not available|blocked)/i.test(first.summary)?first.summary:`${({airbnb:'Airbnb',vrbo:'Vrbo','booking.com':'Booking.com',direct:'Direct'} as Record<string,string>)[first?.channel]??''} guest`.trim())),email,phone,stays,messages:[],scheduled:data.scheduled.filter(s=>stays.some(b=>b.id===s.bookingId)),drafts:summary?.drafts??0,lastAt:summary?.lastAt??''}
 }
 const keysByBooking=new Map(keys), list=selected.map(r=>make(r.key)), open=openKey?(list.find(t=>t.key===openKey)??make(openKey)):undefined
 // A page preview and open transcript use selected booking ids, so the
 // ordinary booking index narrows each read before touching message bodies.
 const previewRows=await Promise.all(list.map(async t=>{const selection=messageSelection(keys,t.key,scope,scopeParams);const row=await db.prepare(`SELECT r.data FROM cb_records r WHERE ${selection.where} AND json_extract(r.data,'$.status') NOT IN ('draft','drafting') ORDER BY COALESCE(json_extract(r.data,'$.sentAt'),json_extract(r.data,'$.createdAt')) DESC,r.id DESC LIMIT 1`).bind(...selection.params).first<{data:string}>();return {t,message:row?JSON.parse(row.data):undefined}}))
 for(const {t,message} of previewRows)if(message)t.messages=[message]
 let messageTotal=0,latestIncoming:any
 if(open){
  const selection=messageSelection(keys,open.key,scope,scopeParams),order="COALESCE(json_extract(r.data,'$.sentAt'),json_extract(r.data,'$.createdAt')) DESC,r.id DESC"
  const results=await db.batch<any>([
   db.prepare(`SELECT COUNT(*) n FROM cb_records r WHERE ${selection.where}`).bind(...selection.params),
   db.prepare(`SELECT r.data FROM cb_records r WHERE ${selection.where} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...selection.params,MESSAGES,(messagePage-1)*MESSAGES),
   db.prepare(`SELECT r.data FROM cb_records r WHERE ${selection.where} AND json_extract(r.data,'$.direction')='in' ORDER BY ${order} LIMIT 1`).bind(...selection.params),
  ])
  messageTotal=Number(results[0].results[0].n)
  if(messagePage>Math.max(1,Math.ceil(messageTotal/MESSAGES)))throw Object.assign(new Error('That message page is no longer available. Reopen this guest conversation.'),{status:400})
  open.messages=results[1].results.map((r:any)=>JSON.parse(r.data)).reverse();data.messages=open.messages
  latestIncoming=results[2].results[0]?JSON.parse(results[2].results[0].data):undefined
 }
 const replyIds=JSON.stringify([...new Set((open?.messages??[]).map(m=>m.replyTo).filter(Boolean))])
 const references=await db.prepare(`SELECT data FROM cb_records WHERE kind='messages' AND ${inIds('id')}`).bind(replyIds).all<{data:string}>()
 data.messages=[...data.messages,...references.results.map(r=>JSON.parse(r.data)),...(latestIncoming?[latestIncoming]:[])]
 // Metadata must cross the same read projection as the ordinary state. In
 // particular previews must not retain authority objects or scoped secrets.
 const messageRows=[...list.flatMap(t=>t.messages),...(open?.messages??[]),...(latestIncoming?[latestIncoming]:[])]
 const projected=projectState({...data,messages:messageRows},actor), visibleMessages=new Map(projected.messages.map(m=>[m.id,m])), visibleBookings=new Map(projected.bookings.map(b=>[b.id,b])),visibleScheduled=new Map(projected.scheduled.map(r=>[r.id,r]))
 for(const t of new Set([...list,...(open?[open]:[])])){t.messages=t.messages.map(m=>visibleMessages.get(m.id)).filter((m):m is NonNullable<typeof m>=>!!m);t.stays=t.stays.map(b=>visibleBookings.get(b.id)).filter((b):b is NonNullable<typeof b>=>!!b);t.scheduled=t.scheduled.map(r=>visibleScheduled.get(r.id)).filter((r):r is NonNullable<typeof r>=>!!r)}
 latestIncoming=latestIncoming?visibleMessages.get(latestIncoming.id):undefined
 return {query,page,size:THREADS,total,pages,threads:list,open,messagePage,messageSize:MESSAGES,messageTotal,messagePages:Math.max(1,Math.ceil(messageTotal/MESSAGES)),latestIncoming}
}
