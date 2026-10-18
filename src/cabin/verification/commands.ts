import type { Bindings } from '../../auth.server'
import { need,text,type Actor } from '../model'
import { mutate } from '../storage'
import { currentCase,mayReview,saveVerification,resolved } from './records'
export async function verificationCommand(env:Bindings,actor:Actor,name:string,p:Record<string,unknown>){
 if(!name.startsWith('direct.verification.'))return undefined
 return mutate(env.DB,actor,name,async c=>{
  const v=currentCase(c,text(p.id,'verification case'),p.revision);need(mayReview(actor,v),'Only the assigned reviewer or installation owner can review this identity check',403)
  need(v.status!=='erased','This verification was erased',409)
  if(name==='direct.verification.assign'){
   need(actor.role==='owner','Only the installation owner can reassign verification review',403)
   const id=text(p.reviewerId,'reviewer'),member=c.data.members.find(m=>m.id===id&&m.active&&m.role==='manager'),owner=await c.db.prepare("SELECT id,email FROM oa_operators WHERE id=? AND status='active' AND role='owner'").bind(id).first<{id:string;email:string}>();need(member||owner,'Choose an active manager or owner');v.policy.reviewerId=id;v.policy.reviewerEmail=owner?.email??member!.email
   v.history.push({at:c.now,by:actor.id,action:'Responsible reviewer reassigned'});saveVerification(c,v);return {id:v.id}
  }
  need(name==='direct.verification.decide','Unknown verification command',404)
  need(!resolved(v)&&v.status!=='rejected','This verification already has a final decision',409)
  need(v.consentMethod==='manual'&&v.consentAt,'The guest must request and consent to manual review first',409)
  const outcome=text(p.outcome,'decision');need(outcome==='approved'||outcome==='rejected','Choose approve or reject')
  v.decision={by:actor.id,at:c.now,outcome,method:text(p.method,'review method',200),reference:text(p.reference,'evidence reference (no document numbers)',300),reason:text(p.reason,'decision reason (no identity document data)',500)}
  v.status=outcome;v.history.push({at:c.now,by:actor.id,action:'Manual review '+outcome});saveVerification(c,v);return {id:v.id,status:v.status}
 })
}
