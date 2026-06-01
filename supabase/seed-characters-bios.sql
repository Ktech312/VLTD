-- VLTD Seed Character Bios + Visibility Migration
-- Run this in Supabase SQL Editor after seed-characters.sql

-- ═══ STEP 1: Add bio to public_profiles ═══
ALTER TABLE public_profiles ADD COLUMN IF NOT EXISTS bio text;

-- ═══ STEP 2: Add is_public to profiles (default true = everyone visible) ═══
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- ═══ STEP 3: Update bios on profiles table ═══
UPDATE profiles SET bio = 'The undisputed king of American finance. Morgan''s private collection spanned Old Masters, illuminated manuscripts, and ancient antiquities — assembled with the same ruthless precision he applied to cornering markets. His library alone contained over 10,000 rare books and manuscripts. If it was priceless, Morgan owned it.' WHERE username = 'jpmorgan';

UPDATE profiles SET bio = 'Newspaper baron. Castle builder. Collector of everything. Hearst filled San Simeon with art looted from European estates, Greek antiquities, Egyptian relics, and enough fine silver to supply a small kingdom. His motto: if you want it, buy it twice.' WHERE username = 'wrhearst';

UPDATE profiles SET bio = 'The Commodore built his fortune on steam and steel, and spent it acquiring the finest coins, estate silver, and Old Master paintings money could buy. A ruthless negotiator in business; a meticulous curator in private. His collection was as disciplined as his ledgers.' WHERE username = 'thecommodore';

UPDATE profiles SET bio = 'Six wives. One crown. Infinite appetites. Henry VIII''s collection of armor, illuminated manuscripts, royal tapestries, and jeweled relics was the envy of every court in Europe. He didn''t just collect — he confiscated, commissioned, and conquered his way to one of history''s great hoards.' WHERE username = 'kinghenry8';

UPDATE profiles SET bio = 'Aviator. Film mogul. Obsessive. Hughes spent his last decades locked away from the world, but his early years produced one of the most eclectic private collections ever assembled — prototype aircraft models, rare film reels, experimental instruments, and enough curiosities to fill a hangar. Everything was catalogued. Nothing was ever thrown away.' WHERE username = 'howardhughes';

UPDATE profiles SET bio = 'The man who lit the world. Tesla''s collection was an extension of his mind — rare scientific instruments, first-edition physics texts, handwritten patent drawings, and devices that were decades ahead of their time. He died with little money but a vault full of genius.' WHERE username = 'nikolatesla';

UPDATE profiles SET bio = 'Rome''s most notorious emperor didn''t just rule the ancient world — he collected it. Nero''s vaults held Greek sculptures plundered from Athens, rare gemstones, golden dinner services, and coins from every corner of the empire. His tastes were extravagant. His methods were worse. The collection survived him.' WHERE username = 'emperornero';

UPDATE profiles SET bio = 'Standard Oil built the fortune. The collection built the legacy. Rockefeller was a meticulous accumulator of rare stamps, fine art, and ancient artifacts — organized, catalogued, and appraised with the same discipline that made him the world''s first billionaire. Everything has a number. Everything has a value.' WHERE username = 'jdrockefeller';

UPDATE profiles SET bio = 'The Qianlong Emperor ruled China for 60 years and spent much of that time acquiring the finest jade, imperial porcelain, and ancient bronzes the kingdom could produce. His collection of calligraphy and painting alone numbered in the thousands. He didn''t just possess the art — he annotated it, stamped it, and made it his own.' WHERE username = 'emperorqianlong';

UPDATE profiles SET bio = 'The Sun King. Every object in Versailles was a political statement — a demonstration that France, and Louis, were the center of the civilized world. His collection of tapestries, royal portraits, ceremonial armor, and decorative arts set the standard for royal collecting that every European monarch spent the next century trying to match.' WHERE username = 'sunking';

UPDATE profiles SET bio = 'Deaf by his late twenties. Still the greatest composer who ever lived. Beethoven''s apartment was chaos — manuscripts stacked on every surface, broken piano strings left unreplaced, coffee grounds counted obsessively. But his collection of original scores, rare instruments, and correspondence with Europe''s musical elite told the full story of a mind that could not stop creating.' WHERE username = 'beethoven';

UPDATE profiles SET bio = 'Painter. Sculptor. Architect. Engineer. Anatomist. Leonardo da Vinci collected the world through observation — thousands of notebook pages, anatomical drawings, mechanical sketches, and studies of everything from water currents to the movement of wings. His collection is the greatest archive of human curiosity ever assembled.' WHERE username = 'leonardodavinci';

UPDATE profiles SET bio = 'The most feared pirate in the Atlantic. Blackbeard''s legend grew with every ship he took — and so did his hoard. Gold coins from a dozen nations, navigational instruments stripped from captured vessels, maps of routes no cartographer had charted, and weapons that were works of art in their own right. The vault at the bottom of the sea is only half the story.' WHERE username = 'blackbeard';

UPDATE profiles SET bio = 'The greatest showman who ever lived. Barnum understood that the rarest thing isn''t an object — it''s a story. His collection of oddities, circus posters, sideshow artifacts, and theatrical memorabilia turned the bizarre into the beloved. If it was strange, he staged it. If it was staged, he sold tickets.' WHERE username = 'ptbarnum';

UPDATE profiles SET bio = 'The most famous lover in history left a paper trail. Letters, miniature portraits, jewelry gifted and received, fashion accessories from every city in Europe, and a library of correspondence that mapped the social world of 18th-century aristocracy. Casanova collected experiences — and kept every receipt.' WHERE username = 'casanova';

UPDATE profiles SET bio = 'Queen of Versailles. Patron of fashion. History''s most famous collector of the beautiful and the excessive. Marie Antoinette''s jewels were legendary — diamonds, sapphires, and pearl ropes that sparked a revolution. Her collection of fine porcelain, rose-gold accessories, and custom-made gowns defined an era of taste that the world still hasn''t recovered from.' WHERE username = 'marieantoinette';

UPDATE profiles SET bio = 'The first musician. Orpheus could move rivers with his lyre, charm stones into walls, and lead the dead back to the living. His collection spans every instrument ever made in his honor, every retelling of his myth across three thousand years of art and music, and artifacts from the edge of the underworld. Some items came back. Some didn''t.' WHERE username = 'orpheus';

UPDATE profiles SET bio = 'The dealer of deals. Rumplestiltskin has been collecting favors, artifacts, and cursed objects longer than most civilizations have existed. His shop is a labyrinth of enchanted relics, spun-gold curiosities, and magical contracts — each one with a price attached. Everything has value. Everything can be traded. The question is what you''re willing to give up.' WHERE username = 'rumplestiltskin';

UPDATE profiles SET bio = 'Professor of archaeology. Adventurer of questionable ethics. Walton J. Jr. has pulled the Holy Grail from a French cave, outrun three governments to acquire the Ark''s companion pieces, and written six academic papers that the university quietly buried. His collection belongs in a museum. It does not live in a museum.' WHERE username = 'waltonjjr';

UPDATE profiles SET bio = 'No one knows his real name. The Phantom of the Paris Opera spent thirty years beneath the stage composing in secret, and collecting everything the surface world discarded — musical scores, architectural plans for the opera house, masks of every style, and mechanical curiosities he built with his own hands. The music never stopped. Neither did the acquiring.' WHERE username = 'erikthephantom';

UPDATE profiles SET bio = 'At midnight, at the crossroads, he handed over the guitar. What came back was different — tuned to something older than music. Solomon King''s collection runs from the first 78rpm pressings ever cut in the Delta, to hand-drawn blues tablatures, to instruments with histories that don''t quite add up. Every piece has a story. Not all of them are safe to tell.' WHERE username = 'solomonking';

UPDATE profiles SET bio = 'Made his first million at 19 from a crypto arbitrage bot running on a server in his dorm room. Spent the next decade building the definitive modern vault — PSA 10 rookie cards, first-print modern comics, graded sealed games, limited sneakers, and pop culture collectibles that the market hasn''t caught up to yet. Data-driven. Never sentimental. Always right.' WHERE username = 'kaisterling';

-- ═══ STEP 4: Sync bios to public_profiles ═══
UPDATE public_profiles pp
SET bio = p.bio
FROM profiles p
WHERE p.id = pp.profile_id
  AND p.bio IS NOT NULL;
