import { need, type Actor } from '../model'
export const roleNames = {
 manager:'Portfolio manager', reservation:'Reservation staff', guest_service:'Guest-service staff', accountant:'Accountant', inspector:'Inspector', cleaner:'Cleaner', maintenance:'Maintenance vendor', rental_owner:'Rental owner'
} as const
export type PmsRole=keyof typeof roleNames
const reservation=['reservation.create','reservation.request','reservation.move','reservation.end','reservation.cancel','reservation.reconcile','reservation.amend','booking.details','quote.issue','quote.revise','quote.expire']
const inbox=['message.compose','message.send','message.retry','message.discard','thread.accept','thread.assign','thread.claim','thread.handover','thread.note','thread.promise.done','thread.template','thread.triage','message.arrival.approve']
const operations=['turnover.prepare','turnover.approve','turnover.assign','turnover.offers','turnover.accept','turnover.decline','turnover.checkout','turnover.complete','task.raise','task.assign','task.close','work.configure','work.accept','work.decline','work.quote','work.approveQuote','work.invoice','work.approveInvoice','work.complete','work.inspect','readiness.plan','readiness.attest','readiness.chase','portal.guide','portal.link.rotate','portal.sessions.end','portal.guide.file.add','portal.guide.file.remove','issue.accept','issue.dispatch','issue.followup','issue.open','issue.propose','issue.troubleshoot']
const finance=['direct.manual.receive','direct.collection.create','direct.collection.revise','direct.collection.refresh','direct.collection.retry','ledger.post','ledger.reverse','ledger.close','statement.prepare','statement.approve','statement.close.prepare','statement.deliver','payout.import','payout.match','tax.report.prepare','tax.report.approve','tax.report.deliver']
const reports=['report.save','report.schedule','report.pause','report.followup.resolve']
export const roleActions:Record<PmsRole,string[]>={
 manager:['calendar:read','reservations:read','inbox:read','operations:read','finance:read','reports:read','owners:read','access:read','identity:read',...reservation,...inbox,...operations,...finance,...reports,'calendar.prepare','calendar.approve','question.investigate'],
 reservation:['calendar:read','reservations:read',...reservation],
 guest_service:['calendar:read','reservations:read','inbox:read','operations:read','access:read',...inbox,'booking.details','portal.link.rotate','portal.sessions.end','task.raise','issue.open','issue.followup'],
 accountant:['finance:read','reports:read',...finance,...reports],
 inspector:['operations:read','access:read','work.inspect','task.raise'],
 cleaner:['operations:read','access:read','turnover.accept','turnover.decline','turnover.checkout','turnover.complete','task.raise','task.close'],
 maintenance:['operations:read','access:read','work.accept','work.decline','work.quote','work.invoice','work.complete','task.raise','task.close'],
 rental_owner:['owners:read','rentalOwner.stay.request','rentalOwner.stay.edit','rentalOwner.stay.cancel','rentalOwner.expense.decide']
}
export function hasAction(actor:Actor,action:string){return !actor.scope||actor.role==='owner'||actor.scope.actions.includes('*')||actor.scope.actions.includes(action)}
export function permitsProperty(actor:Actor,id:string){return !actor.scope||actor.role==='owner'||actor.scope.propertyIds.includes('*')||actor.scope.propertyIds.includes(id)}
export function requireAction(actor:Actor,action:string){need(hasAction(actor,action),'This action is outside your team grant',403)}
export function requireProperty(actor:Actor,id:string){need(permitsProperty(actor,id),'Record not found',404)}
export const serviceRole=(role:string)=>['cleaner','inspector','maintenance'].includes(role)
export function pageAction(path:string){
 const page=path.split('/')[2]||'calendar'
 return ({direct:'finance:read',calendar:'calendar:read',reservations:'reservations:read',inbox:'inbox:read',guests:'reservations:read',readiness:'operations:read',turnovers:'operations:read',maintenance:'operations:read',recovery:'operations:read',reports:'reports:read',questions:'reports:read',statements:'finance:read',ledger:'finance:read',taxes:'finance:read',people:'owners:read'} as Record<string,string>)[page]
}
