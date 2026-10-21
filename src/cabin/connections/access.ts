import { accessMessage } from '../agreements/access'
import type { Data } from '../model'
import { ordinaryOutput } from './redaction'
export const accessSecrets=(data:Pick<Data,'codes'|'exports'>&Partial<Pick<Data,'guestPortalLinks'>>)=>[...data.codes.flatMap(c=>[c.code,c.link??'']),...data.exports.map(e=>e.token),...(data.guestPortalLinks??[]).map(p=>p.token??'')].filter(Boolean)
export const ordinaryState=(data:Data)=>ordinaryOutput(data,accessSecrets(data))
/** This purpose-specific human door supplies the capabilities required to configure access. */
export function accessDetails(data:Data){return {guestPortalLinks:data.guestPortalLinks.map(({emailHash,sessionEpoch,...link})=>link),codes:data.codes,exports:data.exports,connections:data.connections,agreements:data.rentalAgreements.map(a=>({id:a.id,token:a.token})),messages:data.messages.filter(m=>accessMessage(data,m))}}
