import type { Bindings } from '../../auth.server'
import { need } from '../model'
import { load } from '../storage'
import { sharingAllowed } from '../connections/guard'
import { overlaps } from '../inventory'
import type { Action,Profile } from './types'
/** Recheck at the browser-effect boundary, including provider revoke and changed inventory. */
export async function authorizeEffect(env:Bindings,a:Action,profile:Profile){
 need(profile.status===(a.kind==='connect'?'connecting':'connected'),'Channel profile is paused',409)
 await sharingAllowed(env.DB,'calendars',a.kind==='connect'?'calendar:read':'calendar:publish',a.propertyId)
 if(a.kind==='connect')return
 const data=await load(env.DB)
 if(a.kind==='close'){
  const b=data.bookings.find(b=>b.id===a.bookingId)
  need(b&&b.status==='confirmed'&&!b.cancelled&&!b.restorePaused&&b.start.slice(0,10)===a.start&&b.end.slice(0,10)===a.end,'The source reservation changed. Review the queued action.',409)
 }else need(!data.bookings.some(b=>b.propertyId===a.propertyId&&b.status==='confirmed'&&!b.cancelled&&overlaps(b,{start:a.start!,end:a.end!})),'Nights are held again. Reopening stopped.',409)
}
