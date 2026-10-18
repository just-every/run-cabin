import { manager, need, type Actor } from '../model'
import { assertLive } from '../storage'
import { taxData } from './store'
import { packet } from './delivery'
export async function taxExport(db:D1Database,actor:Actor,id:string){
 manager(actor);need(!actor.isAgent,'Human manager access required',403);await assertLive(db,actor)
 const data=await taxData(db),report=data.reports.find(r=>r.id===id);need(report,'Tax review not found',404)
 const exported={...report,packets:report.obligations.map(o=>packet(report,o)),deliveries:data.deliveries.filter(d=>d.reportId===id),evidence:data.evidence.filter(e=>e.reportId===id),balances:report.obligations.map(o=>({jurisdictionId:o.jurisdiction.id,hostCents:o.hostCents,paidCents:data.evidence.filter(e=>e.reportId===id&&e.jurisdictionId===o.jurisdiction.id&&e.kind==='payment').reduce((n,e)=>n+e.amountCents,0)}))}
 await assertLive(db,actor);return JSON.stringify(exported,null,2)+'\n'
}
