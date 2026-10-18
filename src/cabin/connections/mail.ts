import { operatorMail as sender } from '../../mail.server.mjs'
import type { Bindings } from '../../auth.server'
import { sharingAllowed } from './guard'
/** Keep the product's email data behind the same durable revocation as API calls. */
export function operatorMail(env: Bindings) {
 const mail = sender(env)
 return mail && { async send(message: Parameters<NonNullable<ReturnType<typeof sender>>['send']>[0]) { await sharingAllowed(env.DB, 'mail'); return mail.send(message) } }
}
