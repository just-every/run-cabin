import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { createModelDriver } from './model.mjs';
import { executeRead } from './read-page.mjs';
import { executeJob } from './executor.mjs';
import { allowedNavigation } from './policy.mjs';
import { startSigninViewer } from './viewer.mjs';

export async function readPrivateConfig(path) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600 || (typeof process.getuid === 'function' && stat.uid !== process.getuid()) || stat.size > 16384) throw new Error('Runner config must be a private mode-0600 file owned by this user');
    const config = JSON.parse(await file.readFile('utf8'));
    const url = new URL(config.origin);
    if (url.origin !== config.origin || url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) || typeof config.token !== 'string' || config.token.length < 16 || config.token.length > 4096) throw new Error('Invalid runner configuration');
    if (['modelEndpoint', 'modelKey', 'model'].some(key => config[key] !== undefined && (typeof config[key] !== 'string' || config[key].length > 8192))) throw new Error('Invalid model configuration');
    return { origin: config.origin, token: config.token, modelEndpoint: config.modelEndpoint, modelKey: config.modelKey, model: config.model };
  } finally { await file.close(); }
}

export async function runnerRequest(config, body) {
  const response = await fetch(`${config.origin}/api/cabin/channel-agent/runner`, { method: 'POST', redirect: 'error', headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(30000), body: JSON.stringify(body) });
  if (!response.ok) throw new Error('Cabin runner request rejected');
  return response.json();
}

function scopedStorage(state, channel) {
  if (!state || !Array.isArray(state.cookies) || !Array.isArray(state.origins)) return undefined;
  return {
    cookies: state.cookies.filter(cookie => typeof cookie.domain === 'string' && allowedNavigation(`https://${cookie.domain.replace(/^\./, '')}/`, channel)),
    origins: state.origins.filter(item => allowedNavigation(item.origin, channel)),
  };
}

export async function launchChannelBrowser() {
  const { chromium } = await import('@playwright/test');
  const executable = chromium.executablePath();
  // The owner forbids old Chromium/keychain builds; never substitute installed Chrome.
  const build = /chromium(?:_headless_shell)?-(\d+)/.exec(executable);
  if (!build || Number(build[1]) < 1243) throw new Error('Current Playwright Chromium is required');
  return chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] });
}

/** Runs one browser process, isolated storageState contexts, sequential bounded leased jobs. */
export async function runRunner(configPath, { once = false, signal, log = message => process.stdout.write(`${message}\n`) } = {}) {
  const config = await readPrivateConfig(configPath);
  const driver = createModelDriver(config);
  let browser;
  try {
    do {
      if (signal?.aborted) break;
      const claimed = await runnerRequest(config, { op: 'claim' });
      const job = claimed.job;
      if (!job) {
        if (once) break;
        await new Promise(resolve => {
          const done = () => { clearTimeout(timer); signal?.removeEventListener('abort', done); resolve(); };
          const timer = setTimeout(done, 5000);
          signal?.addEventListener('abort', done, { once: true });
        });
        continue;
      }
      let context, viewer, completion = { outcome: 'failed', canUndo: false };
      try {
        browser ||= await launchChannelBrowser();
        const storageState = scopedStorage(job.storageState, job.channel);
        context = await browser.newContext({ ...(storageState ? { storageState } : {}), viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', acceptDownloads: false });
        const page = await context.newPage();
        completion = await (job.kind.startsWith('read-') ? executeRead : executeJob)(page, job, driver, {
          onBefore: async (_job, before) => { await runnerRequest(config, { op: 'checkpoint', id: job.id, lease: job.lease, before }); },
          beforeAction: async () => { await runnerRequest(config, { op: 'authorize', id: job.id, lease: job.lease }); },
          connect: async (page, job, guard) => {
            viewer = await startSigninViewer(page, job, guard);
            log(`Cabin sign-in viewer: ${viewer.url}`);
            const onAbort = () => void viewer.close();
            signal?.addEventListener('abort', onAbort, { once: true });
            try { return await viewer.result; }
            finally { signal?.removeEventListener('abort', onAbort); await viewer.close(); }
          },
        });
        const state = scopedStorage(await context.storageState({ indexedDB: true }), job.channel);
        if (state) completion.storageState = state;
      } catch {
        // executeJob contains mutation failures. A later storage/read failure must not
        // turn a previously submitted operation into a retryable pre-mutation failure.
        if (completion.outcome === 'succeeded' && job.kind !== 'connect') completion = { outcome: 'uncertain', canUndo: false };
      } finally {
        if (viewer) await viewer.close().catch(() => {});
        if (context) await context.close().catch(() => {});
      }
      for (const key of ['before', 'after']) if (completion[key]?.length > 650000) delete completion[key];
      // No automatic transport retry: if receipt is ambiguous, the lease expires uncertain.
      await runnerRequest(config, { op: 'complete', id: job.id, lease: job.lease, ...completion });
      log(`Cabin channel job: ${completion.outcome}`);
    } while (!once && !signal?.aborted);
  } finally { if (browser) await browser.close(); }
}
