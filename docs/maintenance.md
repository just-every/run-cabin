# Maintenance work orders

Cleaners report broken things from their turnover. Assigned vendors and inspectors can report another problem from a work order, and guests can attach photographs from their private stay page. Reports become durable tasks assigned to the home's maintenance person and emailed with the address and source. Guests cannot choose a different home, approve work or read staff records.

Managers set the asset, priority, due date, checklist, named inspector and recurrence. The installation owner sets the manager's spend ceiling. An optional unavailable date range takes the same inventory as guest stays, refuses occupied nights and appears in the home's iCal exports. It can reopen only through the work order's completion requirements.

The assigned vendor accepts or declines the work, submits a photographed quote, and waits for exact human approval. Amounts above the ceiling require the owner's explicit override. A photographed invoice cannot exceed the approved quote. Approval posts one source-linked cost against the saved rental owner and a vendor payable in the configured trust ledger; it does not send a payment or claim the invoice has been paid. These payables remain distinct from the monthly statement's manually recorded paid expenses.

Completion needs every checklist item, a description and photos. Configured inspection keeps the work and inventory open until the named inspector accepts; rejection returns it for correction and retains the inspection history. Paid work also waits for invoice approval and owner allocation. Closure releases only its own inventory block and creates exactly one next recurring visit with fresh acceptance, quote, invoice and completion requirements. A future preventive visit does not inherit the repair's closure of rental nights.

Existing open reports enter the same acceptance and evidence workflow. Accepted scope and vendor cannot silently change; staff open a corrective order for different work. Inspector and vendor sessions expose only relevant tasks and photos, never the owner's agreement or expense records.

`tests/work-orders.test.mjs` exercises the guest report, scoped staff, stale approvals, spend ceiling, invoice limits, owner ledger allocation, inspection correction, inventory reopening and one recurrence. `tests/turnovers.test.mjs` and `tests/readiness.test.mjs` exercise cleaner reports and arrival readiness with required acceptance and completion evidence.

The hosted `sd-cabin-c9` journey exercised photographed guest reporting, an authentic vendor invitation and assignment mail (SPF/DKIM/DMARC pass), quote/invoice approval, completed work, named inspection, reopening and one next recurrence at 1440 and 390 pixels. The environment was removed after the check.
