import type { ReactNode } from 'react'
import { Parts, StageHead, Whole } from '../parts'

// Saturday at Lake Loft, as the recovery case logs it. Megan keeps her 4 pm check-in and Tuesday's 10 am checkout (the hero's
// "Sat 4 pm → Tue 10 am"); the 10% off her next stay is the "Returning guest 10%" on her July booking under Next stay.
// Each step's text is its values: a line breaks only between them, and a time range, a fraction or "check-in" never breaks.
const STEPS: [string, string, ReactNode[], string][] = [
  ['9:12 am', 'bad', ['Maria Lopez canceled the 11:00 clean'], 'cleaners'],
  ['9:13 am', 'ok', ['Asked 3 nearby cleaners', <>Ana Diaz accepted, arrives <Whole>1:30 pm</Whole></>], 'cleaners'],
  ['9:13 am', 'ok', ['Code 7102 for Ana', <Whole>1:30 – 4:00 pm</Whole>], 'locks'],
  ['9:14 am', 'warn', [<>Megan’s 2&nbsp;pm early <Whole>check-in</Whole> no longer fits</>], 'messages'],
  ['9:15 am', 'ok', ['Offered 10% off her next stay'], 'messages'],
  ['9:22 am', 'ok', ['Megan: Works for us, thanks!'], 'messages'],
  ['3:31 pm', 'ok', [<Whole>Checklist 18 / 18</Whole>, <Whole>photos 14 / 14</Whole>], 'checklist'],
  ['3:32 pm', 'done', [<Whole>Lake Loft ready</Whole>, <>code 4417 live at <Whole>4:00 pm</Whole></>], 'locks'],
]

/** Stay recovery, the pine band: the cleaner cancels the morning of Megan's arrival and Cabin carries the day through to ready. */
export function StayRecovery() {
  return <section id="stay-recovery" className="stage recovery" aria-labelledby="stay-recovery-title">
    <div className="s-wrap">
      <StageHead id="stay-recovery" eyebrow={[<Whole>Stay recovery</Whole>, <Whole>Sat Oct 24</Whole>, <Whole>9:12 AM</Whole>]} title={<>When plans break, Cabin fixes them.</>}>
        Cabin finds a new cleaner, resets the door codes and settles it with the guest before she arrives.
      </StageHead>
      <div className="card recovery-log">
        <div className="recovery-head"><h3>Lake Loft<i>·</i>Saturday</h3><p className="resolved">Resolved 3:32&nbsp;pm</p></div>
        <ol>{STEPS.map(([time, tone, text, area], i) => <li key={i} className={`step-${tone}`}>
          <span className="step-time">{time}</span><span className="step-node" aria-hidden="true" /><span className="step-text"><Parts of={text} /></span><span className="step-area">{area}</span>
        </li>)}</ol>
        <div className="recovery-foot"><p>Megan arrives 4:00&nbsp;pm</p><p>Cost to owner $0.00</p></div>
      </div>
    </div>
  </section>
}
