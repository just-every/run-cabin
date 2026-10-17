import { deliverStatements } from './finance/delivery'
import type { Bindings } from '../auth.server'
import { deliverNotices } from './notify'
import { pushLocks } from './locks'
import { deliverGuestMessages } from './inbox/deliver'
import { finishDrafts } from './inbox/drafts'
/** After a commit, and on every Cron: send the emails dispatch wrote, deliver approved statements, push door codes to connected locks, write waiting AI drafts and send the guest messages that are due. What fails is retried on the next run. */
export async function settle(env: Bindings) {
 try { await deliverNotices(env) } catch (error) { console.error('Cabin notices', (error as Error).message) }
 try { await deliverStatements(env) } catch { console.error('Cabin statement delivery failed') }
 try { await pushLocks(env) } catch (error) { console.error('Cabin locks', (error as Error).message) }
 try { await finishDrafts(env) } catch (error) { console.error('Cabin drafts', (error as Error).message) }
 try { await deliverGuestMessages(env) } catch (error) { console.error('Cabin guest messages', (error as Error).message) }
}
