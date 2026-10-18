import { integer,need,newId,text,type Context } from '../model'
import type { DirectHome } from '../direct/types'
import type { VerificationPolicy } from './types'
export function configureVerification(p:Record<string,unknown>,origin:string):VerificationPolicy|undefined {
 if(p.identityMode===undefined)return undefined
 const mode=String(p.identityMode);need(['none','all','risk'].includes(mode),'Choose an identity policy')
 return {revision:newId(),mode:mode as VerificationPolicy['mode'],shortLeadDays:integer(Number(p.identityLeadDays??0),'Short booking lead days',0,365),minGuests:integer(Number(p.identityMinGuests??0),'Identity guest threshold',0,100),minTotalCents:integer(Math.round(Number(p.identityMinTotalDollars??0)*100),'Identity value threshold',0,99_999_999),reviewerId:String(p.identityReviewerId??''),reviewerEmail:'',blockAccess:p.identityBlockAccess===true||p.identityBlockAccess==='on'||p.identityBlockAccess==='true',requireBeforeConfirmation:p.identityBeforeConfirmation===true||p.identityBeforeConfirmation==='on'||p.identityBeforeConfirmation==='true',retentionDays:integer(Number(p.identityRetentionDays??30),'Verification retention days',1,365),origin}
}
export async function validateReviewer(c:Context,p:VerificationPolicy) {
 if(p.mode==='none')return
 need(p.mode!=='risk'||p.shortLeadDays>0||p.minGuests>0||p.minTotalCents>0,'Choose at least one risk criterion')
 const operator=await c.db.prepare("SELECT id,email FROM oa_operators WHERE id=? AND status='active' AND role='owner'").bind(p.reviewerId).first<{id:string;email:string}>()
 const member=c.data.members.find(m=>m.id===p.reviewerId&&m.active&&m.role==='manager')
 need(operator||member,'Assign an active manager or installation owner to identity review')
 p.reviewerEmail=operator?.email??member!.email
}
export function policyFor(home:DirectHome,owner:{id:string;email:string},origin:string):VerificationPolicy {
 return home.verificationPolicy??{revision:home.revision,mode:home.requireIdentity?'all':'none',shortLeadDays:0,minGuests:0,minTotalCents:0,reviewerId:owner.id,reviewerEmail:owner.email,blockAccess:true,requireBeforeConfirmation:true,retentionDays:30,origin}
}
export function riskReasons(p:VerificationPolicy,b:{start:string;createdAt?:string},amount?:number,guests?:number,now=Date.now()) {
 if(p.mode==='none')return []
 if(p.mode==='all')return ['Required for every reservation']
 const reasons:string[]=[]
 if(p.shortLeadDays&&Date.parse(b.start.slice(0,10)+'T00:00:00Z')-Date.parse(b.createdAt??new Date(now).toISOString())<=p.shortLeadDays*86400000)reasons.push('Booked within the saved lead-time threshold')
 if(p.minGuests&&(guests===undefined||guests>=p.minGuests))reasons.push(guests===undefined?'Party size unavailable: manual review required':'Party size meets the saved threshold')
 if(p.minTotalCents&&(amount===undefined||amount>=p.minTotalCents))reasons.push(amount===undefined?'Reservation value unavailable: manual review required':'Reservation value meets the saved threshold')
 return reasons
}
