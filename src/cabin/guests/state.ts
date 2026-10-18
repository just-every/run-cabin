import type { Actor, Data } from '../model'
import type { GuestData } from './types'
/** Project before any state leaves the server. Notes are owner-only; offer capabilities never leave storage. */
export function guestState(data:Data,actor:Actor):GuestData {
 const source=data as Data&GuestData
 if(actor.isAgent||!['owner','manager'].includes(actor.role))return {guests:[],guestMerges:[],guestPolicies:[],guestOffers:[]}
 return {guests:source.guests.map(g=>({...g,facts:g.facts.filter(f=>actor.role==='owner'||f.kind!=='note')})),guestMerges:source.guestMerges,guestPolicies:source.guestPolicies,guestOffers:source.guestOffers.map(({tokenHash,...offer})=>({...offer,tokenHash:''}))}
}
