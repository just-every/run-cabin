import { type Actor, need } from '../model'
import { load } from '../storage'
import { hasAction, pageAction, requireAction, requireProperty } from './policy'
/** Every private HTTP read is either scoped here or denied before its handler runs. */
export async function readScope(db:D1Database,actor:Actor,url:URL){
 if(!actor.scope||actor.scope.propertyIds.includes('*')&&actor.scope.actions.includes('*'))return
 const path=url.pathname
 if(path==='/api/cabin/state'||path==='/app')return
 if(path.startsWith('/app/')){need(['/app/calendar','/app/reservations','/app/inbox','/app/guests','/app/readiness','/app/turnovers','/app/maintenance','/app/recovery','/app/reports','/app/statements','/app/ledger','/app/taxes','/app/people'].includes(path),'Page outside your team grant',403);const action=pageAction(path);need(action&&hasAction(actor,action),'Page outside your team grant',403);return}
 if(path==='/api/cabin/access'){requireAction(actor,'access:read');return}
 if(['/api/cabin/reports.json','/api/cabin/reports.csv','/api/cabin/report-sharing.json'].includes(path)){requireAction(actor,'reports:read');return}
 if(path.startsWith('/api/cabin/report-artifacts/')){requireAction(actor,'reports:read');return}
 const statement=path.match(/^\/api\/cabin\/statements\/([\w-]+)\.(?:pdf|csv)$/)
 const agreement=path.match(/^\/api\/cabin\/agreements\/([\w-]+)\/[\w-]+$/)
 const quote=path.match(/^\/api\/cabin\/quotes\/([\w-]+)\/link$/)
 const photo=path.match(/^\/api\/cabin\/(?:photos|turnovers)\/([\w-]+)(?:\/photo)?$/)
 const data=await load(db)
 let propertyId:string|undefined
 if(statement){requireAction(actor,'finance:read');propertyId=data.statements.find(r=>r.id===statement[1])?.propertyId}
 else if(agreement){requireAction(actor,'identity:read');propertyId=data.rentalAgreements.find(r=>r.id===agreement[1])?.propertyId}
 else if(quote){requireAction(actor,'reservations:read');propertyId=data.staffQuotes.find(r=>r.id===quote[1])?.propertyId}
 else if(photo){requireAction(actor,'operations:read');const row=await db.prepare(`SELECT r.data FROM cb_records r WHERE r.id=? OR r.id=(SELECT turnover_id FROM cb_photos WHERE id=?) LIMIT 1`).bind(photo[1],photo[1]).first<{data:string}>();propertyId=row&&JSON.parse(row.data).propertyId}
 else need(false,'This private door is outside your team grant',403)
 need(propertyId,'Record not found',404);requireProperty(actor,propertyId)
}
