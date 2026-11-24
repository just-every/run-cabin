import type { Bindings } from '../auth.server'
import { syncDue } from './channels'
import { directDue } from './direct/payments'
import { pollChannels } from './inbox/inbound'
import { promotionDue } from './promotions/payments'
import { settle } from './settle'
/**
 * The five-minute Cron: poll every connected channel calendar whose interval is due (SYNC-009),
 * then send turnover emails, push door codes the new stays made (OPS-001, OPS-005) and send the
 * guest messages that have fallen due (MESSAGE-003). Each step first asks cron-due.ts whether
 * anything is due, so a quiet tick reads the same few rows however much history is stored.
 */
export async function runCron(env: Bindings) {
 await Promise.all([syncDue(env), directDue(env), pollChannels(env).catch(error => console.error('Cabin channel messages', error.message))])
 await promotionDue(env)
 await settle(env)
}
