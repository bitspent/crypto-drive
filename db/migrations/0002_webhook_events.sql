-- Gumroad Ping idempotency: one row per processed sale. Retried
-- deliveries find the row and ack without re-provisioning.

CREATE TABLE IF NOT EXISTS webhook_events (
  id text PRIMARY KEY,
  source text NOT NULL DEFAULT 'gumroad',
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_events_source_idx ON webhook_events(source, id);
