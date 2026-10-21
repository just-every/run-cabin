// The only fake is the paid mail transport. Native invitations and token
// confirmation still run through the production HTTP handlers and real D1.
export function operatorMail(env) {
  return { async send(message) {
    let outcome
    if(env.CABIN_TEST_MAIL_EDGE==='true'){
      const response=await fetch('https://mail.cabin.test/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(message)})
      if(!response.ok)throw new Error('Synthetic mail provider refused the request')
      outcome=await response.json()
    }
    const id = crypto.randomUUID()
    await env.DB.prepare('INSERT INTO rer_mail_development_outbox(id,created_at,message) VALUES(?,?,?)').bind(id,Date.now(),JSON.stringify(message)).run()
    return outcome??{ status: 'accepted', provider: 'test', providerMessageId: id }
  } }
}
