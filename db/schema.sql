-- Mini Facebook: database schema
-- Run with:  psql -U minifb -h localhost -d minifb -f db/schema.sql
--
-- Drop in reverse dependency order so re-running this file starts clean.
-- (A table can't be dropped while another table's foreign key points at it.)
SET client_min_messages = warning;  -- hide "does not exist, skipping" notices
DROP TABLE IF EXISTS likes, comments, friendships, posts, users CASCADE;
DROP TYPE  IF EXISTS friendship_status;

-- ─── users ──────────────────────────────────────────────────────────────
CREATE TABLE users (
  -- IDENTITY is the modern, SQL-standard replacement for SERIAL.
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT        NOT NULL,
  display_name  TEXT        NOT NULL CHECK (length(display_name) BETWEEN 1 AND 50),
  password_hash TEXT        NOT NULL,          -- never store the raw password
  bio           TEXT,                          -- NULL = "not filled in"
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Emails are case-insensitive in practice: Bob@x.com and bob@x.com are the
-- same person. A unique index on lower(email) enforces that.
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

-- ─── posts ──────────────────────────────────────────────────────────────
CREATE TABLE posts (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Foreign key: every post must belong to a real user.
  -- ON DELETE CASCADE: deleting a user deletes their posts too.
  author_id  BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The feed asks "posts by these authors, newest first" constantly.
-- This index matches that question exactly.
CREATE INDEX posts_author_created_idx ON posts (author_id, created_at DESC);

-- ─── comments ───────────────────────────────────────────────────────────
CREATE TABLE comments (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id    BIGINT      NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_post_created_idx ON comments (post_id, created_at);

-- ─── likes ──────────────────────────────────────────────────────────────
-- A "join table" for the many-to-many relationship users <-> posts.
-- The composite primary key makes it impossible to like the same post twice.
CREATE TABLE likes (
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    BIGINT      NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
-- The PK index starts with user_id, so "how many likes does post X have?"
-- needs its own index starting with post_id.
CREATE INDEX likes_post_idx ON likes (post_id);

-- ─── friendships ────────────────────────────────────────────────────────
-- An ENUM restricts a column to a fixed set of values.
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted');

CREATE TABLE friendships (
  requester_id BIGINT            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id BIGINT            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       friendship_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ       NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)       -- can't befriend yourself
);
-- The PK stops Alice->Bob twice, but not Alice->Bob AND Bob->Alice.
-- Indexing the (smaller id, larger id) pair treats both directions as one.
CREATE UNIQUE INDEX friendships_pair_key
  ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
CREATE INDEX friendships_addressee_idx ON friendships (addressee_id);
