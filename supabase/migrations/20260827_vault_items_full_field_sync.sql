-- Adds the ~109 VaultItem fields that have existed in the app's TypeScript
-- type and in local device storage for a long time, but were NEVER wired to
-- Supabase — found during a code audit (2026-08-27), not reported by EK.
-- Purely additive: every column is nullable with no default, so this cannot
-- affect any existing row or existing feature. Safe to run any time.
--
-- Core fields (existed on VaultItem but had no column at all):
alter table public.vault_items add column if not exists year text;
alter table public.vault_items add column if not exists condition text;
alter table public.vault_items add column if not exists condition_reason text;
alter table public.vault_items add column if not exists condition_source text;
alter table public.vault_items add column if not exists image_back_url text;
alter table public.vault_items add column if not exists subject text;
alter table public.vault_items add column if not exists edition text;
alter table public.vault_items add column if not exists variant text;
alter table public.vault_items add column if not exists print_run text;
alter table public.vault_items add column if not exists is_first_edition boolean;
alter table public.vault_items add column if not exists estimated_value numeric;
alter table public.vault_items add column if not exists last_comp_value numeric;
alter table public.vault_items add column if not exists value_low numeric;
alter table public.vault_items add column if not exists value_median numeric;
alter table public.vault_items add column if not exists value_high numeric;
alter table public.vault_items add column if not exists comparables jsonb;
alter table public.vault_items add column if not exists price_sources jsonb;
alter table public.vault_items add column if not exists price_source text;
alter table public.vault_items add column if not exists price_confidence text;
alter table public.vault_items add column if not exists price_updated_at bigint;
alter table public.vault_items add column if not exists price_notes text;

-- TCG
alter table public.vault_items add column if not exists tcg_parallel_type text;
alter table public.vault_items add column if not exists tcg_set_code text;
alter table public.vault_items add column if not exists tcg_holo_type text;
alter table public.vault_items add column if not exists tcg_rarity text;
alter table public.vault_items add column if not exists tcg_language text;
alter table public.vault_items add column if not exists tcg_grading_company text;

-- Sports
alter table public.vault_items add column if not exists sports_parallel_type text;
alter table public.vault_items add column if not exists sports_is_relic boolean;
alter table public.vault_items add column if not exists sports_relic_description text;
alter table public.vault_items add column if not exists sports_is_auto boolean;
alter table public.vault_items add column if not exists sports_serial_number text;
alter table public.vault_items add column if not exists sports_sport text;
alter table public.vault_items add column if not exists sports_team text;
alter table public.vault_items add column if not exists sports_grading_company text;
alter table public.vault_items add column if not exists sports_pop text;
alter table public.vault_items add column if not exists sports_auto_auth text;

-- Vinyl / Music
alter table public.vault_items add column if not exists vinyl_pressing text;
alter table public.vault_items add column if not exists vinyl_label text;
alter table public.vault_items add column if not exists vinyl_matrix text;
alter table public.vault_items add column if not exists vinyl_speed_rpm text;
alter table public.vault_items add column if not exists vinyl_color text;
alter table public.vault_items add column if not exists vinyl_country text;
alter table public.vault_items add column if not exists vinyl_sleeve_condition text;
alter table public.vault_items add column if not exists vinyl_inserts boolean;
alter table public.vault_items add column if not exists vinyl_gatefold boolean;

-- Comics
alter table public.vault_items add column if not exists comic_issue_number text;
alter table public.vault_items add column if not exists comic_cover_variant text;
alter table public.vault_items add column if not exists comic_arc_title text;
alter table public.vault_items add column if not exists comic_publisher text;
alter table public.vault_items add column if not exists comic_cover_date text;
alter table public.vault_items add column if not exists comic_grading_company text;
alter table public.vault_items add column if not exists comic_page_quality text;
alter table public.vault_items add column if not exists comic_restoration_status text;
alter table public.vault_items add column if not exists comic_holder_type text;
alter table public.vault_items add column if not exists comic_census_rank text;

-- Original Comic Art (also reused under Art & Prints)
alter table public.vault_items add column if not exists art_penciller text;
alter table public.vault_items add column if not exists art_inker text;
alter table public.vault_items add column if not exists art_colorist text;
alter table public.vault_items add column if not exists art_type text;
alter table public.vault_items add column if not exists art_first_appearance text;

-- Toys
alter table public.vault_items add column if not exists toy_brand text;
alter table public.vault_items add column if not exists toy_line text;
alter table public.vault_items add column if not exists toy_scale text;
alter table public.vault_items add column if not exists toy_package_condition text;
alter table public.vault_items add column if not exists toy_box_included boolean;
alter table public.vault_items add column if not exists toy_accessories_included boolean;
alter table public.vault_items add column if not exists toy_is_complete boolean;

-- Art Cards
alter table public.vault_items add column if not exists art_card_artist text;
alter table public.vault_items add column if not exists art_card_set text;
alter table public.vault_items add column if not exists art_card_type text;

-- Memorabilia
alter table public.vault_items add column if not exists memorabilia_team text;
alter table public.vault_items add column if not exists memorabilia_event text;
alter table public.vault_items add column if not exists memorabilia_signing_date text;
alter table public.vault_items add column if not exists memorabilia_witnessed boolean;
alter table public.vault_items add column if not exists memorabilia_auth_company text;
alter table public.vault_items add column if not exists memorabilia_game_used boolean;
alter table public.vault_items add column if not exists memorabilia_game_used_desc text;

-- Watches
alter table public.vault_items add column if not exists watch_brand text;
alter table public.vault_items add column if not exists watch_reference text;
alter table public.vault_items add column if not exists watch_movement text;
alter table public.vault_items add column if not exists watch_case_material text;
alter table public.vault_items add column if not exists watch_case_size text;
alter table public.vault_items add column if not exists watch_dial_color text;
alter table public.vault_items add column if not exists watch_box boolean;
alter table public.vault_items add column if not exists watch_papers boolean;
alter table public.vault_items add column if not exists watch_full_set boolean;

-- Bags / Handbags
alter table public.vault_items add column if not exists bag_brand text;
alter table public.vault_items add column if not exists bag_color text;
alter table public.vault_items add column if not exists bag_material text;
alter table public.vault_items add column if not exists bag_hardware text;
alter table public.vault_items add column if not exists bag_auth_card boolean;
alter table public.vault_items add column if not exists bag_dustbag boolean;
alter table public.vault_items add column if not exists bag_box boolean;

-- Apparel / Streetwear
alter table public.vault_items add column if not exists apparel_size text;
alter table public.vault_items add column if not exists apparel_colorway text;
alter table public.vault_items add column if not exists apparel_worn boolean;

-- Art & Prints (Fine Art)
alter table public.vault_items add column if not exists art_medium text;
alter table public.vault_items add column if not exists art_surface text;
alter table public.vault_items add column if not exists art_height text;
alter table public.vault_items add column if not exists art_width text;
alter table public.vault_items add column if not exists art_depth text;
alter table public.vault_items add column if not exists art_is_framed boolean;
alter table public.vault_items add column if not exists art_is_signed boolean;
alter table public.vault_items add column if not exists art_signature_location text;
alter table public.vault_items add column if not exists art_provenance text;
alter table public.vault_items add column if not exists art_exhibitions text;

-- Coins & Currency
alter table public.vault_items add column if not exists coin_denomination text;
alter table public.vault_items add column if not exists coin_country text;
alter table public.vault_items add column if not exists coin_mint text;
alter table public.vault_items add column if not exists coin_mint_mark text;
alter table public.vault_items add column if not exists coin_grading_company text;
alter table public.vault_items add column if not exists coin_population text;
alter table public.vault_items add column if not exists coin_error text;
alter table public.vault_items add column if not exists coin_key_date boolean;

-- Games
alter table public.vault_items add column if not exists game_platform text;
alter table public.vault_items add column if not exists game_region text;
alter table public.vault_items add column if not exists game_grading_company text;
alter table public.vault_items add column if not exists game_is_sealed boolean;
alter table public.vault_items add column if not exists game_is_cib boolean;
alter table public.vault_items add column if not exists game_has_manual boolean;
alter table public.vault_items add column if not exists game_publisher text;
alter table public.vault_items add column if not exists console_controller_count text;
alter table public.vault_items add column if not exists console_cables boolean;
alter table public.vault_items add column if not exists console_box boolean;
alter table public.vault_items add column if not exists console_tested boolean;
