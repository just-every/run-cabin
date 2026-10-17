-- Keys entered in Direct bookings are sealed with this installation's secret.
CREATE TABLE cb_direct_provider(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL CHECK(json_valid(data)));
