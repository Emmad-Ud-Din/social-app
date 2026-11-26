-- Sample data for practising queries. Run after schema.sql.
-- Times are relative to now() so "newest first" is predictable.

-- Every sample user's password is password123. The value stored is its bcrypt
-- hash (made with bcryptjs, cost 10), never the password itself.
INSERT INTO users (email, display_name, password_hash, bio) VALUES
  ('ann@mail.com',  'Ann',  '$2b$10$A27iaV9ZNzxhrGKWcO5X3egJ8687QsOfLSyFWXeIg32.nPkMOR6iG', 'Coffee and climbing'),   -- 1
  ('ben@mail.com',  'Ben',  '$2b$10$A27iaV9ZNzxhrGKWcO5X3egJ8687QsOfLSyFWXeIg32.nPkMOR6iG', NULL),                    -- 2
  ('cara@mail.com', 'Cara', '$2b$10$A27iaV9ZNzxhrGKWcO5X3egJ8687QsOfLSyFWXeIg32.nPkMOR6iG', 'Photographer'),          -- 3
  ('dev@mail.com',  'Dev',  '$2b$10$A27iaV9ZNzxhrGKWcO5X3egJ8687QsOfLSyFWXeIg32.nPkMOR6iG', NULL),                    -- 4
  ('eve@mail.com',  'Eve',  '$2b$10$A27iaV9ZNzxhrGKWcO5X3egJ8687QsOfLSyFWXeIg32.nPkMOR6iG', 'Just joined');           -- 5

INSERT INTO friendships (sender_id, receiver_id, status) VALUES
  (1, 2, 'accepted'),   -- Ann & Ben are friends
  (3, 1, 'accepted'),   -- Cara & Ann are friends
  (4, 1, 'pending'),    -- Dev has asked Ann, not answered yet
  (2, 4, 'accepted'),   -- Ben & Dev are friends
  (5, 3, 'pending');    -- Eve has asked Cara

INSERT INTO posts (user_id, body, time_created) VALUES
  (1, 'Hello world, my first post!',         now() - interval '5 days'),   -- 1
  (2, 'Anyone up for football Saturday?',    now() - interval '4 days'),   -- 2
  (3, 'New photo series is live on my page', now() - interval '3 days'),   -- 3
  (4, 'Dev here, just learning SQL',         now() - interval '2 days'),   -- 4
  (1, 'Climbing trip this weekend',          now() - interval '1 day'),    -- 5
  (3, 'Golden hour at the beach today',      now() - interval '5 hours'),  -- 6
  (5, 'Is this thing working? Hello?',       now() - interval '1 hour');   -- 7

INSERT INTO likes (user_id, post_id) VALUES
  (2, 1), (3, 1),           -- post 1: 2 likes
  (1, 3), (2, 3), (4, 3),   -- post 3: 3 likes
  (1, 6),                   -- post 6: 1 like
  (4, 2);                   -- post 2: 1 like

INSERT INTO comments (user_id, post_id, body) VALUES
  (2, 1, 'Welcome to the site!'),
  (3, 1, 'Glad you made it here'),
  (1, 3, 'These photos are stunning'),
  (2, 5, 'Bring me back a souvenir');
