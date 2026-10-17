import { StageHead } from '../parts'

// Saturday at Lake Loft, as the recovery case logs it. Megan keeps her 4 pm check-in and Tuesday's 10 am checkout (the hero's
// "Sat 4 pm → Tue 10 am"); the 10% off her next stay is the "Returning guest 10%" on her July booking under Next stay.
const STEPS = [
  ['9:12 am', 'bad', 'Maria Lopez canceled the 11:00 clean', 'cleaners'],
  ['9:13 am', 'ok', 'Asked 3 nearby cleaners · Ana Diaz accepted, arrives 1:30 pm', 'cleaners'],
  ['9:13 am', 'ok', 'Code 7102 for Ana · 1:30 – 4:00 pm', 'locks'],
  ['9:14 am', 'warn', 'Megan’s 2 pm early check-in no longer fits', 'messages'],
  ['9:15 am', 'ok', 'Offered 10% off her next stay', 'messages'],
  ['9:22 am', 'ok', 'Megan: Works for us, thanks!', 'messages'],
  ['3:31 pm', 'ok', 'Checklist 18 / 18 · photos 14 / 14', 'checklist'],
  ['3:32 pm', 'done', 'Lake Loft ready · code 4417 live at 4:00 pm', 'locks'],
] as const

/** Splits a step at its separator dots so each part wraps whole. */
const Parts = ({ text }: { text: string }) => <>{text.split(' · ').map((part, i) => <span key={part}>{i > 0 && <i>·</i>}{part}</span>)}</>

/** Stay recovery, the pine band: the cleaner cancels the morning of Megan's arrival and Cabin carries the day through to ready. */
export function StayRecovery() {
  return <section id="stay-recovery" className="stage recovery" aria-labelledby="stay-recovery-title">
    <div className="s-wrap">
      <StageHead id="stay-recovery" eyebrow={<>Stay recovery<i>·</i>Sat Oct&nbsp;24<i>·</i>9:12&nbsp;AM</>} title={<>When plans break, Cabin fixes them.</>}>
        Cabin finds a new cleaner, resets the door codes and settles it with the guest before she arrives.
      </StageHead>
      <div className="card recovery-log">
        <div className="recovery-head"><h3>Lake Loft<i>·</i>Saturday</h3><p className="resolved">Resolved 3:32&nbsp;pm</p></div>
        <ol>{STEPS.map(([time, tone, text, area], i) => <li key={i} className={`step-${tone}`}>
          <span className="step-time">{time}</span><span className="step-node" aria-hidden="true" /><span className="step-text"><Parts text={text} /></span><span className="step-area">{area}</span>
        </li>)}</ol>
        <div className="recovery-foot"><p>Megan arrives 4:00&nbsp;pm</p><p>Cost to owner $0.00</p></div>
      </div>
    </div>
  </section>
}
