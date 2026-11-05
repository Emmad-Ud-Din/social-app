-- Social App schema, written exercise by exercise.
-- Run with:  psql -U minifb -h localhost -d minifb -f db/schema.sql

-- Exercise 1: users
CREATE TABLE users(
     id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     email TEXT NOT NULL UNIQUE,
     display_name TEXT NOT NULL,
     password_hash TEXT NOT NULL,
     bio TEXT,
     date_created TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exercise 2: posts
CREATE TABLE posts(
user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
body     TEXT  NOT NULL CHECK (length(trim(body)) BETWEEN 10 AND 500),
time_created TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exercise 3: likes
CREATE TABLE likes(
user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
post_id BIGINT  NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
PRIMARY KEY (user_id, post_id),
time_created TIMESTAMPTZ NOT NULL DEFAULT now()
);
