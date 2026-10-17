import { type Actor, type Context, type Query, newId, query, kinds } from '../model'
export interface Scope { sourceVersion?:number; kind?:string; id?:string|null; propertyId?:string|null; bookingId?:string|null; revision?:string|null; result?:string; facts?:{ role?:string; active?:boolean; channel?:string; lockState?:string } }
const results=new Set(['removed','draft','pending','sending','sent','suppressed','failed','unavailable','skipped','cancelled','confirmed','approved','completed','closed','revoked','issued','active','undone','set','manual','error','posted','matched','unmatched','accepted','declined','expired','ready','proposed','escalated','open','unassigned','received','drafting','discarded','scheduled','ok','stale','held','paid','uncertain','rejected','exported'])
const revision=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)?String(v):typeof v==='string'&&/^(?:[\da-f-]{16,80}|\d+)$/.test(v)?v:null
/** Only application identifiers, revisions and controlled outcomes. Never accepts a business record as event data. */
export type AuditActor=Pick<Actor,'id'|'isAgent'|'operatorVersion'|'keyId'>&{role:string}
export function event(actor:AuditActor,action:string,at:string,scope:Scope={}):Query {
 const actorKind=actor.isAgent?'agent':actor.role==='guest'||action.startsWith('guest.')||action.startsWith('recovery.guest.')?'guest':actor.role==='system'?'automation':'human'
 return query('INSERT INTO cb_events(id,actor_id,actor_role,action,entity_id,at,actor_kind,actor_key_id,entity_kind,property_id,booking_id,source_revision,result,actor_version,facts,source_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',newId(),actor.id,actor.role,action,scope.id??null,at,actorKind,actor.keyId??null,scope.kind??null,scope.propertyId??null,scope.bookingId??null,revision(scope.revision),scope.result??'completed',actor.operatorVersion,JSON.stringify(scope.facts??{}),scope.sourceVersion??null)
}
const state=(row:any,action:string)=>action.startsWith('privacy.')?'erased':action.startsWith('lock.')&&results.has(row.lock?.state)?row.lock.state:results.has(row.status)?row.status:results.has(row.phase)?row.phase:results.has(row.match)?row.match:'completed'
export function changes(c:Context,name:string,root=true):Query[] {
 const out:Query[]=[],seen=new Set<string>()
 const add=(kind:string,row:any)=>{const key=kind+':'+row.id;if(seen.has(key))return;seen.add(key);const actor=c.actor.role==='system'&&row.source==='ai'&&['drafting','draft'].includes(row.status)?{...c.actor,isAgent:true,id:'cabin:ai-replies'}:c.actor;const statement=kind==='statements'?row:c.data.statements.find(s=>s.id===row.statementId),turnover=c.data.turnovers.find(t=>t.id===row.turnoverId),bookings=[...new Set([row.bookingId,row.nextBookingId,turnover?.bookingId,turnover?.nextBookingId,...(statement?.lines?.map((l:any)=>l.bookingId)??[]),...(kind==='bookings'?[row.id]:[])].filter(Boolean))];for(const bookingId of bookings.length?bookings:[null])out.push(event(actor,name,c.now,{kind,id:row.id,sourceVersion:c.before.version,propertyId:row.propertyId??(kind==='property'?row.id:null),bookingId,revision:row.revision??(kind==='ledger-journal'?row.id:null),result:state(row,name),facts:{...(row.role==='manager'||row.role==='cleaner'?{role:row.role}:{}),...(typeof row.active==='boolean'?{active:row.active}:{}),...(['email','sms','airbnb','vrbo','booking.com','direct'].includes(row.channel)?{channel:row.channel}:{}),...(results.has(row.lock?.state)?{lockState:row.lock.state}:{})}}))}
 for(const kind of kinds){const before=new Map(c.before[kind].map(r=>[r.id,JSON.stringify(r)]));for(const row of c.data[kind])if(before.get(row.id)!==JSON.stringify(row))add(kind,row);const kept=new Set(c.data[kind].map(r=>r.id));for(const row of c.before[kind])if(!kept.has(row.id))add(kind,{...row,status:'removed'})}
 for(const approval of c.data.approvals)if(!c.before.approvals.some(a=>a.id===approval.id))out.push(event(c.actor,'approval.'+approval.kind,c.now,{kind:approval.kind,id:approval.recordId,sourceVersion:c.before.version,revision:approval.revision,result:'approved'}))
 for(const q of c.queries){
  if(q.sql.startsWith('INSERT INTO cb_properties'))add('property',{id:q.params[0],revision:q.params[5]})
  else if(q.sql.startsWith('INSERT INTO cb_members'))add('member',{id:q.params[0],revision:q.params[5],role:q.params[3],active:!!q.params[4]})
  else if(q.sql.startsWith('UPDATE cb_direct_stays SET data=')){const row=JSON.parse(q.params[0]);add('direct-stay',row)}
  else if(q.sql.startsWith('INSERT INTO cb_direct_stays')){const raw=q.params.find(p=>typeof p==='string'&&p.startsWith('{'));if(raw)add('direct-stay',JSON.parse(raw))}
  else if(q.sql.startsWith('INSERT INTO cb_finance_connections'))add('finance-connection',{id:'books-connection',revision:c.before.version})
  else if(q.sql.startsWith('INSERT INTO cb_ledger_journals'))add('ledger-journal',JSON.parse(q.params.at(-1)))
 }
 for(const scope of c.audit??[]){out.push(event(c.actor,name,c.now,{sourceVersion:c.before.version,...scope}));if(scope.id)seen.add((scope.kind??'')+':'+scope.id)}
 if(root&&(!out.length||c.entityId&&![...seen].some(key=>key.slice(key.indexOf(':')+1)===c.entityId)))out.push(event(c.actor,name,c.now,{id:c.entityId,sourceVersion:c.before.version}))
 return out
}

export async function record(db:D1Database,actor:AuditActor,action:string,scope:Scope){const q=event(actor,action,new Date().toISOString(),scope);await db.prepare(q.sql).bind(...q.params).run()}
