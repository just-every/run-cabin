import { need, integer, text } from '../model'
import type { ManagementTerms } from '../properties/terms'
import type { AllocationModel, OwnerShare, AllocationPart } from './allocation-types'
const cents=(v:unknown,label:string)=>integer(Number(v??0),label,0,100_000_000)
const bps=(v:unknown,label:string)=>integer(Number(v??0),label,0,10000)
const email=(v:unknown)=>{const s=text(v,'owner email',254).toLowerCase();need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),'Enter a valid owner email');return s}
export function allocationModel(input:Record<string,unknown>):AllocationModel|undefined {
 if(input.allocationEnabled!==true&&input.allocationEnabled!=='on'&&input.allocation===undefined)return undefined
 const p=(input.allocation??input) as Record<string,unknown>
 const owners:OwnerShare[]=typeof p.owners==='string'?p.owners.split(/\r?\n/).filter(v=>v.trim()).map(line=>{const [name,address,share,...extra]=line.split(',');need(!extra.length,'Owner rows use name,email,basis points');return {name:text(name,'owner name',160),email:email(address),bps:bps(share,'owner share')}}):Array.isArray(p.owners)?p.owners.map(v=>({name:text(v.name,'owner name',160),email:email(v.email),bps:bps(v.bps,'owner share')})):[]
 need(owners.length>0&&owners.length<=20&&owners.every(o=>o.bps>0)&&owners.reduce((n,o)=>n+o.bps,0)===10000&&new Set(owners.map(o=>o.email)).size===owners.length,'Unique owner shares must total 10,000 basis points (100%)')
 const commissionBase=p.commissionBase??'rent';need(['rent','netRent','receipts'].includes(String(commissionBase)),'Choose a commission base')
 const passThrough=p.passThrough??'owner',taxExpense=p.taxExpense??'owner';need(['owner','manager'].includes(String(passThrough))&&['owner','manager'].includes(String(taxExpense)),'Choose who bears pass-through and tax expenses')
 const m=(p.mapping??p) as Record<string,unknown>
 return {commissionBase:commissionBase as AllocationModel['commissionBase'],fixedFeeCents:cents(p.fixedFeeCents,'fixed fee cents'),reserveBps:bps(p.reserveBps,'reserve basis points'),ownerUseCleaningCents:cents(p.ownerUseCleaningCents,'owner-use cleaning cents'),passThrough:passThrough as 'owner'|'manager',taxExpense:taxExpense as 'owner'|'manager',owners,mapping:{owner:text(m.owner??m.ownerMapping,'owner funds mapping'),manager:text(m.manager??m.managerMapping,'manager income mapping'),reserve:text(m.reserve??m.reserveMapping,'reserve mapping'),tax:text(m.tax??m.taxMapping,'tax payable mapping'),vendor:text(m.vendor??m.vendorMapping,'vendor payable mapping'),reviewedBy:text(m.reviewedBy,'accountant reviewer name')}}
}
export const modelFor=(t:ManagementTerms):AllocationModel=>t.allocation??{commissionBase:'rent',fixedFeeCents:0,reserveBps:0,ownerUseCleaningCents:0,passThrough:'owner',taxExpense:'owner',owners:[{name:t.ownerName,email:t.ownerEmail,bps:10000}],mapping:{owner:'ownerLiability',manager:'managerRevenue',reserve:'ownerReserves',tax:'taxes',vendor:'vendorPayable',reviewedBy:''}}
/** Largest remainder, stable input order: every cent is allocated exactly once. */
export function splitCents(amount:number,shares:number[]):number[]{
 need(Number.isSafeInteger(amount)&&shares.reduce((n,v)=>n+v,0)===10000,'Allocation shares must total 100%')
 const sign=Math.sign(amount),n=BigInt(Math.abs(amount)),parts=shares.map((share,index)=>({index,value:Number(n*BigInt(share)/10000n),remainder:Number(n*BigInt(share)%10000n)}))
 const remaining=Number(n)-parts.reduce((n,p)=>n+p.value,0)
 const ranked=[...parts].sort((a,b)=>b.remainder-a.remainder||a.index-b.index);for(let i=0;i<remaining;i++)ranked[i].value++
 return parts.map(p=>p.value*sign)
}
export const percent=(n:number,bps:number)=>Number((BigInt(n)*BigInt(bps)+5000n)/10000n)
export function revenueParts(t:ManagementTerms,gross:number,fees:number,rent:number,passThrough:number,tax:number):AllocationPart[]{
 const m=modelFor(t);need(rent+passThrough+tax===gross,'Rent, pass-through receipts and collected tax must equal matched gross receipts')
 const base=m.commissionBase==='netRent'?Math.max(0,rent-fees):m.commissionBase==='receipts'?gross-tax:rent
 const management=percent(base,t.commissionBps)+m.fixedFeeCents,available=gross-fees-tax-management
 need(available>=0,'Fees and tax exceed settled proceeds; correct the breakdown or agreement',409)
 const reserve=percent(available,m.reserveBps),shares=m.owners.map(o=>o.bps)
 const cols=[gross,fees,management,tax,reserve].map(n=>splitCents(n,shares))
 return m.owners.map((o,i)=>({ownerName:o.name,ownerEmail:o.email,shareBps:o.bps,grossCents:cols[0][i],channelFeeCents:cols[1][i],managementFeeCents:cols[2][i],taxCents:cols[3][i],expenseCents:0,reserveCents:cols[4][i],payableCents:cols[0][i]-cols[1][i]-cols[2][i]-cols[3][i]-cols[4][i]}))
}
export function costParts(t:ManagementTerms,amount:number):AllocationPart[]{const m=modelFor(t),values=splitCents(amount,m.owners.map(o=>o.bps));return m.owners.map((o,i)=>({ownerName:o.name,ownerEmail:o.email,shareBps:o.bps,grossCents:0,channelFeeCents:0,managementFeeCents:0,taxCents:0,expenseCents:values[i],reserveCents:0,payableCents:-values[i]}))}
