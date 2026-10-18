import { allowedNavigation, assertJob, detectChallenge, installNavigationGuard } from './policy.mjs';
import { ChallengeError, hasReopenControl, modelObservation, observePage, safeScreenshot, verifyNightEvidence } from './observation.mjs';

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const KEYS = new Set(['Enter', 'Tab', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Backspace', 'Home', 'End']);

async function applyAction(page, action, observation) {
  if (action.type === 'scroll') {
    if (!Number.isFinite(action.dy) || Math.abs(action.dy) > 900) throw new Error('Invalid UI action');
    await page.mouse.wheel(0, action.dy);
    return;
  }
  const node = observation.controls.find(control => control.ref === action.ref);
  if (!node || node.disabled) throw new Error('Invalid observed reference');
  if (/delete|remove (?:listing|property)|cancel (?:reservation|booking)|refund|payment|payout|credit card|bank account|change price|send message|message guest|confirm booking|accept reservation/i.test(node.text)) throw new Error('Action outside calendar scope');
  const locator = page.locator(node.selector);
  if (await locator.count() !== 1 || !await locator.isVisible()) throw new Error('Stale observed reference');
  // Check that the original observed control has not been replaced between model and action.
  const same = await locator.evaluate((element, previous) => {
    const text = `${element.innerText || ''} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('title') || ''} ${element.getAttribute('data-date') || ''} ${element.getAttribute('datetime') || ''} ${element.getAttribute('data-state') || ''} ${element.getAttribute('data-status') || ''}`.trim().slice(0, 1400);
    return element.tagName.toLowerCase() === previous.tag && text === previous.text;
  }, { tag: node.tag, text: node.text });
  if (!same) throw new Error('Stale observed reference');
  if (action.type === 'fill' || (action.type === 'key' && ['input', 'textarea', 'select'].includes(node.tag))) {
    const calendarField = await locator.evaluate(element => {
      const descriptor = [element.getAttribute('aria-label'), element.getAttribute('placeholder'), element.getAttribute('name'), element.getAttribute('id'), element.getAttribute('type'), ...[...(element.labels || [])].map(label => label.innerText)].filter(Boolean).join(' ');
      return /date|month|year|day|start|end|check.?in|check.?out|\bfrom\b|\buntil\b|\bto\b/i.test(descriptor) && !/price|rate|amount|card|credit|bank|account|password|email|phone|verification|security|code|otp|secret|token|guest|message|note/i.test(descriptor);
    });
    if (!calendarField) throw new Error('Field outside calendar scope');
  }
  if (action.type === 'click') {
    await locator.click({ timeout: 8000 });
  } else if (action.type === 'fill') {
    if (!['input', 'textarea'].includes(node.tag) || ['password', 'email', 'tel'].includes(node.type) || typeof action.text !== 'string' || action.text.length > 100) throw new Error('Invalid field action');
    // Operational fields only: never type credentials, codes, guest text or payment details.
    if (!/^(?:\d{1,4}[-/. :]){0,4}\d{1,4}$/.test(action.text)) throw new Error('Only numeric calendar fields may be filled');
    await locator.fill(action.text, { timeout: 8000 });
  } else if (action.type === 'key') {
    if (!KEYS.has(action.key)) throw new Error('Invalid calendar key');
    await locator.press(action.key, { timeout: 8000 });
  } else throw new Error('Invalid UI action');
}

/**
 * Driver: async ({ phase: 'act'|'verify', job, observation, screenshot, step }) =>
 * {type:'click'|'fill'|'key',ref,...} | {type:'scroll',dy} |
 * {type:'baseline',evidence:[{date,ref,state:'open'}]} |
 * {type:'done',evidence:[{date,ref,state:'open'|'closed'}]} | {type:'needs_you'}.
 * options.policy accepts ONLY a policy made by createRecordedPagePolicy for edge tests.
 * options.connect is human-only and returns {outcome,challenge?}; it must not automate auth.
 */
export async function executeJob(page, job, driver, options = {}) {
  let guard, mutated = false, before, baselineOpen = false;
  const failure = async challenge => {
    challenge ||= guard ? await detectChallenge(page, guard).catch(() => 'bot') : null;
    if (challenge) return { outcome: 'needs_you', challenge, canUndo: false };
    const completion = { outcome: mutated ? 'uncertain' : 'failed', canUndo: false };
    if (before) {
      completion.before = before;
      if (!guard.state.blocked) {
        try { completion.after = await safeScreenshot(page, guard); }
        catch (error) {
          if (error instanceof ChallengeError) return { outcome: 'needs_you', challenge: error.challenge, canUndo: false };
        }
      }
    }
    return completion;
  };
  try {
    assertJob(job, options.policy);
    guard = await installNavigationGuard(page.context(), job.channel, options.policy);
    page.setDefaultTimeout(8000);
    try { await page.goto(job.listingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }); }
    catch (error) {
      // A blocked external authentication redirect may interrupt initial navigation.
      // Only the human viewer may continue it via its explicit reload action.
      if (job.kind !== 'connect' || !guard.state.blocked) throw error;
    }
    await delay(1200);
    if (job.kind === 'connect') {
      if (typeof options.connect !== 'function') return { outcome: 'needs_you', challenge: (await detectChallenge(page, guard)) || 'signin', canUndo: false };
      return await options.connect(page, job, guard);
    }
    if (guard.state.blocked) return await failure(guard.state.challenge);
    let challenge = await detectChallenge(page, guard);
    if (challenge) return await failure(challenge);
    if (typeof driver !== 'function') return { outcome: 'needs_you', canUndo: false };
    let observation = await observePage(page, guard);
    before = observation.screenshot;
    if (typeof options.onBefore === 'function') await options.onBefore(job, before);
    for (let step = 0; step < 20; step++) {
      challenge = await detectChallenge(page, guard);
      if (challenge) return await failure(challenge);
      if (guard.state.blocked || !allowedNavigation(page.url(), job.channel, options.policy)) return await failure();
      const input = { phase: 'act', job: { kind: job.kind, channel: job.channel, start: job.start, end: job.end }, observation: modelObservation(observation), screenshot: observation.screenshot, step };
      const action = await driver(input);
      if (!action || action.type === 'needs_you') return mutated ? await failure() : { outcome: 'needs_you', canUndo: false };
      challenge = await detectChallenge(page, guard);
      if (challenge) return await failure(challenge);
      if (guard.state.blocked) return await failure();
      if (action.type === 'baseline') {
        if (mutated || job.kind !== 'close' || !verifyNightEvidence({ ...job, kind: 'open' }, observation, action.evidence)) return await failure();
        baselineOpen = true;
        observation = await observePage(page, guard);
        continue;
      }
      if (action.type === 'done') {
        // Re-read first, then reload and re-read again so an optimistic unsaved calendar
        // cannot be mistaken for a completed channel operation.
        const current = await observePage(page, guard);
        if (!verifyNightEvidence(job, current, action.evidence)) return await failure();
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
        await delay(1200);
        if (guard.state.blocked) return await failure(guard.state.challenge);
        const after = await observePage(page, guard);
        const verification = await driver({ ...input, phase: 'verify', observation: modelObservation(after), screenshot: after.screenshot });
        challenge = await detectChallenge(page, guard);
        if (challenge) return await failure(challenge);
        const verified = await observePage(page, guard);
        if (verification?.type !== 'done' || !verifyNightEvidence(job, verified, verification.evidence)) return await failure();
        return { outcome: 'succeeded', result: job.kind === 'close' ? 'closed' : 'open', before, after: verified.screenshot, canUndo: job.kind === 'close' && mutated && baselineOpen && hasReopenControl(verified) };
      }
      // A click/key/fill can submit a mutation even when a model labels it as navigation.
      // Any later ambiguous error therefore becomes uncertain and cannot be retried.
      if (typeof options.beforeAction === 'function') await options.beforeAction(job);
      if (action.type !== 'scroll') mutated = true;
      await applyAction(page, action, observation);
      await delay(1200);
      challenge = await detectChallenge(page, guard);
      if (challenge) return await failure(challenge);
      if (guard.state.blocked) return await failure();
      observation = await observePage(page, guard);
    }
    return await failure();
  } catch (error) {
    return await failure(error instanceof ChallengeError ? error.challenge : guard?.state.challenge);
  } finally {
    if (guard) await guard.dispose();
  }
}

export { createRecordedPagePolicy } from './policy.mjs';
