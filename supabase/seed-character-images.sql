-- VLTD Seed Character Images
-- Adds image_front_url to seed character vault_items using public-domain Wikimedia images.
-- Run in Supabase SQL Editor after seed-characters.sql

-- ═══════════════════════════════════════════════════════════════
-- 01 — J.P. MORGAN (profile 00000000-0000-0000-0000-000000000001)
-- ═══════════════════════════════════════════════════════════════
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Gutenberg_Bible%2C_Lenox_Copy%2C_New_York_Public_Library%2C_2009._Pic_01.jpg/800px-Gutenberg_Bible%2C_Lenox_Copy%2C_New_York_Public_Library%2C_2009._Pic_01.jpg' WHERE id = 'seed_morgan_item_001';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Book_of_hours_of_Catherine_of_Cleves%2C_illuminated_MS_M.917%2C_p._166.jpg/600px-Book_of_hours_of_Catherine_of_Cleves%2C_illuminated_MS_M.917%2C_p._166.jpg' WHERE id = 'seed_morgan_item_002';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Rembrandt_van_Rijn_-_Self-Portrait_-_Google_Art_Project.jpg/600px-Rembrandt_van_Rijn_-_Self-Portrait_-_Google_Art_Project.jpg' WHERE id = 'seed_morgan_item_003';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Egyptian_Scarab_Met_Museum.jpg/500px-Egyptian_Scarab_Met_Museum.jpg' WHERE id = 'seed_morgan_item_004';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/First_Folio_Oxford.jpg/500px-First_Folio_Oxford.jpg' WHERE id = 'seed_morgan_item_005';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Solidus-Justinian_I-sb0140.jpg/500px-Solidus-Justinian_I-sb0140.jpg' WHERE id = 'seed_morgan_item_006';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Rembrandt_van_Rijn_-_Self-Portrait_with_Two_Circles_c.1665-9.jpg/600px-Rembrandt_van_Rijn_-_Self-Portrait_with_Two_Circles_c.1665-9.jpg' WHERE id = 'seed_morgan_item_007';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Gothic_ivory_diptych_Annunciation.jpg/500px-Gothic_ivory_diptych_Annunciation.jpg' WHERE id = 'seed_morgan_item_008';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Wolfgang-amadeus-mozart_1.jpg/500px-Wolfgang-amadeus-mozart_1.jpg' WHERE id = 'seed_morgan_item_009';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Bust_of_Augustus_at_Prima_Porta%2C_detail.jpg/500px-Bust_of_Augustus_at_Prima_Porta%2C_detail.jpg' WHERE id = 'seed_morgan_item_010';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/D%C3%BCrer_-_Rhinoceros_1515.jpg/600px-D%C3%BCrer_-_Rhinoceros_1515.jpg' WHERE id = 'seed_morgan_item_011';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Venice_glass_beaker_V%26A.jpg/400px-Venice_glass_beaker_V%26A.jpg' WHERE id = 'seed_morgan_item_012';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Charles_Dickens_portrait_Jeremiah_Gurney.jpg/500px-Charles_Dickens_portrait_Jeremiah_Gurney.jpg' WHERE id = 'seed_morgan_item_013';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Gold_wreath_Macedonia_Met.jpg/500px-Gold_wreath_Macedonia_Met.jpg' WHERE id = 'seed_morgan_item_014';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/The_Unicorn_Rests_in_a_Garden_%28from_the_Unicorn_Tapestries%29_MET_DP118991.jpg/500px-The_Unicorn_Rests_in_a_Garden_%28from_the_Unicorn_Tapestries%29_MET_DP118991.jpg' WHERE id = 'seed_morgan_item_015';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Faberg%C3%A9_egg_-_Lilies_of_the_Valley_Egg.jpg/500px-Faberg%C3%A9_egg_-_Lilies_of_the_Valley_Egg.jpg' WHERE id = 'seed_morgan_item_016';

-- ═══════════════════════════════════════════════════════════════
-- 02 — WILLIAM RANDOLPH HEARST (profile 00000000-0000-0000-0000-000000000002)
-- ═══════════════════════════════════════════════════════════════
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/San_Simeon_-_Heart_Castle_-_Neptune_pool.jpg/800px-San_Simeon_-_Heart_Castle_-_Neptune_pool.jpg' WHERE id = 'seed_hearst_item_001';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Greek_Vase_-_Panathenaic_amphora.jpg/500px-Greek_Vase_-_Panathenaic_amphora.jpg' WHERE id = 'seed_hearst_item_002';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Rubens_-_Massacre_of_the_Innocents_-_1610-1611.jpg/600px-Rubens_-_Massacre_of_the_Innocents_-_1610-1611.jpg' WHERE id = 'seed_hearst_item_003';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Egyptian_Mummy_Case_Louvre.jpg/400px-Egyptian_Mummy_Case_Louvre.jpg' WHERE id = 'seed_hearst_item_004';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Flemish_tapestry_verdure.jpg/600px-Flemish_tapestry_verdure.jpg' WHERE id = 'seed_hearst_item_005';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Spanish_silver_chalice_17th_century.jpg/400px-Spanish_silver_chalice_17th_century.jpg' WHERE id = 'seed_hearst_item_006';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Medieval_armor_suit_Met.jpg/400px-Medieval_armor_suit_Met.jpg' WHERE id = 'seed_hearst_item_007';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Stained_glass_medieval_window.jpg/400px-Stained_glass_medieval_window.jpg' WHERE id = 'seed_hearst_item_008';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Choir_stalls_medieval_carved_wood.jpg/600px-Choir_stalls_medieval_carved_wood.jpg' WHERE id = 'seed_hearst_item_009';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Roman_sarcophagus_Met.jpg/600px-Roman_sarcophagus_Met.jpg' WHERE id = 'seed_hearst_item_010';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Egyptian_statue_limestone_Met.jpg/400px-Egyptian_statue_limestone_Met.jpg' WHERE id = 'seed_hearst_item_011';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Italian_majolica_plate_16th_century.jpg/500px-Italian_majolica_plate_16th_century.jpg' WHERE id = 'seed_hearst_item_012';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Persian_carpet_16th_century_Met.jpg/400px-Persian_carpet_16th_century_Met.jpg' WHERE id = 'seed_hearst_item_013';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Illuminated_manuscript_psalter.jpg/400px-Illuminated_manuscript_psalter.jpg' WHERE id = 'seed_hearst_item_014';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Silver_candelabra_baroque.jpg/400px-Silver_candelabra_baroque.jpg' WHERE id = 'seed_hearst_item_015';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Marble_bust_Roman_senator.jpg/400px-Marble_bust_Roman_senator.jpg' WHERE id = 'seed_hearst_item_016';

-- ═══════════════════════════════════════════════════════════════
-- 10 — KING LOUIS XIV / SUN KING (profile 00000000-0000-0000-0000-000000000010)
-- ═══════════════════════════════════════════════════════════════
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Louis_XIV_Rigaud.jpg/600px-Louis_XIV_Rigaud.jpg' WHERE id = 'seed_sunking_item_001';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Hall_of_Mirrors_Versailles%2C_2009.jpg/800px-Hall_of_Mirrors_Versailles%2C_2009.jpg' WHERE id = 'seed_sunking_item_002';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Manufacture_Gobelin_tapestry_Louis_XIV.jpg/600px-Manufacture_Gobelin_tapestry_Louis_XIV.jpg' WHERE id = 'seed_sunking_item_003';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Sevres_Porcelain_Royal_blue.jpg/400px-Sevres_Porcelain_Royal_blue.jpg' WHERE id = 'seed_sunking_item_004';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/French_Royal_Crown_Jewels_Louvre.jpg/400px-French_Royal_Crown_Jewels_Louvre.jpg' WHERE id = 'seed_sunking_item_005';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Louis_XIV_armor_musee_armee.jpg/400px-Louis_XIV_armor_musee_armee.jpg' WHERE id = 'seed_sunking_item_006';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Le_roi_soleil_court_ballet.jpg/500px-Le_roi_soleil_court_ballet.jpg' WHERE id = 'seed_sunking_item_007';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Chateau_de_Versailles_1668_Pierre_Patel.jpg/800px-Chateau_de_Versailles_1668_Pierre_Patel.jpg' WHERE id = 'seed_sunking_item_008';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Baroque_golden_clock_french_Louvre.jpg/400px-Baroque_golden_clock_french_Louvre.jpg' WHERE id = 'seed_sunking_item_009';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Versailles_Gardens_Fountain.jpg/800px-Versailles_Gardens_Fountain.jpg' WHERE id = 'seed_sunking_item_010';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/French_baroque_furniture_cabinet.jpg/500px-French_baroque_furniture_cabinet.jpg' WHERE id = 'seed_sunking_item_011';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Gobelins_tapestry_Victories_Louis_XIV.jpg/600px-Gobelins_tapestry_Victories_Louis_XIV.jpg' WHERE id = 'seed_sunking_item_012';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Boulle_furniture_ormolu_Louvre.jpg/500px-Boulle_furniture_ormolu_Louvre.jpg' WHERE id = 'seed_sunking_item_013';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Grand_Canal_Versailles_aerial.jpg/800px-Grand_Canal_Versailles_aerial.jpg' WHERE id = 'seed_sunking_item_014';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/French_royal_sword_17th_century.jpg/400px-French_royal_sword_17th_century.jpg' WHERE id = 'seed_sunking_item_015';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Versailles_Royal_Chapel_interior.jpg/600px-Versailles_Royal_Chapel_interior.jpg' WHERE id = 'seed_sunking_item_016';

-- ═══════════════════════════════════════════════════════════════
-- 06 — NIKOLA TESLA (profile 00000000-0000-0000-0000-000000000006)
-- ═══════════════════════════════════════════════════════════════
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Tesla_circa_1890.jpeg/500px-Tesla_circa_1890.jpeg' WHERE id = 'seed_tesla_item_001';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Tesla_Colorado_Springs.jpg/500px-Tesla_Colorado_Springs.jpg' WHERE id = 'seed_tesla_item_002';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Tesla_Polyphase_Motor_diagram.jpg/600px-Tesla_Polyphase_Motor_diagram.jpg' WHERE id = 'seed_tesla_item_003';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/NikolaTesla_01.jpg/500px-NikolaTesla_01.jpg' WHERE id = 'seed_tesla_item_004';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Tesla_Egg_of_Columbus_device.jpg/500px-Tesla_Egg_of_Columbus_device.jpg' WHERE id = 'seed_tesla_item_005';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Science_laboratory_19th_century.jpg/600px-Science_laboratory_19th_century.jpg' WHERE id = 'seed_tesla_item_006';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Galvanometer_antique_instrument.jpg/500px-Galvanometer_antique_instrument.jpg' WHERE id = 'seed_tesla_item_007';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Edison_bulbs_antique.jpg/500px-Edison_bulbs_antique.jpg' WHERE id = 'seed_tesla_item_008';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Antique_compass_brass.jpg/500px-Antique_compass_brass.jpg' WHERE id = 'seed_tesla_item_009';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Antique_voltmeter_scientific.jpg/500px-Antique_voltmeter_scientific.jpg' WHERE id = 'seed_tesla_item_010';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Maxwell_Treatise_on_Electricity_1873.jpg/400px-Maxwell_Treatise_on_Electricity_1873.jpg' WHERE id = 'seed_tesla_item_011';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Antique_telegraph_machine.jpg/500px-Antique_telegraph_machine.jpg' WHERE id = 'seed_tesla_item_012';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Patent_drawing_Tesla_motor.jpg/500px-Patent_drawing_Tesla_motor.jpg' WHERE id = 'seed_tesla_item_013';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Electrostatic_generator_Wimshurst.jpg/500px-Electrostatic_generator_Wimshurst.jpg' WHERE id = 'seed_tesla_item_014';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Oscilloscope_antique_CRT.jpg/500px-Oscilloscope_antique_CRT.jpg' WHERE id = 'seed_tesla_item_015';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Tesla_tower_Wardenclyffe.jpg/500px-Tesla_tower_Wardenclyffe.jpg' WHERE id = 'seed_tesla_item_016';

-- ═══════════════════════════════════════════════════════════════
-- 12 — LEONARDO DA VINCI (profile 00000000-0000-0000-0000-000000000012)
-- ═══════════════════════════════════════════════════════════════
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/600px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg' WHERE id = 'seed_leonardodavinci_item_001';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/%22The_Last_Supper%22_by_Leonardo_da_Vinci.jpg/800px-%22The_Last_Supper%22_by_Leonardo_da_Vinci.jpg' WHERE id = 'seed_leonardodavinci_item_002';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Da_Vinci_Vitruvian_Man_Luc_Viatour.jpg/600px-Da_Vinci_Vitruvian_Man_Luc_Viatour.jpg' WHERE id = 'seed_leonardodavinci_item_003';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Leonardo_da_Vinci_-_Anatomical_studies_of_the_shoulder.jpg/600px-Leonardo_da_Vinci_-_Anatomical_studies_of_the_shoulder.jpg' WHERE id = 'seed_leonardodavinci_item_004';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Leonardo_da_Vinci_helicopter.jpg/500px-Leonardo_da_Vinci_helicopter.jpg' WHERE id = 'seed_leonardodavinci_item_005';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Salvator_Mundi%2C_Leonardo_da_Vinci%2C_1500.jpg/500px-Salvator_Mundi%2C_Leonardo_da_Vinci%2C_1500.jpg' WHERE id = 'seed_leonardodavinci_item_006';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Leonardo_da_Vinci_-_Lady_with_an_Ermine.jpg/500px-Leonardo_da_Vinci_-_Lady_with_an_Ermine.jpg' WHERE id = 'seed_leonardodavinci_item_007';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Leonardo_Codex_Leicester_water.jpg/500px-Leonardo_Codex_Leicester_water.jpg' WHERE id = 'seed_leonardodavinci_item_008';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Leonardo_da_vinci%2C_studio_di_drappeggio.jpg/500px-Leonardo_da_vinci%2C_studio_di_drappeggio.jpg' WHERE id = 'seed_leonardodavinci_item_009';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Leonardo_da_Vinci_-_Virgin_of_the_Rocks_%28National_Gallery%29.jpg/500px-Leonardo_da_Vinci_-_Virgin_of_the_Rocks_%28National_Gallery%29.jpg' WHERE id = 'seed_leonardodavinci_item_010';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Leonardo_Codex_birds_wings.jpg/500px-Leonardo_Codex_birds_wings.jpg' WHERE id = 'seed_leonardodavinci_item_011';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Leonardo_da_Vinci_-_St._John_the_Baptist.jpg/400px-Leonardo_da_Vinci_-_St._John_the_Baptist.jpg' WHERE id = 'seed_leonardodavinci_item_012';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Leonardo_ornithopter_drawing.jpg/500px-Leonardo_ornithopter_drawing.jpg' WHERE id = 'seed_leonardodavinci_item_013';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Leonardo_da_Vinci_-_Isabella_d%27Este.jpg/400px-Leonardo_da_Vinci_-_Isabella_d%27Este.jpg' WHERE id = 'seed_leonardodavinci_item_014';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Leonardo_da_Vinci_anatomical_skull.jpg/500px-Leonardo_da_Vinci_anatomical_skull.jpg' WHERE id = 'seed_leonardodavinci_item_015';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Ginevra_de%27_Benci_-_National_Gallery_of_Art.jpg/500px-Ginevra_de%27_Benci_-_National_Gallery_of_Art.jpg' WHERE id = 'seed_leonardodavinci_item_016';

-- ═══════════════════════════════════════════════════════════════
-- 16 — MARIE ANTOINETTE (profile 00000000-0000-0000-0000-000000000016)
-- ═══════════════════════════════════════════════════════════════
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Marie-Antoinette%2C_1775_-_Mus%C3%A9e_Antoine_L%C3%A9cuyer.jpg/500px-Marie-Antoinette%2C_1775_-_Mus%C3%A9e_Antoine_L%C3%A9cuyer.jpg' WHERE id = 'seed_marieantoinette_item_001';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Marie_Antoinette_Rose_Bertin_gown.jpg/400px-Marie_Antoinette_Rose_Bertin_gown.jpg' WHERE id = 'seed_marieantoinette_item_002';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Sevres_porcelain_Marie_Antoinette.jpg/400px-Sevres_porcelain_Marie_Antoinette.jpg' WHERE id = 'seed_marieantoinette_item_003';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Diamond_necklace_affair_replica.jpg/400px-Diamond_necklace_affair_replica.jpg' WHERE id = 'seed_marieantoinette_item_004';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Marie_Antoinette_rose_gold_watch.jpg/400px-Marie_Antoinette_rose_gold_watch.jpg' WHERE id = 'seed_marieantoinette_item_005';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/French_18th_century_fan_ivory.jpg/500px-French_18th_century_fan_ivory.jpg' WHERE id = 'seed_marieantoinette_item_006';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Petit_Trianon_Marie_Antoinette_boudoir.jpg/600px-Petit_Trianon_Marie_Antoinette_boudoir.jpg' WHERE id = 'seed_marieantoinette_item_007';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Vigee_LeBrun_Marie_Antoinette_roses.jpg/500px-Vigee_LeBrun_Marie_Antoinette_roses.jpg' WHERE id = 'seed_marieantoinette_item_008';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/French_rococo_commode_18th_century.jpg/500px-French_rococo_commode_18th_century.jpg' WHERE id = 'seed_marieantoinette_item_009';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Marie_Antoinette_pearl_necklace.jpg/400px-Marie_Antoinette_pearl_necklace.jpg' WHERE id = 'seed_marieantoinette_item_010';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Meissen_porcelain_18th_century_flowers.jpg/400px-Meissen_porcelain_18th_century_flowers.jpg' WHERE id = 'seed_marieantoinette_item_011';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Marie_Antoinette_miniature_portrait.jpg/300px-Marie_Antoinette_miniature_portrait.jpg' WHERE id = 'seed_marieantoinette_item_012';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Hameau_de_la_Reine_Versailles.jpg/600px-Hameau_de_la_Reine_Versailles.jpg' WHERE id = 'seed_marieantoinette_item_013';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Opera_royal_Versailles_interior.jpg/600px-Opera_royal_Versailles_interior.jpg' WHERE id = 'seed_marieantoinette_item_014';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/French_royal_harpsichord_18th.jpg/500px-French_royal_harpsichord_18th.jpg' WHERE id = 'seed_marieantoinette_item_015';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Miniature_portrait_snuffbox_18th.jpg/400px-Miniature_portrait_snuffbox_18th.jpg' WHERE id = 'seed_marieantoinette_item_016';

-- ═══════════════════════════════════════════════════════════════
-- 11 — BEETHOVEN (profile 00000000-0000-0000-0000-000000000011)
-- ═══════════════════════════════════════════════════════════════
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Beethoven.jpg/500px-Beethoven.jpg' WHERE id = 'seed_beethoven_item_001';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Beethoven_9th_symphony_manuscript.jpg/600px-Beethoven_9th_symphony_manuscript.jpg' WHERE id = 'seed_beethoven_item_002';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Beethoven_piano_broadwood.jpg/500px-Beethoven_piano_broadwood.jpg' WHERE id = 'seed_beethoven_item_003';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Beethoven_ear_trumpet.jpg/400px-Beethoven_ear_trumpet.jpg' WHERE id = 'seed_beethoven_item_004';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Beethoven_death_mask_Danhauser.jpg/400px-Beethoven_death_mask_Danhauser.jpg' WHERE id = 'seed_beethoven_item_005';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Beethoven_Ode_to_Joy_manuscript.jpg/600px-Beethoven_Ode_to_Joy_manuscript.jpg' WHERE id = 'seed_beethoven_item_006';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Antique_violin_18th_century.jpg/400px-Antique_violin_18th_century.jpg' WHERE id = 'seed_beethoven_item_007';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Haydn_portrait_Hardy.jpg/400px-Haydn_portrait_Hardy.jpg' WHERE id = 'seed_beethoven_item_008';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Beethoven_manuscript_sketches.jpg/600px-Beethoven_manuscript_sketches.jpg' WHERE id = 'seed_beethoven_item_009';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Classical_era_concert_hall.jpg/600px-Classical_era_concert_hall.jpg' WHERE id = 'seed_beethoven_item_010';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Beethoven_moonlight_sonata_first_edition.jpg/500px-Beethoven_moonlight_sonata_first_edition.jpg' WHERE id = 'seed_beethoven_item_011';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Antique_metronome_brass.jpg/400px-Antique_metronome_brass.jpg' WHERE id = 'seed_beethoven_item_012';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Mozart_portrait_Croce.jpg/400px-Mozart_portrait_Croce.jpg' WHERE id = 'seed_beethoven_item_013';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Beethoven_Heiligenstadt_testament.jpg/500px-Beethoven_Heiligenstadt_testament.jpg' WHERE id = 'seed_beethoven_item_014';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Fortepiano_Streicher_1815.jpg/500px-Fortepiano_Streicher_1815.jpg' WHERE id = 'seed_beethoven_item_015';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Beethoven_conversation_book.jpg/400px-Beethoven_conversation_book.jpg' WHERE id = 'seed_beethoven_item_016';

-- ═══════════════════════════════════════════════════════════════
-- 13 — BLACKBEARD (profile 00000000-0000-0000-0000-000000000013)
-- ═══════════════════════════════════════════════════════════════
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Blackbeard_the_pirate.jpg/500px-Blackbeard_the_pirate.jpg' WHERE id = 'seed_blackbeard_item_001';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Jolly_Roger_pirate_flag.jpg/500px-Jolly_Roger_pirate_flag.jpg' WHERE id = 'seed_blackbeard_item_002';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Flintlock_pistol_18th_century.jpg/600px-Flintlock_pistol_18th_century.jpg' WHERE id = 'seed_blackbeard_item_003';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Pirate_treasure_chest.jpg/500px-Pirate_treasure_chest.jpg' WHERE id = 'seed_blackbeard_item_004';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Spanish_doubloon_gold_coin.jpg/400px-Spanish_doubloon_gold_coin.jpg' WHERE id = 'seed_blackbeard_item_005';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Pirate_cutlass_18th_century.jpg/500px-Pirate_cutlass_18th_century.jpg' WHERE id = 'seed_blackbeard_item_006';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Antique_nautical_sextant.jpg/500px-Antique_nautical_sextant.jpg' WHERE id = 'seed_blackbeard_item_007';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Nautical_chart_18th_century.jpg/600px-Nautical_chart_18th_century.jpg' WHERE id = 'seed_blackbeard_item_008';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/18th_century_ship_cannon.jpg/600px-18th_century_ship_cannon.jpg' WHERE id = 'seed_blackbeard_item_009';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Antique_spyglass_telescope.jpg/400px-Antique_spyglass_telescope.jpg' WHERE id = 'seed_blackbeard_item_010';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Pirate_ship_Queen_Anne_Revenge.jpg/600px-Pirate_ship_Queen_Anne_Revenge.jpg' WHERE id = 'seed_blackbeard_item_011';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Pirate_musket_blunderbuss.jpg/500px-Pirate_musket_blunderbuss.jpg' WHERE id = 'seed_blackbeard_item_012';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Gold_bar_treasure.jpg/400px-Gold_bar_treasure.jpg' WHERE id = 'seed_blackbeard_item_013';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Pirate_rum_bottle_18th_century.jpg/400px-Pirate_rum_bottle_18th_century.jpg' WHERE id = 'seed_blackbeard_item_014';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Treasure_map_old_manuscript.jpg/500px-Treasure_map_old_manuscript.jpg' WHERE id = 'seed_blackbeard_item_015';
UPDATE vault_items SET image_front_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Maritime_compass_antique_brass.jpg/400px-Maritime_compass_antique_brass.jpg' WHERE id = 'seed_blackbeard_item_016';

-- ═══════════════════════════════════════════════════════════════
-- UPDATE public_profiles with bio (copy from profiles table)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public_profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public_profiles ADD COLUMN IF NOT EXISTS avatar_url text;

UPDATE public_profiles SET bio = p.bio
FROM profiles p
WHERE public_profiles.profile_id = p.id
  AND p.bio IS NOT NULL;

-- Hardcode bios for seed characters that may not have them in profiles yet
UPDATE public_profiles SET bio = 'The undisputed king of American finance. Morgan''s private collection spanned Old Masters, illuminated manuscripts, and ancient antiquities — assembled with the same ruthless precision he applied to cornering markets. His library alone contained over 10,000 rare books and manuscripts. If it was priceless, Morgan owned it.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000001';
UPDATE public_profiles SET bio = 'Newspaper baron. Castle builder. Collector of everything. Hearst filled San Simeon with art looted from European estates, Greek antiquities, Egyptian relics, and enough fine silver to supply a small kingdom. His motto: if you want it, buy it twice.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000002';
UPDATE public_profiles SET bio = 'The Commodore built his fortune on steam and steel, and spent it acquiring the finest coins, estate silver, and Old Master paintings money could buy. A ruthless negotiator in business; a meticulous curator in private.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000003';
UPDATE public_profiles SET bio = 'Six wives. One crown. Infinite appetites. Henry VIII''s collection of armor, illuminated manuscripts, royal tapestries, and jeweled relics was the envy of every court in Europe. He didn''t just collect — he confiscated, commissioned, and conquered his way to one of history''s great hoards.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000004';
UPDATE public_profiles SET bio = 'Aviator. Film mogul. Obsessive. Hughes spent his last decades locked away from the world, but his early years produced one of the most eclectic private collections ever assembled — prototype aircraft models, rare film reels, experimental instruments, and enough curiosities to fill a hangar.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000005';
UPDATE public_profiles SET bio = 'The man who lit the world. Tesla''s collection was an extension of his mind — rare scientific instruments, first-edition physics texts, handwritten patent drawings, and devices that were decades ahead of their time. He died with little money but a vault full of genius.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000006';
UPDATE public_profiles SET bio = 'Rome''s most notorious emperor didn''t just rule the ancient world — he collected it. Nero''s vaults held Greek sculptures plundered from Athens, rare gemstones, golden dinner services, and coins from every corner of the empire.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000007';
UPDATE public_profiles SET bio = 'Standard Oil built the fortune. The collection built the legacy. Rockefeller was a meticulous accumulator of rare stamps, fine art, and ancient artifacts — organized, catalogued, and appraised with the same discipline that made him the world''s first billionaire.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000008';
UPDATE public_profiles SET bio = 'The Qianlong Emperor ruled China for 60 years and spent much of that time acquiring the finest jade, imperial porcelain, and ancient bronzes the kingdom could produce. His collection of calligraphy and painting alone numbered in the thousands.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000009';
UPDATE public_profiles SET bio = 'The Sun King. Every object in Versailles was a political statement — a demonstration that France, and Louis, were the center of the civilized world. His collection of tapestries, royal portraits, ceremonial armor, and decorative arts set the standard for royal collecting that every European monarch spent the next century trying to match.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000010';
UPDATE public_profiles SET bio = 'Deaf by his late twenties. Still the greatest composer who ever lived. Beethoven''s collection of original scores, rare instruments, and correspondence with Europe''s musical elite told the full story of a mind that could not stop creating.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000011';
UPDATE public_profiles SET bio = 'Painter. Sculptor. Architect. Engineer. Anatomist. Leonardo da Vinci collected the world through observation — thousands of notebook pages, anatomical drawings, mechanical sketches, and studies of everything from water currents to the movement of wings.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000012';
UPDATE public_profiles SET bio = 'The most feared pirate in the Atlantic. Blackbeard''s legend grew with every ship he took — and so did his hoard. Gold coins from a dozen nations, navigational instruments, maps of uncharted routes, and weapons that were works of art in their own right.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000013';
UPDATE public_profiles SET bio = 'The greatest showman who ever lived. Barnum understood that the rarest thing isn''t an object — it''s a story. His collection of oddities, circus posters, sideshow artifacts, and theatrical memorabilia turned the bizarre into the beloved.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000014';
UPDATE public_profiles SET bio = 'The most famous lover in history left a paper trail. Letters, miniature portraits, jewelry gifted and received, fashion accessories from every city in Europe, and a library of correspondence that mapped the social world of 18th-century aristocracy.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000015';
UPDATE public_profiles SET bio = 'Queen of Versailles. Patron of fashion. History''s most famous collector of the beautiful and the excessive. Marie Antoinette''s jewels were legendary — diamonds, sapphires, and pearl ropes that sparked a revolution.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000016';
UPDATE public_profiles SET bio = 'The first musician. Orpheus could move rivers with his lyre, charm stones into walls, and lead the dead back to the living. His collection spans every instrument ever made in his honor and artifacts from the edge of the underworld.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000017';
UPDATE public_profiles SET bio = 'The dealer of deals. Rumplestiltskin has been collecting favors, artifacts, and cursed objects longer than most civilizations have existed. Everything has value. Everything can be traded. The question is what you''re willing to give up.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000018';
UPDATE public_profiles SET bio = 'Professor of archaeology. Adventurer of questionable ethics. Has pulled artifacts from French caves, outrun three governments, and written six academic papers the university quietly buried. His collection belongs in a museum. It does not live in a museum.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000019';
UPDATE public_profiles SET bio = 'No one knows his real name. The Phantom of the Paris Opera spent thirty years beneath the stage composing in secret and collecting everything the surface world discarded — musical scores, architectural plans, masks of every style, and mechanical curiosities he built with his own hands.'
  WHERE profile_id = '00000000-0000-0000-0000-000000000020';
