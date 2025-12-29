-- Conversation Mode support
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'INSIGHTS',
  ADD COLUMN IF NOT EXISTS convo_state_json jsonb DEFAULT '{}'::jsonb;

-- Store explainability per message (only used for ACCORDO messages)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS explainability_json jsonb;

