import { record } from './audit/write'
import type { Bindings } from '../auth.server'
import { operatorMail } from './connections/mail'
import { load, mutate, SYSTEM } from './storage'
// Sends the notices dispatch wrote, after their commit: each is claimed first
// (pending → sending) so two runs never send it twice, then recorded as sent,
// suppressed (development mail), unavailable (no mail provider) or failed.
// Runs after every command and on the Cron, so a failed run is retried.
const PER_RUN = 20
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
export async function deliverNotices(env: Bindings) {
 const pending = (await load(env.DB)).notices.filter(n => n.status === 'pending').sort((a,b)=>Number(b.priority==='urgent')-Number(a.priority==='urgent')).slice(0, PER_RUN)
 if (!pending.length) return []
 const results = []
 for (const { id } of pending) {
  const claimed = await mutate(env.DB, SYSTEM, 'notice.claim', c => { const n = c.data.notices.find(r => r.id === id); if (!n || n.status !== 'pending') return null; n.status = 'sending'; return { ...n } }, () => false).catch(() => null)
  if (!claimed) continue
  const current=(await load(env.DB)).members.find(m=>m.id===claimed.memberId)
  if(current&&!current.active){await mutate(env.DB,SYSTEM,'notice.offboarded',c=>{const n=c.data.notices.find(n=>n.id===id);if(n){n.status='suppressed';n.detail='Team access ended before this notice was submitted.'}});continue}
  const sender=operatorMail(env,claimed.propertyId)
  let status: 'sent' | 'suppressed' | 'unavailable' | 'failed', detail: string | null = null
  if (!sender || !env.MAIL_FROM) { status = 'unavailable'; detail = 'No mail provider is set up for this install, so this email was not sent. The job is in Cabin.' }
  else {
   try {
    const text = `${claimed.text}\n\nOpen your jobs: ${new URL(claimed.kind === 'payment' ? '/app/direct' : claimed.kind === 'issue' ? '/app/recovery#issue-'+claimed.recordId : claimed.kind === 'inbox' ? '/app/inbox' : claimed.kind === 'task' ? '/app/maintenance' : '/app/turnovers', env.AUTH_ORIGIN).href}\n`
    const result = await sender.send({ deliveryId: claimed.id, from: env.MAIL_FROM, to: [claimed.email], subject: claimed.subject, text, html: `<div style="font:15px/1.5 system-ui,sans-serif;white-space:pre-wrap">${escape(text)}</div>`, headers: { 'Auto-Submitted': 'auto-generated' } })
    status = result?.status === 'accepted' ? 'sent' : result?.status === 'development' ? 'suppressed' : 'failed'
    if (status === 'suppressed') detail = 'Development mode does not send email; a hosted install sends it.'
    if (status === 'failed') detail = 'The mail provider did not accept this email.'
   } catch (error) { status = 'failed'; detail = 'The mail provider refused this email. Check its delivery history before sending again.' }
  }
  await record(env.DB,SYSTEM,'notice.provider.result',{kind:'notices',id:claimed.id,propertyId:claimed.propertyId,revision:claimed.revision,result:status==='failed'?'failed-or-uncertain':status})
  results.push(await mutate(env.DB, SYSTEM, `notice.${status}`, c => { const n = c.data.notices.find(r => r.id === id); if (!n) return null; Object.assign(n, { status, detail, sentAt: c.now }); c.entityId = n.id; return n }))
 }
 return results
}
