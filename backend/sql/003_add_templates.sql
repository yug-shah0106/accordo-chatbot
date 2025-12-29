-- Negotiation templates table
CREATE TABLE IF NOT EXISTS negotiation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  accept_threshold NUMERIC NOT NULL,
  walkaway_threshold NUMERIC NOT NULL,
  max_rounds INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Negotiation parameters table (one row per parameter per template)
CREATE TABLE IF NOT EXISTS negotiation_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES negotiation_templates(id) ON DELETE CASCADE,
  key TEXT NOT NULL,                      -- 'unit_price' | 'payment_terms'
  weight NUMERIC NOT NULL,
  direction TEXT NOT NULL,                -- 'lower_better' | 'higher_better' etc
  config JSONB NOT NULL,                  -- parameter-specific config
  UNIQUE(template_id, key)
);

-- Add template reference to deals (if not already exists)
-- Note: We use template_id (not negotiation_template_id) to match existing schema
-- The existing template_id column references deal_templates, so we'll use a different approach
-- For MVP, we'll add negotiation_template_id but recommend migrating to use template_id for negotiation templates
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='negotiation_template_id') THEN
    ALTER TABLE deals ADD COLUMN negotiation_template_id UUID REFERENCES negotiation_templates(id);
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_negotiation_parameters_template_id ON negotiation_parameters(template_id);

