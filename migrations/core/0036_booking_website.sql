CREATE TABLE cb_booking_site (id TEXT PRIMARY KEY CHECK(id='site'), data TEXT NOT NULL);
CREATE TABLE cb_booking_views (day TEXT NOT NULL, path TEXT NOT NULL, views INTEGER NOT NULL, PRIMARY KEY(day,path));
