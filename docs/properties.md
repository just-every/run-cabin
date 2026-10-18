# Property register and management agreements

In Properties & people, add one record for each independently rentable home or unit. Units in the same building share a building name and retain separate calendars. Property details hold the address, US time zone, check-in/out times, occupancy limit, amenities, house rules, emergency contact, private photos and channel listing identifiers. Operations settings keep their own revision; saving property content preserves the cleaning team and checklist.

Management agreements are immutable, effective-dated owner and commission terms. Each newly recorded reservation selects the latest agreement effective on its arrival date and keeps that exact version through later owner, commission or date changes. Existing records acquire their original terms before an amendment is applied. New direct quotes carry the selected agreement reference, and checkout rejects a supplied reference that has changed. Occupancy limits apply to quotes and checkout.

Matched-payout statements compute commission per reservation from its saved terms and show the agreement references in source lines and CSV. A month covering different owners requires the operator to select an owner email and prepares separate statements; trust journals use the reservation's saved owner. Broader fee models, shared expenses, reserves and multiple-owner splits remain FIN-003.

`tests/property-register.test.mjs` exercises two properties in different US time zones, private photo access, revision refusal, an agreement amendment, unchanged original stay terms, new quotes and exact commission allocation. Product forms, uploads, amendments, reservation records and statement drafts were exercised at 1440 and 390 pixels. No external provider is needed for the register.
