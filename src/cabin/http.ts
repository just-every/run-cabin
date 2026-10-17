import { runtimeBindings,type Bindings } from '../auth.server'
import { command,snapshot,turnoverPhoto } from './domain'
import { statementCsv } from './statements'
import { importCommand } from './movein'
import { principal,credentialCommand } from './credentials'
import { channelCommand } from './channels'
import { icalExportResponse } from './ical-export'
import { fail,need,type Actor } from './model'
import { renderApp } from './ui'
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-robots-tag':'noindex, nofollow'}
const json=(value:unknown,status=200)=>Response.json(value,{status,headers})
const pages=new Set(['/app','/app/calendar','/app/turnovers','/app/statements','/app/people','/app/import','/app/agent'])
const AGENT_COMMANDS=['calendar.prepare','turnover.prepare','statement.prepare']
async function execute(request:Request,env:Bindings,who:Actor,name:string,input:Record<string,unknown>){
 if(who.isAgent)need(AGENT_COMMANDS.includes(name),'Agents may only prepare drafts. Human approval is required.',403)
 if(name.startsWith('agent.')||name==='member.invite')return credentialCommand(request,env,who,name,input)
 if(name.startsWith('import.'))return importCommand(env.DB,who,name,input)
 if(name.startsWith('channel.'))return channelCommand(env,who,name,input)
 return command(env.DB,who,name,input)
}
function actionMessage(name:string,result:any){
 if(name.endsWith('.prepare'))return 'Draft prepared. Review this revision before approval.'
 if(name==='turnover.complete')return 'Turnover completed with checklist and photo evidence.'
 if(name==='reservation.request')return result.status==='declined'?`Request declined: ${result.reason}.`:result.kind==='block'?'Nights blocked on every channel.':'Request accepted. These nights now close on every channel.'
 if(name==='channel.connect'||name==='channel.sync')return result.connection.status==='ok'?`Synced: ${result.changes} change${result.changes===1?'':'s'}.`:`Sync failed: ${result.connection.error}`
 if(name==='export.publish')return 'Export links ready. Paste each one into its channel; older links stop working.'
 return 'Saved.'
}
async function bodyBytes(request:Request){
 const limit=500_000;need(Number(request.headers.get('content-length')??0)<=limit,'Request is too large',413)
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
   if(value instanceof File){need(key==='photo'&&value.size<=256_000,'Use a photo up to 256 KB');const photo=new Uint8Array(await value.arrayBuffer());let binary='';for(const b of photo)binary+=String.fromCharCode(b);input.photo=btoa(binary);input.mimeType=value.type}
   else input[key]=form.getAll(key).length>1?form.getAll(key):value
  }
 }else if(type.includes('application/x-www-form-urlencoded')){const form=new URLSearchParams(new TextDecoder().decode(bytes));input=Object.fromEntries(form);if(form.has('lineDescription')){input.lineDescription=form.getAll('lineDescription');input.lineAmount=form.getAll('lineAmount')}}
 else return fail('Use JSON, a form, or a photo upload',415)
 for(const key of ['commissionBps','managementFeeCents'])if(key in input&&input[key]!=='')input[key]=Number(input[key]);else if(input[key]==='')delete input[key]
 if(typeof input.revision==='string'&&/^\d+$/.test(input.revision))input.revision=Number(input.revision)
 if('active'in input)input.active=input.active==='true'||input.active==='on'||input.active==='1'
 for(const key of ['checklist','checks'])if(typeof input[key]==='string'){
  const value=(input[key] as string).trim();if(value.startsWith('[')){try{input[key]=JSON.parse(value)}catch{fail(`Invalid ${key}`)}}else input[key]=value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean)
 }
 if(Array.isArray(input.lineDescription)){const amounts=input.lineAmount;need(Array.isArray(amounts)&&amounts.length===input.lineDescription.length,'Enter an amount for every statement line');input.lines=input.lineDescription.map((description,i)=>{const amount=String(amounts[i]).trim();need(/^-?[0-9]+(?:\.[0-9]{1,2})?$/.test(amount),'Use a USD amount with at most two decimal places');const [whole,fraction='']=amount.replace('-','').split('.');const amountCents=(Number(whole)*100+Number(fraction.padEnd(2,'0')))*(amount.startsWith('-')?-1:1);need(Number.isSafeInteger(amountCents),'Amount is too large');return {description,amountCents}});delete input.lineDescription;delete input.lineAmount}
 if(typeof input.lines==='string'){try{input.lines=JSON.parse(input.lines)}catch{fail('Statement lines must be a JSON array')}}
 return input
}
export async function cabinResponse(request:Request,original:Bindings):Promise<Response|null>{
 const url=new URL(request.url),path=url.pathname
 if(path.startsWith('/ical/'))return icalExportResponse(request,runtimeBindings(original))
 if(!path.startsWith('/api/cabin/')&&path!=='/app'&&!path.startsWith('/app/'))return null
 const env=runtimeBindings(original),isAgent=path.startsWith('/api/cabin/agent/'),back=pages.has(url.searchParams.get('returnTo')??'')?url.searchParams.get('returnTo')!:'/app';let who:Actor|undefined
 try{
  need(url.origin===env.AUTH_ORIGIN&&(!request.headers.has('host')||request.headers.get('host')===url.host),'Wrong application origin',403)
  need(request.method==='GET'||request.method==='POST','Method not allowed',405)
  // Origin is the CSRF boundary for ambient human sessions, including all
  // urlencoded and multipart forms. Bearer routes never accept a session alone.
  if(request.method==='POST'&&!isAgent)need(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','Cross-site request refused',403)
  who=await principal(request,env,isAgent)
  if(request.method==='GET'){
   if(pages.has(path))return renderApp(await snapshot(env,who),path,{from:url.searchParams.get('from')})
   if(path==='/api/cabin/state'||path==='/api/cabin/agent/context')return json(await snapshot(env,who))
   const csv=path.match(/^\/api\/cabin\/statements\/([\w-]+)\.csv$/)
   if(csv)return new Response(await statementCsv(env.DB,who,csv[1]),{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="cabin-statement-${csv[1]}.csv"`}})
   const photo=path.match(/^\/api\/cabin\/turnovers\/([\w-]+)\/photo$/),direct=path.match(/^\/api\/cabin\/photos\/([\w-]+)$/)
   if(photo||direct){const saved=await turnoverPhoto(env.DB,who,(photo??direct)![1],!!direct);return new Response(saved.bytes,{headers:{...headers,'content-type':saved.mimeType,'content-disposition':'inline','content-security-policy':"default-src 'none'; sandbox"}})}
  }else if(path==='/app/action'){
   const input=await inputBody(request),name=url.searchParams.get('name')??'',result=await execute(request,env,who,name,input)
   return renderApp(await snapshot(env,who),back,{message:actionMessage(name,result),result})
  }else if(path==='/api/cabin/command'||path==='/api/cabin/agent/command'){
   const body=await inputBody(request);need(typeof body.name==='string'&&body.input&&typeof body.input==='object'&&!Array.isArray(body.input),'Provide a command name and input object')
   return json({result:await execute(request,env,who,body.name,body.input as Record<string,unknown>)})
  }
  return json({error:'Not found'},404)
 }catch(error){
  const status=Number((error as any)?.status)||500,message=status<500?(error as Error).message:'Could not complete this request. Refresh and try again.'
  if(path==='/app/action'&&who){try{return await renderApp(await snapshot(env,who),back,{error:message})}catch{/* Revocation cannot fall back to a stale page. */}}
  if(pages.has(path)&&status===401)return new Response(null,{status:303,headers:{...headers,location:'/signin?returnTo='+encodeURIComponent(path)}})
  return json({error:message},status)
 }
}
