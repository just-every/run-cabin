import { queuedAuthority } from '../permissions/commands'
import type { Bindings } from '../../auth.server'
import { need } from '../model'
import { load } from '../storage'
import { sharingAllowed } from '../connections/guard'
import { capacityBookings, sharesCapacity } from '../capacity'
import { overlaps } from '../inventory'
import type { Action,Profile } from './types'
/** Recheck at the browser-effect boundary, including provider revoke and changed inventory. */
export async function authorizeEffect(env:Bindings,a:Action,profile:Profile){
 need(await queuedAuthority(env.DB,a.authority,a.authorityAction??'calendar.approve',a.propertyId),'The initiating team grant changed before channel execution',403)
 need(profile.status===(a.kind==='connect'?'connecting':'connected'),'Channel profile is paused',409)
 await sharingAllowed(env.DB,'calendars',a.kind==='connect'||a.kind.startsWith('read-')?'calendar:read':'calendar:publish',a.propertyId)
 if(a.kind!=='connect')need(profile.grantedAt,'Review the disclosed channel terms and reconnect this profile first',409)
 if(a.kind.startsWith('read-')){need(a.profileGeneration===profile.generation,'The source profile changed. Queue a new read.',409);return}
 if(a.kind==='connect')return
 const data=await load(env.DB)
 if(a.kind==='close'){
  const b=data.bookings.find(b=>b.id===a.bookingId)
  need(b&&sharesCapacity(data,b.propertyId,a.propertyId)&&b.status==='confirmed'&&!b.cancelled&&!b.restorePaused&&b.start.slice(0,10)===a.start&&b.end.slice(0,10)===a.end,'The source reservation changed. Review the queued action.',409)
 }else need(!capacityBookings(data,a.propertyId).some(b=>b.status==='confirmed'&&!b.cancelled&&overlaps(b,{start:a.start!,end:a.end!})),'Nights are held again. Reopening stopped.',409)
}
