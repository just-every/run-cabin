import { Feature, Icon, Initials, Status, Tick } from '../parts'

/** Saturday's turnover at Desert Casita: the window between guests, Luis's checklist and photos, the next guest's door code
 * and the one thing Luis found broken. */
export function Turnovers() {
  return <Feature id="turnovers" eyebrow="Turnovers" title={<>Checkout sends<br />the cleaner.</>}
    label="Turnover at Desert Casita on Saturday Oct 17: checkout 10:00 am, next guest 4:00 pm. Luis Ramos cleans from 11:00 am to 3:00 pm; strip and remake 3 beds, restock coffee and towels, hot tub cleaned and tested are done; photos 12 of 12. Door code 4417 runs Saturday 4 pm to Tuesday 10 am. Patio light out: a task was added for Dale"
    art={<div className="card turnover">
      <div className="turnover-head"><p className="card-title">Turnover<i>·</i>Desert Casita<i>·</i>Sat Oct 17</p><p className="muted">Checkout 10:00 am<span className="arrow">→</span>Next guest 4:00 pm</p></div>
      <p className="turnover-who"><Initials>LR</Initials><span>Luis Ramos<i>·</i><span className="muted">11:00 am – 3:00 pm</span></span></p>
      <ul className="checklist">
        {['Strip and remake 3 beds', 'Restock coffee and towels', 'Hot tub cleaned and tested'].map(item => <li key={item}><span className="tick-disc solid"><Tick /></span>{item}</li>)}
      </ul>
      <div className="turnover-photos"><p>Photos <span className="muted">12 / 12</span></p><div className="thumbs"><span className="thumb thumb-bed" /><span className="thumb thumb-bath" /><span className="thumb thumb-tub" /></div></div>
      <p className="turnover-row"><Status tone="lock" /><span>Door code 4417<i>·</i><span className="muted">Sat 4 pm → Tue 10 am</span></span></p>
      <p className="turnover-row"><Status tone="warn" /><span>Patio light out<i>·</i><span className="muted">task added for Dale</span></span></p>
    </div>}>
    Every reservation creates its turnover and its door code. Cleaners get the checklist on their phone, and photos come back when the home is ready.
  </Feature>
}

const STEPS = [
  ['9:12 am', 'bad', 'Maria cancelled the 11:00 am clean'],
  ['9:13 am', 'ok', 'Rebooked with Ana for 11:30 am'],
  ['9:14 am', 'ok', 'New cleaner code 7102 sent'],
  ['1:40 pm', 'ok', 'Photos in · home ready ✓'],
  ['6:05 pm', 'warn', 'Guest: hot tub not heating'],
  ['6:07 pm', 'ok', '$75 credit sent · within your $100 limit'],
] as const

/** The same Saturday at Lake Loft: a cleaner drops out and a guest reports a fault, and Cabin carries each through. */
export function StayRecovery() {
  return <Feature id="recovery" flip eyebrow="Stay recovery" title={<>When plans break,<br />Cabin fixes them.</>}
    label="Lake Loft on Saturday Oct 17: at 9:12 am Maria cancelled the 11:00 am clean; 9:13 am rebooked with Ana for 11:30 am; 9:14 am new cleaner code 7102 sent; 1:40 pm photos in and the home is ready; 6:05 pm the guest reports the hot tub is not heating; 6:07 pm a $75 credit is sent, within your $100 limit. Owner balance updated by minus $75.00"
    art={<div className="card timeline">
      <p className="card-title">Lake Loft<i>·</i>Sat Oct 17</p>
      <ol>{STEPS.map(([time, tone, text]) => <li key={time} className={`step-${tone}`}><span className="time">{time}</span><span className="node" /><span>{text}</span></li>)}</ol>
      <p className="timeline-foot"><span className="money-disc"><Icon name="dollar" /></span><span>Owner balance updated<b>−$75.00</b></span></p>
    </div>}>
    A cleaner cancels or a guest reports a problem. Cabin rebooks the turnover, resets the door code, offers the credit you approved and confirms the home is ready.
  </Feature>
}
