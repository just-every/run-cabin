import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {harness} from './harness.mjs'
import {qboBooks,assertBatch} from './qbo-support.mjs'
// The local runner supplies an already refreshed grant after securely preserving rotation.
// This journey never exchanges or logs the held refresh token.
assert.ok(process.env.CABIN_QBO_GRANT_FILE,'Supply a private owner-consented sandbox grant file')
const grant=JSON.parse(await readFile(process.env.CABIN_QBO_GRANT_FILE,'utf8'))
const receiptDir=process.env.CABIN_QBO_RECEIPTS??'test-results/qbo-sandbox';await mkdir(receiptDir,{recursive:true})
const origin='https://sandbox-quickbooks.api.intuit.com/v3/company/'+grant.realmId
async function api(path,body){const r=await fetch(origin+'/'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+grant.accessToken,accept:'application/json',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),data=await r.json();assert.ok(r.ok&&!data.Fault,'Sandbox request failed: HTTP '+r.status+' code '+(data.Fault?.Error?.[0]?.code??''));return data}
async function query(kind){return (await api('query?'+new URLSearchParams({query:'select * from '+kind+' MAXRESULTS 1000'}))).QueryResponse?.[kind]??[]}
const h=await harness({auth:{QUICKBOOKS_CLIENT_ID:process.env.QUICKBOOKS_CLIENT_ID,QUICKBOOKS_CLIENT_SECRET:process.env.QUICKBOOKS_CLIENT_SECRET},assets:true})
try{
 const company=(await api('companyinfo/'+grant.realmId)).CompanyInfo;assert.equal(company.Country,'US');assert.equal(company.CompanyName,'Sandbox Company US 86ae')
 await h.cmd('qbo.connect',{...grant,mode:'sandbox',consent:true})
 const existingAccounts=await query('Account'),accountIds={}
 const specs={cash:['Bank','Checking'],receivable:['Other Current Asset','OtherCurrentAssets'],advances:['Other Current Liability','OtherCurrentLiabilities'],damageAuthorization:['Other Current Asset','OtherCurrentAssets'],damageHolds:['Other Current Liability','OtherCurrentLiabilities'],ownerLiability:['Other Current Liability','OtherCurrentLiabilities'],managerRevenue:['Income','ServiceFeeIncome'],channelFees:['Expense','OtherMiscellaneousServiceCost'],expenses:['Expense','OtherMiscellaneousServiceCost'],taxes:['Other Current Liability','OtherCurrentLiabilities'],guestCredits:['Other Current Liability','OtherCurrentLiabilities'],vendorPayable:['Other Current Liability','OtherCurrentLiabilities'],processorFunds:['Other Current Asset','OtherCurrentAssets'],allocationClearing:['Other Current Asset','OtherCurrentAssets'],ownerReserves:['Other Current Liability','OtherCurrentLiabilities'],managerExpenses:['Expense','OtherMiscellaneousServiceCost']}
 for(const [key,[AccountType,AccountSubType]]of Object.entries(specs)){const Name='Synthetic Cabin '+key,old=existingAccounts.find(a=>a.Name===Name);const a=old??(await api('account',{Name,AccountType,AccountSubType})).Account;accountIds[key]=a.Id}
 const preferences=(await api('preferences')).Preferences
 if(!preferences.AccountingInfoPrefs?.ClassTrackingPerTxnLine)await api('preferences',{...preferences,AccountingInfoPrefs:{...preferences.AccountingInfoPrefs,TrackDepartments:preferences.AccountingInfoPrefs?.TrackDepartments??false,ClassTrackingPerTxnLine:true,ClassTrackingPerTxn:false}})
 const classes=await query('Class'),vendors=await query('Vendor')
 const cls=classes.find(c=>c.Name==='Synthetic Cabin Cedar Creek')??(await api('class',{Name:'Synthetic Cabin Cedar Creek'})).Class
 const vendor=vendors.find(v=>v.DisplayName==='Synthetic Cabin Morgan Carter')??(await api('vendor',{DisplayName:'Synthetic Cabin Morgan Carter'})).Vendor
 const catalog=await h.cmd('qbo.catalog',{}),b=await qboBooks(h)
 await h.cmd('qbo.mapping.approve',{propertyId:b.home.id,classId:cls.Id,vendorId:vendor.Id,accounts:accountIds,consent:true})
 const preview=await h.cmd('qbo.preview',{propertyId:b.home.id,month:'2026-10'}),sent=await h.cmd('qbo.sync',{id:preview.id,revision:preview.revision,consent:true})
 await assertBatch(h,sent,b.source)
 const remote=[]
 for(const e of sent.entries){const row=(await api('journalentry/'+e.externalId)).JournalEntry;assert.equal(row.DocNumber,e.payload.DocNumber);assert.equal(row.Line.length,e.payload.Line.length);for(let i=0;i<row.Line.length;i++){assert.equal(Math.round(row.Line[i].Amount*100),Math.round(e.payload.Line[i].Amount*100));assert.equal(row.Line[i].JournalEntryLineDetail.AccountRef.value,e.payload.Line[i].JournalEntryLineDetail.AccountRef.value);assert.equal(row.Line[i].JournalEntryLineDetail.ClassRef.value,cls.Id);assert.equal(row.Line[i].JournalEntryLineDetail.Entity.EntityRef.value,vendor.Id)}remote.push(row)}
 await h.restart();const repeat=await h.cmd('qbo.sync',{id:preview.id,revision:preview.revision,consent:true});await assertBatch(h,repeat,b.source)
 for(const e of sent.entries){const matches=(await api('query?'+new URLSearchParams({query:`select * from JournalEntry where DocNumber = '${e.payload.DocNumber}'`}))).QueryResponse?.JournalEntry??[];assert.equal(matches.length,1);assert.equal(matches[0].Id,e.externalId)}
 const changed=remote[0];await api('journalentry',{...changed,PrivateNote:changed.PrivateNote+'; synthetic external accountant edit'})
 const conflict=await h.cmd('qbo.reconcile',{id:preview.id});assert.equal(conflict.reconciled,false);assert.equal(conflict.entries.filter(e=>e.status==='conflict').length,1)
 await h.cmd('qbo.sync',{id:preview.id,revision:preview.revision,consent:true});for(const e of sent.entries){const matches=(await api('query?'+new URLSearchParams({query:`select * from JournalEntry where DocNumber = '${e.payload.DocNumber}'`}))).QueryResponse?.JournalEntry??[];assert.equal(matches.length,1)}
 const receipt={format:'cabin-qbo-sandbox-v1',candidateSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),at:new Date().toISOString(),companyName:company.CompanyName,country:company.Country,environment:'sandbox',realmSha256:createHash('sha256').update(grant.realmId).digest('hex'),authorization:'Owner-consented Accounting OAuth grant validated with company read; refreshed grant preserved locally before this journey.',month:preview.month,sourceTypes:b.source.map(j=>j.sourceType),mapping:{classId:cls.Id,vendorId:vendor.Id,accounts:accountIds},batchId:preview.id,totals:{debitCents:sent.debitCents,creditCents:sent.creditCents,accountTotals:sent.accountTotals},reconciled:sent.reconciled,repeatReconciled:repeat.reconciled,externalConflict:conflict.entries.find(e=>e.status==='conflict').externalId,externalIds:sent.entries.map(e=>({sourceId:e.sourceId,externalId:e.externalId,docNumber:e.payload.DocNumber,syncToken:e.syncToken})),duplicates:0}
 await writeFile(receiptDir+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({company:company.CompanyName,journals:sent.entries.length,sourceTypes:receipt.sourceTypes,totals:receipt.totals,reconciled:true,repeat:true,externalConflict:true,duplicates:0}))
}finally{await h.close()}
