import type { Bindings } from '../../auth.server'
import { beginRecoveryEffect, finishRecoveryEffect } from '../recovery/effects'
import { claim, receipt, settle, start } from './jobs'
import { observe, seam } from './provider'
import type { Observation } from './types'

export async function pushLock(env:Bindings,id:string){
 const work=await claim(env.DB,id);if(!work)return null
 const {code,job}=work
 let error:string|null=null
 if(job.stage==='prepared'){
  try{
   if(job.operation==='delete'&&!job.deviceId){
    const found=await seam(env,code.propertyId,'/access_codes/get',{access_code_id:job.providerId},true)
    if(found.access_code?.access_code_id!==job.providerId||typeof found.access_code?.device_id!=='string')throw Error('The original lock device is unknown. Reconcile Seam request history before removing access.')
    job.deviceId=found.access_code.device_id
   }
   // Recovery execution continues to own permission for every provider write.
   job.recovery=await beginRecoveryEffect(env.DB,'lock',id)
   if(!await start(env.DB,id,job))return await settle(env.DB,id,job,{state:'failed',providerId:job.providerId,error:'Access changed before the lock request. Review the current code.',complete:false,acknowledged:false})
   const body=job.operation==='delete'?{access_code_id:job.providerId}:job.operation==='update'?{access_code_id:job.providerId,code:job.code,starts_at:job.starts_at,ends_at:job.ends_at}:{device_id:job.deviceId,name:job.name,code:job.code,starts_at:job.starts_at,ends_at:job.ends_at}
   const value=await seam(env,code.propertyId,`/access_codes/${job.operation}`,body)
   if(!await receipt(env.DB,id,job,value))return null
  }catch(cause){error=(cause as Error).message.slice(0,300)}
 }
 let result:Observation
 if(job.stage==='prepared')result={state:'failed',providerId:job.providerId,error:error??'The lock request was withheld.',complete:false,acknowledged:false}
 else{
  try{result=await observe(env,code.propertyId,job)}
  catch(cause){result={state:'failed',providerId:job.providerId,error:(cause as Error).message.slice(0,300),complete:false,acknowledged:!!job.acceptedAt}}
 }
 const saved=await settle(env.DB,id,job,result)
 // A programming acknowledgement does not attest physical testing or readiness.
 await finishRecoveryEffect(env.DB,job.recovery??null,{state:result.acknowledged?'acknowledged':'uncertain',reference:result.providerId??undefined})
 return saved
}
