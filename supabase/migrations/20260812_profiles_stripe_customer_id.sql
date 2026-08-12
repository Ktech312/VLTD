-- ─────────────────────────────────────────────────────────────
-- Persist the Stripe customer id server-side on profiles.
--
-- Before this, the Stripe customer id only ever lived in the browser's
-- localStorage (src/lib/billingClient.ts) -- set once, on the device that
-- completed Checkout, and never synced anywhere else. profiles.tier is
-- already kept correct on every device (the webhook writes it), but a real
-- paying user opening /account/billing on a NEW device would see the right
-- plan and then have the Payment method / Invoice history / Cancel
-- sections stay hidden, because nothing server-side ever remembered which
-- Stripe customer they are.
--
-- This column is populated by src/app/api/billing/webhook/route.ts on
-- checkout.session.completed and customer.subscription.updated -- no
-- action needed beyond running this migration.
--
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists stripe_customer_id text;
