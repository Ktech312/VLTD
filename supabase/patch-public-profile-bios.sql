-- VLTD Patch: Copy seed character bios into public_profiles
-- Run after seed-characters-bios.sql
-- This makes bios visible on the /v/[profileId] page

ALTER TABLE public_profiles ADD COLUMN IF NOT EXISTS bio text;

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'jpmorgan' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000001';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'wrhearst' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000002';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'thecommodore' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000003';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'kinghenry8' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000004';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'howardhughes' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000005';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'nikolatesla' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000006';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'emperornero' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000007';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'jdrockefeller' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000008';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'emperorqianlong' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000009';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'sunking' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000010';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'beethoven' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000011';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'leonardodavinci' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000012';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'blackbeard' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000013';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'ptbarnum' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000014';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'casanova' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000015';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'marieantoinette' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000016';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'orpheus' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000017';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'rumplestiltskin' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000018';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'waltonjjr' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000019';

UPDATE public_profiles SET bio = (
  SELECT p.bio FROM profiles p WHERE p.username = 'erikthephantom' LIMIT 1
) WHERE profile_id = '00000000-0000-0000-0000-000000000020';

UPDATE public_profiles SET bio = 'The Delta''s greatest mystery. Solomon King materialized at the crossroads of Highway 61 and 49, played the blues like the devil himself was watching, and left behind 29 recordings that rewrote the history of American music. His vault holds every instrument he ever touched, every record that survived, and a few things that probably shouldn''t exist.' WHERE profile_id = '00000000-0000-0000-0000-000000000021';

UPDATE public_profiles SET bio = 'The next generation collector. Kai Sterling doesn''t chase the past — he chases what''s next. Sports cards graded PSA 10, first-edition Pokémon slabs, rare sneakers still in box, and NFTs that actually meant something. His vault is a time capsule of what this era thought was worth holding onto. He''s betting he''s right.' WHERE profile_id = '00000000-0000-0000-0000-000000000022';

-- Verify
SELECT profile_id, display_name, LEFT(bio, 60) as bio_preview FROM public_profiles ORDER BY profile_id;
