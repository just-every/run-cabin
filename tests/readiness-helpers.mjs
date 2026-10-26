// Public command sequence shared by the flows that deliberately require verified readiness.
export async function attestArrival(h, bookingId, cookie = h.owner) {
 // The built page carries the exact current revision and evidence baseline.
 for (;;) {
  const state = await h.state(), b = state.bookings.find(b => b.id === bookingId)
  const page = (await h.send('/app/readiness?from='+b.start.slice(0,10),undefined,cookie)).text
  const unescape = v => v.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
  // Choose the first unresolved item from rendered per-item sections.
  const sections = [...page.matchAll(/<section class="readiness-item">([\s\S]*?)<\/section>/g)]
  const pending = sections.find(m=>m[1].includes('name="bookingId" value="'+bookingId+'"')&&!m[1].includes('<strong>passed</strong>'))
  if (!pending) return
  const values = Object.fromEntries([...pending[1].matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/g)].map(m=>[m[1],unescape(m[2])]))
  await h.cmd('readiness.attest',{...values,status:'passed',note:'Physically checked for this arrival'},cookie)
 }
}
