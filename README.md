# Social App (Mini Facebook)

A learning project: a small social network backend on PostgreSQL, built one
exercise at a time.

## Progress

| Exercise | Table | Concepts | Status |
|---|---|---|---|
| 1 | `users` | Data types, primary key, `NOT NULL`, `UNIQUE`, `DEFAULT`, NULL vs `''` | ✅ |
| 2 | `posts` | Foreign keys, `ON DELETE`, `CHECK`, nesting functions, normalization | ✅ |
| 3 | `likes` | Many-to-many, join tables, composite primary keys, cascade chains | ✅ |
| 4 | `comments` | Putting it together: two foreign keys, `CHECK`, `ON DELETE`, nullable foreign keys | ✅ |
| 5 | `friendships` | Self-referencing tables, ENUM types, multi-column `CHECK`, unique index on expressions | ✅ |

Later: a Node + Express API and authentication.

## Set up the database

```bash
psql -U postgres -c "CREATE ROLE minifb LOGIN PASSWORD 'minifb'" -c "CREATE DATABASE minifb OWNER minifb"
psql -U minifb -h localhost -d minifb -f db/schema.sql
```

Handy psql commands: `\dt` list tables, `\d posts` describe a table, `\q` quit.

## Tables

```
users ──< posts
users ──< likes    >── posts
users ──< comments >── posts
```
`likes` and `comments` sit between `users` and `posts`: each row is one user
liking, or commenting on, one post.

```
users ──< friendships >── users
```
`friendships` links two users: `sender_id` sent the request, `receiver_id`
received it, and `status` is `pending` or `accepted`.
`─<` means "one to many": one user has many posts.
