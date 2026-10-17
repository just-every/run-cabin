import { need, sha } from '../model'
import { normalizeProvider, type Normalized } from './providers'
import { load } from '../storage'
import { overlaps } from '../inventory'
export const listingId = (provider:string,id:string) => `migrate:${provider}:${id}`
/** Refusals retain their source IDs; no reservation whose listing/guest was refused can slip through. */
export async function providerPlan(db:D1Database,input:Record<string,unknown>):Promise<Normalized>{
 let plan:Normalized
 try{plan=normalizeProvider(input.provider,input.files,input.asOf)}catch(error){need(false,(error as Error).message,422)}
 const data=await load(db)
 const refuse=(kind:string,externalId:string,reason:string,location?:{file:string;row:number})=>plan.refusals.push({file:location?.file??'Move-in validation',row:location?.row??0,kind,externalId,reason})
 const homes=[] as Normalized['homes']
 for(const home of plan.homes){
  const id=listingId(plan.provider,home.externalId)
  const erased=await db.prepare("SELECT 1 FROM cb_erasure_fences WHERE entity='property' AND id_hash IN (?,?)").bind(await sha(id),await sha(home.ownerEmail)).first()
  if(erased)refuse('listing',home.externalId,'This listing or owner identity was erased. It cannot be reimported.',home.location)
  else if(data.properties.some(p=>p.id===id))refuse('listing',home.externalId,'This provider listing already exists in Cabin. Undo the earlier import or use that listing.',home.location)
  else homes.push(home)
 }
 plan.homes=homes
 const guests=new Map<string,Normalized['guests'][number]>()
 for(const guest of plan.guests)if(!guests.has(guest.externalId))guests.set(guest.externalId,guest)
 plan.guests=[...guests.values()]
 const stays=[] as Normalized['stays'],ids=new Set<string>()
 for(const stay of plan.stays){
  if(!homes.some(h=>h.externalId===stay.listingId)){refuse('reservation',stay.externalId,`Listing ${stay.listingId} was refused or is missing.`,stay.location);continue}
  if(!plan.guests.some(g=>g.externalId===stay.guestId)){refuse('reservation',stay.externalId,`Guest ${stay.guestId} was refused or is missing.`,stay.location);continue}
  if(ids.has(stay.externalId)){refuse('reservation',stay.externalId,'Duplicate source reservation ID.',stay.location);continue}
  ids.add(stay.externalId)
  const hit=stay.status==='confirmed'&&stays.find(s=>s.listingId===stay.listingId&&s.status==='confirmed'&&overlaps(s,stay))
  if(hit){refuse('reservation',stay.externalId,`Overlaps reservation ${hit.externalId}. Resolve this at the source before switching.`,stay.location);continue}
  stays.push(stay)
 }
 plan.stays=stays
 const balances=[] as Normalized['balances'],balanceIds=new Set<string>()
 for(const b of plan.balances){
  const home=homes.find(h=>h.externalId===b.listingId)
  if(!home)refuse('owner balance',b.externalId,`Listing ${b.listingId} was refused or is missing.`,b.location)
  else if(balanceIds.has(b.externalId))refuse('owner balance',b.externalId,'Duplicate balance source ID.',b.location)
  else if(b.ownerEmail.toLowerCase()!==home.ownerEmail.toLowerCase())refuse('owner balance',b.externalId,'Balance owner does not match the listing owner.',b.location)
  else{balanceIds.add(b.externalId);balances.push(b)}
 }
 plan.balances=balances
 for(const home of homes){
  if(!balances.some(b=>b.listingId===home.externalId))refuse('owner balance',home.externalId,'No verified opening owner balance supplied for this listing. Supply an explicit USD balance, including zero, or explain the missing balance before sign-off.',home.location)
 }
 need(plan.homes.length>0||plan.refusals.length>0,'No listings or reservations were found in these exports',422)
 return plan
}
