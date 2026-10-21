import { addDays } from '../inventory'
import { localDay } from '../clock'
import { homeSettings } from '../homes'
import { type Actor, type Data } from '../model'
import { isDay, DAYS, SPANS } from '../ui/calendar-grid'
import { records, inIds, scoped } from './core'

interface BookingIndex { id:string; propertyId:string; start:string; end:string; status:string; kind:string; channel:string; connectionId?:string }
export async function calendarData(db:D1Database, _actor:Actor, data:Data, url:URL) {
 const homes = scoped(data)
 await records(db,data,['homeSettings','feeds','connections','calendarDrafts','readinessPlans','readinessRecords','recoveries','recoveryPolicies','statements'],inIds("json_extract(data,'$.propertyId')"),[homes])
 const index = (await db.prepare(`SELECT id,json_extract(data,'$.propertyId') propertyId,json_extract(data,'$.start') start,json_extract(data,'$.end') end,json_extract(data,'$.status') status,COALESCE(json_extract(data,'$.kind'),'stay') kind,json_extract(data,'$.channel') channel,json_extract(data,'$.connectionId') connectionId FROM cb_records WHERE kind='bookings' AND ${inIds("json_extract(data,'$.propertyId')")}`).bind(homes).all<BookingIndex>()).results
 const one = data.properties.find(p => p.id === url.searchParams.get('home'))
 const today = data.properties.length ? localDay(Date.now(),homeSettings(data,one?.id ?? data.properties[0].id).timeZone) : new Date().toISOString().slice(0,10)
 const chosen = isDay(url.searchParams.get('from')) ? url.searchParams.get('from')! : today
 const mode = SPANS.some(([n]) => String(n) === url.searchParams.get('days')) ? Number(url.searchParams.get('days')) : DAYS
 const from = mode === DAYS ? chosen.slice(0,7)+'-01' : chosen
 const days = mode === DAYS ? new Date(Date.UTC(Number(from.slice(0,4)),Number(from.slice(5,7)),0)).getUTCDate() : mode
 const end = addDays(from,days), ids = new Set<string>(), byHome = new Map<string,BookingIndex[]>()
 for (const b of index) { if (b.start.slice(0,10)<end && b.end.slice(0,10)>from || b.id===url.searchParams.get('reservation')) ids.add(b.id); if(b.status==='confirmed'){const rows=byHome.get(b.propertyId)??[];rows.push(b);byHome.set(b.propertyId,rows)} }
 const selected=index.find(b=>b.id===url.searchParams.get('reservation'))
 if(selected)for(const b of index)if(b.propertyId===selected.propertyId&&b.start.slice(0,10)<selected.end.slice(0,10)&&selected.start.slice(0,10)<b.end.slice(0,10))ids.add(b.id)
 // Readiness uses the preceding occupied stay, even when it is outside this month.
 for (const rows of byHome.values()) {
  rows.sort((a,b)=>a.start.localeCompare(b.start))
  const next=rows.find(b=>b.kind==='stay'&&b.start.slice(0,10)>=today);if(next)ids.add(next.id)
  const arrivals=rows.filter(b=>ids.has(b.id)&&b.kind==='stay')
  for(const arrival of arrivals){const before=rows.filter(b=>b.end.slice(0,10)<=arrival.start.slice(0,10)).at(-1);if(before)ids.add(before.id)}
  if(!next){const before=rows.filter(b=>b.end.slice(0,10)<=today).at(-1);if(before)ids.add(before.id)}
 }
 const bookings=JSON.stringify([...ids])
 await records(db,data,['bookings'],inIds('id'),[bookings])
 await records(db,data,['guests'],inIds("json_extract(data,'$.bookingId')"),[bookings])
 let parents=[...new Set(data.guests.map(g=>g.mergedInto).filter((id):id is string=>!!id&&!data.guests.some(g=>g.id===id)))]
 while(parents.length){const seen=new Set(parents);await records(db,data,['guests'],inIds('id'),[JSON.stringify(parents)]);parents=[...new Set(data.guests.map(g=>g.mergedInto).filter((id):id is string=>!!id&&!seen.has(id)&&!data.guests.some(g=>g.id===id)))]}
 // Latest completed cover photos, pending work, and every turnover attached to
 // the visible inventory/preceding stays. No historical message bodies load.
 await records(db,data,['turnovers'],`${inIds("json_extract(data,'$.propertyId')")} AND (${inIds("json_extract(data,'$.bookingId')")} OR json_extract(data,'$.status')='draft' OR (json_extract(data,'$.dueDate')>=? AND json_extract(data,'$.dueDate')<=?) OR id IN (SELECT id FROM (SELECT id,row_number() OVER (PARTITION BY json_extract(data,'$.propertyId') ORDER BY json_extract(data,'$.completion.completedAt') DESC,id) n FROM cb_records WHERE kind='turnovers' AND json_extract(data,'$.status')='completed' AND json_extract(data,'$.completion.photoId') IS NOT NULL) WHERE n=1))`,[homes,bookings,from,end])
 await records(db,data,['tasks'],`${inIds("json_extract(data,'$.propertyId')")} AND json_extract(data,'$.status')='open'`,[homes])
 await records(db,data,['requests'],`${inIds("json_extract(data,'$.propertyId')")} AND json_extract(data,'$.status')='declined' AND substr(json_extract(data,'$.start'),1,10)<? AND substr(json_extract(data,'$.end'),1,10)>?`,[homes,end,from])
 await records(db,data,['codes','notices'],`${inIds("json_extract(data,'$.propertyId')")} AND (${inIds("json_extract(data,'$.bookingId')")} OR ${inIds("json_extract(data,'$.turnoverId')")} OR ${inIds("json_extract(data,'$.recordId')")})`,[homes,bookings,JSON.stringify(data.turnovers.map(t=>t.id)),JSON.stringify(data.turnovers.map(t=>t.id))])
 const balanceBookingIds=data.bookings.filter(b=>b.id===url.searchParams.get('reservation')||b.start.slice(0,10)<end&&b.end.slice(0,10)>from).map(b=>b.id)
 const calendarSources=[...new Map(index.filter(b=>b.status==='confirmed'&&b.channel!=='direct').map(b=>[JSON.stringify([b.propertyId,b.channel,b.connectionId]),{propertyId:b.propertyId,channel:b.channel,connectionId:b.connectionId}])).values()]
 return {calendarSources,balanceBookingIds}
}
