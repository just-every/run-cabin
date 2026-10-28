import assert from 'node:assert/strict'

// Source evidence is synthetic; every setup and review goes through authenticated product commands.
export async function taxPeriods(h){
 const home=await h.cmd('property.save',{name:'Quarterly tax cabin',ownerName:'Synthetic Cabin Owner',ownerEmail:h.auth.OWNER_EMAIL,commissionBps:2000})
 await h.cmd('ledger.configure',{propertyId:home.id,legalEntity:'Synthetic Cabin trust'})
 await h.cmd('tax.profile.save',{propertyId:home.id,country:'US',state:'Maine',county:'Synthetic County',city:'Unincorporated'})
 const jurisdictions=[]
 for(const [i,level] of ['state','county','city'].entries()){
  const j=await h.cmd('tax.jurisdiction.save',{propertyId:home.id,level,registrationStatus:i===2?'not-required':'active',registrationUntil:'2027-12-31',registrationReference:'synthetic-cabin-registration-'+i,partner:'Synthetic Cabin accountant',recipient:h.auth.OWNER_EMAIL,source:'Synthetic owner-held registration and recipient authorization'})
  await h.cmd('tax.rule.save',{jurisdictionId:j.id,taxType:'lodging',bps:[900,200,0][i],from:'2025-01-01',until:'2027-12-31',source:'Synthetic configured rule and common taxable base'})
  if(i===0)await h.cmd('tax.rule.save',{jurisdictionId:j.id,taxType:'sales',bps:100,from:'2025-01-01',until:'2027-12-31',source:'Synthetic separate sales levy on the common taxable base'})
  jurisdictions.push(j)
 }
 const record=async(channel,start,end,reference,baseCents=20000,exemptCents=0)=>{
  const booking=await h.cmd('reservation.request',{propertyId:home.id,channel,start,end,guestName:'Synthetic Cabin Guest'})
  const input={bookingId:booking.bookingId,baseCents,exemptCents,...(exemptCents?{exemptionEvidence:'Synthetic exempt rent certificate'}:{})}
  const preview=await h.cmd('tax.source.preview',input)
  return h.cmd('tax.source.record',{...input,previewDigest:preview.previewDigest,reference,document:'Synthetic source document held for this native journey',collections:preview.assessed.map(r=>({ruleId:r.rule.id,month:r.month,channelCents:channel==='airbnb'&&r.rule.taxType==='lodging'&&r.jurisdiction.level==='state'?r.taxCents:0})),confirm:'yes'})
 }
 const yearStart=await record('direct','2025-12-31','2026-01-02','synthetic-cabin-1')
 const quarterEnd=await record('airbnb','2026-03-31','2026-04-02','synthetic-cabin-2',24000,4000)
 const february=await record('direct','2026-02-10','2026-02-11','synthetic-cabin-3',10000)
 const yearEnd=await record('direct','2026-12-31','2027-01-02','synthetic-cabin-4')
 const prepare=(month,periodKind='quarter',jurisdictionId)=>h.cmd('tax.report.prepare',{propertyId:home.id,month,periodKind,...(jurisdictionId?{jurisdictionId}:{})})
 const approve=(r,cookie=h.owner,status=200)=>h.cmd('tax.report.approve',{id:r.id,revision:r.revision,confirm:'yes'},cookie,status)
 const exported=async r=>{const response=await h.send(`/api/cabin/taxes/${r.id}.json`,undefined,h.owner);assert.equal(response.status,200);return response.value}
 return {home,jurisdictions,yearStart,quarterEnd,february,yearEnd,prepare,approve,exported,record}
}
