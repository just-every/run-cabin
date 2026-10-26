import {readFile} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'

// Keep the public domain command as the complete file registry. Give restart
// flows their own job so browser setup cannot consume their execution budget.
const restartFiles=new Set(['tests/direct.test.mjs','tests/lifecycle.test.mjs','tests/recovery.test.mjs','tests/recovery-authority.test.mjs'])
export async function domainArguments(group){
 if(!['core','restart'].includes(group))throw Error('Choose core or restart domain coverage')
 const {scripts}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'))
 const [node,...args]=scripts['test:cabin'].trim().split(/\s+/)
 if(node!=='node'||args.some(arg=>!arg.startsWith('--')&&!/^tests\/[\w-]+\.test\.mjs$/.test(arg)))throw Error('The public domain command must contain Node test arguments and test files')
 return args.filter(arg=>arg.startsWith('--')||restartFiles.has(arg)===(group==='restart'))
}
if(process.argv[1]===import.meta.filename){
 const result=spawnSync(process.execPath,await domainArguments(process.argv[2]),{stdio:'inherit'})
 if(result.error)throw result.error
 process.exitCode=result.status??1
}
