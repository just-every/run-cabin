import { decimalUnits } from '../direct/presentation'
export function promotionInput(p:Record<string,unknown>){
 const out={...p},values=(v:unknown):unknown[]=>Array.isArray(v)?v:v===undefined?[]:[v]
 for(const key of ['minimumNetCents','providerFeeReserveCents','baseCents','costCents']){const dollar=key.replace('Cents','Dollars');if(dollar in p)out[key]=decimalUnits(p[dollar],dollar)}
 for(const [percent,bps]of [['taxPercent','taxBps'],['refundRetainedPercent','refundRetainedBps']])if(percent in p)out[bps]=decimalUnits(p[percent],percent)
 if(typeof p.booking==='string'){const [id,revision]=p.booking.split('|');out.bookingId=id;out.bookingRevision=revision}
 if('couponCode' in p)out.coupons=values(p.couponCode).map((code,i)=>({code,bps:decimalUnits(values(p.couponPercent)[i]||0,'discount percent'),from:values(p.couponFrom)[i],until:values(p.couponUntil)[i],minNights:values(p.couponMinNights)[i],repeatOnly:values(p.couponRepeatOnly)[i]==='yes',channels:values(p['couponChannels_'+i])})).filter(v=>v.code)
 return out
}
