Open **Portfolio questions** in the manager workspace (`/app/questions`). Ask, for example, “Why did this property's owner net fall?”, “Which arrivals are at risk?”, “What do the saved guest conversations say?”, or “What is our occupancy and ADR?”. The question selects a report topic; the visible property, dates, channel and accounting controls select the records. Cabin does not infer a different property or date window from a name in the question. Unsupported questions say that they cannot be grounded and propose no work.

Answers are live reads of saved Cabin records. They show the installation revision, generation cutoff, filters, report links, source identifiers and uncertainty. They do not call a language-model or provider service, send the prompt elsewhere, or store question and answer history. Guest text is quoted evidence and never executable instructions. Access codes, capability links and credential-shaped text are redacted from conversation quotations. Unlinked messages are excluded rather than assigned to a guest by name.

## Reports and uncertainty

Financial questions compare the selected end-exclusive window with the immediately preceding window of equal calendar-day length: October 1–November 1 compares with August 31–October 1. They use REPORT-001's accounting definitions and show the change in gross, refunds, channel and processor fees, commissions, owner expenses and collected tax, with every contributing journal's source and revision. The components reconcile exactly to the change in recorded net contribution. A period with no journals remains explicitly incomplete; a payout file or processor receipt never becomes proof of bank settlement. Cash and accrual retain their existing report meanings.

Arrival questions use the report's saved readiness records and associated turnover, task, reservation and message-deadline sources. Unknown readiness counts as risk. Conversation questions quote the saved messages linked to the filtered reservation cohort, retaining direction, time, channel and actual delivery state. Reservation questions reuse the report's occupancy denominator, ADR, RevPAR and missing-price treatment. They do not infer missing provider records, guest receipt or physical readiness.

The answer and both comparison reports must have one saved installation revision; concurrent changes refuse the read. Calendar reads are identified separately from that cutoff. A pending/failed read, a missing successful read, or a successful read older than 60 minutes is explicitly stale or unavailable. Even a recent successful local record does not establish current external state. No connected freshness is labeled unavailable. Report links open live reports; their displayed revision must still match before relying on the old answer.

## Scope and follow-up

Staff need their existing report grant and the question's finance, reservation and readiness or inbox grants. Each selected home is checked before aggregation and citations. Bearer agents cannot ask or approve through these human doors. Rental owners use **Ask Cabin about your records** in their existing owner portal (`/owners/questions`), or `/app/rental-owner/questions` with a native rental-owner session. Their current ownership interests and any native home grant bound the report. Financial totals use only their owner-key journals; co-owner totals and full shared-stay payouts are withheld. Guest conversations remain a staff inbox capability. Ownership changes and offboarding invalidate the next read, including direct report URLs.

A staff answer can propose an investigation. To create it, choose one of the answer's homes, name an active signed-in team member who can read that evidence, and explicitly approve. The server recomputes the answer and binds approval to its digest, filters, current data revision and the approver's current grant. Changed records or authority require a fresh question. An exact duplicate submission is refused.

Approval creates a nonblocking internal task, with the named assignee, report references, cutoff and an attributable exact approval. Find it under **Assigned investigations**, or follow it to the existing task workflow in Maintenance. Existing assignment notices, audit, restart persistence, export and erasure rules apply. The task stores no raw question or guest-conversation copy. Approval authorizes no booking change, posting, refund, payout, guest send or physical-readiness claim. Those retain their own public doors and approvals. Rental-owner questions do not grant operational approval.

## Native doors

`POST /api/cabin/questions` accepts a question and report filters:

```json
{
  "question": "Why did owner net fall?",
  "filters": {
    "from": "2026-10-01",
    "until": "2026-11-01",
    "property": "HOME_ID",
    "basis": "accrual"
  }
}
```

The response contains `kind`, `filters`, `cutoff`, `version`, `statements`, `citations`, `warnings`, matching `reports`, a proposed investigation and its `digest`.

- `question.ask` through `POST /api/cabin/command` has the same input and read behavior. It returns the answer under `result`.
- `question.investigate` through that command door accepts the exact `question`, `filters`, `digest`, selected `propertyId`, `assigneeId` and `consent: true`. It returns the assigned task.
- Owner sessions can POST the question to `/owners/questions` (HTML form or JSON); `/owners/questions/report` opens their currently scoped report using its query filters. Native rental-owner sessions use the corresponding `/app/rental-owner/questions` paths.

All human POSTs require the installation's exact Origin. Read-only questions do not run domain settlement or external actions. A question is limited to 1,000 characters; invalid filters and unsupported access are refused. The browser retains a server-refused question in the returned form and focuses the error without saving prompts in browser recovery storage.
