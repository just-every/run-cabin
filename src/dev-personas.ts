import type { DevPersona } from './modules/operator-auth/dev/index.mjs'

// Local dev personas: real operators at <as>@dev.localhost, created only by
// local dev sign-in and suspended in exports. Only src/server.dev.ts uses them.
export function devPersonas(): DevPersona[] {
 return [
  { as: 'manager', role: 'member', displayName: 'Dev manager' },
  { as: 'cleaner', role: 'member', displayName: 'Dev cleaner' },
 ]
}
