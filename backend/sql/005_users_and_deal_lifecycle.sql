-- Users table for future authentication
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert test user
INSERT INTO users (id, email, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'test@accordo.ai', 'Test User')
ON CONFLICT (email) DO NOTHING;

-- Add lifecycle columns to deals table
DO $$
BEGIN
  -- Add user_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='user_id') THEN
    ALTER TABLE deals ADD COLUMN user_id UUID REFERENCES users(id);
  END IF;

  -- Add archived_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='archived_at') THEN
    ALTER TABLE deals ADD COLUMN archived_at TIMESTAMPTZ;
  END IF;

  -- Add deleted_at column (soft delete)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deals' AND column_name='deleted_at') THEN
    ALTER TABLE deals ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;
END $$;

-- Set all existing deals to belong to test user
UPDATE deals SET user_id = '11111111-1111-1111-1111-111111111111' WHERE user_id IS NULL;

-- Create indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_deals_user_id ON deals(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_archived_at ON deals(archived_at);
CREATE INDEX IF NOT EXISTS idx_deals_deleted_at ON deals(deleted_at);
