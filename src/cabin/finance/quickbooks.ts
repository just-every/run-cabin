import type { Bindings } from '../../auth.server'
import { type Actor, manager, need, text, newId, sha } from '../model'
import { mutate } from '../storage'
import { statementCsv } from '../statements'
import { journal, type BookPosting } from './books'
/** QuickBooks users can prepare their own account mapping without connecting Pantry. */
export async function quickBooksCommand(env:Bindings,actor:Actor,input:Record<string,unknown>){
 manager(actor)
 return mutate(env.DB,actor,'books.export.prepare',async c=>{
  const s=c.data.statements.find(s=>s.id===text(input.id,'statement'))
  need(s?.status==='approved'&&s.source==='imported'&&s.revision===input.revision,'Choose this exact approved imported statement',409)
  const existing=c.data.postings.find(p=>p.statementId===s.id&&p.statementRevision===s.revision&&p.status==='exported');if(existing)return existing
  const account=(key:string,type:string)=>{const name=text(input[key],key,200);need(!/[\u0000-\u001f\u007f]/.test(name),'Account names cannot contain tabs or control characters');return {id:name,code:'',name,type,subtype:'other',active:1,revision:''}}
  const clearing=account('clearingName','asset'),owner=account('ownerName','liability'),income=account('managementName','income')
  need(new Set([clearing.name,owner.name,income.name]).size===3,'Choose three distinct QuickBooks accounts')
  const lines=journal(s,c.data.payouts.filter(p=>s.payoutIds?.includes(p.id)),clearing,owner,income)
  const date=new Date(Date.UTC(Number(s.month.slice(0,4)),Number(s.month.slice(5,7)),0)).toISOString().slice(0,10)
  const row:BookPosting={id:newId(),revision:newId(),propertyId:s.propertyId,statementId:s.id,statementRevision:s.revision,origin:'',marker:`cabin:${s.id}:${s.revision}`,documentId:'',sourceSha256:await sha(await statementCsv(env.DB,actor,s.id)),payloadSha256:await sha(JSON.stringify(lines)),date,memo:`Cabin ${s.propertyName} ${s.month}`,lines,rows:lines.length,status:'exported',proposalId:null,batchId:null,at:c.now,updatedAt:c.now,detail:'QuickBooks mapping saved. Download and review the CSV or IIF before importing; no posting was sent.'}
  c.data.postings.push(row);c.entityId=row.id;return row
 })
}
