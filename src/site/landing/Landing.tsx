import { SiteHeader } from '../shell/SiteHeader'
import { Hero } from './Hero'
import { Closing } from './sections/Closing'
import { Details } from './sections/Details'
import { Channels, GuestInbox } from './sections/Distribution'
import { Interlude } from './sections/Interlude'
import { MoveIn, OwnerStatements } from './sections/Money'
import { StayRecovery, Turnovers } from './sections/Operations'
import { Ownership } from './sections/Ownership'
import { DirectBookings, Pricing } from './sections/Selling'
import '../styles/site.css'
import '../styles/landing.css'
import '../styles/cards.css'

/**
 * run-cabin.com's homepage, built from the design desk's approved page (16 Oct 2026) in its order: hero; channels and the
 * guest inbox; direct bookings and pricing; the interlude; turnovers and stay recovery; owner statements and moving in;
 * ownership; the quiet details; the closing with the footer. Painted art appears only in the hero, the interlude and
 * the closing; every other drawing is HTML and CSS. One Saturday (Oct 17, 2026) runs through the sample data.
 */
export function Landing() {
  return <>
    <SiteHeader overArt />
    <main id="main">
      <Hero />
      <Channels /><GuestInbox />
      <DirectBookings /><Pricing />
      <Interlude />
      <Turnovers /><StayRecovery />
      <OwnerStatements /><MoveIn />
      <Ownership />
      <Details />
      <Closing />
    </main>
  </>
}
