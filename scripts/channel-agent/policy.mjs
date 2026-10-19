const CHANNEL_DOMAINS = Object.freeze({ airbnb: ['airbnb.com'], vrbo: ['vrbo.com'], 'booking.com': ['booking.com'] });
const testPolicies = new WeakSet();

export function createRecordedPagePolicy(origin) {
  const url = new URL(origin);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.protocol !== 'http:' || url.origin !== origin) {
    throw new Error('Recorded channel edge must be a loopback HTTP origin');
  }
  const policy = Object.freeze({ origin });
  testPolicies.add(policy);
  return policy;
}

export function allowedNavigation(raw, channel, policy) {
  try {
    const url = new URL(raw);
    if (url.username || url.password) return false;
    if (testPolicies.has(policy)) return url.origin === policy.origin;
    return url.protocol === 'https:' && (!url.port || url.port === '443') &&
      (CHANNEL_DOMAINS[channel] || []).some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch { return false; }
}

// Only the local host viewer can enable this narrow, human-driven exception. It is
// never enabled for an automated job or configurable through a runner JSON file.
export function allowedHumanNavigation(raw, channel, policy) {
  if (allowedNavigation(raw, channel, policy)) return true;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false;
    return ['accounts.google.com', 'appleid.apple.com', 'challenges.cloudflare.com'].includes(url.hostname) ||
      (['www.google.com', 'www.recaptcha.net', 'recaptcha.net'].includes(url.hostname) && url.pathname.startsWith('/recaptcha/')) ||
      url.hostname === 'hcaptcha.com' || url.hostname.endsWith('.hcaptcha.com');
  } catch { return false; }
}

export function challengeFromUrl(raw) {
  try {
    const url = new URL(raw);
    const value = `${url.hostname}${url.pathname}`.toLowerCase();
    if (/\/(?:terms|agreement|consent)(?:\/|$)/.test(url.pathname)) return 'terms';
    if (/captcha|recaptcha|hcaptcha|challenges\.cloudflare/.test(value)) return 'captcha';
    if (/two[_-]?factor|two[_-]?step|mfa|\/2fa|verify[-_/]?(identity|code)|challenge\/otp/.test(value)) return '2fa';
    if (/\/login(?:\/|$)|\/signin(?:\/|$)|\/sign-in(?:\/|$)|\/auth(?:\/|$)|\/authenticate(?:\/|$)/.test(value)) return 'signin';
    if (/bot[-_/]?check|challenge-platform|access[-_/]?denied/.test(value)) return 'bot';
  } catch { /* A non-URL cannot provide challenge evidence. */ }
  return null;
}

// Attach before navigation. Navigation is constrained in the browser, including redirects,
// child frames and popups; blocked challenge frames also stop automatic operation.
export async function installNavigationGuard(context, channel, policy) {
  const state = { blocked: false, challenge: null, human: false };
  const route = async route => {
    const request = route.request();
    if (!request.isNavigationRequest()) return route.fallback();
    const challenge = challengeFromUrl(request.url());
    if (challenge) state.challenge = challenge;
    if (!(state.human ? allowedHumanNavigation(request.url(), channel, policy) : allowedNavigation(request.url(), channel, policy))) {
      state.blocked = true;
      await route.abort('blockedbyclient');
      return;
    }
    await route.fallback();
  };
  await context.route('**/*', route);
  const onPage = page => {
    page.on('dialog', dialog => void dialog.dismiss().catch(() => {}));
    page.on('download', download => void download.cancel().catch(() => {}));
  };
  context.pages().forEach(onPage);
  context.on('page', onPage);
  return {
    state,
    resetChallenge() { state.challenge = null; },
    setHumanMode(enabled) { state.human = enabled === true; if (enabled) { state.blocked = false; state.challenge = null; } },
    async dispose() { context.off('page', onPage); await context.unroute('**/*', route); },
  };
}

export async function detectChallenge(page, guard) {
  if (guard?.state.challenge) return guard.state.challenge;
  for (const frame of page.frames()) {
    const urlChallenge = challengeFromUrl(frame.url());
    if (urlChallenge) return urlChallenge;
    try {
      const result = await frame.evaluate(() => {
        const visible = node => !!(node.getBoundingClientRect().width && node.getBoundingClientRect().height) && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none';
        const has = selector => [...document.querySelectorAll(selector)].some(visible);
        const text = (document.body?.innerText || '').slice(0, 100000);
        if (has('input[type=checkbox][name*=terms i],input[type=checkbox][name*=agree i]') || /(?:accept|agree to|review and accept) (?:the |our |updated |new )*(?:terms|agreement)|terms (?:have been|were) updated|accept updated terms/i.test(text)) return 'terms';
        if (has('iframe[src*="captcha"],iframe[src*="challenge"],[class*="captcha"],[id*="captcha"],[data-sitekey]') || /verify (?:that )?you are human|complete the captcha|security check to continue/i.test(text)) return 'captcha';
        if (has('input[autocomplete="one-time-code"],input[name*="otp" i],input[name*="verification" i]') || /enter (?:the |your )?(?:verification|security|authentication|six.digit|6.digit) code|two.factor authentication|two.step verification|check your (?:phone|email) for (?:a |the )?code/i.test(text)) return '2fa';
        if (/unusual traffic|automated (?:access|requests)|checking your browser|access denied|temporarily blocked|robot check/i.test(text)) return 'bot';
        if (has('input[type="password"],input[autocomplete="username"],input[autocomplete="current-password"]') || /(?:log|sign) in to (?:your account|continue|manage)|create an account or (?:log|sign) in/i.test(text)) return 'signin';
        return null;
      });
      if (result) return result;
    } catch { return 'bot'; } // An unreadable / moving frame cannot authorize an action.
  }
  return null;
}

export function assertJob(job, policy) {
  if (!job || !CHANNEL_DOMAINS[job.channel] || !['connect', 'close', 'open'].includes(job.kind) || !allowedNavigation(job.listingUrl, job.channel, policy)) throw new Error('Invalid channel job');
  if (job.kind !== 'connect') {
    const start = Date.parse(`${job.start}T00:00:00Z`), end = Date.parse(`${job.end}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(job.start) || !/^\d{4}-\d{2}-\d{2}$/.test(job.end) || !Number.isFinite(start) || !Number.isFinite(end) || start >= end || end - start > 366 * 86400000 || new Date(start).toISOString().slice(0, 10) !== job.start || new Date(end).toISOString().slice(0, 10) !== job.end) throw new Error('Invalid channel date range');
  }
}
