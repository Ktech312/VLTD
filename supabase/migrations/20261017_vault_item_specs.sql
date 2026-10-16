-- Category-specific Details: values for fields that have no column of their own (material, catalog number, dimensions...),
-- kept as one small JSON object per item, e.g. {"material": "Brass", "catalog_number": "BN 4001"}.
-- Optional and private: it is not part of any public view. Safe to run more than once.
alter table public.vault_items add column if not exists specs jsonb;
