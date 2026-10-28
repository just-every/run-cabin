// Compatibility entrypoint; main's generator owns contract views and preserves legacy prose.
import { spawnSync } from 'node:child_process'
const [mode,...args]=process.argv.slice(2)
const result=spawnSync(process.execPath,['src/base/contract-docs.mjs',mode,...(args.length?args:['--clauses','PRICE-002'])],{stdio:'inherit'})
process.exit(result.status??1)
