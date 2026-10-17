import { Actions } from '../shell/Actions'
import { HeroTags } from './HeroTags'
import { BLEED, Painting } from './parts'

/** The painted coast of one host's homes, the promise and the action, with Saturday's live tags on the homes. */
export function Hero() {
  return <section className="hero" aria-labelledby="hero-title">
    <Painting className="hero-art" name="hero" widths={BLEED} sizes="100vw" eager phone={{ name: 'hero-phone', widths: [640, 1016], media: '(max-width: 760px)' }} />
    <div className="hero-copy">
      <h1 id="hero-title">Ready before they&nbsp;arrive.</h1>
      <p className="hero-sub">Cabin syncs Airbnb, Vrbo and Booking.com, answers your guests, sends the cleaner and the door code, and turns every payout into an owner statement.</p>
      <p className="hero-alt">100% free, open source alternative to <strong>Guesty, Hostaway</strong> and&nbsp;<strong>OwnerRez</strong></p>
      <Actions />
    </div>
    <HeroTags />
  </section>
}
