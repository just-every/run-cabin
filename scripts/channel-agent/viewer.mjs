import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { allowedHumanNavigation, allowedNavigation, detectChallenge } from './policy.mjs';
import { viewerPage } from './viewer-page.mjs';

async function readAction(request) {
  let size = 0, body = '';
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16384) throw new Error('Input too large');
    body += chunk.toString('utf8');
  }
  return JSON.parse(body);
}

async function verifiedConnection(page, job, guard, policy) {
  guard.resetChallenge();
  const challenge = await detectChallenge(page, guard);
  if (challenge || guard.state.blocked || !allowedNavigation(page.url(), job.channel, policy)) return { challenge };
  const hostInterface = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    const hostPath = /hosting|calendar|reservations|manage|extranet|property|properties|owner|dashboard/.test(location.pathname.toLowerCase()) || location.hostname === 'admin.booking.com';
    return hostPath && /calendar|reservations|listings|properties|availability|guest arrivals|your accommodation/i.test(text);
  });
  const state = await page.context().storageState({ indexedDB: true });
  const hasSession = state.cookies.some(cookie => cookie.value && allowedNavigation(`https://${cookie.domain.replace(/^\./, '')}/`, job.channel)) ||
    state.origins.some(origin => allowedNavigation(origin.origin, job.channel, policy) && (origin.localStorage?.length || origin.indexedDB?.length));
  return { connected: !!hostInterface && !!hasSession };
}

/** Human-only, ephemeral loopback viewer. No model calls, screen persistence or credentials in logs. */
export async function startSigninViewer(page, job, guard, { policy, timeoutMs = 10 * 60 * 1000 } = {}) {
  let origin, busy = false, ended = false, resolveResult;
  const context = page.context();
  const nonce = randomBytes(18).toString('base64');
  guard.setHumanMode(true);
  const result = new Promise(resolve => { resolveResult = resolve; });
  let timer;
  function finish(value) {
    if (ended) return;
    ended = true;
    guard.setHumanMode(false);
    clearTimeout(timer);
    resolveResult(value);
  }
  const headers = {
    'cache-control': 'no-store, max-age=0', 'pragma': 'no-cache',
    'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff',
    'content-security-policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'`,
    'cross-origin-resource-policy': 'same-origin', 'cross-origin-opener-policy': 'same-origin',
  };
  const server = createServer(async (request, response) => {
    const send = (code, body, type = 'application/json') => {
      response.writeHead(code, { ...headers, 'content-type': type });
      response.end(type === 'application/json' ? JSON.stringify(body) : body);
    };
    const fetchSite = request.headers['sec-fetch-site'];
    const expectedHost = new URL(origin).host;
    if (request.headers.host !== expectedHost || (request.headers.origin && request.headers.origin !== origin) || !['same-origin', 'none'].includes(fetchSite)) return send(403, { status: 'Local access only.' });
    if (request.method === 'GET' && request.url === '/' && !ended) return send(200, viewerPage(nonce), 'text/html; charset=utf-8');
    if (fetchSite !== 'same-origin') return send(403, { status: 'Open the local viewer first.' });
    if (ended) return send(410, { status: 'Viewer finished.', done: true });
    // Some identity providers open a popup. Keep it in the same context and expose
    // only an allowed provider/channel page; a closed popup returns to the channel.
    page = context.pages().filter(candidate => !candidate.isClosed() && allowedHumanNavigation(candidate.url(), job.channel, policy)).at(-1) || page;
    if (request.method === 'GET' && request.url === '/frame') {
      if (busy) return send(409, { status: 'Action in progress.' });
      busy = true;
      try {
        // Human-visible authentication image only: returned directly, never stored or
        // passed to the model, Cabin API, evidence screenshots or log handlers.
        if (guard.state.blocked || !allowedHumanNavigation(page.url(), job.channel, policy)) return send(409, { status: 'Navigation stopped. Return to Cabin.' });
        const frame = await page.screenshot({ type: 'png', fullPage: false, animations: 'disabled' });
        return send(200, frame, 'image/png');
      } catch { return send(409, { status: 'Page unavailable.' }); }
      finally { busy = false; }
    }
    if (request.method !== 'POST' || request.url !== '/action' || request.headers.origin !== origin || request.headers['content-type'] !== 'application/json') return send(403, { status: 'Local action required.' });
    if (busy) return send(409, { status: 'Wait for your previous action.' });
    busy = true;
    try {
      const action = await readAction(request);
      if (action.type === 'cancel') {
        finish({ outcome: 'needs_you', challenge: (await detectChallenge(page, guard)) || 'signin', canUndo: false });
        return send(200, { status: 'Sign-in cancelled. Return to Cabin.', done: true });
      }
      if (action.type === 'reload') {
        guard.setHumanMode(true);
        await page.goto(job.listingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        return send(200, { status: 'Channel page reloaded. Finish sign-in yourself.' });
      }
      if (guard.state.blocked || !allowedHumanNavigation(page.url(), job.channel, policy)) return send(409, { status: 'Off-channel navigation stopped. Return to Cabin.' });
      if (action.type === 'finish') {
        const verification = await verifiedConnection(page, job, guard, policy);
        if (!verification.connected) return send(409, { status: verification.challenge ? 'Complete the sign-in or verification, then select Finished.' : 'Open your signed-in host calendar, then select Finished.' });
        finish({ outcome: 'succeeded', result: 'connected', canUndo: false });
        return send(200, { status: 'Connected. Return to Cabin.', done: true });
      }
      if (action.type === 'viewport') {
        if (!Number.isInteger(action.width) || action.width < 320 || action.width > 1440) throw new Error('Invalid viewport');
        await page.setViewportSize({ width: action.width, height: 900 });
      } else if (action.type === 'click') {
        const viewport = page.viewportSize();
        if (!Number.isInteger(action.x) || !Number.isInteger(action.y) || action.x < 0 || action.y < 0 || action.x >= viewport.width || action.y >= viewport.height) throw new Error('Invalid click');
        await page.mouse.click(action.x, action.y);
      } else if (action.type === 'type') {
        if (typeof action.text !== 'string' || action.text.length > 4096) throw new Error('Invalid text');
        await page.keyboard.insertText(action.text);
      } else if (action.type === 'key') {
        if (!['Tab', 'Enter', 'Backspace', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(action.key)) throw new Error('Invalid key');
        await page.keyboard.press(action.key);
      } else if (action.type === 'scroll') {
        if (!Number.isFinite(action.dy) || Math.abs(action.dy) > 900) throw new Error('Invalid scroll');
        await page.mouse.wheel(0, action.dy);
      } else throw new Error('Invalid action');
      return send(200, { status: 'Action sent. Finish sign-in, then select Finished.' });
    } catch { return send(400, { status: 'Action could not be completed. Check the page.' }); }
    finally { busy = false; }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  timer = setTimeout(() => finish({ outcome: 'needs_you', challenge: 'signin', canUndo: false }), timeoutMs);
  return {
    url: origin,
    result,
    async close() {
      finish({ outcome: 'needs_you', challenge: 'signin', canUndo: false });
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    },
  };
}
