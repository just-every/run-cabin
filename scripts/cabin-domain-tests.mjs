import {readFile} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'

// Balance whole files using the observed push Verify timings. The public
// test:cabin command remains the complete registry; reject omissions, duplicates
// and stale assignments so new coverage cannot silently miss push verification.
const groups={
 operations:['cabin','readiness','dispatch','turnovers','work-orders','property-register','calendar','calendars-sync','issues','data-custody'],
 finance:['finance','ledger','allocations','month-close','taxes','audit'],
 guests:['security','inbox','promotions','guest-portal','guests','replies','owners','website'],
 restart:['direct','lifecycle','recovery','recovery-authority','demo','privacy','reservations','movein','movein-register'],
}
export async function domainArguments(group){
 if(!Object.hasOwn(groups,group))throw Error('Choose '+Object.keys(groups).join(', ')+' domain coverage')
 const {scripts}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'))
 const [node,...args]=scripts['test:cabin'].trim().split(/\s+/)
 if(node!=='node'||args.some(arg=>!arg.startsWith('--')&&!/^tests\/[\w-]+\.test\.mjs$/.test(arg)))throw Error('The public domain command must contain Node test arguments and test files')
 const files=args.filter(arg=>!arg.startsWith('--'))
 const assignments=Object.values(groups).flat().map(name=>'tests/'+name+'.test.mjs')
 if(new Set(files).size!==files.length||new Set(assignments).size!==assignments.length||files.length!==assignments.length||files.some(file=>!assignments.includes(file)))throw Error('Every public domain test file must belong to exactly one CI group')
 const selected=new Set(groups[group].map(name=>'tests/'+name+'.test.mjs'))
 return args.filter(arg=>arg.startsWith('--')||selected.has(arg))
}
if(process.argv[1]===import.meta.filename){
 const result=spawnSync(process.execPath,await domainArguments(process.argv[2]),{stdio:'inherit'})
 if(result.error)throw result.error
 process.exitCode=result.status??1
}
