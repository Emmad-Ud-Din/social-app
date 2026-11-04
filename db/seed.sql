-- Sample data. Run after schema.sql.
-- The password hashes are placeholders; the API (lesson 2) will make real ones.
INSERT INTO users (email, display_name, password_hash, bio) VALUES
  ('alice@example.com', 'Alice', 'x', 'Coffee and climbing'),
  ('bob@example.com',   'Bob',   'x', NULL),
  ('cara@example.com',  'Cara',  'x', 'Photographer'),
  ('dan@example.com',   'Dan',   'x', NULL);

-- Alice & Bob are friends, Alice & Cara are friends, Dan has asked Alice.
INSERT INTO friendships (requester_id, addressee_id, status) VALUES
  (1, 2, 'accepted'),
  (3, 1, 'accepted'),
  (4, 1, 'pending');

INSERT INTO posts (author_id, body, created_at) VALUES
  (1, 'Hello world, first post!',          now() - interval '3 days'),
  (2, 'Anyone up for football Saturday?',  now() - interval '2 days'),
  (3, 'New photo series is live',          now() - interval '1 day'),
  (4, 'Dan here, just joined',             now() - interval '5 hours'),
  (1, 'Learning Postgres today',           now() - interval '1 hour');

INSERT INTO likes (user_id, post_id) VALUES (2, 1), (3, 1), (1, 3), (2, 5);

INSERT INTO comments (post_id, author_id, body) VALUES
  (1, 2, 'Welcome!'),
  (5, 3, 'Good luck, it is worth it');
