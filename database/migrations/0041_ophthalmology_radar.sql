-- Additive; no upstream scoring, grouping, heat or publication tables are replaced.
CREATE TABLE ophthalmology_analyses (
  article_id text PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  input_hash text NOT NULL,
  version text NOT NULL,
  payload jsonb NOT NULL,
  receipt_id bigint REFERENCES receipts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE editorial_topic_members (
  topic_key text NOT NULL,
  article_id text NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  angle text NOT NULL,
  confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  PRIMARY KEY(topic_key, article_id)
);
CREATE INDEX editorial_topic_article_idx ON editorial_topic_members(article_id);
CREATE TABLE radar_snapshots (
  id bigserial PRIMARY KEY,
  slot text NOT NULL CHECK(slot IN ('08','20','ondemand')),
  local_date date NOT NULL,
  captured_at timestamptz NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  memory_days integer NOT NULL CHECK(memory_days > 0),
  profile_version text NOT NULL,
  content jsonb NOT NULL
);
CREATE UNIQUE INDEX radar_scheduled_slot_idx ON radar_snapshots(local_date, slot) WHERE slot <> 'ondemand';
CREATE TABLE editorial_recommendations (
  id bigserial PRIMARY KEY,
  snapshot_id bigint REFERENCES radar_snapshots(id) ON DELETE CASCADE,
  article_id text NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  topic_key text NOT NULL,
  angle text NOT NULL,
  format text NOT NULL CHECK(format IN ('reel','carousel','other')),
  is_top boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(snapshot_id,article_id,topic_key)
);
CREATE INDEX editorial_recommendations_window_idx ON editorial_recommendations(topic_key,created_at);
CREATE TABLE ophthalmology_scout_runs (
  id bigserial PRIMARY KEY, provider text NOT NULL, query text NOT NULL,
  result_count integer NOT NULL, created_count integer NOT NULL,
  receipt_id bigint REFERENCES receipts(id), created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO budgets(service,per_minute,per_hour,per_day) VALUES ('brave',1,30,100) ON CONFLICT DO NOTHING;
