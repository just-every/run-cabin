/** The six stages a host runs every booking through, in page order; each is a section's anchor. */
export const STAGES = [
  ['booked', 'Booked'],
  ['before-arrival', 'Before arrival'],
  ['turnover-day', 'Turnover day'],
  ['stay-recovery', 'Stay recovery'],
  ['payout', 'Payout'],
  ['next-stay', 'Next stay'],
] as const

/**
 * The stage rail: drawn at the top of Booked, then sticky through the six stage sections with the current stage filled
 * (STAGE_SCRIPT). On phones it scrolls sideways and keeps the current stage in view. Without script, Booked stays filled.
 */
export function StageRail() {
  return <nav className="stage-rail" aria-label="One stay, stage by stage">
    <ol>{STAGES.map(([id, label], index) => <li key={id}><a href={`#${id}`} aria-current={index === 0 ? 'step' : undefined}>{label}</a></li>)}</ol>
  </nav>
}

/** Fills the stage whose section holds the line a quarter down the screen, and marks the rail stuck once the stages scroll under it. */
export const STAGE_SCRIPT = `(()=>{const rail=document.querySelector('.stage-rail');if(!rail)return;const list=rail.querySelector('ol'),links=[...rail.querySelectorAll('a')],sections=links.map(a=>document.getElementById(a.hash.slice(1)));let current=links[0],queued=false;
const update=()=>{queued=false;const line=innerHeight*.25;let index=0;sections.forEach((s,i)=>{if(s&&s.getBoundingClientRect().top<=line)index=i});const next=links[index];
rail.classList.toggle('is-stuck',rail.parentElement.getBoundingClientRect().top<-1);
if(next!==current){current.removeAttribute('aria-current');next.setAttribute('aria-current','step');current=next;
if(list.scrollWidth>list.clientWidth+1)list.scrollTo({left:next.parentElement.offsetLeft-(list.clientWidth-next.parentElement.offsetWidth)/2,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}};
addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update)}},{passive:true});addEventListener('resize',update);update()})()`
