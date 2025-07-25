CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  pref_set BOOLEAN NOT NULL DEFAULT FALSE,         
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT UNIQUE NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  script_verified BOOLEAN NOT NULL DEFAULT FALSE,  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  visitor_id TEXT,
  session_id TEXT,
  url TEXT,
  referrer TEXT,
  user_agent TEXT,
  device_type TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  os TEXT,
  browser TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  visitor_id TEXT,
  session_id TEXT,
  name TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sites_user_id ON sites(user_id);

CREATE INDEX idx_visits_site_id ON visits(site_id);
CREATE INDEX idx_visits_session_id ON visits(session_id);
CREATE INDEX idx_visits_visitor_id ON visits(visitor_id);
CREATE INDEX idx_visits_created_at ON visits(created_at);


CREATE INDEX idx_events_site_id ON events(site_id);
CREATE INDEX idx_events_session_id ON events(session_id);
CREATE INDEX idx_events_visitor_id ON events(visitor_id);
CREATE INDEX idx_events_created_at ON events(created_at);
