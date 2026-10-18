import { assertContactsAllowed } from '../privacy/contacts'
import { operatorMail as sender } from '../../mail.server.mjs'
import type { Bindings } from '../../auth.server'
import { sharingAllowed } from './guard'
/** Keep the product's email data behind the same durable revocation as API calls. */
export function operatorMail(env: Bindings,propertyId?:string|null) {
 const mail = sender(env)
 return mail && { async send(message: Parameters<NonNullable<ReturnType<typeof sender>>['send']>[0]) { await assertContactsAllowed(env.DB,message.to); await sharingAllowed(env.DB, 'mail','message:send',propertyId); return mail.send(message) } }
}
