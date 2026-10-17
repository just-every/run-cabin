import { type Context, manager, owner, need, text, integer, newId, property, query } from '../model'
import { journals, post } from './store'
import { debit as dr, credit as cr, type Account, type Leg } from './types'
const pair=(a:Account,b:Account,n:number)=>[dr(a,n),cr(b,n)]
export const operations:Record<string,(n:number)=>Leg[]>={
 deposit:n=>pair('cash','advances',n), earn:n=>pair('receivable','ownerLiability',n),
 payment:n=>pair('cash','receivable',n), applyAdvance:n=>pair('advances','receivable',n),
 tax:n=>pair('receivable','taxes',n), taxRemittance:n=>pair('taxes','cash',n),
 hold:n=>pair('damageAuthorization','damageHolds',n), releaseHold:n=>pair('damageHolds','damageAuthorization',n),
 channelFee:n=>[...pair('channelFees','cash',n),...pair('ownerLiability','channelFees',n)],
 expense:n=>[...pair('expenses','cash',n),...pair('ownerLiability','expenses',n)],
 commission:n=>pair('ownerLiability','managerRevenue',n), refund:n=>pair('ownerLiability','cash',n),
 distribution:n=>pair('ownerLiability','cash',n),
}
export async function ledgerCommand(c:Context,name:string,p:Record<string,unknown>) {
 if(!name.startsWith('ledger.'))return undefined
 manager(c.actor)
 if(name==='ledger.configure'){
  owner(c.actor);const home=property(c,p.propertyId),legalEntity=text(p.legalEntity,'legal entity',200)
  const old=c.data.ledgerSettings.find(s=>s.propertyId===home.id)
  if(old){need(old.revision===p.revision,'Ledger settings changed',409);old.legalEntity=legalEntity;old.revision=newId();c.entityId=old.id;return old}
  const setting={id:`ledger:${home.id}`,revision:newId(),propertyId:home.id,legalEntity};c.data.ledgerSettings.push(setting);c.entityId=home.id;return setting
 }
 if(name==='ledger.close'){
  owner(c.actor);const month=text(p.month,'month',7);need(/^\d{4}-(0[1-9]|1[0-2])$/.test(month),'Choose a YYYY-MM period')
  need(!await c.db.prepare('SELECT 1 FROM cb_ledger_periods WHERE month=?').bind(month).first(),'Period already closed',409)
  c.queries.push(query('INSERT INTO cb_ledger_periods(month,closed_at,actor_id) VALUES(?,?,?)',month,c.now,c.actor.id));c.entityId=month;return {month,closedAt:c.now}
 }
 if(name==='ledger.reverse'){
  const original=(await journals(c.db)).find(j=>j.id===text(p.id,'journal'));need(original,'Journal not found',404)
  need(!original.reversalOf,'Reverse the original entry rather than a reversal',409)
  need(!(await journals(c.db)).some(j=>j.reversalOf===original.id),'This journal is already reversed',409)
  const row=await post(c,{...original,sourceKey:'reversal:'+original.id,sourceType:'correction',sourceId:original.id,sourceRevision:original.id,effectiveDate:text(p.effectiveDate,'correction date',10),reversalOf:original.id,lines:original.lines.map(l=>({...l,debitCents:l.creditCents,creditCents:l.debitCents}))});c.entityId=row.id;return row
 }
 need(name==='ledger.post','Unknown ledger command',404)
 const operation=text(p.operation,'transaction type'),build=operations[operation];need(build,'Choose a supported ledger transaction')
 const home=property(c,p.propertyId),bookingId=text(p.bookingId,'reservation'),amount=integer(Number(p.amountCents),'amount cents',1,100_000_000),sourceId=text(p.sourceId,'source document reference',200)
 const sourceRevision=text(p.sourceRevision,'source revision',200)
 const all=await journals(c.db),previous=all.filter(j=>j.propertyId===home.id&&j.sourceType===operation&&j.sourceId===sourceId)
 need(previous.every(j=>j.sourceRevision===sourceRevision||all.some(r=>r.reversalOf===j.id)), 'Source revision changed; reverse its original posting before replacing it',409)
 need(previous.every(j=>j.bookingId===bookingId),'A source reference cannot move funds to another reservation',409)
 const correction=previous.find(j=>j.sourceRevision!==sourceRevision)
 const row=await post(c,{...(correction?{ownerKey:correction.ownerKey,legalEntity:correction.legalEntity,correctionOf:correction.id}:{}),sourceKey:`manual:${home.id}:${operation}:${sourceId}:${sourceRevision}`,propertyId:home.id,bookingId,effectiveDate:text(p.effectiveDate,'effective date',10),sourceType:operation,sourceId,sourceRevision,lines:build(amount)})
 // The same evidence may be submitted again, but may never silently change amounts or scope.
 need(row.bookingId===bookingId&&row.lines.reduce((n,l)=>n+l.debitCents,0)===build(amount).reduce((n,l)=>n+l.debitCents,0)&&row.effectiveDate===p.effectiveDate&&row.sourceRevision===p.sourceRevision,'This source already has a different immutable posting; reverse it first',409)
 c.entityId=row.id;return row
}
