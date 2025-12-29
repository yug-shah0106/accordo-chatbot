CREATE TABLE IF NOT EXISTS deal_templates (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  config_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

DO $$ BEGIN
  CREATE TYPE deal_status AS ENUM ('NEGOTIATING','READY_TO_ACCEPT','ACCEPTED','WALKED_AWAY','ESCALATED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY,
  template_id UUID REFERENCES deal_templates(id),
  title TEXT NOT NULL,
  counterparty TEXT,
  status deal_status NOT NULL DEFAULT 'NEGOTIATING',
  round INT NOT NULL DEFAULT 0,
  latest_offer_json JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DO $$ BEGIN
  CREATE TYPE message_role AS ENUM ('VENDOR','ACCORDO','SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  role message_role NOT NULL,
  content TEXT NOT NULL,
  extracted_offer JSONB,
  engine_decision JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_deal_id ON messages(deal_id);

