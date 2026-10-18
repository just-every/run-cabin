import { pathToFileURL } from 'node:url';
import { runRunner } from './runner.mjs';

export { executeJob, createRecordedPagePolicy } from './executor.mjs';
export { startSigninViewer } from './viewer.mjs';
export { runRunner, readPrivateConfig, runnerRequest, launchChannelBrowser } from './runner.mjs';
export { createModelDriver } from './model.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const configAt = args.indexOf('--config');
  const configPath = configAt >= 0 ? args[configAt + 1] : undefined;
  const valid = configPath && args.filter((_, index) => index !== configAt && index !== configAt + 1).every(arg => arg === '--once');
  if (!valid) {
    process.stderr.write('Usage: node scripts/channel-agent/index.mjs --config PRIVATE_JSON [--once]\n');
    process.exitCode = 2;
  } else {
    const abort = new AbortController();
    process.once('SIGINT', () => abort.abort());
    process.once('SIGTERM', () => abort.abort());
    runRunner(configPath, { once: args.includes('--once'), signal: abort.signal }).catch(() => {
      // Intentionally exclude error strings: browser/provider errors may contain URLs,
      // request details, session tokens or typed credentials.
      process.stderr.write('Cabin runner stopped. Check its private configuration and job status in Cabin.\n');
      process.exitCode = 1;
    });
  }
}
