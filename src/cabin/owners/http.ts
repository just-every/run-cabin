import { answerQuestion, questionReport, rentalQuestionAccess } from '../questions/read'
import { questionPanel, ownerQuestionReport } from '../questions/ui'
import { page } from './ui'
import { type Actor } from '../model'
import { assertLive } from '../storage'
import { hasAction,permitsProperty } from '../permissions/policy'
import { downloadOwnerReportArtifact } from '../reports/sharing'
import { runtimeBindings,type Bindings } from '../../auth.server'
import { authorizedStatement } from './state'
import { statementPdf } from '../archive/statement-pdf'
import { need } from '../model'
import { ownerEmail,portalState,requestOwnerLink,confirmOwner,signOutOwner,ownerCsv } from './access'
import { ownerAction } from './actions'
import { recordStatementAccess } from './activity'
import { ownerDocument, ownerRecordsCsv } from './downloads'
import { portalPage,signInPage,confirmationPage,portalErrorPage } from './ui'
const headers={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow'}
async function inputBody(request:Request){
 const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let size=0
 if(reader)try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;need(size<=4096,'Request too large',413);chunks.push(value)}}finally{await reader.cancel();reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 const raw=new TextDecoder().decode(bytes);let value:unknown
 if(request.headers.get('content-type')?.includes('application/json')){try{value=JSON.parse(raw)}catch{need(false,'Invalid JSON')}}
 else{need(request.headers.get('content-type')?.includes('application/x-www-form-urlencoded'),'Use JSON or a form',415);value=Object.fromEntries(new URLSearchParams(raw))}
 need(value&&typeof value==='object'&&!Array.isArray(value),'Expected an object');return value as Record<string,unknown>
}
export async function ownersResponse(request:Request,original:Bindings,nativeActor?:Actor):Promise<Response|null>{
 const env=runtimeBindings(original),url=new URL(request.url),path=url.pathname
 if(path!=='/owners'&&!path.startsWith('/owners/'))return null
 try{
  need(url.origin===env.AUTH_ORIGIN&&(!request.headers.has('host')||request.headers.get('host')===url.host),'Wrong application origin',403)
  need(request.method==='GET'||request.method==='POST','Method not allowed',405)
  if(request.method==='POST'){
   need(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','Cross-site request refused',403)
   need(Number(request.headers.get('content-length')??0)<=4096,'Request too large',413)
   const value=await inputBody(request)
   if(path==='/owners/signin'){await requestOwnerLink(env,value);return signInPage(env.AUTH_LOCAL==='true'||env.RER_DEMO==='1'?'Local development does not send email. Ask your manager to preview your owner portal from Statements.':'If this address has owner access, a sign-in link is on its way.')}
   if(path==='/owners/confirm')return new Response(null,{status:303,headers:{...headers,location:'/owners','set-cookie':await confirmOwner(env,value.token)}})
   if(path==='/owners/signout')return new Response(null,{status:303,headers:{...headers,location:'/owners/signin','set-cookie':await signOutOwner(request,env)}})
   const email=nativeActor?(await assertLive(env.DB,nativeActor),nativeActor.email):await ownerEmail(request,env)
   if(path==='/owners/questions'||path==='/owners/questions/answer'){
    const access=await rentalQuestionAccess(env.DB,email,nativeActor),answer=await answerQuestion(env.DB,access,value)
    await rentalQuestionAccess(env.DB,email,nativeActor)
    if(request.headers.get('content-type')?.includes('application/json'))return Response.json(answer,{headers})
    return page('<main><p><a href="/owners">Your owner portal</a></p><h1>Questions about your homes</h1>'+questionPanel(answer.properties,answer,true)+'</main>','Questions')
   }
   if(path==='/owners/action'){
    need(!nativeActor||hasAction(nativeActor,'rentalOwner.'+String(value.action??'')),'Action outside your team grant',403)
    const result=await ownerAction(env,email,String(value.action??''),value,nativeActor)
    if(request.headers.get('content-type')?.includes('application/json'))return Response.json({result},{headers})
    return new Response(null,{status:303,headers:{...headers,location:'/owners?done='+encodeURIComponent(String(value.action))}})
   }
  }else{
   if(path==='/owners/signin')return signInPage()
   if(path==='/owners/confirm')return confirmationPage(url.searchParams.get('token')??'')
   const email=nativeActor?(await assertLive(env.DB,nativeActor),nativeActor.email):await ownerEmail(request,env),month=url.searchParams.get('month')??undefined
   if(path==='/owners/questions'||path==='/owners/questions/report'){
    const access=await rentalQuestionAccess(env.DB,email,nativeActor)
    if(path.endsWith('/report')){const report=await questionReport(env.DB,access,url.searchParams);await rentalQuestionAccess(env.DB,email,nativeActor);return page(ownerQuestionReport(report),'Your source report')}
    const directory=await env.DB.prepare('SELECT id,name FROM cb_properties WHERE id IN (SELECT value FROM json_each(?)) ORDER BY name').bind(JSON.stringify(access.actor.scope!.propertyIds)).all<{id:string;name:string}>()
    return page('<main><p><a href="/owners">Your owner portal</a></p><h1>Questions about your homes</h1>'+questionPanel(directory.results,undefined,true)+'</main>','Questions')
   }
   if(path==='/owners'){
    const s=await nativeState(env,email,month,nativeActor),selected=url.searchParams.get('statement')
    if(selected)need(s.statements.some(s=>s.id===selected),'Approved statement not found',404)
    const shown=selected?s.statements.filter(s=>s.id===selected):s.statements
    await recordStatementAccess(env,email,shown,'view')
    return portalPage({...s,statements:shown},false,url.searchParams.get('done')??'')
   }
   if(path==='/owners/api/state')return Response.json(await nativeState(env,email,month,nativeActor),{headers})
   const reportArtifact=path.match(/^\/owners\/reports\/([\w-]+)$/)
   if(reportArtifact){const file=await downloadOwnerReportArtifact(env.DB,email,reportArtifact[1],nativeActor);return new Response(file.content,{headers:{...headers,'content-type':file.contentType,'content-disposition':`attachment; filename="${file.filename}"`}})}
   const pdf=path.match(/^\/owners\/statements\/([\w-]+)\.pdf$/)
   if(pdf){const s=await authorizedStatement(env,email,pdf[1],nativeActor);await recordStatementAccess(env,email,[s],'download');return new Response(new Uint8Array(await statementPdf(s)).buffer,{headers:{...headers,'content-type':'application/pdf','content-disposition':`attachment; filename="cabin-statement-${s.id}.pdf"`}})}
   const csv=path.match(/^\/owners\/statements\/([\w-]+)\.csv$/)
   if(csv){await authorizedStatement(env,email,csv[1],nativeActor);return new Response(await ownerCsv(env,email,csv[1]),{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="cabin-statement-${csv[1]}.csv"`}})}
   const document=path.match(/^\/owners\/documents\/([\w-]+)\.txt$/)
   if(document){const record=await ownerDocument(env,email,document[1]);need(!nativeActor||permitsProperty(nativeActor,record.propertyId),'Record not found',404);return new Response(record.title+'\n\n'+record.content+'\n',{headers:{...headers,'content-type':'text/plain; charset=utf-8','content-disposition':`attachment; filename="cabin-record-${document[1]}.txt"`}})}
   const records=path.match(/^\/owners\/properties\/([\w-]+)\/records\.csv$/)
   if(records){need(!nativeActor||permitsProperty(nativeActor,records[1]),'Record not found',404);return new Response(await ownerRecordsCsv(env,email,records[1],month),{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="cabin-owner-records-${records[1]}.csv"`}})}
  }
  return Response.json({error:'Not found'},{status:404,headers})
 }catch(error){
  const status=Number((error as any).status)||500,message=status<500?(error as Error).message:'Could not complete the request. Try again.'
  if(status===401&&path==='/owners')return new Response(null,{status:303,headers:{...headers,location:'/owners/signin'}})
  if(path==='/owners/questions/report'||request.headers.get('content-type')?.includes('application/json')&&path.startsWith('/owners/questions')||path.startsWith('/owners/api/')||path.endsWith('.pdf')||path.endsWith('.csv')||path.endsWith('.txt')||path.startsWith('/owners/reports/')||request.headers.get('content-type')?.includes('application/json')&&path==='/owners/action')return Response.json({error:message},{status,headers})
  if(path==='/owners/action'||path==='/owners')return portalErrorPage(message,status)
  return signInPage(message,status)
 }
}

async function nativeState(env:Bindings,email:string,month:string|undefined,actor:Actor|undefined){
 const state=await portalState(env,email,month)
 if(actor)for(const key of ['properties','bookings','statements','performance','documents','expenses','stayRequests','issues','ledgerEntries','ledgerBalances','blockUses'] as const)(state as any)[key]=state[key].filter((row:any)=>permitsProperty(actor,key==='properties'?row.id:row.propertyId))
 return state
}
