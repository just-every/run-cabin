ALTER TABLE cb_owner_policies ADD COLUMN cleaning_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cb_owner_stay_requests ADD COLUMN purpose TEXT NOT NULL DEFAULT 'owner';
