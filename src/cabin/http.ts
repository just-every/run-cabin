import { taxCommand } from './taxes/commands'
import { taxExport } from './taxes/export'
import { importHistory } from './audit/imports'
import { history, exportHistory } from './audit/read'
import { record } from './audit/write'
import { assertLive } from './storage'
import { ledgerState } from './ledger/store'
import { csvCell } from './statements'
import { recoveryWording } from './recovery/wording'
import { authResponse } from '../auth.server'
import { quickBooksCommand } from './finance/quickbooks'
import { booksCommand, exportBooks } from './finance/books'
import { portalState } from './owners/access'
import { portalPage } from './owners/ui'
import { ownersResponse } from './owners/http'
import { financeImport } from './finance/import'
import { resendStatement } from './finance/delivery'
import { runtimeBindings,type Bindings } from '../auth.server'
import { command,snapshot,turnoverPhoto } from './domain'
import { statementCsv } from './statements'
import { importCommand } from './movein'
import { principal,credentialCommand } from './credentials'
import { channelCommand } from './channels'
import { icalExportResponse } from './ical-export'
import { settle } from './settle'
import { guestStayResponse } from './guest'
import { fail,need,type Actor } from './model'
import { renderApp } from './ui'
import { readyMessage } from './ui/turnovers'
import { bookingResponse } from './direct/http'
import { directCommand } from './direct/admin'
import { stay } from './direct/store'
import { signedAgreement } from './direct/public-ui'
import { manager } from './model'
import { inboxCommand } from './inbox/commands'
import { smsResponse } from './inbox/sms'
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-robots-tag':'noindex, nofollow'}
const json=(value:unknown,status=200)=>Response.json(value,{status,headers})
const pages=new Set(['/app','/app/calendar','/app/readiness','/app/turnovers','/app/maintenance','/app/statements','/app/people','/app/guests','/app/import','/app/agent','/app/direct','/app/books','/app/taxes','/app/ledger','/app/activity','/app/inbox','/app/reservations','/app/channels','/app/recovery','/app/recovery/setup','/app/signin'])
const AGENT_COMMANDS=['calendar.prepare','turnover.prepare','statement.prepare']
async function execute(request:Request,env:Bindings,who:Actor,name:string,input:Record<string,unknown>){
 if(who.isAgent)need(AGENT_COMMANDS.includes(name),'Agents may only prepare drafts. Human approval is required.',403)
 if(name.startsWith('agent.')||name==='member.invite')return credentialCommand(request,env,who,name,input)
 if(name.startsWith('import.'))return importHistory(env.DB,who,name,input,()=>importCommand(env.DB,who,name,input))
 const result=name.startsWith('tax.')?await taxCommand(env,who,name,input):name==='recovery.wording'||name==='recovery.ai.test'?await recoveryWording(env,who,name,input):name==='books.export.prepare'?await quickBooksCommand(env,who,input):name.startsWith('books.')?await booksCommand(env,who,name,input):name.startsWith('payout.')?await financeImport(env,who,name,input):name==='statement.deliver'?await resendStatement(env,who,input):name.startsWith('direct.')?await directCommand(env,who,name,input):name.startsWith('channel.')?await channelCommand(env,who,name,input):name.startsWith('message.')||name.startsWith('inbox.')?await inboxCommand(env,who,name,input):await command(env.DB,who,name,input)
 await settle(env);return result
}
/** Photo forms save through the command API in the browser, then return here with ?done=NAME: say what was saved and where it shows. */
function savedMessage(name:string|null,who:Actor,state:any,record:string|null){
 if(name==='task.raise')return who.role==='cleaner'?'Reported. It is saved on this job below, and your manager sees it under Maintenance.':'Maintenance task added. It is listed under Maintenance with its photos.'
 if(name==='turnover.complete')return readyMessage(state,record)
 if(name==='task.close')return 'Task closed. The fix and its photos are kept on the task.'
 return undefined
}
function actionMessage(name:string,result:any,local:boolean,state:any){
 if(name==='recovery.ai.test')return result.message
 if(name==='recovery.wording')return 'Wording drafted. Review this exact revision before approval.'
 if(name==='recovery.open')return 'Recovery case opened. Review and propose the next action below.'
 if(name==='recovery.close')return 'Readiness checked. The case closes when the guest confirmation is accepted.'
 if(name==='recovery.approve'&&state.turnovers.find((t:any)=>t.id===result.turnoverId)?.status==='unassigned')return 'Recovery approved. The replacement cleaner has an offer and must accept after capacity and travel checks. The guest update and owner adjustment are recorded.'
 if(name==='recovery.approve')return 'Approved and applied. The replacement cleaner is assigned and emailed, the guest has a new door code and the update, and the owner adjustment is frozen.'
 if(name==='recovery.reject')return 'Proposal rejected. Nothing was applied; the case is open for a new plan.'
 if(name==='recovery.plan'||name==='recovery.propose')return result.status==='escalated'?'No backup cleaner is free in this window. The case needs the owner.':result.status==='active'?'Applied within the owner’s limits.':'Plan drafted. Review the replacement, credit and guest message, then approve or reject.'
 if(name==='import.provider.preview')return 'Preview ready. No listings, reservations or balances have been imported.'
 if(name==='import.provider.apply')return 'Imported. Review the source and Cabin totals before signing off.'
 if(name==='import.provider.signoff')return 'Cutover signed off. Your totals and explanations are recorded.'
 if(name==='import.provider.undo')return 'Move-in undone. Imported listings, stays, guests, balances and calendar links were removed.'
 if(name==='privacy.erase'&&result.reservations)return `Guest operational identity erased from ${result.reservations} reservation${result.reservations===1?'':'s'}. History keeps anonymous action references.`
 if(name==='books.export.prepare')return 'QuickBooks files ready. Download the CSV or IIF file below and import it into QuickBooks.'
 if(name.endsWith('.prepare'))return 'Draft prepared. Review this revision before approval.'
 if(name==='payout.import'||name==='payout.stripe')return `${result.imported.length} payout lines imported; ${result.matched} matched to stays. ${result.duplicates.length} already imported lines skipped.`
 if(name==='statement.approve')return 'Statement approved and frozen. Owner email delivery status is shown below.'
 if(name==='statement.deliver')return 'Owner email requested. Check delivery status below.'
 if(name==='turnover.complete')return readyMessage(state,result.id)
 if(name==='turnover.checkout')return 'Check-out recorded.'
 if(name==='turnover.accept')return 'Accepted. Your current window, instructions and door code are shown below.'
 if(name==='turnover.decline')return 'Response saved. Cabin is asking eligible backups and your manager sees any work still at risk.'
 if(name==='turnover.offers')return 'Offers reopened. Eligible cleaners are emailed; the first eligible acceptance gets this job.'
 if(name==='cleaner.capacity')return 'Capacity and home base saved. Open assignments are checked against them.'
 if(name==='home.drive')return 'Drive time saved for these addresses. Changed addresses require a new drive time.'
 if(name==='turnover.assign'&&result.status==='unassigned')return 'Offer sent. The cleaner must accept before being assigned or receiving door access.'
 if(name==='turnover.assign')return 'Assigned. The cleaner is emailed the window, address and door code.'
 if(name==='turnover.approve')return 'Approved and assigned. The cleaner is emailed the window, address and door code.'
 if(name==='home.settings')return 'Turnover settings saved. Unfinished jobs now use this checklist and photo requirement.'
 if(name==='task.raise')return result.assigneeId?'Maintenance task added and its assignee emailed.':'Maintenance task added. Choose who fixes it.'
 if(name==='task.assign')return 'Task assigned and emailed.'
 if(name==='task.close')return 'Task closed.'
 if(name==='reservation.request')return result.status==='declined'?`Request declined: ${result.reason}.`:result.kind==='block'?'Nights blocked on every channel.':'Request accepted. These nights now close on every channel.'
 if(name==='channel.connect'||name==='channel.update'||name==='channel.sync')return result.connection.status==='ok'?`Synced: ${result.changes} change${result.changes===1?'':'s'}.`:`Sync failed: ${result.connection.error}`
 if(name==='reservation.move')return 'Stay moved. Its turnover, door codes and scheduled messages moved with it.'
 if(name==='message.arrival.approve')return 'Early check-in approved. The guest access window and cleaner window changed; guest mail status is in the thread.'
 if(name==='inbox.reply.policy')return 'Reply authority and approved sources saved.'
 if(name==='message.send')return 'Approved exactly as written. The thread shows when it went out, or why it could not.'
 if(name==='message.compose')return 'Sending. The thread shows when it went out, or why it could not.'
 if(name==='message.discard')return 'Draft discarded. Nothing was sent.'
 if(name==='message.retry')return 'Sending again.'
 if(name==='member.invite')return 'Sign-in invitation sent. Ask your teammate to check their email.'
 if(name.startsWith('direct.stripe.')&&result.message)return result.message
 if(name==='inbox.address')return result.address?(local?`Saved ${result.address}. This local Cabin cannot receive internet mail: use Try a guest email here, and guest email arrives at this address once Cabin is hosted and Email Routing sends it to Cabin’s Worker.`:`Saved. Guest email sent to ${result.address} arrives here once Email Routing sends that address to Cabin’s Worker.`):'Inbox address removed.'
 if(name==='inbox.schedule')return 'Scheduled messages saved. Every upcoming stay follows them.'
 if(name==='inbox.ai.save')return 'AI key saved. New guest messages get an AI draft.'
 if(name==='inbox.ai.remove')return 'AI key removed. Drafts come from templates.'
 if(name==='inbox.ai.test')return result.message
 if(name==='inbox.try')return 'Received: it is in the sender’s thread with a drafted reply.'
 if(name==='export.publish')return 'Export links ready. Paste each one into its channel; older links stop working.'
 return 'Saved.'
}
async function bodyBytes(request:Request){
 const limit=4_000_000;need(Number(request.headers.get('content-length')??0)<=limit,'Request is too large',413)
 const reader=request.body?.getReader();if(!reader)return new Uint8Array()
 const chunks:Uint8Array[]=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();fail('Request is too large',413)}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length}return bytes
}
async function inputBody(request:Request):Promise<Record<string,unknown>>{
 const bytes=await bodyBytes(request),type=request.headers.get('content-type')??'';let input:Record<string,unknown>
 if(type.includes('application/json')){let value:unknown;try{value=JSON.parse(new TextDecoder().decode(bytes))}catch{fail('Invalid JSON')};need(value&&typeof value==='object'&&!Array.isArray(value),'Expected a JSON object');return value as Record<string,unknown>}
 if(type.includes('multipart/form-data')){
  const form=await new Response(bytes,{headers:{'content-type':type}}).formData();input={}
  for(const key of new Set(form.keys())){const value=form.get(key)
   if(key==='sourceFiles'){const files=[];for(const file of form.getAll(key)){if(file===''||(file instanceof File&&!file.name&&!file.size))continue;need(file instanceof File&&file.size>0&&file.size<=2_000_000,'Choose export files up to 2 MB');files.push({name:file.name,text:await file.text()})}input.files=files}
   else if(key==='payoutFile'){need(value instanceof File&&value.size>0&&value.size<=2_000_000,'Choose a payout CSV up to 2 MB');input.csv=await value.text()}
   else if(key==='photoFiles'){const photos=[];for(const file of form.getAll(key)){if(!(file instanceof File)||!file.size)continue;need(file.size<=256_000,'Use photos up to 256 KB each');const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(const b of bytes)binary+=String.fromCharCode(b);photos.push({photo:btoa(binary),mimeType:file.type})}input.photos=photos}
   else{need(!(value instanceof File),'Upload photos with the photo field');input[key]=form.getAll(key).length>1?form.getAll(key):value}
  }
 }else if(type.includes('application/x-www-form-urlencoded')){const form=new URLSearchParams(new TextDecoder().decode(bytes));input=Object.fromEntries(form);if(form.has('cleanerIds'))input.cleanerIds=form.getAll('cleanerIds').filter(Boolean);if(form.has('approvedCleanerIds'))input.approvedCleanerIds=form.getAll('approvedCleanerIds').filter(Boolean);if(form.has('expenseDescription')){input.expenseDescription=form.getAll('expenseDescription');input.expenseAmount=form.getAll('expenseAmount')}if(form.has('lineDescription')){input.lineDescription=form.getAll('lineDescription');input.lineAmount=form.getAll('lineAmount')}}
 else return fail('Use JSON, a form, or a photo upload',415)
 if(input.dispatchEnabled==='on')input.dispatch={templateName:input.dispatchTemplateName,instructions:input.dispatchInstructions,durationMinutes:Number(input.dispatchDurationMinutes),rateCents:Math.round(Number(input.dispatchRateDollars)*100),startOffsetMinutes:Number(input.dispatchStartOffsetMinutes),finishBeforeMinutes:Number(input.dispatchFinishBeforeMinutes),approvedCleanerIds:Array.isArray(input.approvedCleanerIds)?input.approvedCleanerIds:[input.approvedCleanerIds].filter(Boolean),offerCount:Number(input.dispatchOfferCount),responseMinutes:Number(input.dispatchResponseMinutes),reminderMinutes:Number(input.dispatchReminderMinutes),escalationMinutes:Number(input.dispatchEscalationMinutes)}
 if('commissionPercent' in input){const amount=String(input.commissionPercent);need(/^\d+(?:\.\d{1,2})?$/.test(amount),'Enter a commission percentage with at most two decimal places');input.commissionBps=Math.round(Number(amount)*100);delete input.commissionPercent}
 for(const key of ['commissionBps','managementFeeCents'])if(key in input&&input[key]!=='')input[key]=Number(input[key]);else if(input[key]==='')delete input[key]
 if(typeof input.revision==='string'&&/^\d+$/.test(input.revision))input.revision=Number(input.revision)
 if('active'in input)input.active=input.active==='true'||input.active==='on'||input.active==='1'
 for(const key of ['checklist','checks'])if(typeof input[key]==='string'){
  const value=(input[key] as string).trim();if(value.startsWith('[')){try{input[key]=JSON.parse(value)}catch{fail(`Invalid ${key}`)}}else input[key]=value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean)
 }
 if(Array.isArray(input.lineDescription)){const amounts=input.lineAmount;need(Array.isArray(amounts)&&amounts.length===input.lineDescription.length,'Enter an amount for every statement line');input.lines=input.lineDescription.map((description,i)=>{const amount=String(amounts[i]).trim();need(/^-?[0-9]+(?:\.[0-9]{1,2})?$/.test(amount),'Use a USD amount with at most two decimal places');const [whole,fraction='']=amount.replace('-','').split('.');const amountCents=(Number(whole)*100+Number(fraction.padEnd(2,'0')))*(amount.startsWith('-')?-1:1);need(Number.isSafeInteger(amountCents),'Amount is too large');return {description,amountCents}});delete input.lineDescription;delete input.lineAmount}
 if(Array.isArray(input.expenseDescription)){const amounts=input.expenseAmount;need(Array.isArray(amounts)&&amounts.length===input.expenseDescription.length,'Enter an amount for every expense');input.expenses=input.expenseDescription.flatMap((description,i)=>{const amount=String(amounts[i]).trim();if(!String(description).trim()&&!amount)return [];need(/^[0-9]+(?:\.[0-9]{1,2})?$/.test(amount),'Use a positive USD expense with at most two decimal places');const [whole,fraction='']=amount.split('.');return [{description,amountCents:Number(whole)*100+Number(fraction.padEnd(2,'0'))}]});delete input.expenseDescription;delete input.expenseAmount}
 if(typeof input.lines==='string'){try{input.lines=JSON.parse(input.lines)}catch{fail('Statement lines must be a JSON array')}}
 return input
}
/** The owner's sign-in settings, read through Base's own JSON answer for this session. */
async function signInSettings(request:Request,env:Bindings){
 const headers=new Headers(request.headers);headers.set('accept','application/json')
 const r=await authResponse(new Request(new URL('/auth/settings/identity',request.url),{headers}),env)
 return r?.ok?await r.json() as {idpSignIn?:boolean}:null
}
export async function cabinResponse(request:Request,original:Bindings):Promise<Response|null>{
 const url=new URL(request.url),path=url.pathname
 if(path==='/owners'||path.startsWith('/owners/'))return ownersResponse(request,original)
 if(path==='/book'||path.startsWith('/book/'))return bookingResponse(request,runtimeBindings(original))
 if(path.startsWith('/ical/'))return icalExportResponse(request,runtimeBindings(original))
 if(path.startsWith('/stay/'))return guestStayResponse(request,runtimeBindings(original))
 if(path==='/inbound/sms')return smsResponse(request,runtimeBindings(original))
 if(!path.startsWith('/api/cabin/')&&path!=='/app'&&!path.startsWith('/app/'))return null
 const env=runtimeBindings(original),isAgent=path.startsWith('/api/cabin/agent/'),[returnPath,returnQuery='']=(url.searchParams.get('returnTo')??'').split('?'),back=pages.has(returnPath)?returnPath:'/app',thread=new URLSearchParams(returnQuery).get('thread')??url.searchParams.get('thread');let who:Actor|undefined
 try{
  need(url.origin===env.AUTH_ORIGIN&&(!request.headers.has('host')||request.headers.get('host')===url.host),'Wrong application origin',403)
  need(request.method==='GET'||request.method==='POST','Method not allowed',405)
  // Origin is the CSRF boundary for ambient human sessions, including all
  // urlencoded and multipart forms. Bearer routes never accept a session alone.
  if(request.method==='POST'&&!isAgent)need(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','Cross-site request refused',403)
  who=await principal(request,env,isAgent)
  if(request.method==='GET'){
   if(path==='/app/owners/preview'){manager(who);const state=await snapshot(env,who),home=state.properties.find(p=>p.id===url.searchParams.get('property'));need(home,'Home not found',404);return portalPage(await portalState(env,home.ownerEmail),true)}
   const tax=path.match(/^\/api\/cabin\/taxes\/([\w-]+)\.json$/)
   if(tax)return new Response(await taxExport(env.DB,who,tax[1]),{headers:{...headers,'content-type':'application/json; charset=utf-8','content-disposition':`attachment; filename="cabin-tax-${tax[1]}.json"`}})
   const books=path.match(/^\/api\/cabin\/books\/([\w-]+)\.(csv|iif)$/)
   if(books)return new Response(await exportBooks(env.DB,who,books[1],books[2] as 'csv'|'iif'),{headers:{...headers,'content-type':'text/plain; charset=utf-8','content-disposition':`attachment; filename="cabin-books-${books[1]}.${books[2]}"`}})
   if(path==='/api/cabin/activity')return json(await history(env.DB,who,url.searchParams))
   if(path==='/api/cabin/activity.jsonl'){manager(who);need(!who.isAgent,'Human access required',403);await assertLive(env.DB,who);return new Response(exportHistory(env.DB,who,url.searchParams),{headers:{...headers,'content-type':'application/x-ndjson; charset=utf-8','content-disposition':'attachment; filename="cabin-activity.jsonl"'}})}
   if(path==='/api/cabin/ledger.csv'){manager(who);need(!who.isAgent,'Human access required',403);const ledger=await ledgerState(env.DB,who);const rows=[['Journal','Entity','Property','Owner reference','Reservation','Effective','Posted','Actor','Source type','Source','Revision','Reversal','Correction','Account','Debit USD cents','Credit USD cents'],...ledger.journals.flatMap(j=>j.lines.map(l=>[j.id,j.legalEntity,j.propertyId,j.ownerKey,j.bookingId,j.effectiveDate,j.postedAt,j.actorId,j.sourceType,j.sourceId,j.sourceRevision,j.reversalOf??'',j.correctionOf??'',l.account,l.debitCents,l.creditCents]))];return new Response(rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="cabin-ledger.csv"'}})}
   if(pages.has(path)){const state=await snapshot(env,who),identity=path==='/app/signin'?await signInSettings(request,original):undefined;return renderApp(state,path,{identity,activity:path==='/app/activity'?await history(env.DB,who,url.searchParams):undefined,activityParams:url.searchParams,from:url.searchParams.get('from'),days:url.searchParams.get('days'),home:url.searchParams.get('home'),thread,message:savedMessage(url.searchParams.get('done'),who,state,url.searchParams.get('record'))})}
   if(path==='/api/cabin/state'||path==='/api/cabin/agent/context')return json(await snapshot(env,who))
   const agreement=path.match(/^\/api\/cabin\/direct\/stays\/([\w-]+)\/agreement$/)
   if(agreement){manager(who);return signedAgreement(await stay(env.DB,agreement[1]))}
   const csv=path.match(/^\/api\/cabin\/statements\/([\w-]+)\.csv$/)
   if(csv)return new Response(await statementCsv(env.DB,who,csv[1]),{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="cabin-statement-${csv[1]}.csv"`}})
   const photo=path.match(/^\/api\/cabin\/turnovers\/([\w-]+)\/photo$/),direct=path.match(/^\/api\/cabin\/photos\/([\w-]+)$/)
   if(photo||direct){const saved=await turnoverPhoto(env.DB,who,(photo??direct)![1],!!direct);return new Response(saved.bytes,{headers:{...headers,'content-type':saved.mimeType,'content-disposition':'inline','content-security-policy':"default-src 'none'; sandbox"}})}
  }else if(path==='/app/action'){
   const input=await inputBody(request),name=url.searchParams.get('name')??'',result=await execute(request,env,who,name,input)
   if(name==='direct.stripe.test'&&(result as {url?:string}).url)return new Response(null,{status:303,headers:{...headers,location:(result as {url:string}).url}})
   const state=await snapshot(env,who);return renderApp(state,back,{activity:back==='/app/activity'?await history(env.DB,who,new URLSearchParams()):undefined,message:actionMessage(name,result,env.AUTH_LOCAL==='true',state),result,thread})
  }else if(path==='/api/cabin/command'||path==='/api/cabin/agent/command'){
   const body=await inputBody(request);need(typeof body.name==='string'&&body.input&&typeof body.input==='object'&&!Array.isArray(body.input),'Provide a command name and input object')
   return json({result:await execute(request,env,who,body.name,body.input as Record<string,unknown>)})
  }
  return json({error:'Not found'},404)
 }catch(error){
  const status=Number((error as any)?.status)||500,message=(error as any)?.status?(error as Error).message:'Could not complete this request. Refresh and try again.'
  if(who&&request.method==='POST'){try{await assertLive(env.DB,who);await record(env.DB,who,'command.denied',{result:status===403?'denied':'refused'})}catch{}}
  if(path==='/app/action'&&who){try{return await renderApp(await snapshot(env,who),back,{activity:back==='/app/activity'?await history(env.DB,who,new URLSearchParams()):undefined,error:message,thread})}catch{/* Revocation cannot fall back to a stale page. */}}
  if(pages.has(path)&&status===401)return new Response(null,{status:303,headers:{...headers,location:'/signin?returnTo='+encodeURIComponent(path)}})
  return json({error:message},status)
 }
}
