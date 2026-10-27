# Held Seam sandbox boundary — 27 October 2026

The held key and the explicitly injected `SEAM_SANDBOX_DEVICE_ID` authorize the existing virtual FRONT DOOR, an online Schlage Encode. The workspace is checked as sandbox before any change. No new provider connection or physical lock is used. The bounded journeys use Cabin’s actual reservation commands, scheduled worker, native sessions, database and provider adapter. Keys remain in the injected process environment; receipts never print PINs, stay capabilities or credentials.

## Observed provider outcomes

`tests/locks-sandbox.mjs` independently compares the provider’s device, PIN and exact schedule with the saved reservation window. It requires confirmed programming with no pending mutation, then checks restart, cancellation and the actual provider resource after checkout. Cleanup is checked separately and includes every page of access codes, matching only this run’s resource IDs and exact generated names.

On source `f7176289450cb1fc460196d90c7e92ecbbcc3236`, resource `f16e1eee-0c53-4a74-8609-c21282968c8a` was independently confirmed as set, its extended window was confirmed with no pending mutations, restart preserved its identity, and public cancellation removed it. That run’s separate expiry probe showed that relying on the provider’s time-bound metadata did not remove the resource after checkout. Both owned resources were removed by cleanup.

The subsequent source `f10077b14f742e3268b13db7410f8b2bec98c193` adds explicit checkout revocation through the existing scheduled normalization. Resource `51dafeaa-4cf3-4b7d-a061-29eb78890189` was confirmed as set. Its extension retained `updating_time_frame` past the bounded observation window, so Cabin kept it pending; cancellation nevertheless removed that exact identified resource without repeating the update. The separate expiry resource `c691a83e-a4e0-446e-8622-09ba72cacb14` was confirmed as set and was absent after Cabin processed its exact `2026-10-27T11:47:00.000Z` deadline. Local state was revoked and removed. Cleanup reported two owned resources and zero remaining. The overall journey correctly failed its still-unconfirmed extension assertion; this is point-specific provider evidence, not a claim that the whole journey passed. Later changes remove a redundant expiry check and use the current DELETE removal route. The deadline guards and the journey’s expiry assertions are unchanged. This remains the explicitly identified source’s provider receipt, rather than a whole-clause DONE claim.

`tests/recovery-authority.test.mjs` — “ordinary lock jobs reconcile interruptions before and after create, update and removal without repeating provider writes” — exercises the exact checkout boundary with a pinned clock, keeps the cleaner’s distinct window, removes that access at its own deadline, and proves repeated scheduled runs do not reissue either code. The same test proves cancellation during a pending provider update and no duplicate provider writes across restart.

## Release and visibility

`tests/readiness-browser.test.mjs` — “connected-lock readback governs board status and guest disclosure on desktop and phone” — invokes `tests/lock-status-browser.mjs` in ordinary push Verify. At 1440 and 390 it checks pending, active and failed board and turnover states, unpaid and paid guest disclosure, approved access-message gating, and cleaner secrecy. Manual keypad setup is labeled separately from confirmed connected access. `tests/guest-portal.test.mjs` checks HTML, JSON and guide downloads before and after recorded payment. Required identity and agreement rules remain enforced.

The former sandbox Request forwarder failed before HTTP because Miniflare’s Request object is not Node’s native Request. A read-only probe reproduced that TypeError and independently reached Seam by URL. Both live journeys now use the native Worker provider transport, preserving actual provider refusals and reconciliation rather than substituting success.

## Remaining account and device boundaries

The 23 October provider catalogue exposed Schlage, Yale, August, Kwikset, Igloohome, Nuki and Salto KS, with no RemoteLock provider. The held single-device journey does not prove all eight named families. OPS-005 still requires an authorized RemoteLock-capable route, complete family coverage, assigned battery and offline action, a manager-approved backup entry plan, and complete release-rule coverage. A pending provider extension stays pending; no physical-door success is claimed.

[Seam’s Schlage catalogue](https://www.seam.co/manufacturers/schlage) was recorded on 23 October as listing Schlage Sense unavailable and local-only. The held Encode does not replace OPS-007’s named Sense-through-hub acceptance. Its connectivity modes, Igloohome offline PIN, non-revocability warning, approved cancellation fallback and hub-offline case remain unimplemented and unproved. Completion needs an authorized Sense-capable provider, device and hub path.

OPS-008 retains its actual OTA decision and full five-home acceptance obligations. Native source links, Cabin request reasons and network-edge lock fixtures do not establish a channel acknowledgment. Guest-portal and lock-event checkout sources also remain open. The 27 October held-key release permits this bounded live work; it does not remove these separate provider and account dependencies.

## Recovery boundary

The successor AGENT-001 journey also uses the held device. On source `c245c96eef31a6a0f6db0b500fe403f4d0d14bcf`, initial and replacement programming were confirmed, but previous-code removal stayed pending through the bounded observation. Cleanup removed all five owned resources. On source `fd3fa2d55eae471d1da78622d4923985dbcaa12c`, the native transport and real runtime clock were used; the initial future code still reported unset, not scheduled on the device, with a creating mutation and no provider errors. Cabin retained pending state. Cleanup removed all three owned resources. Complete native recovery closure with the replacement and previous access reconciled remains unproved. These observations do not establish a missing key or authorize a blind repeat.

Live journeys use the real clock so durable leases can advance while the provider works. Deterministic integration journeys explicitly pin and advance their clock through restart. No manual metadata change, substituted device state or cleanup operation is counted as successful native recovery.
