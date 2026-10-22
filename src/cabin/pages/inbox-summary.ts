export interface InboxSummaryOptions {
 /** JSON [booking id, reviewed guest thread key] pairs for permitted bookings. */
 mapping: string
 query: string
 page: number
 size: number
 /** The message scope and bindings already used by inboxData/messageSelection. */
 scope: string
 scopeParams: unknown[]
}
export interface InboxSummaryRow { key: string; lastAt: string; drafts: number }
export interface InboxSummary { total: number; rows: InboxSummaryRow[] }

// Keep these expressions identical to the ordinary expression index in 0062.
const booking = "json_extract(r.data,'$.bookingId')"
const contact = "CASE WHEN json_extract(r.data,'$.email') IS NOT NULL THEN 'e:'||json_extract(r.data,'$.email') WHEN json_extract(r.data,'$.phone') IS NOT NULL THEN 'p:'||json_extract(r.data,'$.phone') ELSE 'r:'||COALESCE(json_extract(r.data,'$.ref'),'unknown') END"
const at = "COALESCE(json_extract(r.data,'$.sentAt'),json_extract(r.data,'$.createdAt'),'')"
const draft = "CASE WHEN json_extract(r.data,'$.status') IN ('draft','drafting') THEN 1 ELSE 0 END"
const retained = "r.kind='messages' AND json_extract(r.data,'$.status')!='discarded'"
const search = "lower(COALESCE(json_extract(r.data,'$.text'),'')||' '||COALESCE(json_extract(r.data,'$.subject'),'')||' '||COALESCE(json_extract(r.data,'$.email'),'')||' '||COALESCE(json_extract(r.data,'$.phone'),'')||' '||COALESCE(json_extract(r.data,'$.ref'),''))"
const bookingSearch = "lower(COALESCE(json_extract(r.data,'$.guestName'),'')||' '||COALESCE(json_extract(r.data,'$.guestEmail'),'')||' '||COALESCE(json_extract(r.data,'$.guestPhone'),'')||' '||COALESCE(json_extract(r.data,'$.channelRef'),'')||' '||COALESCE(json_extract(r.data,'$.summary'),'')||' '||COALESCE(p.name,''))"
const messages = 'cb_records r INDEXED BY cb_records_inbox_activity'
const stays = "r.kind='bookings' AND COALESCE(json_extract(r.data,'$.kind'),'stay')='stay'"
const keys = "keys AS MATERIALIZED (SELECT json_extract(value,'$[0]') booking,json_extract(value,'$[1]') key FROM json_each(?))"

/** Group the covering message index before joining reviewed guest identities. */
function allActivity(scope: string) {
 return `message_activity AS MATERIALIZED (
  SELECT ${booking} booking,${contact} contact,MAX(${at}) at,SUM(${draft}) drafts
  FROM ${messages} WHERE ${retained}${scope}
  GROUP BY ${booking},${contact}
 ), activity AS (
  SELECT COALESCE(k.key,m.contact) key,m.at,m.drafts,1 eligible
  FROM message_activity m LEFT JOIN keys k ON k.booking=m.booking
  UNION ALL SELECT k.key,COALESCE(json_extract(r.data,'$.approvedAt'),''),0,1
  FROM cb_records r JOIN keys k ON k.booking=r.id WHERE ${stays}
  UNION ALL SELECT k.key,COALESCE(json_extract(r.data,'$.sentAt'),''),0,0
  FROM cb_records r JOIN keys k ON k.booking=${booking} WHERE r.kind='scheduled'
 )`
}

/** Find matches first; only then read all activity of those complete threads. */
function matchingActivity(scope: string) {
 return `message_matches AS MATERIALIZED (
  SELECT ${booking} booking,${contact} contact FROM ${messages}
  WHERE ${retained}${scope} AND instr(${search},?)>0
 ), matched AS MATERIALIZED (
  SELECT COALESCE(k.key,m.contact) key FROM message_matches m LEFT JOIN keys k ON k.booking=m.booking
  UNION SELECT k.key FROM cb_records r JOIN keys k ON k.booking=r.id
  LEFT JOIN cb_properties p ON p.id=json_extract(r.data,'$.propertyId')
  WHERE ${stays} AND instr(${bookingSearch},?)>0
 ), matched_bookings AS MATERIALIZED (
  SELECT k.booking,k.key FROM keys k JOIN matched m ON m.key=k.key
 ), matched_contacts AS MATERIALIZED (
  SELECT key FROM matched WHERE substr(key,1,2) IN ('e:','p:','r:')
 ), activity AS (
  SELECT k.key,${at} at,${draft} drafts,1 eligible
  FROM matched_bookings k CROSS JOIN ${messages}
  WHERE ${retained} AND ${booking}=k.booking${scope}
  UNION ALL SELECT m.key,${at},${draft},1
  FROM matched_contacts m CROSS JOIN ${messages}
  WHERE ${retained} AND ${contact}=m.key
  AND NOT EXISTS (SELECT 1 FROM keys k WHERE k.booking=${booking})${scope}
  UNION ALL SELECT k.key,COALESCE(json_extract(r.data,'$.approvedAt'),''),0,1
  FROM matched_bookings k JOIN cb_records r ON r.id=k.booking WHERE ${stays}
  UNION ALL SELECT k.key,COALESCE(json_extract(r.data,'$.sentAt'),''),0,0
  FROM matched_bookings k CROSS JOIN cb_records r
  WHERE r.kind='scheduled' AND ${booking}=k.booking
 )`
}

/** Exact literal search, truthful counts, and an explicit page of whole threads. */
export async function inboxSummary(db: D1Database, options: InboxSummaryOptions): Promise<InboxSummary> {
 const { mapping, query, page, size, scopeParams } = options
 // A scope's null-property exception uses the complete permitted mapping,
 // even when the search narrows activity to just a few reviewed guest roots.
 const scope = options.scope.replaceAll('k.booking IS NOT NULL',`${booking} IN (SELECT booking FROM keys)`)
 const needle = query.toLowerCase()
 const activity = needle ? matchingActivity(scope) : allActivity(scope)
 const params = needle
  ? [mapping,...scopeParams,needle,needle,...scopeParams,...scopeParams]
  : [mapping,...scopeParams]
 const result = await db.prepare(`WITH ${keys},${activity}, grouped AS (
  SELECT key,MAX(at) lastAt,SUM(drafts) drafts FROM activity GROUP BY key HAVING MAX(eligible)=1
 ) SELECT (SELECT COUNT(*) FROM grouped) total,
  (SELECT json_group_array(json_object('key',key,'lastAt',lastAt,'drafts',drafts))
   FROM (SELECT * FROM grouped ORDER BY (drafts>0) DESC,lastAt DESC,key LIMIT ? OFFSET ?)) rows`
 ).bind(...params,size,(page-1)*size).first<{total:number;rows:string}>()
 return { total:Number(result?.total??0), rows:JSON.parse(result?.rows??'[]') }
}
