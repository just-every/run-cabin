# Rental agreements

Open **Direct bookings → Rental agreement templates and rules**. This also
handles reservations entered by staff or received from a channel; Stripe and
an external signing account are not required for agreements.

For each property, enter your reviewed US agreement, its title and US state or
territory code (`US` for nationwide terms). Choose whether new reservations
require it and whether outstanding consent blocks guest door access and
check-in instructions. Saving retains the template and rule version. Template
history is available on the same page. Existing reservations retain their
saved terms and rules; publishing a new template alone does not replace a
signed contract.

The direct-booking settings retain a template without silently requiring new channel guests to sign it. Use the template editor to enable that property-wide rule. Direct checkouts and agreements explicitly requested by staff require signing; their saved access-block rule also applies to amendments.

New guest reservations at a property requiring an agreement receive their own
document automatically. Existing reservations can use **Request rental
agreement**. A direct Stripe checkout records the exact document shown before
signing into the same history. Previous direct-booking signatures remain
retained when an older reservation is brought into this workflow.

## Signing and downloading

The reservation card exposes its private guest agreement link. Cabin also
queues an email to the reservation's guest email, when present, and the Inbox
reports its actual delivery status. Development suppresses external email.
Without mail delivery, staff can copy the private link to their guest. The link
works independently of a payment provider and independently of the arrival
page's access code.

The guest reads the complete saved document, enters the reservation's full
guest name and email, and explicitly accepts electronic records and signing.
The submitted version and digest must still match the current document. A
different reservation email is rejected when the booking has a saved email.
Cabin retains the exact document, SHA-256 digest, template and document
versions, signer name and email at signing, time, consent and signing method.
For signing through the private link, it also retains the supplied browser
user-agent string. This is evidence of consent through that private capability,
not a claim that a signing provider independently verified the person's identity.

Guests download the saved signed version from their agreement page, including
earlier signed versions after an amendment. Owner and manager downloads remain
available in document history. Cleaners and bearer agents receive neither
agreement content nor signing links. Signed-out staff downloads are refused.
Cancellation or guest identity erasure revokes the guest link; necessary signed
legal records remain available to authorized staff with the original signer
evidence intact.

## Amendments and renewed consent

Use **Amend dates or terms and request renewed agreement** on the reservation
card. Enter the reason, dates and complete reservation-specific amendment
terms. Opt in to adopting the property's latest template when needed; otherwise
the reservation retains its original template. Cabin atomically checks night
availability, saves the new document and requests a new signature. Earlier
documents and signatures are never overwritten.

Dates on a channel reservation are changed on that channel first. A changed
stay arriving through sync, an ordinary **Move stay**, a changed guest name or
changed local check-in/out terms also requests renewed agreement before access
is released. Reservation-specific terms carry forward into these automatic
amendments. Template edits alone leave existing consent valid.

A confirmed direct Stripe stay can be amended before recorded checkout. Staff
must explicitly keep the paid price and damage authorization amount unchanged;
the document says this. This agreement operation does not charge a supplement
or refund money. Its original paid quote remains retained, while the stay and
deposit schedule move to the amended dates.

When the saved reservation rule blocks access, unresolved consent prevents a
guest code from being issued. An amendment revokes an existing guest code;
connected-lock removal follows Cabin's existing lock transport. Previously
sent instructions cannot be recalled, so staff must remove any earlier code
from a manually managed keypad. The arrival page withholds the code and points
to signing, facts used for guest replies omit it, and due check-in messages
remain unsent. Queued access-bearing replies are withheld; stale pending
instructions are withdrawn or returned for review. Once the current version is
signed, dispatch issues fresh access and current instructions can be sent.

The agreement setting can instead track outstanding consent without blocking
access. Each reservation retains the rule under which its agreement was
requested. Signing an obsolete document cannot satisfy the current requirement,
and repeated signing of the same document does not create another signature.

## Acceptance evidence

`tests/direct.test.mjs` exercises the actual command and HTTP routes: versioned
property terms, a required agreement on a real staff-entered reservation,
private-link signing, saved downloads, date/term amendments, preserved original
signatures, renewed signing, revoked and freshly issued codes, delayed check-in
instructions, staff authorization and guest-link revocation after erasure. Its
agreement-only flow refuses every outside-provider call. The existing direct
checkout flow additionally checks that Stripe-booked signatures join this
history and can be renewed; Stripe is faked only at the paid network edge.

The hosted proof also exercised the template editor and guest signing at 1440 and 390, read authentic initial and amendment email in the owner QA mailbox (SPF/DKIM/DMARC passing), downloaded both signed versions and opened arrival details after renewed consent. No payment or signing-provider account was needed for that flow.
