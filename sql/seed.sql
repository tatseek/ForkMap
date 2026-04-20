-- ============================================================
-- Seed Data  (Indian Cities: Bengaluru, Mumbai, Delhi,
--             Chennai, Hyderabad)
-- ============================================================
USE restaurant_finder;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE restaurant_nodes;
TRUNCATE TABLE graph_edges;
TRUNCATE TABLE graph_nodes;
TRUNCATE TABLE restaurants;
TRUNCATE TABLE cuisines;
SET FOREIGN_KEY_CHECKS = 1;

-- ── Cuisines ──────────────────────────────────────────────────
INSERT INTO cuisines (name, emoji) VALUES
  ('Indian',       '🍛'),   -- 1
  ('South Indian', '🥘'),   -- 2
  ('Chinese',      '🥡'),   -- 3
  ('Mughlai',      '🫕'),   -- 4
  ('Biryani',      '🍚'),   -- 5
  ('Street Food',  '🌯'),   -- 6
  ('American',     '🍔'),   -- 7
  ('Seafood',      '🦞'),   -- 8
  ('Thai',         '🍜'),   -- 9
  ('Italian',      '🍝');   -- 10

-- ── Restaurants ───────────────────────────────────────────────
-- Bengaluru (IDs 1–6, near MG Road / Brigade Road)
INSERT INTO restaurants (name, cuisine_id, latitude, longitude, rating, review_count, price_range, address) VALUES
  ('Karavalli',              2, 12.9662, 77.6035, 4.7, 3210, 4, 'The Gateway Hotel, Residency Rd, Bengaluru'),
  ('Toit Brewpub',           7, 12.9715, 77.6088, 4.5, 5840, 3, '298 100 Feet Rd, Indiranagar, Bengaluru'),
  ('Meghana Foods',          5, 12.9702, 77.6079, 4.6, 7320, 2, '107 Residency Rd, Brigade Rd, Bengaluru'),
  ('AB\'s - Absolute Barbecues', 1, 12.9720, 77.6165, 4.3, 4110, 3, 'UB City Mall, Vittal Mallya Rd, Bengaluru'),
  ('Koshy\'s Restaurant',    1, 12.9752, 77.5953, 4.4, 2980, 2, '39 St Marks Rd, Bengaluru'),
  ('Fatty Bao',              3, 12.9683, 77.5997, 4.3, 2100, 3, '17 Lavelle Rd, Bengaluru');

-- Mumbai (IDs 7–12)
INSERT INTO restaurants (name, cuisine_id, latitude, longitude, rating, review_count, price_range, address) VALUES
  ('Britannia & Co',         1, 18.9322, 72.8356, 4.8, 4560, 2, 'Wakefield House, Sprott Rd, Ballard Estate, Mumbai'),
  ('Trishna',                8, 18.9341, 72.8325, 4.7, 3870, 4, '7 Sai Baba Marg, Kala Ghoda, Fort, Mumbai'),
  ('Cafe Mondegar',          7, 18.9224, 72.8316, 4.2, 6120, 2, 'Metro House, Colaba Causeway, Mumbai'),
  ('Bade Miya',              6, 18.9210, 72.8320, 4.4, 8900, 1, 'Tulloch Rd, Behind Taj Hotel, Colaba, Mumbai'),
  ('Swati Snacks',           2, 18.9663, 72.8118, 4.6, 5230, 2, 'Tejpal Scheme Rd, Tardeo, Mumbai'),
  ('Leopold Cafe',           1, 18.9217, 72.8313, 4.3, 7640, 2, 'Colaba Causeway, Mumbai');

-- Delhi (IDs 13–18)
INSERT INTO restaurants (name, cuisine_id, latitude, longitude, rating, review_count, price_range, address) VALUES
  ('Bukhara',                4, 28.5977, 77.1705, 4.8, 5120, 4, 'ITC Maurya, Sardar Patel Marg, Diplomatic Enclave, Delhi'),
  ('Karim\'s',               4, 28.6507, 77.2330, 4.7, 9870, 2, '16 Jama Masjid, Gali Kababian, Old Delhi'),
  ('Paranthe Wali Gali',     6, 28.6556, 77.2283, 4.5, 6340, 1, 'Gali Paranthe Wali, Chandni Chowk, Delhi'),
  ('Indian Accent',          1, 28.5982, 77.2017, 4.9, 3210, 4, 'The Lodhi Hotel, Lodhi Rd, Delhi'),
  ('SodaBottleOpenerWala',   1, 28.5989, 77.2253, 4.4, 4450, 2, '73 Khan Market, Delhi'),
  ('Moti Mahal',             4, 28.6422, 77.2215, 4.5, 7230, 2, '3703 Netaji Subhash Marg, Daryaganj, Delhi');

-- Chennai (IDs 19–24)
INSERT INTO restaurants (name, cuisine_id, latitude, longitude, rating, review_count, price_range, address) VALUES
  ('Murugan Idli Shop',      2, 13.0418, 80.2341, 4.7, 11200, 1, '77 GN Chetty Rd, T Nagar, Chennai'),
  ('Dakshin',                2, 13.0524, 80.2525, 4.6, 3890,  3, 'ITC Grand Chola, Mount Rd, Chennai'),
  ('Peshwari',               4, 13.0578, 80.2486, 4.5, 2760,  4, 'ITC Grand Chola, Anna Salai, Chennai'),
  ('Saravana Bhavan',        2, 13.0750, 80.2742, 4.4, 15600, 1, '21 George Town, Chennai'),
  ('The Marina Kitchen',     8, 13.0488, 80.2818, 4.3, 1980,  3, 'Marriott Hotel, Marina Beach Rd, Chennai'),
  ('Junior Kuppanna',        2, 13.0263, 80.2138, 4.5, 8740,  2, '130 Arcot Rd, Vadapalani, Chennai');

-- Hyderabad (IDs 25–30)
INSERT INTO restaurants (name, cuisine_id, latitude, longitude, rating, review_count, price_range, address) VALUES
  ('Paradise Biryani',       5, 17.4318, 78.4717, 4.7, 18900, 2, 'SD Rd, Secunderabad, Hyderabad'),
  ('Chutneys',               2, 17.4374, 78.4484, 4.5, 7620,  2, 'Road No 1, Banjara Hills, Hyderabad'),
  ('Peshawariya',            4, 17.4156, 78.4479, 4.6, 4310,  3, 'Rd No 12, Banjara Hills, Hyderabad'),
  ('Bawarchi Restaurant',    5, 17.4399, 78.4805, 4.4, 12400, 2, 'RTC X Rd, Musheerabad, Hyderabad'),
  ('Shah Ghouse Cafe',       6, 17.3616, 78.4743, 4.5, 9870,  1, 'Tolichowki, Hyderabad'),
  ('Meridian Restaurant',    1, 17.3850, 78.4867, 4.3, 3200,  2, 'Himayatnagar, Hyderabad');

-- ── Graph nodes (street intersections — Bengaluru Central) ────
INSERT INTO graph_nodes (label, latitude, longitude) VALUES
  ('MG Road & Trinity Circle',        12.9754, 77.6207),  -- 1
  ('MG Road & Halasuru Metro',        12.9722, 77.6168),  -- 2
  ('MG Road & Brigade Road',          12.9716, 77.6090),  -- 3
  ('Brigade Road & Church Street',    12.9705, 77.6082),  -- 4
  ('Church Street & Residency Road',  12.9695, 77.6068),  -- 5
  ('Residency Road & Richmond Road',  12.9662, 77.6033),  -- 6
  ('Richmond Road & Lavelle Road',    12.9683, 77.5998),  -- 7
  ('Lavelle Road & MG Road',          12.9703, 77.5975),  -- 8
  ('MG Road & Cubbon Road',           12.9754, 77.5951),  -- 9
  ('Infantry Road & Cubbon Park',     12.9807, 77.5950),  -- 10
  ('Queens Road & Cubbon Park',       12.9832, 77.5962),  -- 11
  ('Cunningham Road & Queens Road',   12.9857, 77.5940);  -- 12

-- ── Graph edges ───────────────────────────────────────────────
-- MG Road corridor (east-west)
INSERT INTO graph_edges (node_from, node_to, weight, road_name) VALUES
  (1,2,552,'MG Road'),(2,1,552,'MG Road'),
  (2,3,847,'MG Road'),(3,2,847,'MG Road'),
  (3,9,1150,'MG Road'),(9,3,1150,'MG Road'),
  (9,10,590,'Cubbon Road'),(10,9,590,'Cubbon Road');

-- Brigade Road / Church Street corridor (north-south)
INSERT INTO graph_edges (node_from, node_to, weight, road_name) VALUES
  (3,4,149,'Brigade Road'),(4,3,149,'Brigade Road'),
  (4,5,188,'Church Street'),(5,4,188,'Church Street'),
  (5,6,503,'Residency Road'),(6,5,503,'Residency Road');

-- Richmond / Lavelle loop
INSERT INTO graph_edges (node_from, node_to, weight, road_name) VALUES
  (6,7,443,'Richmond Road'),(7,6,443,'Richmond Road'),
  (7,8,295,'Lavelle Road'),(8,7,295,'Lavelle Road'),
  (8,9,645,'MG Road'),(9,8,645,'MG Road');

-- Northern routes (Cunningham / Queens Road)
INSERT INTO graph_edges (node_from, node_to, weight, road_name) VALUES
  (10,11,307,'Queens Road'),(11,10,307,'Queens Road'),
  (11,12,365,'Cunningham Road'),(12,11,365,'Cunningham Road'),
  (9,12,955,'Cubbon Park Road'),(12,9,955,'Cubbon Park Road');

-- Cross connections for routing flexibility
INSERT INTO graph_edges (node_from, node_to, weight, road_name) VALUES
  (2,5,490,'St Marks Road'),(5,2,490,'St Marks Road'),
  (8,6,420,'Residency Road'),(6,8,420,'Residency Road');

-- ── Restaurant → nearest graph node (Bengaluru only) ─────────
INSERT INTO restaurant_nodes VALUES
  (1, 6),   -- Karavalli      → Residency & Richmond
  (2, 3),   -- Toit Brewpub   → MG Road & Brigade Road
  (3, 4),   -- Meghana Foods  → Brigade & Church Street
  (4, 2),   -- AB's           → MG Road & Halasuru
  (5, 9),   -- Koshy's        → MG Road & Cubbon Road
  (6, 7);   -- Fatty Bao      → Richmond & Lavelle
