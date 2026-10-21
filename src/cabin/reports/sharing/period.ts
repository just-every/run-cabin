import { need, text } from '../../model'
import type { ReportSchedule } from './types'
export function runInstant(value:unknown){const s=text(value,'next run time',40),n=Date.parse(s);need(Number.isFinite(n)&&/T/.test(s),'Choose an exact delivery date and time');return new Date(n).toISOString()}
export function periodFilters(s:ReportSchedule){
 const f={...s.filters},d=new Date(s.nextRunAt)
 if(s.period==='previous-month'){f.until=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)).toISOString().slice(0,10);f.from=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1)).toISOString().slice(0,10)}
 if(s.period==='previous-week'){const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));end.setUTCDate(end.getUTCDate()-(end.getUTCDay()+6)%7);f.until=end.toISOString().slice(0,10);f.from=new Date(end.getTime()-7*86400000).toISOString().slice(0,10)}
 return f
}
export function nextOccurrence(s:ReportSchedule){
 const d=new Date(s.nextRunAt)
 if(s.cadence==='weekly')d.setUTCDate(d.getUTCDate()+7)
 if(s.cadence==='monthly'){const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,end))}
 return d.toISOString()
}
