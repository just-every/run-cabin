import type { Bindings } from '../../auth.server'
import { h } from '../ui/shared'
import { portalToken, recipientHint, savedEmail } from './lifecycle'
import { browserCookie, cookie, readCookie, type PortalContext } from './auth'
import { latestChallenge } from './challenge'
import { portalShell } from './shell'
export const wantsJson=(request:Request)=>new URL(request.url).pathname.endsWith('/api')||request.headers.get('accept')?.includes('application/json')||(request.method==='POST'&&request.headers.get('content-type')?.includes('application/json'))
export async function verificationGate(request:Request,env:Bindings,p:PortalContext,notice='',status=200,challengeId=''){
 const home=p.data.properties.find(h=>h.id===p.booking.propertyId)!.name,email=savedEmail(p.booking.guestEmail),hint=recipientHint(email),path='/stay/'+p.link.token,browser=readCookie(request,browserCookie),cookies=browser?[]:[cookie(browserCookie,portalToken(),30*86400)]
 const headers=new Headers({'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'});for(const c of cookies)headers.append('set-cookie',c)
 if(wantsJson(request))return Response.json({home,recipientHint:hint,verificationRequired:true,message:email?(notice||'Verify your reservation email'): 'Ask your host to add your email',...(challengeId?{challengeId}:{})},{status,headers})
 const challenge=challengeId||await latestChallenge(env,p,request)
 const body=`<section class="panel stay-sheet"><p class="eyebrow">Your stay</p><h1>${h(home)}</h1>${notice?`<p class="notice" role="status">${h(notice)}</p>`:''}${email?`<p>Verify your reservation email to open your stay.</p><p>Saved address: <strong>${h(hint)}</strong></p><form method="post" action="${path}/send-code"><button type="submit">Send code</button></form>${challenge?`<form method="post" action="${path}/verify"><input type="hidden" name="challengeId" value="${h(challenge)}"><label>6-digit code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button type="submit">Verify email</button></form>`:''}`:'<p class="notice">Ask your host to add your email</p>'}</section>`
 return portalShell(home,body,status,cookies)
}
