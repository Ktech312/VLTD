-- VLTD Seed Character Images — v4 — 33 Verified Met Museum URLs
-- UUID rotation: (('x'||substr(id::text,1,8))::bit(32)::int & 127) % N
-- 8-12 images per character → each image repeats only 3-5x across 40 items

-- GALLERY COVERS
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/ep/web-large/DP-16323-001.jpg' WHERE profile_id='00000000-0000-0000-0000-000000000001';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/ep/web-large/DP145921.jpg'     WHERE profile_id='00000000-0000-0000-0000-000000000002';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/as/web-large/DP123353.jpg'     WHERE profile_id='00000000-0000-0000-0000-000000000003';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/aa/web-large/DP160368.jpg'     WHERE profile_id='00000000-0000-0000-0000-000000000004';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/aa/web-large/LC-1992_330_1_2-005.jpg' WHERE profile_id='00000000-0000-0000-0000-000000000005';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/md/web-large/DP160636.jpg'     WHERE profile_id='00000000-0000-0000-0000-000000000006';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/gr/web-large/DP333080.jpg'     WHERE profile_id='00000000-0000-0000-0000-000000000007';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/ep/web-large/DP145912.jpg'     WHERE profile_id='00000000-0000-0000-0000-000000000008';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/as/web-large/DP350410.jpg'     WHERE profile_id='00000000-0000-0000-0000-000000000009';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/es/web-large/DP105712.jpg'     WHERE profile_id='00000000-0000-0000-0000-000000000010';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/mi/web-large/DP163308.jpg'     WHERE profile_id='00000000-0000-0000-0000-000000000011';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/cl/web-large/DP233162.jpg'     WHERE profile_id='00000000-0000-0000-0000-000000000012';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/aa/web-large/DP-18838-005.jpg' WHERE profile_id='00000000-0000-0000-0000-000000000013';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/ep/web-large/DP145912.jpg'     WHERE profile_id='00000000-0000-0000-0000-000000000014';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/es/web-large/DP105328.jpg'     WHERE profile_id='00000000-0000-0000-0000-000000000015';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/es/web-large/DP155617.jpg'     WHERE profile_id='00000000-0000-0000-0000-000000000016';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/mi/web-large/DP230434.jpg'     WHERE profile_id='00000000-0000-0000-0000-000000000017';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/cl/web-large/DP-20629-001.jpg' WHERE profile_id='00000000-0000-0000-0000-000000000018';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/gr/web-large/DT11659.jpg'      WHERE profile_id='00000000-0000-0000-0000-000000000019';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/es/web-large/DP250149.jpg'     WHERE profile_id='00000000-0000-0000-0000-000000000020';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/mi/web-large/DP163308.jpg'     WHERE profile_id='00000000-0000-0000-0000-000000000021';
UPDATE galleries SET cover_image='https://images.metmuseum.org/CRDImages/ep/web-large/DP-16323-001.jpg' WHERE profile_id='00000000-0000-0000-0000-000000000022';

-- VAULT ITEMS — 9 images per character average

-- J.P. MORGAN (01) — paintings, manuscripts, antiquities (9 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%9
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP-16323-001.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DT5343.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/cl/web-large/DP233162.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145912.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/cl/web-large/DP-20629-001.jpg'
  WHEN 5 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145921.jpg'
  WHEN 6 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DP160636.jpg'
  WHEN 7 THEN 'https://images.metmuseum.org/CRDImages/is/web-large/sf19-196-6a.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/md/web-large/sf1981-322s1.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000001';

-- WILLIAM RANDOLPH HEARST (02) — paintings, manuscripts, sculpture (8 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%8
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145921.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP-16323-001.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145912.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/gr/web-large/DT11659.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DT5343.jpg'
  WHEN 5 THEN 'https://images.metmuseum.org/CRDImages/gr/web-large/DP333080.jpg'
  WHEN 6 THEN 'https://images.metmuseum.org/CRDImages/cl/web-large/DP233162.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/md/web-large/DP160636.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000002';

-- CORNELIUS VANDERBILT (03) — coins, silver, paintings (7 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%7
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/as/web-large/DP123353.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/as/web-large/99_35_3025.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145921.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145912.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/es/web-large/DP105712.jpg'
  WHEN 5 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP-16323-001.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/es/web-large/DP105328.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000003';

-- KING HENRY VIII (04) — armor, manuscripts, portraits (10 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%10
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/aa/web-large/DP160368.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/aa/web-large/DP-36206-003.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/aa/web-large/DP237081.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DT5343.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/aa/web-large/DT5334.jpg'
  WHEN 5 THEN 'https://images.metmuseum.org/CRDImages/cl/web-large/DP233162.jpg'
  WHEN 6 THEN 'https://images.metmuseum.org/CRDImages/aa/web-large/DP-18838-005.jpg'
  WHEN 7 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/sf1981-322s1.jpg'
  WHEN 8 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145912.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/aa/web-large/DP160338.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000004';

-- HOWARD HUGHES (05) — weapons, portraits, manuscripts (6 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%6
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/aa/web-large/LC-1992_330_1_2-005.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145921.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/aa/web-large/DP160368.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145912.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/es/web-large/DP250149.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/md/web-large/DT5343.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000005';

-- NIKOLA TESLA (06) — manuscripts, drawings (6 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%6
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DT5343.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/cl/web-large/DP-20629-001.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/is/web-large/sf19-196-6a.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DP160636.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/cl/web-large/DP233162.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/md/web-large/sf1981-322s1.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000006';

-- EMPEROR NERO (07) — Roman sculpture, coins, portraits (7 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%7
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/gr/web-large/DP333080.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/gr/web-large/DT11659.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/as/web-large/DP123353.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/es/web-large/DP250149.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/as/web-large/99_35_3025.jpg'
  WHEN 5 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145921.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/aa/web-large/DP160368.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000007';

-- JOHN D. ROCKEFELLER (08) — paintings, manuscripts (8 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%8
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP-16323-001.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145921.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145912.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DT5343.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/gr/web-large/DT11659.jpg'
  WHEN 5 THEN 'https://images.metmuseum.org/CRDImages/cl/web-large/DP233162.jpg'
  WHEN 6 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DP160636.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/gr/web-large/DP333080.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000008';

-- EMPEROR QIANLONG (09) — Chinese porcelain, jade (7 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%7
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/as/web-large/37_191_8_S1_sf.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/as/web-large/DP350410.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/as/web-large/32_100_432_O1_sf.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/as/web-large/DP-14153-068.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/as/web-large/14_40_418_sf.jpg'
  WHEN 5 THEN 'https://images.metmuseum.org/CRDImages/as/web-large/DP-24604-001.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/as/web-large/201712.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000009';

-- KING LOUIS XIV (10) — French decorative arts, armor, portraits (8 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%8
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/es/web-large/DP105712.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/es/web-large/DP105328.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/es/web-large/DP155617.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/aa/web-large/DP160368.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145921.jpg'
  WHEN 5 THEN 'https://images.metmuseum.org/CRDImages/aa/web-large/DP237081.jpg'
  WHEN 6 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145912.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/es/web-large/DP250149.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000010';

-- BEETHOVEN (11) — instruments, manuscripts, portraits (8 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%8
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/mi/web-large/DP163308.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/mi/web-large/DP230434.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DT5343.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/cl/web-large/DP233162.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DP160636.jpg'
  WHEN 5 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145912.jpg'
  WHEN 6 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/sf1981-322s1.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/ep/web-large/DP145921.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000011';

-- LEONARDO DA VINCI (12) — manuscripts, paintings, drawings (8 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%8
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/cl/web-large/DP233162.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP-16323-001.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DT5343.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/cl/web-large/DP-20629-001.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145921.jpg'
  WHEN 5 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DP160636.jpg'
  WHEN 6 THEN 'https://images.metmuseum.org/CRDImages/is/web-large/sf19-196-6a.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/ep/web-large/DP145912.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000012';

-- BLACKBEARD (13) — weapons, coins, nautical (8 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%8
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/aa/web-large/LC-1992_330_1_2-005.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/aa/web-large/DP160338.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/as/web-large/DP123353.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/aa/web-large/DP237081.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/as/web-large/99_35_3025.jpg'
  WHEN 5 THEN 'https://images.metmuseum.org/CRDImages/aa/web-large/DP160368.jpg'
  WHEN 6 THEN 'https://images.metmuseum.org/CRDImages/aa/web-large/DP-18838-005.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/aa/web-large/DT5334.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000013';

-- P.T. BARNUM (14) — portraits, sculpture, curiosities (6 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%6
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145912.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP-16323-001.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/es/web-large/DP250149.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/gr/web-large/DT11659.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145921.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/gr/web-large/DP333080.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000014';

-- CASANOVA (15) — European art, French decorative, manuscripts (8 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%8
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/es/web-large/DP105328.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145912.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/es/web-large/DP105712.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DT5343.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/aa/web-large/LC-1992_330_1_2-005.jpg'
  WHEN 5 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145921.jpg'
  WHEN 6 THEN 'https://images.metmuseum.org/CRDImages/is/web-large/sf19-196-6a.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/es/web-large/DP155617.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000015';

-- MARIE ANTOINETTE (16) — French decorative arts, jewelry (6 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%6
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/es/web-large/DP155617.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/es/web-large/DP105712.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/es/web-large/DP105328.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145912.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/es/web-large/DP250149.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/ep/web-large/DP145921.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000016';

-- ORPHEUS (17) — instruments, ancient art, manuscripts (8 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%8
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/mi/web-large/DP230434.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/mi/web-large/DP163308.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/gr/web-large/DT11659.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DT5343.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/cl/web-large/DP-20629-001.jpg'
  WHEN 5 THEN 'https://images.metmuseum.org/CRDImages/gr/web-large/DP333080.jpg'
  WHEN 6 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DP160636.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/cl/web-large/DP233162.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000017';

-- RUMPLESTILTSKIN (18) — manuscripts, gold, magical (6 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%6
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/cl/web-large/DP-20629-001.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/as/web-large/DP123353.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DT5343.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/is/web-large/sf19-196-6a.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DP160636.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/as/web-large/99_35_3025.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000018';

-- WALTON J. JR. (19) — ancient artifacts, relics, archaeology (8 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%8
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/gr/web-large/DT11659.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/as/web-large/DP123353.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/gr/web-large/DP333080.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DT5343.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/as/web-large/99_35_3025.jpg'
  WHEN 5 THEN 'https://images.metmuseum.org/CRDImages/cl/web-large/DP-20629-001.jpg'
  WHEN 6 THEN 'https://images.metmuseum.org/CRDImages/es/web-large/DP250149.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/md/web-large/sf1981-322s1.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000019';

-- ERIK THE PHANTOM (20) — theatrical, musical, manuscripts (6 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%6
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/mi/web-large/DP163308.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/es/web-large/DP250149.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/cl/web-large/DP233162.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DT5343.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/mi/web-large/DP230434.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/md/web-large/DP160636.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000020';

-- SOLOMON KING (21) — blues instruments, manuscripts (5 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%5
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/mi/web-large/DP163308.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/mi/web-large/DP230434.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145912.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/md/web-large/DT5343.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/is/web-large/sf19-196-6a.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000021';

-- KAI STERLING (22) — modern collectibles, portraits, sculpture (6 images)
UPDATE vault_items SET image_front_url=CASE(('x'||substr(id::text,1,8))::bit(32)::int&127)%6
  WHEN 0 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP-16323-001.jpg'
  WHEN 1 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145921.jpg'
  WHEN 2 THEN 'https://images.metmuseum.org/CRDImages/ep/web-large/DP145912.jpg'
  WHEN 3 THEN 'https://images.metmuseum.org/CRDImages/es/web-large/DP250149.jpg'
  WHEN 4 THEN 'https://images.metmuseum.org/CRDImages/gr/web-large/DT11659.jpg'
  ELSE        'https://images.metmuseum.org/CRDImages/gr/web-large/DP333080.jpg'
END WHERE profile_id='00000000-0000-0000-0000-000000000022';
