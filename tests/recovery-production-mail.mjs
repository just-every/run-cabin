// The real production bundle requires HTTPS and its native host-cookie name.
// Miniflare dispatches these HTTPS requests directly to the Worker; no transport is replaced.
const publicErrors=new Set([
 'invalid_configuration','invalid_host','invalid_origin','invalid_or_expired','forbidden','unauthenticated',
 'Sign in to continue','Access expired or revoked','Team access is not granted',
 'Wrong application origin','Cross-site request refused',
 'The revision changed. Review this exact draft again.',
 'Records or access changed. Reload and review before trying again.',
 'This case is not awaiting readiness confirmation',
 'The replacement cleaner must accept and mark ready with all required photos',
 'Resolve the home’s blocking maintenance tasks first',
 'Confirm the replacement code on the lock or keypad first','The owner balance has not posted',
 'The guest must accept the revised arrangements on their stay page before closing',
 'Deliver the approved credit offer before closing; check the guest Inbox for failures',
 'Add the guest’s email before sending readiness confirmation',
 'Reconcile blocked or uncertain recovery effects before confirming readiness',
 'Provider sharing needs installation storage.',
 'Review this restored installation before reconnecting providers.',
 'Sharing with this provider is disconnected. Review it in Channel calendars before reconnecting.',
 'Recipient contact was erased. Automatic and queued delivery is blocked.',
 'The approving operator was offboarded.',
 'The approving team grant expired or changed before execution.',
 'No mail provider is set up for this install, so this message was not sent.',
 'The mail provider did not accept this message.',
 'Submission outcome is uncertain. Check the provider before any resend.',
 'Submission outcome is uncertain after interruption. Check the provider before any resend.',
 'Mail input is invalid; check the error code and module contract.',
 'Could not complete this request. Refresh and try again.',
])
export function safePublicError(value){
 if(value==null)return null
 if(publicErrors.has(value))return value
 if(typeof value==='string'&&value.startsWith('Verify the arrival in Readiness first: '))return 'Verify the arrival in Readiness first: [details redacted]'
 return 'redacted_unrecognized_error'
}
function routeError(operation,response){
 const error=new Error('Production mail public route failed')
 error.diagnostic={operation,httpStatus:response.status,publicError:safePublicError(response.value?.error)}
 return error
}
export async function productionMail(h,auth){
 const origin=new URL(h.origin);origin.protocol='https:'
 // This is the native session issued to this synthetic owner, retained in this
 // harness's D1. Only its client cookie name changes with the native auth mode.
 if(!/^operator_session_local_\d+=/.test(h.owner??''))throw new Error('Expected the harness native owner session')
 const owner=h.owner.replace(/^[^=]+=/,'__Host-operator_session=')
 await h.restart({productionMail:true,auth:{...auth,AUTH_LOCAL:'false',AUTH_ORIGIN:origin.origin}})
 async function send(path,body,cookie=owner){
  const response=await h.mf.dispatchFetch(new URL(path,origin),{method:body===undefined?'GET':'POST',headers:{host:origin.host,origin:origin.origin,'content-type':'application/json',cookie},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'manual'})
  const text=await response.text();let value
  try{value=JSON.parse(text)}catch{value=null}
  return {status:response.status,value}
 }
 const session=await send('/auth/session')
 if(session.status!==200)throw routeError('native-session',session)
 if(session.value?.operator?.role!=='owner')throw new Error('Expected the native installation owner session')
 return {
  send,
  async cmd(name,input){const r=await send('/api/cabin/command',{name,input});if(r.status!==200)throw routeError(name,r);return r.value?.result??r.value},
  async state(){const r=await send('/api/cabin/state');if(r.status!==200)throw routeError('state',r);return r.value},
  async restore(){await h.restart({productionMail:true,auth:{AUTH_LOCAL:'true',AUTH_ORIGIN:h.origin,MAIL_PROVIDER:'development',MAIL_API_KEY:''}})},
 }
}
