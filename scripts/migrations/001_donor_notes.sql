-- Run this in Supabase SQL Editor before using the Notes feature
CREATE TABLE IF NOT EXISTS donor_notes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  donor_id   uuid NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
  content    text NOT NULL,
  created_by text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_donor_notes_donor_id ON donor_notes(donor_id);
