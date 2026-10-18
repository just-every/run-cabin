# Guest records and returning rates

For an upgraded installation, use **Create guest profiles from existing reservations** once if Guests shows unindexed stays. New reservations create their identity origin automatically.

Open **Guests** to review each reservation’s identity, facts, consent and service history. Each reservation starts with an independent identity origin, even when its guest name, email or phone matches another reservation. Contact matches suggest a review; they never merge guests. Staff can review both histories and merge them with an evidence note. Undo separates the original identities and their attached reservations, messages, facts and consent. Sources and original channel references stay attached to their reservation origin.

Email and phone contacts are observations until a manager records how they checked ownership. Verification is a staff attestation with its source and time; Cabin does not infer it from typing an address or receiving email. Unmatched messages can be linked to a reservation only after staff review. An ambiguous contact shared by separate guests stays unmatched.

Preferences and offer consent are independent, explicit opt-ins or opt-outs, scoped to a home. Record the guest’s decision and its source. A home must separately permit preference reuse or repeat offers. An explicit opt-out on any merged identity prevents reuse until staff record new consent on that identity. Permitted preferences appear with the guest’s reservation history for that home. Service facts retain their source; sensitive notes can be written and read only by the owner. Cleaners and agent credentials do not receive guest-profile records.

## Private returning-guest offer

Publish the home’s direct booking page, permit repeat offers under the home’s guest policy, record explicit offers opt-in, and verify the email on this guest’s completed stay at that home. Review those records, select that completed stay and choose an expiry within 90 days. **Create private 10% returning-guest offer** shows its link once. Share it with that guest through the guest inbox or your existing conversation. Cabin does not automatically send it.

The link is an unguessable, one-use capability; only its hash is stored. It displays “Welcome back” and a 10% rent saving before tax. Cleaning, extra-guest fees and damage authorization are unaffected. Tax uses discounted rent. The guest must use the saved name and verified email and explicitly agree to link the new booking to the reviewed guest record. No public email lookup reveals whether someone has stayed before.

Checkout rechecks expiry, home terms, home permission, guest consent, the exact completed reservation revision and reviewed identity-group membership. It redeems the offer in the same guarded transaction that holds the nights. Concurrent or repeated checkout cannot redeem twice. Failed payment retains the original hold and discounted quote for the existing payment retry; it does not grant a second redemption. Once a checkout expires the host may review and issue a new offer. Updated terms, consent or guest merges require a new offer. Revoke an unused offer from Guests.

The saved quote, signed agreement, Stripe charge and payment receipt use the discounted total. Owner accounting continues from actual payment/payout amounts. Other WEB-005 promotions, upsells, gap-night extensions and cleaner-capacity checks remain separate work.

## Command inputs

All guest commands require an owner or manager; sensitive-note commands require the owner. Commands use the existing `/api/cabin/command` envelope `{name,input}` and revision guards. Profile commands take `id` and `revision` of the specific identity origin being edited.

- `guest.sync`: create independent origins for an upgraded installation’s existing reservations.
- `guest.policy`: `propertyId`, optional existing policy `revision`, `allowPreferences` and `allowRepeatOffers` (`"yes"` enables, omission disables).
- `guest.identity.verify`: profile `id`, `revision`, `identityId`, `source`, `confirm:"yes"`.
- `guest.fact`: profile `id`, `revision`, `propertyId`, `kind` (`preference`, `service`, `note`), `value`, `source`.
- `guest.consent`: profile `id`, `revision`, `propertyId`, `purpose` (`preferences`, `offers`), `allowed` (`yes`, `no`), `source`.
- `guest.merge`: source profile `id`, `revision`, destination root `intoId`, `intoRevision`, `reason`, `confirm:"yes"`.
- `guest.merge.undo`: merge `id`, merge `revision`, `confirm:"yes"`.
- `guest.message.link`: profile `id`, `revision`, member `bookingId`, unmatched `messageId`, `messageRevision`, `confirm:"yes"`.
- `guest.offer.issue`: root profile `id`, `revision`, `propertyId`, completed `bookingId`, `expiresAt` (ISO date/time), `confirm:"yes"`. Returns `id`, relative private `url`, `expiresAt`, `discountBps`. Save/share that one response privately; state responses contain no usable offer token.
- `guest.offer.revoke`: offer `id`, offer `revision`.

Public quote accepts optional `offerToken`; public checkout additionally requires `returningConsent:"yes"`, exact guest name, verified email and ordinary agreement/terms fields. The supplied token never chooses its own guest, discount or property.
