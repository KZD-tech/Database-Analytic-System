-- Run this in Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS activity_logs (
  id        bigserial PRIMARY KEY,
  user_email text,
  user_role  text,
  action     text NOT NULL,
  details    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_action_idx     ON activity_logs (action);
