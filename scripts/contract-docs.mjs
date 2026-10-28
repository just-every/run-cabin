import { readFileSync,writeFileSync } from 'node:fs'
import { parseContract } from '../src/base/seed-contract.mjs'
const [mode,...args]=process.argv.slice(2)
if(!['write','check'].includes(mode)||args.length&&!(args[0]==='--clauses'&&args.length===2))throw Error('Use write or check, optionally with --clauses and comma-separated clause IDs')
const original=readFileSync('CONTRACT.md','utf8')
const rows=original.split('\n').filter(line=>/^\| `[A-Z0-9-]+` \| [^|]+ \| (published|target|push-further) \| (done|partial|missing) \|/.test(line)).map(line=>{
 const [id,title,kind,status,evidence,gap]=line.split(/(?<!\\)\|/).slice(1,-1).map(cell=>cell.trim())
 return {id:id.replaceAll('`',''),title,kind,status,evidence,gap}
})
if(!rows.length)throw Error('No contract status rows')
const counts=selected=>[...['done','partial','missing'].map(s=>selected.filter(r=>r.status===s).length),selected.length]
let contract=original
for(const [label,selected]of [['Published',rows.filter(r=>r.kind==='published')],['Target and push further',rows.filter(r=>r.kind!=='published')],['All',rows]]){
 const pattern=new RegExp('^\\| '+label+' \\| \\d+ \\| \\d+ \\| \\d+ \\| \\d+ \\|$','m')
 contract=contract.replace(pattern,'| '+label+' | '+counts(selected).join(' | ')+' |')
}
const [done,partial,missing,total]=counts(rows)
contract=contract.replace(/\*\*\d+ clauses: \d+ done, \d+ partial, \d+ missing\.\*\*/,()=>`**${total} clauses: ${done} done, ${partial} partial, ${missing} missing.**`)
const parsed=parseContract(contract),claims=readFileSync('docs/CLAIMS.md','utf8')
const start='<!-- cabin-contract-status:start -->',end='<!-- cabin-contract-status:end -->'
const prior=claims.includes(start)?claims.slice(claims.indexOf(start)+start.length,claims.indexOf(end)):''
const ids=[...new Set([...prior.matchAll(/^\| `([A-Z0-9-]+)` \|/gm)].map(m=>m[1]).concat(args[1]?.split(',')??[]))].sort()
if(!ids.length)throw Error('Name touched clauses with --clauses for the first generation')
let acceptance=readFileSync('ACCEPTANCE.md','utf8')
for(const id of ids){
 const row=rows.find(r=>r.id===id),clause=parsed.clauses.find(r=>r.id===id)
 if(!row||!clause)throw Error('Unknown touched clause '+id)
 const lines=acceptance.split('\n'),index=lines.findIndex(l=>l.startsWith('- **'+id+' — '))
 if(index<0||!lines[index+1]?.startsWith('  Current evidence:'))throw Error('Cannot locate acceptance entry '+id)
 lines[index]=lines[index].replace(/ · (done|partial|missing)\.\*\*/,()=> ' · '+row.status+'.**')
 lines[index+1]='  Current evidence: '+(row.evidence||'none.')+(row.gap?' Remaining: '+row.gap:'')
 acceptance=lines.join('\n')
}
const block=start+'\n\n### Generated contract status\n\n| Clause | Status | Evidence | Remaining |\n| --- | --- | --- | --- |\n'+ids.map(id=>{
 const r=rows.find(r=>r.id===id);return '| `'+r.id+'` | '+r.status+' | '+r.evidence+' | '+r.gap+' |'
}).join('\n')+'\n\n'+end
const nextClaims=claims.includes(start)?claims.slice(0,claims.indexOf(start))+block+claims.slice(claims.indexOf(end)+end.length):claims.trimEnd()+'\n\n'+block+'\n'
for(const [path,expected]of [['CONTRACT.md',contract],['ACCEPTANCE.md',acceptance],['docs/CLAIMS.md',nextClaims]]){
 if(mode==='write')writeFileSync(path,expected)
 else if(readFileSync(path,'utf8')!==expected)throw Error('Generated contract view is stale: '+path)
}
console.log('Contract views '+mode+' passed; touched clauses '+ids.join(', ')+'.')
