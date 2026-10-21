import { load } from '../storage'
import { managementFor } from '../properties/terms'
import { localDay } from '../clock'
import type { Data } from '../model'
/** Current dated management terms are the source of recorded rental interests. */
export function rentalInterests(data:Data,email:string,now=Date.now()){
 const address=email.trim().toLowerCase()
 return data.properties.flatMap(p=>{
  if(p.ownerEmail.trim().toLowerCase()===address)return [{propertyId:p.id,name:p.ownerName,email:address,primary:true,propertyRevision:p.revision,termsId:null as string|null,termsRevision:null as string|null}]
  const zone=data.homeSettings.find(h=>h.propertyId===p.id)?.timeZone??'America/New_York',terms=managementFor(data,p.id,localDay(now,zone)),interest=terms.allocation?.owners.find(o=>o.email.trim().toLowerCase()===address)
  return interest?[{propertyId:p.id,name:interest.name,email:address,primary:false,propertyRevision:p.revision,termsId:terms.id,termsRevision:terms.revision}]:[]
 })
}

export async function authorizedRentalInterests(db:D1Database,email:string,data?:Data){
 const source=data??await load(db),interests=rentalInterests(source,email)
 const member=source.members.find(m=>m.active&&m.email.trim().toLowerCase()===email.trim().toLowerCase()&&m.scope?.pmsRole==='rental_owner'&&(m.scope.actions.includes('owners:read')))
 return interests.filter(i=>i.primary||member?.scope?.propertyIds.includes(i.propertyId))
}
