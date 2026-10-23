import assert from 'node:assert/strict'

// One authorized test-mode capability probe, never part of push Verify.
// https://docs.stripe.com/testing#ach-direct-debit
const key=process.env.STRIPE_US_TEST_SECRET_KEY
assert.ok(key?.startsWith('sk_test_'),'A held US Stripe test key is required; live mode is refused')
const headers={authorization:`Bearer ${key}`,'Stripe-Version':'2026-09-30.endive'}
const accountResponse=await fetch('https://api.stripe.com/v1/account',{headers,signal:AbortSignal.timeout(20000)})
const account=await accountResponse.json()
assert.equal(accountResponse.status,200,'Test-account identity read failed; response withheld')
assert.equal(account.country,'US','The held test account is not US; no ACH request made')
const body=new URLSearchParams({amount:'100',currency:'usd','payment_method_types[0]':'us_bank_account',payment_method:'pm_usBankAccount_processing',confirm:'true','mandate_data[customer_acceptance][type]':'offline',description:'Synthetic Cabin test-mode ACH capability probe'})
const response=await fetch('https://api.stripe.com/v1/payment_intents',{method:'POST',headers:{...headers,'content-type':'application/x-www-form-urlencoded','idempotency-key':'synthetic-cabin-ach-probe-c16'},body,signal:AbortSignal.timeout(20000)})
const result=await response.json()
if(response.ok)assert.equal(result.livemode,false,'A test-mode response is required')
// No secret, client secret, bank data, customer data or raw provider payload is printed.
console.log(JSON.stringify({at:new Date().toISOString(),country:account.country,testMode:true,httpStatus:response.status,requestId:response.headers.get('request-id'),outcome:response.ok?result.status:'blocked',paymentId:response.ok?result.id:undefined,errorType:result.error?.type,errorCode:result.error?.code,errorParameter:result.error?.param,errorMessage:result.error?.message?.replaceAll(key,'[credential]').replace(/https?:\/\/\S+/g,'[address]')}))
