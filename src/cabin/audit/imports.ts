import { type Actor, owner } from '../model'
import { assertLive } from '../storage'
import { record } from './write'
const names=new Set(['import.preview','import.approve','import.resume','import.undo','import.journal','import.provider.preview','import.provider.apply','import.provider.signoff','import.provider.undo'])
const ref=(v:unknown)=>typeof v==='string'&&/^[\da-f-]{36}$/.test(v)?v:null
export async function importHistory(db:D1Database,actor:Actor,name:string,input:Record<string,unknown>,run:()=>Promise<unknown>){
 owner(actor);await assertLive(db,actor);const action=names.has(name)?name:'import.unknown',id=ref(input.id??input.jobId)
 await record(db,actor,action+'.requested',{kind:'import',id,result:'requested'})
 try{const result:any=await run();await record(db,actor,action+'.result',{kind:'import',id:ref(result?.id??result?.job?.id)??id,revision:typeof result?.fingerprint==='string'?result.fingerprint:null,result:['review','imported','signed-off','undone','completed','applying','undoing','partial','blocked'].includes(result?.status??result?.job?.state)?result.status??result.job.state:'completed'});return result}
 catch(error){await record(db,actor,action+'.result',{kind:'import',id,result:'failed-or-uncertain'});throw error}
}
