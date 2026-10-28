import { safeScreenshot } from './observation.mjs';
import { detectChallenge, installNavigationGuard, allowedNavigation } from './policy.mjs';

export const READ_FIELDS = Object.freeze({
 'read-reservations': ['listingId', 'reservationId', 'guestName', 'start', 'end', 'status'],
 'read-messages': ['listingId', 'reservationId', 'messageId', 'text', 'sentAt', 'direction'],
 'read-payouts': ['listingId', 'transactionId', 'payoutId', 'reservationId', 'date', 'currency', 'gross', 'fee', 'net', 'type', 'status'],
});
const OPTIONAL = { 'read-reservations': ['guestEmail', 'guestPhone', 'threadId', 'guests', 'currency', 'quote', 'deadline', 'message'], 'read-messages': [], 'read-payouts': ['guestName'] };

// Values never enter the model request. The model maps visible headers to fields;
// the browser copies the corresponding cells locally without interpreting text.
async function tablesOn(page) {
 return page.evaluate(() => {
  const visible = el => { const r=el.getBoundingClientRect(); return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none'; };
  return [...document.querySelectorAll('table,[role="table"],[role="grid"]')].filter(visible).slice(0,20).map((table,index)=>{
   const rows=[...table.querySelectorAll('tr,[role="row"]')].filter(visible);
   const header=rows.find(row=>row.querySelector('th,[role="columnheader"]'));
   const headers=header?[...header.querySelectorAll('th,td,[role="columnheader"],[role="cell"]')].filter(visible).map(c=>c.innerText.trim()):[];
   const data=rows.filter(row=>row!==header&&!row.querySelector('th,[role="columnheader"]')).map(row=>[...row.querySelectorAll('td,[role="cell"],[role="gridcell"]')].filter(visible).map(c=>c.innerText.trim()));
   return {ref:String(index),headers,rows:data};
  }).filter(t=>t.headers.length&&t.headers.length<=30&&t.rows.length<=100);
 });
}

export async function executeRead(page,job,driver,{policy,beforeAction,onBefore}={}) {
 let guard;
 try {
  if(!READ_FIELDS[job.kind]||!allowedNavigation(job.readUrl,job.channel,policy)||typeof driver!=='function')return {outcome:'needs_you'};
  guard=await installNavigationGuard(page.context(),job.channel,policy);
  await beforeAction?.(job);
  await page.goto(job.readUrl,{waitUntil:'domcontentloaded',timeout:30000});
  if(guard.state.blocked)return {outcome:'needs_you',challenge:guard.state.challenge||'bot'};
  const challenge=await detectChallenge(page,guard);
  if(challenge)return {outcome:'needs_you',challenge};
  const before=await safeScreenshot(page,guard);
  await onBefore?.(job,before);
  const tables=await tablesOn(page);
  const selection=await driver({phase:'read',job:{kind:job.kind,channel:job.channel},observation:{tables:tables.map(({ref,headers})=>({ref,headers})),required:READ_FIELDS[job.kind],optional:OPTIONAL[job.kind]}});
  const table=tables.find(t=>t.ref===selection?.table);
  if(selection?.type!=='extract'||!table||!selection.columns||!table.rows.length)return {outcome:'needs_you'};
  const keys=Object.keys(selection.columns),allowed=[...READ_FIELDS[job.kind],...OPTIONAL[job.kind]];
  if(keys.some(k=>!allowed.includes(k))||READ_FIELDS[job.kind].some(k=>!keys.includes(k))||new Set(Object.values(selection.columns)).size!==keys.length)return {outcome:'needs_you'};
  for(const index of Object.values(selection.columns))if(!Number.isInteger(index)||index<0||index>=table.headers.length)return {outcome:'needs_you'};
  const current=await tablesOn(page);
  // Refuse a changing table, so model latency cannot mix source revisions.
  if(JSON.stringify(current)!==JSON.stringify(tables))return {outcome:'needs_you'};
  const later=await detectChallenge(page,guard);
  if(later||guard.state.blocked)return {outcome:'needs_you',challenge:later||'bot'};
  await beforeAction?.(job);
  const records=table.rows.map(row=>Object.fromEntries(keys.filter(k=>READ_FIELDS[job.kind].includes(k)||row[selection.columns[k]]).map(k=>[k,row[selection.columns[k]]??''])));
  if(records.some(row=>READ_FIELDS[job.kind].some(k=>!row[k])||Object.values(row).some(v=>v.length>8000)))return {outcome:'needs_you'};
  return {outcome:'succeeded',result:'read',before,after:await safeScreenshot(page,guard),read:{observedAt:new Date().toISOString(),records},canUndo:false};
 } catch { return {outcome:'needs_you'}; }
 finally {await guard?.dispose();}
}
