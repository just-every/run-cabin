import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
export const qboAuth={QUICKBOOKS_CLIENT_ID:'synthetic-cabin-client-1',QUICKBOOKS_CLIENT_SECRET:'synthetic-cabin-secret-1'}
export async function qboBooks(h){
 const home=await h.cmd('property.save',{name:'Cedar Creek Cabin',ownerName:'Morgan Carter',ownerEmail:'synthetic-cabin-owner@stay.example',commissionBps:2000})
 await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Synthetic Cabin Rentals LLC'})
 const stay=await h.cmd('reservation.request',{propertyId:home.id,channel:'direct',start:'2026-11-01',end:'2026-11-05',guestName:'Synthetic Cabin Guest 1'})
 const base={propertyId:home.id,bookingId:stay.bookingId,effectiveDate:'2026-10-26',sourceRevision:'synthetic-cabin-1'}
 for(const [operation,amountCents]of [['deposit',100000],['earn',100000],['applyAdvance',100000],['tax',9000],['payment',9000],['channelFee',3000],['expense',10000],['refund',7500],['commission',20000]])await h.cmd('ledger.post',{...base,operation,amountCents,sourceId:'synthetic-cabin-'+operation})
 const source=(await h.state()).ledger.journals.filter(j=>j.propertyId===home.id)
 return {home,stay,source,base}
}
export const syntheticGrant={mode:'sandbox',realmId:'123456789',accessToken:'synthetic-cabin-access-1',refreshToken:'synthetic-cabin-refresh-1',consent:true}
export async function qboMapping(h,home,catalog){
 const map={propertyId:home.id,classId:catalog.classes[0].Id,vendorId:catalog.vendors[0].Id,accounts:Object.fromEntries(catalog.accounts.map(a=>[a.Id,a.Id])),consent:true}
 return h.cmd('qbo.mapping.approve',map)
}
export async function assertBatch(h,b,source){
 assert.equal(b.entries.length,source.length);assert.equal(b.reconciled,true);assert.equal(b.remoteDebitCents,source.reduce((n,j)=>n+j.lines.reduce((n,l)=>n+l.debitCents,0),0));assert.equal(b.remoteCreditCents,b.remoteDebitCents)
 for(const j of source){const e=b.entries.find(e=>e.sourceId===j.id);assert.ok(e.externalId);assert.equal(e.sourceSha256,createHash('sha256').update(JSON.stringify(j)).digest('hex'));assert.deepEqual(e.payload.Line.map(l=>Math.round(l.Amount*100)),j.lines.map(l=>l.debitCents||l.creditCents))}
}
