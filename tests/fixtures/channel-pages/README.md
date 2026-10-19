# Local channel page recordings

Synthetic, redacted HTML replay at the channel network edge. These fixtures record the documented host concepts (host sign-in, dated availability, block/reopen, two-factor code and CAPTCHA) with a fictitious Lake Loft and no real credentials. They are **not captures of signed-in Airbnb, Vrbo or Booking.com accounts** and make no claim about their exact current DOM. Official per-channel workflow sources and the required live-listing proof are in `docs/channel-agent.md`.

Playwright requests the actual channel origin; the test-only route serves these saved local pages. Cabin, its auth, D1, job transport, encrypted storage, browser policy, screenshots, action log and inventory hook run unmodified. A deterministic test driver reads the recorded controls instead of spending at the model edge. Only these external edges are faked.

`reads.html` is also synthetic: a source-table edge for reservation lifecycle, guest messages and settled payout transactions, with changed/unsupported/upcoming variants. Table headers are exposed at the model edge; actual cells stay in the browser. The test driver chooses header mappings only and cannot manufacture cell values. These saved pages do not establish any channel's real host layout or capture provenance.
