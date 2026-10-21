# Guest stay portal

Each confirmed stay has its own private link at `/stay/<token>`, including stays whose required agreement or identity review still withholds a door code. Staff find the link in reservation access and the turnover/portal controls. The link expires seven days after check-out. Cancellation, erasure or replacement ends it immediately.

## Verify the reservation email

A fresh browser sees only the home's public name, a masked hint of the reservation's saved email and **Send code**. It receives no reservation dates, guest name, address, tasks, guide, offers, issue records or access secrets in HTML or JSON. A stay without a saved email shows **Ask your host to add your email**. Staff add or change the contact through the reservation or Inbox's existing guest-details form; the edit enters history.

Send code uses the installation's existing mail provider and the reservation's own saved email, trimmed and lowercased. Merging guest profiles never changes that recipient. The one-use six-digit code belongs to the browser that requested it, expires after ten minutes and is stored only as a keyed hash. Five wrong entries lock the reservation's challenges for fifteen minutes; sends are limited to three per fifteen minutes across browsers. The result says **accepted by the mail provider** or **failed**. Provider acceptance does not claim delivery. Local/demo mail remains suppressed; tests capture mail only at the network edge.

Correct entry creates a reservation-scoped guest session in a separate host-only, HttpOnly, Secure, SameSite=Lax cookie. Staff, rental-owner and cleaner sessions do not authorize a guest portal, and the guest cookie grants none of those roles. Another browser must verify again. The session stops at link expiry, link replacement/revocation, cancellation, saved-email change, guest/reservation erasure or **End guest sessions**. The guest can also end the current session from their page.

Sending, verification, lockout and session-ending events appear in Activity with a masked recipient and no code, full address or cookie. Challenge/session/rate-limit state is excluded from archives and deleted by erasure. A restore retires old portal links and requires fresh links and email verification after the host reviews the restored reservation.

## The verified stay page

- **Reservation:** the guest's own name, status and dates in the home's time.
- **Before you arrive:** the current rental-agreement signature, independent identity check and payment balance. A task reads Done only from saved evidence. Portal signing, signed downloads and identity-review actions require the guest session. Existing separately mailed agreement and identity links retain their own authorization.
- **Door code:** the actual issued code and its working window, labelled scheduled, active or expired. Required agreement and Stripe Identity/manual review decisions still gate codes and instructions independently of email verification. Email proof never approves an identity review or creates a physical access code.
- **Arrival and your stay:** versioned arrival instructions, house rules and guidebook, with private original-file downloads. These remain withheld until access is released and disappear after check-out.
- **Offers and extras:** the existing eligible, signed and processor-backed supplements for this reservation, opened through session-protected portal routes. Their terms, inventory and payment controls are unchanged.
- **Issues and maintenance:** the report forms and this reservation's existing follow-up records. Reporting works before a physical code is issued. Reports still go through the host's approval, maintenance and recovery flows.

The JSON door is `/stay/<token>/api`. Files, task routes, JSON and every POST use the same current reservation/session boundary; a guessed booking ID or a different reservation's session grants no access.

Channel-paid tasks use the matched channel transaction's recorded **gross reservation receipt**, including negative refund/correction rows, rather than the net host payout. A known reservation charge can therefore reconcile to Paid. Where the original charge is unknown, the page states the recorded amount and asks the host to confirm the remaining balance; it does not invent a paid balance. Existing direct payments, manual receipts and paid supplements retain their own saved evidence.

## Manage the guide and sessions

Managers use **Turnovers → Guest portal by home** to save arrival instructions and the guidebook (`portal.guide`), replace links (`portal.link.rotate`) or end sessions without replacing the link (`portal.sessions.end`). Changed text raises the guide version, identical text does not, and stale forms are refused. Public booking pages, cleaners and agent credentials receive no guide content or live guest-portal capability.

After saving a guide, managers can add up to five PDF, text, PNG or JPEG files, each at most 1 MB (`portal.guide.file.add`). Cabin stores the original bytes, MIME type, file name and SHA-256. Adding or removing a file raises the guide version; stale file forms are refused. Guest downloads are attachments, require a verified session and released access, and check the saved digest. Removed files return not found. Guide files accompany the home's portable history; property erasure removes their bytes. Guest erasure removes the guest's authority to every file without deleting a guide shared by unrelated stays.
