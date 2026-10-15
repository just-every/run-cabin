// The only fake is the paid mail transport. Native invitations and token
// confirmation still run through the production HTTP handlers and real D1.
export function operatorMail(env) {
  return { async send(message) {
    const id = crypto.randomUUID()
    await env.DB.prepare('INSERT INTO rer_mail_development_outbox(id,created_at,message) VALUES(?,?,?)').bind(id,Date.now(),JSON.stringify(message)).run()
    return { status: 'accepted', provider: 'test', providerMessageId: id }
  } }
}
