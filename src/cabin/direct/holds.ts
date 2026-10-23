import { need,sha } from '../model'
import type { DirectStay } from './types'
/** An unpaid checkout hold closes its nights on every channel. Public checkout keeps at most two open per visitor and three per enabled home across the installation. */
const PER_VISITOR=2,PER_HOME=3
export const visitorHash=(secret:string,address:string|null)=>sha(`${secret}:checkout-visitor:${address??''}`)
export function holdQuota(rows:DirectStay[],visitor:string,enabledHomes:number,now:number){
 const open=rows.filter(s=>s.phase==='held'&&!s.paymentId&&Date.parse(s.holdUntil)>now)
 need(open.filter(s=>s.visitorHash===visitor).length<PER_VISITOR,'You already have dates held for checkout. Finish paying from your booking page, or try again once that hold ends.',429)
 need(open.length<PER_HOME*enabledHomes,'Several guests are checking out right now. Try again in a few minutes.',429)
}
