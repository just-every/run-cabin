import type { Bindings } from '../../../auth.server'
import { type Actor, need, text, sha, newId } from '../../model'
import { load } from '../../storage'
import { accounts } from '../../ledger/types'
import { connection } from './connection'
import { query } from './client'
import { audit, requireOwner } from './store'
import type { Mapping, RemoteAccount, RemoteName } from './types'
export async function catalog(env:Bindings,propertyId?:string) {
 const c=await connection(env,propertyId)
 const [a,classes,vendors,company,preferences]=await Promise.all([query(env,c,'Account','',propertyId),query(env,c,'Class','',propertyId),query(env,c,'Vendor','',propertyId),import('./client').then(({api})=>api(env,c,'companyinfo/'+c.realm,undefined,propertyId)),import('./client').then(({api})=>api(env,c,'preferences',undefined,propertyId))])
 need(company.CompanyInfo?.Country==='US','QuickBooks synchronization requires a US company',409)
 const currency=preferences.Preferences?.CurrencyPrefs?.HomeCurrency?.value??'USD';need(currency==='USD','QuickBooks synchronization requires USD home currency',409)
 return {realm:c.realm,mode:c.mode,companyName:company.CompanyInfo.CompanyName,accounts:a as RemoteAccount[],classes:classes as RemoteName[],vendors:vendors as RemoteName[]}
}
export async function approveMapping(env:Bindings,actor:Actor,input:Record<string,unknown>) {
 await requireOwner(env.DB,actor);need(input.consent===true||input.consent==='on','Confirm accountant review of these exact mappings')
 const data=await load(env.DB),propertyId=text(input.propertyId,'property'),p=data.properties.find(p=>p.id===propertyId);need(p,'Property not found',404)
 const ownerKey=input.ownerKey?text(input.ownerKey,'owner key',64):await sha(p.ownerEmail.trim().toLowerCase());need(/^[a-f0-9]{64}$/.test(ownerKey),'Invalid owner identity')
 const remote=await catalog(env,propertyId),classId=text(input.classId,'property class'),vendorId=text(input.vendorId,'owner vendor')
 need(remote.classes.some(c=>c.Id===classId&&c.Active!==false),'Choose an active QuickBooks property class')
 need(remote.vendors.some(v=>v.Id===vendorId&&v.Active!==false),'Choose an active QuickBooks owner vendor')
 const supplied=typeof input.accounts==='object'&&input.accounts?input.accounts as Record<string,unknown>:input
 const mapping={} as Mapping['accounts']
 for(const key of Object.keys(accounts) as (keyof typeof accounts)[]) {
  const id=text(supplied[key],'account for '+accounts[key]),a=remote.accounts.find(a=>a.Id===id&&a.Active!==false)
  need(a&&!['Accounts Receivable','Accounts Payable'].includes(a.AccountType),'Choose an active ordinary account for '+accounts[key]);mapping[key]=id
 }
 const row:Mapping={propertyId,ownerKey,mode:remote.mode,realm:remote.realm,revision:newId(),classId,vendorId,accounts:mapping,approvedBy:actor.id,approvedAt:new Date().toISOString()}
 await requireOwner(env.DB,actor)
 await env.DB.prepare('INSERT INTO cb_qbo_mappings(property_id,owner_key,data) VALUES(?,?,?) ON CONFLICT(property_id,owner_key) DO UPDATE SET data=excluded.data').bind(propertyId,ownerKey,JSON.stringify(row)).run()
 await audit(env.DB,actor,'qbo.mapping.approve',row.revision,propertyId,'approved');return row
}
