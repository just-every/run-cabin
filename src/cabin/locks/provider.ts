import type { Bindings } from '../../auth.server'
import { providerCredentials } from '../connections/credentials'
import type { LockJob, Observation, SeamCode } from './types'

const SEAM='https://connect.getseam.com'
export async function seam(env:Bindings, propertyId:string, path:string, body:Record<string,unknown>, read=false):Promise<any> {
 const credentials=await providerCredentials(env,'seam','access:write',propertyId)
 const url=new URL(SEAM+path)
 if(read)for(const [key,value] of Object.entries(body))url.searchParams.set(key,String(value))
 let response:Response
 try {response=await fetch(url,{method:read?'GET':'POST',redirect:'manual',headers:{authorization:`Bearer ${credentials.SEAM_API_KEY}`,'content-type':'application/json',accept:'application/json'},...(read?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20_000)})}
 catch {throw Error('Seam could not be reached. Reconciliation is pending; no access change will be repeated.')}
 let value:any=null;try{value=await response.json()}catch{/* malformed acknowledgement remains uncertain */}
 if(!response.ok||value?.ok===false)throw Error(`Seam request was not confirmed (HTTP ${response.status}). Check its request history.`)
 if(!value||typeof value!=='object')throw Error('Seam returned no usable acknowledgement. Reconciliation is pending.')
 return value
}
export async function listCodes(env:Bindings,propertyId:string,deviceId:string):Promise<SeamCode[]> {
 const rows:SeamCode[]=[],seen=new Set<string>();let cursor:string|undefined
 do {
  const value=await seam(env,propertyId,'/access_codes/list',{device_id:deviceId,...(cursor?{page_cursor:cursor}:{})},true)
  if(!Array.isArray(value.access_codes))throw Error('Seam returned no access-code list. Reconciliation is pending.')
  rows.push(...value.access_codes)
  if(!value.pagination?.has_next_page)break
  cursor=value.pagination.next_page_cursor
  if(!cursor||seen.has(cursor))throw Error('Seam access-code pagination was incomplete. Reconciliation is pending.')
  seen.add(cursor)
 }while(true)
 return rows
}
const sameInstant=(a:string|undefined,b:string)=>!!a&&Number.isFinite(Date.parse(a))&&Date.parse(a)===Date.parse(b)
const exact=(row:SeamCode,job:LockJob)=>row.device_id===job.deviceId&&row.code===job.code&&sameInstant(row.starts_at,job.starts_at)&&sameInstant(row.ends_at,job.ends_at)
export async function observe(env:Bindings,propertyId:string,job:LockJob):Promise<Observation> {
 let actionStatus:string|undefined
 if(job.actionAttemptId){const value=await seam(env,propertyId,'/action_attempts/get',{action_attempt_id:job.actionAttemptId},true);actionStatus=value.action_attempt?.status;if(!['pending','success','error'].includes(actionStatus??''))throw Error('Seam returned no usable action status. Reconciliation is pending.')}
 let row:SeamCode|undefined
 if(job.operation==='delete'||!job.providerId){
  if(!job.deviceId)throw Error('The original lock device is unknown. Check Seam request history before continuing.')
  const rows=await listCodes(env,propertyId,job.deviceId)
  const matches=job.providerId?rows.filter(r=>r.access_code_id===job.providerId):rows.filter(r=>r.name===job.name&&r.device_id===job.deviceId)
  if(matches.length>1)throw Error('Multiple Seam codes match this attempt. A person must reconcile them before any further change.')
  row=matches[0]
 }else{const value=await seam(env,propertyId,'/access_codes/get',{access_code_id:job.providerId},true);row=value.access_code;if(!row||row.access_code_id!==job.providerId)throw Error('Seam returned no matching access code. Reconciliation is pending.')}
 if(row&&(typeof row.access_code_id!=='string'||!row.access_code_id))throw Error('Seam returned a code without an id. Reconciliation is pending.')
 const base={providerId:row?.access_code_id??job.providerId,acknowledged:!!job.acceptedAt||!!row&&(job.operation==='create'||exact(row,job))||actionStatus==='success'}
 if(job.operation==='delete'){
  if(!row&&actionStatus!=='pending'&&actionStatus!=='error')return {...base,state:'removed',error:null,complete:true,acknowledged:true}
  return {...base,state:actionStatus==='error'?'failed':'pending',error:actionStatus==='error'?'Seam reports that code removal failed. Check its request history.':null,complete:false}
 }
 if(!row)return {...base,state:'failed',error:'No matching code is visible yet. The interrupted attempt will not be repeated; reconcile Seam request history.',complete:false}
 if(actionStatus==='error'||row.errors?.length)return {...base,state:'failed',error:'Seam reports an access-code error. Check its request history before changing access.',complete:false}
 if(exact(row,job)&&row.status==='set'&&!row.is_being_deleted&&!row.pending_mutations?.length&&actionStatus!=='pending')return {...base,state:'set',error:null,complete:true}
 if(!base.acknowledged)return {...base,state:'failed',error:'The attempted access change is not confirmed by Seam readback. Reconcile request history before repeating it.',complete:false}
 return {...base,state:'pending',error:null,complete:false}
}
