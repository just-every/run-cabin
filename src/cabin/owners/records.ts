import { need, text, integer, type Data, type Property } from '../model'
export interface OwnerPolicy { propertyId:string; email:string; revision:string; calendarVisibility:'hidden'|'availability'|'stays'; expenseLimitCents:number; maxStayNights:number; noticeDays:number; agreement:string; updatedAt:string; updatedBy:string }
export interface OwnerGrant { statementId:string; email:string; grantedAt:string; grantedBy:string; reason:string; revokedAt:string|null }
export interface OwnerView { id:string; statementId:string; revision:string; email:string; ownerName:string; viewedAt:string; action:'view'|'download' }
export interface OwnerDocument { id:string; propertyId:string; email:string; title:string; kind:'invoice'|'document'; content:string; createdAt:string; createdBy:string; withdrawnAt:string|null }
export interface OwnerExpense { id:string; propertyId:string; email:string; revision:string; description:string; amountCents:number; documentId:string|null; status:'pending'|'approved'|'declined'|'withdrawn'; requestedAt:string; requestedBy:string; decidedAt:string|null; decisionNote:string }
export interface OwnerStay { id:string; propertyId:string; email:string; revision:string; start:string; end:string; note:string; status:'pending'|'approved'|'declined'|'cancelled'; requestedAt:string; decidedAt:string|null; decidedBy:string|null; decisionNote:string; bookingId:string|null }
export const sameEmail=(a:string,b:string)=>a.trim().toLowerCase()===b.trim().toLowerCase()
export const optionalText=(value:unknown,label:string,max=1000)=>value===undefined||value===null||value===''?'':text(value,label,max)
export function numberInput(value:unknown,label:string,min=0,max=100_000_000){need(typeof value==='number'||typeof value==='string'&&/^\d+$/.test(value),`Enter ${label} as a whole number`);return integer(Number(value),label,min,max)}
export function policyFor(policies:OwnerPolicy[],p:Property):OwnerPolicy {
 return policies.find(r=>r.propertyId===p.id&&sameEmail(r.email,p.ownerEmail))??{propertyId:p.id,email:p.ownerEmail,revision:'',calendarVisibility:'availability',expenseLimitCents:0,maxStayNights:0,noticeDays:0,agreement:'Your manager has shared availability. Expense approvals and personal stay requests need an agreement.',updatedAt:'',updatedBy:''}
}
export async function ownerRecords(db:D1Database){
 const rows=await db.batch([
  db.prepare('SELECT property_id AS propertyId,email,revision,calendar_visibility AS calendarVisibility,expense_limit_cents AS expenseLimitCents,max_stay_nights AS maxStayNights,notice_days AS noticeDays,agreement,updated_at AS updatedAt,updated_by AS updatedBy FROM cb_owner_policies'),
  db.prepare('SELECT statement_id AS statementId,email,granted_at AS grantedAt,granted_by AS grantedBy,reason,revoked_at AS revokedAt FROM cb_owner_statement_grants'),
  db.prepare("SELECT v.id,v.statement_id AS statementId,v.revision,COALESCE(json_extract(s.data,'$.ownerEmail'),'') AS email,COALESCE(json_extract(s.data,'$.ownerName'),'Former rental owner') AS ownerName,v.viewed_at AS viewedAt,v.action FROM cb_owner_statement_views v LEFT JOIN cb_records s ON s.id=v.statement_id AND s.kind='statements' ORDER BY v.viewed_at DESC,v.id DESC"),
  db.prepare('SELECT id,property_id AS propertyId,email,title,kind,content,created_at AS createdAt,created_by AS createdBy,withdrawn_at AS withdrawnAt FROM cb_owner_documents'),
  db.prepare('SELECT id,property_id AS propertyId,email,revision,description,amount_cents AS amountCents,document_id AS documentId,status,requested_at AS requestedAt,requested_by AS requestedBy,decided_at AS decidedAt,decision_note AS decisionNote FROM cb_owner_expenses'),
  db.prepare('SELECT id,property_id AS propertyId,email,revision,start,end,note,status,requested_at AS requestedAt,decided_at AS decidedAt,decided_by AS decidedBy,decision_note AS decisionNote,booking_id AS bookingId FROM cb_owner_stay_requests'),
 ])
 return {policies:rows[0].results as unknown as OwnerPolicy[],grants:rows[1].results as unknown as OwnerGrant[],views:rows[2].results as unknown as OwnerView[],documents:rows[3].results as unknown as OwnerDocument[],expenses:rows[4].results as unknown as OwnerExpense[],stayRequests:rows[5].results as unknown as OwnerStay[]}
}
export function stayDates(data:Data,policy:OwnerPolicy,input:{start:unknown;end:unknown},now=new Date()){
 const date=(value:unknown,label:string)=>{const v=text(value,label,10),time=Date.parse(v+'T00:00:00Z');need(/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===v,`Enter a valid ${label}`);return v}
 const start=date(input.start,'arrival date'),end=date(input.end,'checkout date'),count=(Date.parse(end)-Date.parse(start))/86400000
 need(policy.maxStayNights>0,'Personal stays are not enabled in your agreement',403)
 need(count>0&&count<=policy.maxStayNights,`Request between 1 and ${policy.maxStayNights} nights`)
 const zone=data.homeSettings.find(s=>s.propertyId===policy.propertyId)?.timeZone??'UTC'
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),part=(type:string)=>parts.find(p=>p.type===type)!.value
 const today=`${part('year')}-${part('month')}-${part('day')}`
 need(Date.parse(start)>=Date.parse(today)+policy.noticeDays*86400000,`Give at least ${policy.noticeDays} days’ notice`,409)
 return {start,end}
}
