-- Practice queries. Run one at a time in psql and read the output.

-- 1. Alice's friends (user 1). A friendship row can point either way,
--    so we pick "the other person" with CASE.
SELECT u.id, u.display_name
FROM friendships f
JOIN users u
  ON u.id = CASE WHEN f.requester_id = 1 THEN f.addressee_id ELSE f.requester_id END
WHERE 1 IN (f.requester_id, f.addressee_id)
  AND f.status = 'accepted';

-- 2. Alice's news feed: her posts + her friends' posts, newest first,
--    with like and comment counts.
WITH friend_ids AS (                       -- CTE: a named sub-result
  SELECT CASE WHEN requester_id = 1 THEN addressee_id ELSE requester_id END AS id
  FROM friendships
  WHERE 1 IN (requester_id, addressee_id) AND status = 'accepted'
)
SELECT p.id,
       u.display_name AS author,
       p.body,
       p.created_at,
       (SELECT count(*) FROM likes    l WHERE l.post_id = p.id) AS like_count,
       (SELECT count(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
       EXISTS (SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = 1) AS liked_by_me
FROM posts p
JOIN users u ON u.id = p.author_id
WHERE p.author_id = 1 OR p.author_id IN (SELECT id FROM friend_ids)
ORDER BY p.created_at DESC
LIMIT 20;

-- 3. Pending friend requests sent TO Alice.
SELECT u.display_name, f.created_at
FROM friendships f JOIN users u ON u.id = f.requester_id
WHERE f.addressee_id = 1 AND f.status = 'pending';

-- 4. Accept Dan's request (an UPDATE).
-- UPDATE friendships SET status = 'accepted' WHERE requester_id = 4 AND addressee_id = 1;

-- 5. Constraints in action - each of these should FAIL. Try them!
-- INSERT INTO likes (user_id, post_id) VALUES (2, 1);                 -- duplicate like
-- INSERT INTO friendships (requester_id, addressee_id) VALUES (2, 1); -- reverse duplicate
-- INSERT INTO posts (author_id, body) VALUES (999, 'ghost');          -- no such user
-- INSERT INTO users (email, display_name, password_hash)
--   VALUES ('ALICE@example.com', 'Imposter', 'x');                    -- email case-insensitive

-- 6. See how Postgres plans a query (does it use our index?).
EXPLAIN SELECT * FROM posts WHERE author_id = 1 ORDER BY created_at DESC;
