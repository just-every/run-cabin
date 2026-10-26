# Linked physical inventory

In Properties & people, open Property details and select the physical rooms a listing consumes. Leave the selection empty for an independent unit. For example, Room A and Room B each use their own unit; the whole-home listing selects both rooms. A room sale holds that room and the whole home while the other room remains available. A whole-home sale holds both rooms.

An interchangeable listing must have an explicit physical-room assignment before booking. Combined listings cannot be selected as physical rooms. A physical room referenced by another listing cannot be reassigned until that reference is removed. Future confirmed stays, blocks and quote holds prevent changing their listing's assignment. Assignment changes use the existing revision and transaction fences and invalidate saved staff quote and calendar-review baselines.

Native reservations, checkout, staff quote holds, owner blocks, maintenance, agreement amendments and extensions use the same physical-capacity intersection. Checkout dates remain exclusive. Existing independent listings retain their own inventory without configuration. Saved reservation terms, owner attribution, financial postings and guest tasks remain on the source listing.

Source calendar snapshots preserve conflicting stays for reconciliation. Browser source reads retain their source identity and conflicting authoritative stays rather than silently dropping them. Calendar rows project linked closures without creating reservations, income, access codes or turnovers on the closed listings. Export feeds include related-listing holds even when the channel matches the source channel; only the source listing's own channel echo is omitted.

Browser closure jobs retain the source booking reference and the destination listing and channel. Existing pending, refused and uncertain outcomes remain visible. Every reopening door rechecks surviving physical holds. A cancellation releases only its source hold and does not assert that any channel accepted reopening.

The native journeys use synthetic channel and payment network edges. They are not real OTA sale, cancellation or closure receipts. RES-005 remains partial until an authorized external room sale and cancellation, whole-home sale, accepted closures for both room listings and reconciled acknowledgments for every connected channel are proved through the existing consented channel route.
