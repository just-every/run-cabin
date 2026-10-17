import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { harness } from './harness.mjs'

// A hosted demo's app gets only deploy-demo.json's settings, not deploy.json's vars.
const { settings = {} } = JSON.parse(await readFile('deploy-demo.json', 'utf8'))

test('a demo opens on a lived-in rental business whose waiting drafts approve, and an invitation is simulated', async () => {
  const h = await harness({ entry: 'tests/demo-worker.ts', auth: { RER_DEMO: '1', MAIL_FROM: '', ...settings } })
  try {
    const s = await h.state()
    assert.equal(s.properties.length, 12)
    assert.ok(s.bookings.length > 60 && s.feeds.length > 12)
    assert.deepEqual(new Set(s.turnovers.map(t => t.status)), new Set(['completed', 'approved', 'draft']))
    assert.deepEqual(new Set(s.statements.map(r => r.status)), new Set(['approved', 'draft']))
    const waiting = s.calendarDrafts.filter(d => d.status === 'draft')
    assert.equal(waiting.length, 3)
    assert.ok(waiting.some(d => d.clashes.length) && waiting.some(d => d.changes.some(change => change.kind === 'cancel')))
    // Seeded drafts pass the same fences a person's approval checks.
    for (const draft of waiting.filter(d => !d.clashes.length)) await h.cmd('calendar.approve', { id: draft.id, revision: draft.revision })
    const turnover = s.turnovers.find(t => t.status === 'draft'), statement = s.statements.find(r => r.status === 'draft')
    await h.cmd('turnover.approve', { id: turnover.id, revision: turnover.revision })
    await h.cmd('statement.approve', { id: statement.id, revision: statement.revision })
    const photo = await h.mf.dispatchFetch(`${h.origin}/api/cabin/turnovers/${s.turnovers.find(t => t.status === 'completed').id}/photo`, { headers: { cookie: h.owner } })
    assert.equal(photo.status, 200)
    assert.equal(photo.headers.get('content-type'), 'image/png')
    assert.ok((await photo.arrayBuffer()).byteLength > 500)
    // An invitation is an email to a person: it completes, and nothing is kept or shown.
    assert.deepEqual(await h.cmd('member.invite', { id: s.members.find(m => m.name === 'Rosa Delgado').id }), { id: 'demo-member-rosa', invited: true })
    assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM rer_mail_development_outbox').first()).n, 0)
    const page = await h.send('/app', undefined, h.owner)
    assert.equal(page.status, 200)
    assert.equal(page.text.match(/<[a-z]+ [^>]*data-rer-name/g).length, 1)
    assert.match(page.text, /<title>Calendar · Cabin Demo<\/title>/)
  } finally { await h.close() }
})
