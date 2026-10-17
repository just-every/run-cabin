import { h } from './shared'

// How to give this Cabin a private key, worded for where it runs. Locally the
// key goes in .dev.vars at the top of the Cabin folder and Cabin restarts.
// Hosted, rer sets it on the named Worker (the same --set-secret rer deploy
// prints), so later deploys from .env.cabin keep it.
export function privateSettingSteps(s: any, settings: Array<[name: string, example: string]>) {
  const lines = settings.map(([name, example]) => `${name}=${example}`).join('\n')
  if (s.local) return `<p>This Cabin runs on this computer. Its private settings file is <code>.dev.vars</code> in your Cabin folder, the folder you run <code>rer dev</code> in (for example <code>run-cabin/.dev.vars</code>). Open it in a text editor; from that folder on a Mac, <code>open -e .dev.vars</code> does it, since Finder hides names that start with a dot. Add ${settings.length > 1 ? 'these lines' : 'this line'} and save:</p><pre><code>${h(lines)}</code></pre><p>Then restart Cabin from the same folder:</p><pre><code>rer dev --stop\nrer dev</code></pre>`
  const worker: string | null = s.workerName
  const environment = worker?.startsWith('cabin-') ? worker.slice('cabin-'.length) : null
  const flag = environment === 'production' ? '' : environment ? ` --environment ${environment}` : ' --environment NAME'
  const where = worker ? `This Cabin runs in the Cloudflare Worker <strong>${h(worker)}</strong>.` : 'This custom address does not show which Worker runs Cabin.'
  const which = environment ? '' : worker ? ` Use the <code>--environment</code> you deployed <strong>${h(worker)}</strong> with (leave it out for the default production environment).` : ' Use the <code>--environment</code> you deployed with, or leave it out for the default production environment.'
  const commands = settings.map(([name]) => `rer deploy${flag} --set-secret ${name} --env-file .env.cabin`).join('\n')
  return `<p>${where} Add the key with rer, not in the Cloudflare dashboard, so later deploys keep it.</p><ol><li>In the Cabin folder you deployed from, open your private deploy settings file <code>.env.cabin</code> (the file you pass to <code>rer deploy --env-file</code>) and add:<pre><code>${h(lines)}</code></pre></li><li>From that folder, run:<pre><code>${h(commands)}</code></pre>Each command changes only that secret on ${worker ? `<strong>${h(worker)}</strong>` : 'the Worker'}, without rebuilding.${which}</li><li>Reload this page.</li></ol>`
}
