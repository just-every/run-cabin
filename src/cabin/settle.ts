import type { Bindings } from '../auth.server'
import { deliverNotices } from './notify'
import { pushLocks } from './locks'
/** After a commit, and on every Cron: send the emails dispatch wrote and push door codes to connected locks. What fails is retried on the next run. */
export async function settle(env: Bindings) {
 try { await deliverNotices(env) } catch (error) { console.error('Cabin notices', (error as Error).message) }
 try { await pushLocks(env) } catch (error) { console.error('Cabin locks', (error as Error).message) }
}
