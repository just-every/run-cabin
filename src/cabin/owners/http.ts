import { runtimeBindings,type Bindings } from '../../auth.server'
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
export async function ownersResponse(request:Request,original:Bindings):Promise<Response|null>{
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
   const email=await ownerEmail(request,env)
   if(path==='/owners/action'){
    const result=await ownerAction(env,email,String(value.action??''),value)
    if(request.headers.get('content-type')?.includes('application/json'))return Response.json({result},{headers})
    return new Response(null,{status:303,headers:{...headers,location:'/owners?done='+encodeURIComponent(String(value.action))}})
   }
  }else{
   if(path==='/owners/signin')return signInPage()
   if(path==='/owners/confirm')return confirmationPage(url.searchParams.get('token')??'')
   const email=await ownerEmail(request,env),month=url.searchParams.get('month')??undefined
   if(path==='/owners'){
    const s=await portalState(env,email,month),selected=url.searchParams.get('statement')
    if(selected)need(s.statements.some(s=>s.id===selected),'Approved statement not found',404)
    const shown=selected?s.statements.filter(s=>s.id===selected):s.statements
    await recordStatementAccess(env,email,shown,'view')
    return portalPage({...s,statements:shown},false,url.searchParams.get('done')??'')
   }
   if(path==='/owners/api/state')return Response.json(await portalState(env,email,month),{headers})
   const csv=path.match(/^\/owners\/statements\/([\w-]+)\.csv$/)
   if(csv)return new Response(await ownerCsv(env,email,csv[1]),{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="cabin-statement-${csv[1]}.csv"`}})
   const document=path.match(/^\/owners\/documents\/([\w-]+)\.txt$/)
   if(document){const record=await ownerDocument(env,email,document[1]);return new Response(record.title+'\n\n'+record.content+'\n',{headers:{...headers,'content-type':'text/plain; charset=utf-8','content-disposition':`attachment; filename="cabin-record-${document[1]}.txt"`}})}
   const records=path.match(/^\/owners\/properties\/([\w-]+)\/records\.csv$/)
   if(records)return new Response(await ownerRecordsCsv(env,email,records[1],month),{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="cabin-owner-records-${records[1]}.csv"`}})
  }
  return Response.json({error:'Not found'},{status:404,headers})
 }catch(error){
  const status=Number((error as any).status)||500,message=status<500?(error as Error).message:'Could not complete the request. Try again.'
  if(status===401&&path==='/owners')return new Response(null,{status:303,headers:{...headers,location:'/owners/signin'}})
  if(path.startsWith('/owners/api/')||path.endsWith('.csv')||path.endsWith('.txt')||request.headers.get('content-type')?.includes('application/json')&&path==='/owners/action')return Response.json({error:message},{status,headers})
  if(path==='/owners/action'||path==='/owners')return portalErrorPage(message,status)
  return signInPage(message,status)
 }
}
