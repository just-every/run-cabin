import { detectChallenge } from './policy.mjs';

export const sensitiveSelector = 'input,textarea,[contenteditable="true"],[data-token],[data-secret],[class*="token" i],[id*="token" i],iframe';

export function redact(text) {
  return String(text).replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?\b/g, '[token]')
    .replace(/\b(?:Bearer\s+)[\w.+/-]+=*/gi, '[token]')
    .replace(/\b[a-f0-9]{32,}\b/gi, '[token]')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[token]')
    .replace(/\b(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|session[_ -]?token|secret)\s*[:=]\s*\S+/gi, '[secret]')
    .replace(/(?:https?:\/\/)[^\s<>"']+/gi, '[link]');
}

export class ChallengeError extends Error {
  constructor(challenge) { super('Human action required'); this.challenge = challenge; }
}

export async function safeScreenshot(page, guard) {
  let challenge = await detectChallenge(page, guard);
  if (challenge) throw new ChallengeError(challenge);
  const mask = [page.locator(sensitiveSelector), page.getByText(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|Bearer\s+[\w.+/-]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|[a-f0-9]{32,}|sk-[A-Za-z0-9_-]{12,}|(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|session[_ -]?token|secret)\s*[:=]\s*\S+/i)];
  const image = await page.screenshot({ type: 'png', fullPage: false, mask, animations: 'disabled' });
  challenge = await detectChallenge(page, guard);
  if (challenge) throw new ChallengeError(challenge);
  return image.toString('base64');
}

// Refs are produced from actual, visible DOM elements. No model-supplied selector is executed.
export async function observePage(page, guard) {
  const screenshot = await safeScreenshot(page, guard);
  const raw = await page.evaluate(() => {
    const visible = node => { const r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none'; };
    const selectorFor = node => {
      const parts = [];
      for (let current = node; current && current !== document.documentElement; current = current.parentElement) {
        const tag = current.tagName.toLowerCase();
        const siblings = [...current.parentElement.children].filter(other => other.tagName === current.tagName);
        parts.unshift(`${tag}:nth-of-type(${siblings.indexOf(current) + 1})`);
      }
      return `html > ${parts.join(' > ')}`;
    };
    const nodes = [...document.querySelectorAll('button,a,input,select,textarea,[role="button"],[role="gridcell"],td,[data-date],time,[role="row"],label')].filter(visible).slice(0, 600);
    return { title: document.title, text: (document.body?.innerText || '').slice(0, 24000), controls: nodes.map((node, index) => {
      const r = node.getBoundingClientRect();
      const text = `${node.innerText || ''} ${node.getAttribute('aria-label') || ''} ${node.getAttribute('title') || ''} ${node.getAttribute('data-date') || ''} ${node.getAttribute('datetime') || ''} ${node.getAttribute('data-state') || ''} ${node.getAttribute('data-status') || ''}`.trim().slice(0, 1400);
      return { ref: String(index), selector: selectorFor(node), text, tag: node.tagName.toLowerCase(), type: node.getAttribute('type'), disabled: node.disabled === true || node.getAttribute('aria-disabled') === 'true', rect: { x: r.x, y: r.y, width: r.width, height: r.height } };
    }) };
  });
  const controls = raw.controls.map(item => ({ ...item, text: redact(item.text) }));
  return { screenshot, title: redact(raw.title), text: redact(raw.text), controls };
}

export function modelObservation(observation) {
  return { title: observation.title, text: observation.text, controls: observation.controls.map(({ selector, ...rest }) => rest) };
}

export function nightsFor(job) {
  const nights = [];
  for (let time = Date.parse(`${job.start}T00:00:00Z`); time < Date.parse(`${job.end}T00:00:00Z`); time += 86400000) nights.push(new Date(time).toISOString().slice(0, 10));
  return nights;
}

function datePresent(text, date) {
  const [year, month, day] = date.split('-');
  const parsed = new Date(`${date}T00:00:00Z`);
  const monthNames = [parsed.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }), parsed.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })];
  return text.includes(date) || monthNames.some(name => new RegExp(`(?:${name}\\s+0?${Number(day)}(?:,)?\\s+${year}|0?${Number(day)}\\s+${name}\\s+${year})`, 'i').test(text));
}

// Availability is independently re-read from visible DOM. A model's success assertion alone
// is never proof; each night needs its own dated state element and re-read after a reload.
export function verifyNightEvidence(job, observation, evidence) {
  const wanted = job.kind === 'close' ? 'closed' : 'open';
  const nights = nightsFor(job);
  if (!Array.isArray(evidence) || evidence.length !== nights.length) return false;
  return nights.every(date => {
    const matches = evidence.filter(item => item.date === date && item.state === wanted);
    if (matches.length !== 1) return false;
    const node = observation.controls.find(control => control.ref === matches[0].ref);
    if (!node || !datePresent(node.text, date) || nights.filter(other => datePresent(node.text, other)).length !== 1 || new Set(node.text.match(/\b\d{4}-\d{2}-\d{2}\b/g) || []).size > 1) return false;
    // One DOM node cannot serve as evidence for several nights.
    if (evidence.filter(item => item.ref === node.ref).length !== 1) return false;
    const closed = /\b(?:unavailable|not available|blocked|closed)\b/i.test(node.text);
    return wanted === 'closed' ? closed : !closed && /\b(?:available|open)\b/i.test(node.text);
  });
}

export function hasReopenControl(observation) {
  return observation.controls.some(node => !node.disabled && ['button', 'a', 'input'].includes(node.tag) && /^(?:reopen|open (?:these |selected )?(?:dates|nights)|make (?:these |selected )?(?:dates|nights)?\s*available|available)\b/i.test(node.text.trim()));
}
