import type { Bindings } from '../../auth.server'
import { mutate } from '../storage'
import { manager, owner, need, text, integer, newId, property, type Actor, type Context } from '../model'
import { taxData, saveConfig, revision } from './store'
import { date } from './calculate'
import { sourceCommand } from './sources'
import { reportCommand } from './reports'
import { directSource } from './direct'
import type { Profile, Jurisdiction, Rule } from './types'
function email(v:unknown){const e=text(v,'accountant/approved filing partner email',254).toLowerCase();need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),'Enter a valid delivery email');return e}
export async function taxCommand(env:Bindings,actor:Actor,name:string,input:Record<string,unknown>){
 manager(actor);need(!actor.isAgent,'A human manager must review tax records',403)
 return mutate(env.DB,actor,name,async c=>{
  const data=await taxData(c.db),p=input
  if(name==='tax.profile.save'){
   owner(actor);const home=property(c,p.propertyId),old=data.config.find((r):r is Profile=>r.kind==='profile'&&r.propertyId===home.id)
   need(p.country==='US','This workflow supports configured US jurisdictions; keep other countries as work items')
   const row:Profile={id:old?.id??newId(),revision:revision(old,p),kind:'profile',propertyId:home.id,country:'US',state:text(p.state,'state',120),county:text(p.county,'county or equivalent',120),city:text(p.city,'city or Unincorporated',120)};saveConfig(c,row);return row
  }
  if(name==='tax.jurisdiction.save'){
   owner(actor);const home=property(c,p.propertyId),level=text(p.level,'jurisdiction level');need(level==='state'||level==='county'||level==='city','Choose state, county or city')
   const profile=data.config.find((r):r is Profile=>r.kind==='profile'&&r.propertyId===home.id);need(profile,'Save the US property location first',409)
   const old=data.config.find((r):r is Jurisdiction=>r.kind==='jurisdiction'&&r.propertyId===home.id&&r.level===level&&r.name===profile[level])
   const status=text(p.registrationStatus,'registration status');need(['active','pending','expired','not-required'].includes(status),'Choose a registration status')
   const row:Jurisdiction={id:old?.id??newId(),revision:revision(old,p),kind:'jurisdiction',propertyId:home.id,level,name:profile[level],registrationStatus:status as Jurisdiction['registrationStatus'],registrationReference:text(p.registrationReference,'registration number or documented exemption from registration',500),registrationUntil:p.registrationUntil?date(p.registrationUntil):'',recipient:email(p.recipient),partner:text(p.partner,'accountant or approved filing partner name',200),source:text(p.source,'registration/partner authorization source',2000)};saveConfig(c,row);return row
  }
  if(name==='tax.rule.save'){
   owner(actor);const jurisdiction=data.config.find((r):r is Jurisdiction=>r.kind==='jurisdiction'&&r.id===text(p.jurisdictionId,'jurisdiction'));need(jurisdiction,'Jurisdiction not found',404)
   const old=p.id?data.config.find((r):r is Rule=>r.kind==='rule'&&r.id===p.id):undefined;need(!p.id||old&&old.jurisdictionId===jurisdiction.id,'Rule not found',404)
   const taxType=text(p.taxType,'tax type');need(taxType==='occupancy'||taxType==='lodging'||taxType==='sales','Choose occupancy, lodging or sales')
   const from=date(p.from,'effective start'),until=date(p.until,'effective end');need(from<=until,'Effective end must follow start')
   need(!data.config.some(r=>r.kind==='rule'&&r.jurisdictionId===jurisdiction.id&&r.taxType===taxType&&r.id!==old?.id&&r.from<=until&&r.until>=from),'Rules of the same levy type may not overlap',409)
   const row:Rule={id:old?.id??newId(),revision:revision(old,p),kind:'rule',propertyId:jurisdiction.propertyId,jurisdictionId:jurisdiction.id,taxType,bps:integer(Number(p.bps),'rate basis points',0,10000),from,until,source:text(p.source,'authoritative rule source and taxable fee treatment',2000)};saveConfig(c,row);return row
  }
  if(name==='tax.source.direct')return directSource(c,data,p)
  const sourced=await sourceCommand(c,data,name,p);if(sourced!==undefined)return sourced
  const reported=await reportCommand(c,data,name,p);if(reported!==undefined)return reported
  need(false,'Unknown tax command',404)
 })
}
