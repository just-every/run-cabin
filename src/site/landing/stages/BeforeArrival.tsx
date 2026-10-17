import { Dot, Icon, Initials, Parts, StageHead, Status, Whole } from '../parts'

/** Before arrival: Megan's one thread. The directions went out on schedule, she asks to check in early, and Cabin's draft waits for Send. */
export function BeforeArrival() {
  return <section id="before-arrival" className="stage side arrival" aria-labelledby="before-arrival-title">
    <div className="s-wrap side-row">
      <StageHead id="before-arrival" eyebrow={[<Whole>Before arrival</Whole>, <Whole>Wed Oct 21 → Fri Oct 23</Whole>]} title={<>Every guest,<br />answered.</>}>
        Airbnb, Vrbo, Booking.com, text and email arrive in one thread per guest. Scheduled messages go out on time, and Cabin drafts the rest.
      </StageHead>
      <div className="arrival-art">
        <div className="card thread">
          <div className="thread-head">
            <Initials>MO</Initials>
            <div>
              <p className="thread-name">Megan Ortiz <span className="thread-channel"><Dot channel="airbnb" />Airbnb</span></p>
              <p className="thread-stay"><Parts of={['Lake Loft', <Whole>Oct 24–27</Whole>, <Whole>4 guests</Whole>]} /></p>
            </div>
          </div>
          <div className="thread-body">
            <p className="thread-auto"><Status tone="pine" /><Parts of={[<Whole>Wed 10:00 am</Whole>, <Whole>Directions and Wi-Fi</Whole>, <Whole><span className="muted">sent automatically</span></Whole>]} /></p>
            <p className="thread-time">Fri 7:18&nbsp;pm</p>
            <p className="bubble">Any chance we can check in early? We land at noon.</p>
            <div className="draft">
              <p className="draft-label"><Icon name="pencil" />Draft</p>
              <p className="draft-text">Hi Megan! Cleaning wraps at 1&nbsp;pm, so you’re welcome from 2&nbsp;pm. Your door code will work from then.</p>
              <p className="draft-actions"><span className="draft-send">Send</span><span className="draft-edit">Edit</span></p>
            </div>
          </div>
        </div>
        <p className="float-chip arrival-code"><Icon name="padlock" className="violet" /><span>Door code start moved to 2:00&nbsp;pm</span></p>
        <p className="float-chip arrival-steps"><Status tone="amber" /><Parts of={[<Whole>Sat 12:00 pm</Whole>, <Whole>check-in steps</Whole>, <span className="muted">scheduled</span>]} /></p>
      </div>
    </div>
  </section>
}
