import type { Bindings } from '../../auth.server'
import { record } from './write'
const actions:Record<string,string>={'/auth/operator/role':'authority.role','/auth/operator/status':'authority.status','/auth/invite/cancel':'authority.invitation.cancel','/auth/session/revoke':'authority.session.revoke','/auth/providers/unlink':'authority.provider.unlink','/auth/providers/relink':'authority.provider.relink','/auth/email':'authority.email'}
/** Shared auth owns authorization. Record intent before its write and the exact safe result it returns. */
export async function nativeHistory(request:Request,env:Bindings,auth:any,handle:()=>Promise<Response|null>){
 const action=actions[new URL(request.url).pathname]
 if(!action||request.method!=='POST')return handle()
 const session=await auth.getSession(request)
 if(!session)return handle()
 const actor={id:session.operator.id,role:session.operator.role,isAgent:false,operatorVersion:session.operator.version}
 let input:any={};try{input=await request.clone().json()}catch{}
 const target=typeof input.operatorId==='string'&&/^[\da-f-]{36}$/.test(input.operatorId)?input.operatorId:null
 const facts={...(['owner','admin','member'].includes(input.role)?{role:input.role}:{}),...(['active','inactive'].includes(input.status)?{active:input.status==='active'}:{})}
 await record(env.DB,actor,action+'.requested',{kind:'operator',id:target,result:'requested',facts})
 let response:Response|null;try{response=await handle()}catch(error){await record(env.DB,actor,action+'.result',{kind:'operator',id:target,result:'failed-or-uncertain'});throw error}
 if(!response){await record(env.DB,actor,action+'.result',{kind:'operator',id:target,result:'unavailable'});return null}
 let value:any={};if(response.ok)try{value=await response.clone().json()}catch{}
 const id=typeof value.id==='string'&&/^[\da-f-]{36}$/.test(value.id)?value.id:target
 await record(env.DB,actor,action+'.result',{kind:'operator',id,revision:typeof value.version==='number'?String(value.version):null,result:response.ok?'completed':'refused',facts:{...facts,...(['owner','admin','member'].includes(value.role)?{role:value.role}:{}),...(['active','inactive','invited'].includes(value.status)?{active:value.status==='active'}:{})}})
 return response
}
