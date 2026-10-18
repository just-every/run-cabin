import type { Bindings } from '../../auth.server'
import type { Context,Data,GuestMessage } from '../model'
import { need } from '../model'
import { DIRECT_SYSTEM } from '../direct/store'
import { eligible } from './eligibility'
import { promotionRows } from './store'
import type { PromotionOffer } from './types'
/** An approved offer is revalidated at the actual provider boundary, including a queued send after restart. */
export async function promotionMailAllowed(env:Bindings,data:Data,m:GuestMessage){
 if(!m.promotionOfferId)return
 const o=(await promotionRows<PromotionOffer>(env.DB,'promotionOffers')).find(o=>o.id===m.promotionOfferId)
 need(o&&o.status==='sent'&&o.messageId===m.id&&o.email===m.email,'This offer was withdrawn, accepted or replaced before delivery',409)
 const current={...data,messages:data.messages.filter(row=>row.id!==m.id)},c:Context={db:env.DB,data:current,before:current,actor:DIRECT_SYSTEM,queries:[],now:new Date().toISOString(),entityId:null}
 await eligible(c,o)
}
