import type {Bindings} from '../../auth.server'
import {load,mutate,SYSTEM} from '../storage'
import {newId} from '../model'
import {requestGuestCheck,issueNotice} from './records'

export async function advanceIssueChecks(env:Bindings){
 const data=await load(env.DB)
 const due=data.recoveries.filter(r=>r.issue&&!r.restorePaused&&!['closed','undone'].includes(r.status)).filter(r=>{
  const i=r.issue!,t=data.tasks.find(t=>t.id===i.taskId)
  return t?.status==='closed'&&t.work?.accepted&&t.work.inspected&&(!i.workRevision||!i.confirmationMessageId||!!i.recurrenceDueAt&&!i.recurrenceRequestedAt&&Date.parse(i.recurrenceDueAt)<=Date.now())
 })
 if(!due.length)return
 await mutate(env.DB,SYSTEM,'issue.followup',c=>{
  for(const old of due){const r=c.data.recoveries.find(r=>r.id===old.id)!,i=r.issue!,task=c.data.tasks.find(t=>t.id===i.taskId)
   if(!task?.work?.inspected||task.status!=='closed')continue
   i.workRevision=task.revision;i.inspectedAt=task.work.inspected.at
   if(!i.confirmationMessageId){if(!requestGuestCheck(c,r,env.AUTH_ORIGIN)){r.status='escalated';i.confirmationMessageId='human-contact-required';issueNotice(c,r,'Guest confirmation cannot be delivered','No active private stay link or verified contact. A person must obtain a current guest response; this case cannot close automatically.')}}
   else if(i.recurrenceDueAt&&!i.recurrenceRequestedAt&&Date.parse(i.recurrenceDueAt)<=Date.parse(c.now))requestGuestCheck(c,r,env.AUTH_ORIGIN,true)
   r.revision=newId()
  }
 })
}
