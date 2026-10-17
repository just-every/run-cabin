import { h, heading, panel, form, field, hidden, empty, badge, propertyName } from './shared'
import { atHome } from './ops'
export { movein } from './movein'

function approvalLine(s: any, a: any) {
 const record = [...s.calendarDrafts, ...s.turnovers, ...s.statements].find((r: any) => r.id === a.recordId)
 const label: Record<string, string> = { calendar: 'Calendar review', turnover: 'Turnover assignment', statement: 'Owner statement' }
 const who = a.actorName || s.members.find((m: any) => m.id === a.actorId)?.name || (a.actorId === s.actor.id ? s.actor.email : 'Former team member')
 return `${h(label[a.kind] || 'Approval')}${record ? ` · ${h(propertyName(s, record.propertyId))}` : ''} · approved by ${h(who)} · ${h(atHome(s, record?.propertyId ?? null, a.at))}`
}
export function agent(s: any, extras: any) {
  const result = extras.result?.result ?? extras.result
  const token = result?.token
  const keys = s.agentKeys.map((k: any) => `<article class="record"><h3>${h(k.label)}</h3><p>${k.createdAt ? `Created ${h(atHome(s, null, k.createdAt))}` : ''}</p>${badge(k.revokedAt ? 'Revoked' : 'Active')}${!k.revokedAt ? form('agent.revoke','agent',hidden('id',k.id),'Revoke agent access','class="danger"') : ''}</article>`).join('')
  return heading('A preparer, with boundaries','Agent access','Agents can prepare calendar reviews, turnover assignments and statements. A person approves each exact draft.') + (token ? `<div class="notice"><strong>Copy this token now. It will not be shown again.</strong><code class="token">${h(token)}</code></div>` : '') + `<div class="columns">${panel('Create an agent credential',form('agent.create','agent',field('label','Agent label'),'Create preparation token'))}${panel('Connect your agent','<p>Use <code>Authorization: Bearer TOKEN</code> with <code>GET /api/cabin/agent/context</code> and <code>POST /api/cabin/agent/command</code>.</p><p>The agent may call <code>calendar.prepare</code>, <code>turnover.prepare</code> and <code>statement.prepare</code>. Human sessions approve. Revocation takes effect immediately.</p><p><a href="https://github.com/just-every/run-cabin/blob/main/docs/commands.md">Command inputs and approval contract</a></p>')}</div>` + panel('Credentials',keys || empty('No agent credentials issued.')) + panel('Approval history',s.approvals.length ? `<ol>${s.approvals.slice(-30).reverse().map((a: any) => `<li>${approvalLine(s,a)}</li>`).join('')}</ol>` : empty('Recorded approvals will appear here.'))
}
