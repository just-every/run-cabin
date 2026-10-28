import { need,newId,type Context } from '../model'
import { rows,save } from './store'
import { PROFILE,ACTION,type Profile,type Action,type AgentChannel } from './types'

export const ACCOUNT='channelAgentAccounts'
export interface ChannelAccount {
 id:string; channel:AgentChannel; nickname:string; generation:string; status:'active'|'revoked';
 createdAt:string; updatedAt:string; revokedAt?:string;
}
// Old listing sessions never implied a shared host identity. Give each its own
// stable account until the owner can perform a separately reviewed remap.
export const accountIdFor=(p:Profile)=>p.accountId??'channel-account:'+p.id
export function legacyAccount(p:Profile):ChannelAccount {
 return {id:accountIdFor(p),channel:p.channel,nickname:p.listingId??p.propertyId,generation:p.generation,status:p.grantedAt?'active':'revoked',createdAt:p.updatedAt,updatedAt:p.updatedAt}
}
export async function accountRows(db:D1Database,profiles:Profile[]){
 const accounts=await rows<ChannelAccount>(db,ACCOUNT)
 for(const p of profiles)if(!accounts.some(a=>a.id===accountIdFor(p)))accounts.push(legacyAccount(p))
 return accounts
}
export async function ensureAccounts(c:Context,profiles:Profile[]){
 const stored=await rows<ChannelAccount>(c.db,ACCOUNT),accounts=await accountRows(c.db,profiles)
 for(const a of accounts)if(!stored.some(s=>s.id===a.id))save(c,ACCOUNT,a)
 for(const p of profiles)if(!p.accountId){p.accountId=accountIdFor(p);save(c,PROFILE,p)}
 return accounts
}
export async function assertAccount(db:D1Database,p:Profile,a?:Action){
 const account=(await accountRows(db,[p])).find(a=>a.id===accountIdFor(p))
 need(account?.status==='active'&&account.channel===p.channel,'Channel account is revoked; owner review required',409)
 if(a?.accountId)need(a.accountId===account.id&&a.accountGeneration===account.generation,'Channel account authority changed; queue fresh work',409)
 return account
}
export function revokeAccount(c:Context,account:ChannelAccount,profiles:Profile[],actions:Action[]){
 account.status='revoked';account.generation=newId();account.revokedAt=c.now;account.updatedAt=c.now;save(c,ACCOUNT,account)
 const owned=profiles.filter(p=>accountIdFor(p)===account.id),ids=new Set(owned.map(p=>p.id))
 for(const p of owned){p.status='disconnected';p.generation=newId();p.updatedAt=c.now;delete p.stateSealed;delete p.grantedAt;delete p.grantedBy;delete p.challenge;save(c,PROFILE,p)}
 for(const a of actions.filter(a=>ids.has(a.profileId)&&['queued','running'].includes(a.status))){
  a.status=a.status==='running'&&!a.kind.startsWith('read-')&&a.kind!=='connect'?'uncertain':'cancelled'
  a.detail='Account revoked. Pending work is fenced; check any already started channel change at its source.'
  a.completedAt=c.now;delete a.lease;delete a.leaseUntil;save(c,ACTION,a)
 }
}
