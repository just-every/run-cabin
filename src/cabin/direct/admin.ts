import type { Bindings } from '../../auth.server'
import { manager,need,text,integer, type Actor } from '../model'
import { assertLive,mutate } from '../storage'
import { homes,stays,stay,saveHome,saveStay } from './store'
import { configure } from './rules'
import { refresh,settleDeposit } from './payments'
import { providerState,providerCommand } from './provider'
import { decimalUnits,arrival,timeLabel } from './presentation'
import { homeSettings } from '../homes'
export async function directState(env:Bindings,actor:Actor) {
 if(!['owner','manager'].includes(actor.role)||actor.isAgent)return {homes:[],stays:[]}
 await assertLive(env.DB,actor);const data={homes:await homes(env.DB),stays:(await stays(env.DB)).map(({bookingLinkSealed,...row})=>row),provider:await providerState(env)};await assertLive(env.DB,actor);return data
}
export async function directCommand(env:Bindings,actor:Actor,name:string,input:Record<string,unknown>) {
 manager(actor);await assertLive(env.DB,actor)
 if(name.startsWith('direct.stripe.'))return providerCommand(env,actor,name,input)
 if(name==='direct.configure')return mutate(env.DB,actor,name,async c=>{
  const propertyId=text(input.propertyId,'property ID');need(c.data.properties.some(p=>p.id===propertyId),'Property not found',404)
  const old=(await homes(env.DB)).find(h=>h.propertyId===propertyId);need(!old||old.revision===input.revision,'This home changed. Reload before saving.',409)
  const row=configure(input,propertyId);need(!(await homes(env.DB)).some(h=>h.slug===row.slug&&h.propertyId!==row.propertyId),'Another home uses this booking address',409);saveHome(c,row);return row
 })
 const id=text(input.id,'stay ID');await stay(env.DB,id)
 if(name==='direct.checkout.complete')return mutate(env.DB,actor,name,async c=>{const row=await stay(env.DB,id);need(row.phase==='confirmed'&&!row.checkedOutAt,'Only a confirmed stay awaiting checkout can be checked out',409);const home=homeSettings(c,row.propertyId),checkin=arrival(row,home);need(Date.now()>=checkin,`This guest checks in ${timeLabel(new Date(checkin).toISOString(),home.timeZone)}. Mark them checked out after that.`,409);row.checkedOutAt=c.now;saveStay(c,row);return row})
 if(name==='direct.refresh')return refresh(env,id,actor)
 if(name==='direct.deposit.release')return settleDeposit(env,actor,id,'release')
 if(name==='direct.deposit.capture')return settleDeposit(env,actor,id,'capture',integer('amountDollars' in input?decimalUnits(input.amountDollars,'damage amount'):Number(input.amountCents),'Capture amount',1),text(input.reason,'damage reason',1000),text(input.evidence,'evidence reference',2000))
 if(name==='direct.tax.filed')return mutate(env.DB,actor,name,async c=>{const row=await stay(env.DB,id),jurisdiction=text(input.jurisdiction,'jurisdiction');need(row.paymentId,'Tax has not been collected for this stay',409);need(row.quote.taxes.some(t=>t.jurisdiction===jurisdiction),'This stay has no tax in that jurisdiction');row.taxFilings??=[];need(!row.taxFilings.some(f=>f.jurisdiction===jurisdiction),'Filing evidence is already recorded',409);row.taxFilings.push({jurisdiction,reference:text(input.reference,'filing confirmation reference',1000),actorId:actor.id,at:c.now});saveStay(c,row);return row})
 need(false,'Unknown direct booking command',404)
}
