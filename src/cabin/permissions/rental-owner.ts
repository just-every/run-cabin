import type { Bindings } from '../../auth.server'
import { type Actor, need } from '../model'
import { portalState } from '../owners/state'
import { portalPage } from '../owners/ui'
import { permitsProperty } from './policy'
export async function rentalOwnerPage(env:Bindings,actor:Actor){
 const state=await portalState(env,actor.email)
 for(const key of ['properties','bookings','statements','performance','documents','expenses','stayRequests','issues','ledgerEntries','ledgerBalances','blockUses'] as const)(state as any)[key]=state[key].filter((row:any)=>permitsProperty(actor,key==='properties'?row.id:row.propertyId))
 const response=await portalPage(state,false),body=await response.text()
 return new Response(body.replaceAll('/owners/action','/app/action?name=rentalOwner.perform&amp;returnTo=%2Fapp').replaceAll('/owners/signout','/auth/signout'),{status:response.status,headers:response.headers})
}
