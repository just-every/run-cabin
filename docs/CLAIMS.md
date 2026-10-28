<!-- Generated from CONTRACT.md by contract-docs. Edit CONTRACT.md, then regenerate. -->

# Cabin homepage claims

A claim is done when every clause behind it is done, missing when every one is missing, and partial otherwise.

| # | Claim | Clauses | Status |
| --- | --- | --- | --- |
| 1 | "syncs Airbnb, Vrbo and Booking.com" | `SYNC-002` partial; `SYNC-003` partial; `SYNC-004` partial; `SYNC-009` partial | partial |
| 2 | "answers your guests" | `MESSAGE-001` partial; `MESSAGE-004` partial | partial |
| 3 | "sends the cleaner" | `OPS-001` partial | partial |
| 4 | "and the door code" | `OPS-005` partial | partial |
| 5 | "turns every payout into an owner statement" | `FIN-002` partial; `FIN-004` partial | partial |
| 6 | "100% free, open source alternative to Guesty, Hostaway and OwnerRez" | `OPEN-001` partial; `BOUNDARY-001` missing; `MIGRATE-002` partial; `MIGRATE-003` partial; `MIGRATE-004` partial | partial |
| 7 | Ready ✓ · Pine Ridge Cabin; Checked out 10:00 am · Sandy Shores | `OPS-008` partial; `OPS-003` partial; `RES-002` partial | partial |
| 8 | Guest arriving 4 pm · Airbnb · Lake Loft | `OPS-008` partial; `RES-002` partial; `GUEST-001` done | partial |
| 9 | Door code 4417 active | `OPS-005` partial; `OPS-008` partial | partial |
| 10 | Cleaning · Luis · Desert Casita | `OPS-008` partial; `AUTH-002` partial | partial |
| 11 | Vrbo request declined · overlaps Airbnb | `SYNC-008` partial; `SYNC-006` partial; `SYNC-003` partial | partial |
| 12 | "Booked once. Closed everywhere." / "Seconds later those nights close on Vrbo, Booking.com and your own site" | `SYNC-006` partial; `SYNC-002` partial; `SYNC-003` partial; `SYNC-004` partial; `SYNC-011` partial | partial |
| 13 | Lake Loft calendar: channel rows, stay bar and Closed bars, end-exclusive checkout / Lake Loft calendar: one row per channel (Airbnb, Vrbo, Booking.com, Direct), the stay bar and Closed bars from check-in afternoon to checkout morning | `RES-001` partial; `SYNC-001` partial; `SYNC-006` partial | partial |
| 14 | "Rates from PriceLabs" with each night's rate | `PRICE-001` missing | missing |
| 15 | Sync log: per-channel results, a rate-limited push and its retry / Sync log: each channel's result, Booking.com's "push failed · 429 rate limited" and its retry, "All channels in sync · 34 s" | `SYNC-007` partial; `SYNC-002` partial; `SYNC-003` partial; `SYNC-004` partial; `SYNC-011` partial | partial |
| 16 | "Airbnb · reservation HMQ4K2Z9 received" | `SYNC-002` partial; `RES-002` partial; `SYNC-011` partial | partial |
| 17 | "Airbnb, Vrbo, Booking.com, text and email arrive in one thread per guest" | `MESSAGE-001` partial; `GUEST-001` done; `SYNC-011` partial | partial |
| 18 | "Scheduled messages go out on time" (directions and Wi-Fi sent; check-in steps scheduled) / "Scheduled messages go out on time"; "Wed 10:00 am · Directions and Wi-Fi · sent automatically"; "Sat 12:00 pm · check-in steps · scheduled" | `MESSAGE-003` partial | partial |
| 19 | "and Cabin drafts the rest" / Draft with Send and Edit / "and Cabin drafts the rest" / a reply labelled Draft with Send and Edit | `MESSAGE-004` partial | partial |
| 20 | "Door code start moved to 2:00 pm" | `OPS-005` partial; `MESSAGE-004` partial | partial |
| 21 | "Every checkout opens a turnover: the cleaner, the checklist, the photos and a fresh door code for the next guest" | `OPS-001` partial; `OPS-005` partial | partial |
| 22 | The cleaner's phone: job window, ready time, ticked checklist, "Photos 12 / 12" / Luis's phone: today's job with its window, "Ready 2:41 pm", the ticked checklist, "Photos 12 / 12" and his next job | `OPS-002` done; `EVIDENCE-001` partial | partial |
| 23 | "Desert Casita · front door": the cleaner's and next guest's codes / "Desert Casita · front door": Luis's code for his window, the next guest's code for theirs | `OPS-005` partial | partial |
| 24 | "Patio light out · task added for Dale" | `OPS-004` partial; `OPS-002` done | partial |
| 25 | "Cabin finds a new cleaner" / "Asked 3 nearby cleaners · Ana Diaz accepted" / "Cabin finds a new cleaner"; "Asked 3 nearby cleaners · Ana Diaz accepted, arrives 1:30 pm" | `AGENT-001` partial; `OPS-001` partial | partial |
| 26 | "resets the door codes" / "resets the door codes"; "Code 7102 for Ana · 1:30 – 4:00 pm"; "code 4417 live at 4:00 pm" | `AGENT-001` partial; `OPS-005` partial | partial |
| 27 | "settles it with the guest before she arrives" / "Offered 10% off her next stay" / "settles it with the guest before she arrives": "Megan's 2 pm early check-in no longer fits", "Offered 10% off her next stay", her reply | `AGENT-001` partial; `AGENT-003` partial; `AGENT-006` partial; `WEB-005` partial | partial |
| 28 | "Checklist 18 / 18 · photos 14 / 14" / "Lake Loft ready" / "Resolved 3:32 pm" / "Checklist 18 / 18 · photos 14 / 14"; "Lake Loft ready"; "Resolved 3:32 pm" | `AGENT-001` partial; `EVIDENCE-001` partial; `OPS-003` partial | partial |
| 29 | "Cost to owner $0.00" | `AGENT-001` partial; `FIN-001` partial | partial |
| 30 | "All five homes ready for Saturday" | `OPS-008` partial; `OPS-003` partial | partial |
| 31 | "Airbnb's payout matches Megan's stay to the cent" / "Airbnb's payout matches Megan's stay to the cent": "Airbnb payout · Oct 25 · $929.26 … Matched" | `FIN-002` partial | partial |
| 32 | The owner's October statement and its arithmetic / "and lands on the owner's October statement": the statement with each stay, gross rent, channel and card fees, cleaning, management 20%, the hot tub filter and the owner payout | `FIN-003` done; `FIN-004` partial | partial |
| 33 | "QuickBooks · synced Oct 31" | `FIN-007` partial | partial |
| 34 | "Owner portal · Karen viewed Nov 1" | `FIN-005` done; `AUDIT-001` partial | partial |
| 35 | "Lodging tax 9% · $172.44 · filed Nov 1" / "Lodging tax 9% · $172.44 · filed Nov 1" (the host's share, with Airbnb and Vrbo remitting their own) | `FIN-008` partial | partial |
| 36 | "Your own booking site takes the payment" / "Pay … Powered by Stripe" / "Your own booking site takes the payment" / "Pay $1,454.50 · Powered by Stripe" | `WEB-001` partial; `PAY-001` partial | partial |
| 37 | "the rental agreement" / "the rental agreement" / "Rental agreement signed" | `WEB-003` done; `WEB-001` partial | partial |
| 38 | "the ID check" / "the ID check" / "ID verified" | `WEB-004` partial; `WEB-001` partial | partial |
| 39 | "the damage deposit" / "held, not charged" / "the damage deposit" / "Damage deposit $500 · held, not charged" | `PAY-003` partial; `WEB-001` partial | partial |
| 40 | Checkout lines: nights, cleaning fee, lodging tax 9%, total / Checkout lines: nights, cleaning fee, "Lodging tax 9%", total | `RES-004` partial; `FIN-008` partial | partial |
| 41 | "Returning guest 10%" / "Welcome back, Megan" | `GUEST-001` done; `WEB-005` partial | partial |
| 42 | "Jul 10–14 · closed on Airbnb, Vrbo, Booking.com" | `SYNC-006` partial; `SYNC-002` partial; `SYNC-003` partial; `SYNC-004` partial; `SYNC-011` partial | partial |
| 43 | "No channel fee" | `WEB-001` partial; `PAY-001` partial | partial |
| 44 | "Move from an existing reservation system" / "Move from Guesty, Hostaway or OwnerRez"; "Importing from Hostaway … 100%" | `MIGRATE-002` partial; `MIGRATE-003` partial; `MIGRATE-004` partial | partial |
| 45 | "with listings, reservations, guests and owner balances" / "with listings, reservations, guests and owner balances": 5 listings, 61 upcoming reservations, 1,284 guests, "$18,406.22 · matched" | `MIGRATE-001` partial; `MIGRATE-002` partial; `MIGRATE-003` partial; `MIGRATE-004` partial; `MIGRATE-007` partial | partial |
| 46 | "Your channel listings and reviews stay where they are" / listings reconnected / "Your channel listings and reviews stay where they are": Airbnb 5 and Vrbo 4 listings reconnected, one Booking.com listing awaiting approval | `MIGRATE-007` partial; `SYNC-002` partial; `SYNC-003` partial; `SYNC-004` partial; `SYNC-011` partial | partial |
| 47 | `rer install` / `rer setup` / Terminal chip: `curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-cabin`, then the comment `# Already have Node 22 or later? npx -y @runeditrun/rer dev just-every/run-cabin` | `RUNTIME-001` partial; `HTTP-001` done | partial |
| 48 | "Not yet: Expedia, hotel room types and built-in dynamic pricing." | `BOUNDARY-001` missing | missing |
| 49 | "Open source vacation rental software for hosts and managers" / "Free and open source, MIT licensed" | `OPEN-001` partial | partial |
| 50 | "Try the demo" | `SITE-002` partial | partial |

Claims: 50; 0 done, 48 partial, 2 missing.
