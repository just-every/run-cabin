import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
assert.ok(process.env.SEAM_API_KEY)
assert.ok(process.env.SEAM_SANDBOX_LOGIN&&process.env.SEAM_SANDBOX_PASSWORD)
async function api(path,body={}){const deleting=path.endsWith('/delete'),url=new URL('https://connect.getseam.com'+path);if(deleting)for(const [key,value]of Object.entries(body))url.searchParams.set(key,String(value));const r=await fetch(url,{method:deleting?'DELETE':'POST',headers:{authorization:'Bearer '+process.env.SEAM_API_KEY,'content-type':'application/json'},...(deleting?{}:{body:JSON.stringify(body)})});assert.ok(r.ok,'Sandbox connection HTTP '+r.status);return r.json()}
assert.equal((await api('/workspaces/get')).workspace.is_sandbox,true)
const existing=new Set((await api('/connected_accounts/list')).connected_accounts.map(a=>a.connected_account_id))
const {connect_webview:view}=await api('/connect_webviews/create',{accepted_providers:['kwikset'],automatically_manage_new_devices:true,wait_for_device_creation:true})
const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
let accountId
try{
 const context=await browser.newContext(),page=await context.newPage();await page.goto(view.url)
 for(let step=0;step<10;step++){
  await page.waitForTimeout(1000)
  const state=(await api('/connect_webviews/get',{connect_webview_id:view.connect_webview_id})).connect_webview
  if(state.connected_account_id){accountId=state.connected_account_id;break}
  const alerts=await page.locator('[role="alert"]:visible').allTextContents();assert.deepEqual(alerts.map(v=>v.trim()).filter(Boolean),[],'The sandbox provider must accept its documented test login')
  const email=page.locator('input[name="email"]:visible'),password=page.locator('input[type="password"]:visible')
  if(await email.count())await email.fill(process.env.SEAM_SANDBOX_LOGIN)
  if(await password.count())await password.fill(process.env.SEAM_SANDBOX_PASSWORD)
  const controls=await page.locator('button:visible').allTextContents(),fields=await page.locator('input:visible').evaluateAll(rows=>rows.map(el=>({type:el.type,name:el.name,placeholder:el.placeholder})));console.log(JSON.stringify({journey:'sandbox-connect',step,controls:controls.map(v=>v.trim()),fields}))
  const next=page.getByRole('button',{name:/^(Continue|Next|Sign in|Log in|Login|Connect|Allow|Authorize|Done|Kwikset|Continue with Kwikset)$/i}).first()
  assert.ok(await next.count(),'The documented sandbox connection needs a recognized next action')
  await next.click()
 }
 assert.ok(accountId,'The sandbox test account must authorize its connection')
 assert.ok(!existing.has(accountId),'Use a new isolated sandbox account for this proof')
 const devices=(await api('/devices/list',{connected_account_id:accountId})).devices
 const device=devices.find(d=>d.properties?.online&&d.properties?.supported_code_lengths?.includes(4))
 assert.ok(device,'The new virtual lock must support Cabin’s four-digit codes')
 console.log(JSON.stringify({journey:'sandbox-connect',connected:true,provider:device.device_type,deviceId:device.device_id}))
 await context.close();await browser.close()
 process.env.SEAM_TEST_DEVICE_ID=device.device_id
 await import('./recovery-sandbox.mjs')
}finally{
 await browser.close()
 const state=(await api('/connect_webviews/get',{connect_webview_id:view.connect_webview_id})).connect_webview
 accountId??=state.connected_account_id
 if(accountId&&!existing.has(accountId)){const devices=(await api('/devices/list',{connected_account_id:accountId})).devices,remaining=[];for(const device of devices)remaining.push(...(await api('/access_codes/list',{device_id:device.device_id})).access_codes.filter(c=>c.name?.startsWith('Cabin ')).map(c=>c.access_code_id));assert.equal(remaining.length,0,'Keep the owned sandbox connection available until every Cabin code is removed');await api('/connected_accounts/delete',{connected_account_id:accountId});console.log(JSON.stringify({journey:'sandbox-connect-cleanup',ownedConnectionRemoved:true}))}
}
