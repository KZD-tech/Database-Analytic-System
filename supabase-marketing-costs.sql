-- Run this in Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS marketing_costs (
  id          bigserial PRIMARY KEY,
  platform    text NOT NULL,
  campaign    text NOT NULL,
  cost_date   date NOT NULL,
  date_to     date,
  amount      numeric(12,2) NOT NULL CHECK (amount >= 0),
  notes       text,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_costs_cost_date_idx ON marketing_costs (cost_date DESC);
CREATE INDEX IF NOT EXISTS marketing_costs_campaign_idx  ON marketing_costs (campaign);
CREATE INDEX IF NOT EXISTS marketing_costs_platform_idx  ON marketing_costs (platform);

-- If table already exists, run only this line to add the new column:
-- ALTER TABLE marketing_costs ADD COLUMN IF NOT EXISTS date_to date;
