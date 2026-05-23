ALTER TABLE vault_items ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
