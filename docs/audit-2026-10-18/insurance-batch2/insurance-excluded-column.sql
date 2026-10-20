-- PROPOSAL, NOT APPLIED. Insurance exclusions that follow the account (see MIGRATION-PROPOSAL-account-exclusions.md).
-- Additive and reversible: every existing row defaults to false (still counted), row-level security is unchanged.
alter table public.vault_items
  add column if not exists insurance_excluded boolean not null default false;
