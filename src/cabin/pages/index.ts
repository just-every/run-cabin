import { need, type Actor } from '../model'
import { assertLive } from '../storage'
import { requireAction } from '../permissions/policy'
import { draftThreadCount } from './drafts'
import { calendarData } from './calendar'
import { inboxData } from './inbox'
import { pageBase, records, inIds, scoped } from './core'
export type { InboxPage } from './inbox'

/** Call only for the named HTML GET doors; mutation/archive/state reads stay complete. */
export async function readPageData(db:D1Database,actor:Actor,path:string,url:URL) {
 const action=({'/app/calendar':'calendar:read','/app/inbox':'inbox:read','/app/reports':'reports:read'} as Record<string,string>)[path]
 if(!action)throw new Error('No page read model for '+path)
 requireAction(actor,action)
 const data=await pageBase(db,actor)
 let metadata:Record<string,any>={}
 if(path==='/app/calendar')metadata=await calendarData(db,actor,data,url)
 else if(path==='/app/inbox')metadata={inboxPage:await inboxData(db,actor,data,url)}
 else await records(db,data,['feeds','connections'],inIds("json_extract(data,'$.propertyId')"),[scoped(data)])
 metadata.inboxDraftThreads=await draftThreadCount(db,actor,data)
 need((await db.prepare('SELECT version FROM cb_meta WHERE id=1').first<{version:number}>())?.version===data.version,'Records changed while this page was loading. Reload and review.',409)
 await assertLive(db,actor)
 return {data,...metadata}
}
