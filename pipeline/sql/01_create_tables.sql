-- ============================================================
-- Bronze Layer: raw_incidents
-- Landing table for CSV uploads. All columns as TEXT initially.
-- Mirrors actual ACLED CSV columns exactly.
-- ============================================================
CREATE TABLE IF NOT EXISTS raw_incidents (
  id BIGSERIAL PRIMARY KEY,
  event_id_cnty TEXT,
  event_date TEXT,
  year TEXT,
  time_precision TEXT,
  disorder_type TEXT,
  event_type TEXT,
  sub_event_type TEXT,
  actor1 TEXT,
  assoc_actor_1 TEXT,
  inter1 TEXT,
  actor2 TEXT,
  assoc_actor_2 TEXT,
  inter2 TEXT,
  interaction TEXT,
  civilian_targeting TEXT,
  iso TEXT,
  region TEXT,
  country TEXT,
  admin1 TEXT,
  admin2 TEXT,
  admin3 TEXT,
  location TEXT,
  latitude TEXT,
  longitude TEXT,
  geo_precision TEXT,
  source TEXT,
  source_scale TEXT,
  notes TEXT,
  fatalities TEXT,
  tags TEXT,
  timestamp TEXT,
  upload_batch TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_upload_batch ON raw_incidents (upload_batch);
CREATE INDEX IF NOT EXISTS idx_raw_event_id_cnty ON raw_incidents (event_id_cnty);

-- ============================================================
-- Silver Layer: clean_incidents
-- After Python pipeline processes raw data.
-- ============================================================
CREATE TABLE IF NOT EXISTS clean_incidents (
  event_id_cnty TEXT PRIMARY KEY,
  event_date DATE,
  year INT,
  time_precision INT,
  event_type TEXT,
  sub_event_type TEXT,
  state_clean TEXT,
  geopolitical_zone TEXT,
  lga_clean TEXT,
  actor1 TEXT,
  actor2 TEXT,
  actor1_group TEXT,
  actor2_group TEXT,
  location TEXT,
  latitude FLOAT,
  longitude FLOAT,
  fatalities INT,
  notes TEXT,
  target_category TEXT,
  is_kidnap BOOLEAN DEFAULT FALSE,
  kidnapped_count INT DEFAULT 0,
  fatalities_combatants INT DEFAULT 0,
  fatalities_security_forces INT DEFAULT 0,
  fatalities_civilians INT DEFAULT 0,
  presidential_admin TEXT,
  is_duplicate BOOLEAN DEFAULT FALSE,
  is_reference BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clean_state ON clean_incidents (state_clean);
CREATE INDEX IF NOT EXISTS idx_clean_zone ON clean_incidents (geopolitical_zone);
CREATE INDEX IF NOT EXISTS idx_clean_event_date ON clean_incidents (event_date);
CREATE INDEX IF NOT EXISTS idx_clean_event_type ON clean_incidents (event_type);
CREATE INDEX IF NOT EXISTS idx_clean_actor_group ON clean_incidents (actor1_group);
CREATE INDEX IF NOT EXISTS idx_clean_duplicate ON clean_incidents (is_duplicate);
