import { beginRecoveryEffect, finishRecoveryEffect } from '../recovery/effects'
import { assertContactsAllowed } from '../privacy/contacts'
import { operatorMail as sender } from '../../mail.server.mjs'
import type { Bindings } from '../../auth.server'
import { sharingAllowed } from './guard'
/** Keep the product's email data behind the same durable revocation as API calls. */
export function operatorMail(env: Bindings,propertyId?:string|null) {
 const mail = sender(env)
 return mail && { async send(message: Parameters<NonNullable<ReturnType<typeof sender>>['send']>[0]) { await assertContactsAllowed(env.DB,message.to); await sharingAllowed(env.DB, 'mail','message:send',propertyId); const ticket=await beginRecoveryEffect(env.DB,'mail',message.deliveryId,message)
 try{const result=await mail.send(message);await finishRecoveryEffect(env.DB,ticket,{state:result?.status==='accepted'?'acknowledged':result?.status==='development'?'not_applied':'uncertain',reference:result?.providerMessageId??undefined});return result}
 catch(error){await finishRecoveryEffect(env.DB,ticket,{state:'uncertain'});throw error} } }
}
