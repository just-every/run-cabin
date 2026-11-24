-- The five-minute Cron asks "is anything due?" by narrow indexed reads (src/cabin/cron-due.ts), so a quiet
-- tick costs the same rows however much history is stored. Each index below holds only open work, and its
-- WHERE text is the same text the query repeats: SQLite uses a partial index only when the query implies it.
-- Scheduled messages, notices, quotes, deliveries, turnovers and cases are read through the existing
-- (kind, status) index; this adds the due time behind that status for scheduled guest messages.
CREATE INDEX cb_records_status_due ON cb_records(kind,json_extract(data,'$.status'),json_extract(data,'$.dueAt'));
-- Guest issue cases that are not closed (issues/due.ts).
CREATE INDEX cb_records_open_issue ON cb_records(id) WHERE kind='recoveries' AND json_extract(data,'$.issue') IS NOT NULL AND json_extract(data,'$.status') NOT IN ('closed','undone');
-- Smart-lock codes still to push or remove (locks.ts).
CREATE INDEX cb_records_lock_open ON cb_records(id) WHERE kind='codes' AND (json_extract(data,'$.lock.state')='pending' OR (json_extract(data,'$.status')='revoked' AND json_extract(data,'$.lock.providerId') IS NOT NULL AND json_extract(data,'$.lock.state')<>'removed') OR (json_extract(data,'$.lock.job.stage') IS NOT NULL AND json_extract(data,'$.lock.job.stage')<>'complete'));
-- Collection schedules with a job to run, reconcile or chase (direct/collections.ts).
CREATE INDEX cb_records_collection_open ON cb_records(id) WHERE kind='collectionPlans' AND (instr(json(data),'"status":"scheduled"')>0 OR instr(json(data),'"status":"uncertain"')>0 OR instr(json(data),'"status":"pending"')>0 OR instr(json(data),'"deadline"')>0);
-- Direct stays with a hold, refund or deposit still open (direct/store.ts dueStays).
CREATE INDEX cb_direct_stays_open ON cb_direct_stays(id) WHERE (json_extract(data,'$.phase') IN ('held','paid') OR json_extract(data,'$.previousDeposit.id') IS NOT NULL OR instr(json(data),'"status":"requested"')>0 OR instr(json(data),'"status":"pending"')>0 OR instr(json(data),'"status":"uncertain"')>0 OR (json_extract(data,'$.phase') IN ('confirmed','cancelled') AND json_extract(data,'$.deposit.status') IN ('requires_capture','capturing','releasing')) OR (json_extract(data,'$.phase')='confirmed' AND json_extract(data,'$.quote.depositCents')>0 AND json_extract(data,'$.deposit.id') IS NULL));
-- A stay by its booking: every commit looks one up per booking (reservations/finance.ts), which scanned all stays.
CREATE INDEX cb_direct_stays_booking ON cb_direct_stays(json_extract(data,'$.bookingId'));
-- Identity cases past retention, or with an open provider session (verification/records.ts).
CREATE INDEX cb_verifications_retention ON cb_verifications(json_extract(data,'$.retainUntil')) WHERE json_extract(data,'$.status')<>'erased';
CREATE INDEX cb_verifications_provider_open ON cb_verifications(id) WHERE json_extract(data,'$.provider') IS NOT NULL AND json_extract(data,'$.status') NOT IN ('verified','approved','rejected','manual_requested');
-- Report runs still generating or sending (reports/sharing/run.ts).
CREATE INDEX cb_report_runs_active ON cb_report_runs(id) WHERE json_extract(data,'$.status') IN ('generating','sending');
-- Tax packets waiting to send (taxes/delivery.ts).
CREATE INDEX cb_tax_deliveries_pending ON cb_tax_deliveries(status);
