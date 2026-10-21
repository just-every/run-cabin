import { sweepQuotes } from './reservations/quotes'
import { generateStatements } from './finance/close-schedule'
import { advanceIssueChecks } from './issues/due'
import { restorationPaused } from './connections/guard'
import { deliverTaxes } from './taxes/delivery'
import { load, mutate, SYSTEM } from './storage'
import { deliverStatements } from './finance/delivery'
import type { Bindings } from '../auth.server'
import { deliverNotices } from './notify'
import { pushLocks } from './locks'
import { deliverGuestMessages } from './inbox/deliver'
import { escalateReplies } from './inbox/reply-policy'
import { finishDrafts } from './inbox/drafts'
import { advanceCases } from './inbox/team/advance'
/** After a commit, and on every Cron: send the emails dispatch wrote, deliver approved statements, push door codes to connected locks, write waiting AI drafts and send the guest messages that are due. What fails is retried on the next run. */
export async function settle(env: Bindings) {
 if(await restorationPaused(env.DB))return
 await sweepQuotes(env)
 // The five-minute Cron also advances unanswered offers and pre-arrival deadlines when no booking changed.
 if ((await load(env.DB)).homeSettings.some(s => s.dispatch)) await mutate(env.DB, SYSTEM, 'turnover.deadlines', () => undefined, () => false)
 try { await advanceIssueChecks(env) } catch { console.error('Cabin issue follow-up failed') }
 try { await deliverNotices(env) } catch (error) { console.error('Cabin notices', (error as Error).message) }
 try { await deliverTaxes(env) } catch { console.error('Cabin tax packet delivery failed') }
 try { await generateStatements(env) } catch { console.error('Cabin statement generation failed') }
 try { await deliverStatements(env) } catch { console.error('Cabin statement delivery failed') }
 try { await pushLocks(env) } catch (error) { console.error('Cabin locks', (error as Error).message) }
 try { await finishDrafts(env) } catch (error) { console.error('Cabin drafts', (error as Error).message) }
 try { await escalateReplies(env); await advanceCases(env); await deliverNotices(env) } catch { console.error('Cabin reply escalation failed') }
 try { await deliverGuestMessages(env) } catch (error) { console.error('Cabin guest messages', (error as Error).message) }
}
