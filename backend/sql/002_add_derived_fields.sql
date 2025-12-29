-- Add derived fields to deals table for audit and analytics
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='latest_vendor_offer') THEN
    ALTER TABLE deals ADD COLUMN latest_vendor_offer JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='latest_decision_action') THEN
    ALTER TABLE deals ADD COLUMN latest_decision_action TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='latest_utility') THEN
    ALTER TABLE deals ADD COLUMN latest_utility NUMERIC;
  END IF;
END $$;

-- Add derived fields to messages table for explicit storage
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='decision_action') THEN
    ALTER TABLE messages ADD COLUMN decision_action TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='utility_score') THEN
    ALTER TABLE messages ADD COLUMN utility_score NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='counter_offer') THEN
    ALTER TABLE messages ADD COLUMN counter_offer JSONB;
  END IF;
END $$;

