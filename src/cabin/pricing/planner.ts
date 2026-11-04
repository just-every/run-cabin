import type { Bindings } from '../../auth.server'
import { integer,need,text,type Actor } from '../model'
import { mutate } from '../storage'
import { homes,saveHome } from '../direct/store'
import { day } from '../direct/rules'
import { decimalUnits } from '../direct/presentation'
import { homeSettings } from '../homes'
import { localDay } from '../clock'
import { addDays } from '../inventory'
import { seal,unseal } from '../seal'
import { nativeAmount,nativeNight,nativeRange,validateNativeRates } from './calculate'

export async function plannerCommand(env:Bindings,actor:Actor,name:string,input:Record<string,unknown>){
 need(!actor.isAgent,'Human staff required',403)
 return mutate(env.DB,actor,name,async c=>{
  const propertyId=text(input.propertyId,'property ID'),home=(await homes(c.db)).find(h=>h.propertyId===propertyId)
  need(home,'Save this home’s booking settings first',404)
  need(home.revision===input.revision,'This home changed. Reload and preview again.',409)
  const timeZone=homeSettings(c,propertyId).timeZone,today=localDay(Date.parse(c.now),timeZone)
  if(name==='direct.native.range'){
   const start=day(input.start),end=day(input.end)
   return {nativeRange:true,propertyId,start,end,timeZone,today,nights:nativeRange(home,start,end)}
  }
  if(name==='direct.native.limits'){
   const floorCents=integer(decimalUnits(input.nativeFloorDollars,'native base floor'),'Native base floor',1,100_000_000)
   const ceilingCents=integer(decimalUnits(input.nativeCeilingDollars,'native base ceiling'),'Native base ceiling',floorCents,100_000_000)
   const revision=crypto.randomUUID()
   home.nativePlanner={revision,savedAt:c.now,floorCents,ceilingCents,history:home.nativePlanner?.history??[]}
   validateNativeRates(home);home.revision=revision;saveHome(c,home);return home
  }
  need(home.nativePlanner,'Save native base-rate limits before preparing a change',409)
  need(!home.nativePlanner.restorePaused,'Review and save native limits after restore, then prepare a fresh preview.',409)
  if(name==='direct.native.preview'){
   const date=day(input.date),action=input.action
   need(date>=today,'Choose a current or future property-local night')
   need(action==='override'||action==='clear','Choose an override or restore the saved rule')
   const before=nativeNight(home,date),underlying=nativeNight(home,date,false)
   need(action!=='clear'||before.source==='manual','This night has no manual override',409)
   const amountCents=action==='override'?integer(decimalUnits(input.nativeDollars,'native nightly rate'),'Native nightly rate',1,100_000_000):underlying.amountCents
   nativeAmount(home,amountCents)
   const proposal={propertyId,homeRevision:home.revision,limitsRevision:home.nativePlanner.revision,timeZone,actorId:actor.id,operatorVersion:actor.operatorVersion,expiresAt:new Date(Date.parse(c.now)+15*60_000).toISOString(),date,action,amountCents,reason:text(input.reason,'change reason',500),before,underlying}
   const token=await seal(env.SESSION_SECRET,'native-rate-preview',JSON.stringify(proposal))
   return {nativePreview:true,...proposal,token}
  }
  need(name==='direct.native.apply','Unknown native planner command',404)
  const value=await unseal(env.SESSION_SECRET,'native-rate-preview',text(input.previewToken,'rate preview',10000))
  need(value,'Preview this exact change before applying it',409)
  const p=JSON.parse(value)
  need(p.propertyId===propertyId&&p.homeRevision===home.revision&&p.limitsRevision===home.nativePlanner.revision&&p.timeZone===timeZone,'This home changed. Reload and preview again.',409)
  need(p.actorId===actor.id&&p.operatorVersion===actor.operatorVersion,'This preview belongs to another staff session. Preview again.',403)
  need(Date.parse(p.expiresAt)>Date.parse(c.now)&&p.date>=today,'This preview expired. Preview again.',409)
  nativeAmount(home,p.amountCents)
  const revision=crypto.randomUUID()
  home.nativePlanner.history.push({revision,date:p.date,action:p.action,amountCents:p.amountCents,reason:p.reason,at:c.now,timeZone,actorId:actor.id,homeRevision:p.homeRevision,limitsRevision:p.limitsRevision,before:p.before,underlying:p.underlying})
  home.revision=revision;saveHome(c,home);return {nativeApplied:true,propertyId,start:p.date,end:addDays(p.date,7),home}
 })
}
