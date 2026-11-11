# Social App (Mini Facebook)

A learning project: a small social network backend with PostgreSQL and a
Node + Express API, built one exercise at a time.

```
db/
  schema.sql     tables, constraints and indexes
  seed.sql       sample data (Ann, Ben, Cara, Dev, Eve)
  queries.sql    practice queries, up to the news feed
src/
  index.js       the Express API and its routes
  db.js          the Postgres connection pool
.env.example     template for .env (never commit .env)
```

## Setup

Requires PostgreSQL and Node.js 20.6 or newer.

**1. Create the database** (once):

```bash
psql -U postgres -c "CREATE ROLE minifb LOGIN PASSWORD 'minifb'" -c "CREATE DATABASE minifb OWNER minifb"
psql -U minifb -h localhost -d minifb -f db/schema.sql
psql -U minifb -h localhost -d minifb -f db/seed.sql     # optional sample data
```

**2. Configure the API:** copy `.env.example` to `.env` and fill in your own
connection details:

```
DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/DATABASE
```

**3. Install and run:**

```bash
npm install
npm run dev        # restarts on every save; use npm start for a plain run
```

The API listens on http://localhost:3000.

Handy psql commands: `\dt` list tables, `\d posts` describe a table, `\q` quit.

## API

| Method | Route | Body | Success | Errors |
|---|---|---|---|---|
| GET | `/health` | | 200 `{"status":"ok"}` | |
| GET | `/db-check` | | 200 `{"posts":7}` | |
| GET | `/feed?user_id=1` | | 200, the user's and their friends' posts, newest first, with like and comment counts | 400 missing or invalid `user_id` |
| POST | `/posts` | `{ "user_id", "body" }` | 201, the new post | 400 body not 10–500 characters, 400 user does not exist |
| POST | `/posts/:id/likes` | `{ "user_id" }` | 201, the new like | 400 invalid post id, 404 post or user not found, 409 already liked |
| DELETE | `/posts/:id/likes` | `{ "user_id" }` | 204, no body | 400 invalid post id or user id, 404 post was never liked |
| POST | `/posts/:id/comments` | `{ "user_id", "body" }` | 201, the new comment | 400 invalid ids or body length, 404 post or user not found |
| POST | `/users/:id/friendships` | `{ "receiver_id" }` | 201, a `pending` request from user `:id` | 400 to yourself, missing or invalid id; 404 user not found; 409 request already exists (either direction) |
| PATCH | `/users/:id/friendships/:senderId` | `{ "status": "accepted" }` | 200, the accepted request (only the receiver `:id` can accept) | 400 invalid ids or status, 404 no pending request |

Unexpected errors return 500 `{"error":"Something went wrong"}` and are logged
on the server; error details are never sent to the client.

**Not yet secure:** every route trusts the user id the client sends.
Authentication (next lesson) will replace that with login tokens.

### Trying it with curl

Put the request body in a file, e.g. `test-post.json`:

```json
{ "user_id": 1, "body": "My first post from the API!" }
```

```bash
curl.exe -i -X POST http://localhost:3000/posts -H "Content-Type: application/json" --data "@test-post.json"
```

On macOS or Linux use `curl` instead of `curl.exe`.

## Tables

```
users ──< posts
users ──< likes    >── posts
users ──< comments >── posts
users ──< friendships >── users
```

`─<` means "one to many": one user has many posts.

- `likes` and `comments` sit between `users` and `posts`: each row is one user
  liking, or commenting on, one post.
- `friendships` links two users: `sender_id` sent the request, `receiver_id`
  received it, and `status` is `pending` or `accepted`. A unique index on
  `LEAST`/`GREATEST` of the two ids stops a request being stored in both
  directions.

## Progress

### Database design (`db/schema.sql`)

| Exercise | Table | Concepts | Status |
|---|---|---|---|
| 1 | `users` | Data types, primary key, `NOT NULL`, `UNIQUE`, `DEFAULT`, NULL vs `''` | ✅ |
| 2 | `posts` | Foreign keys, `ON DELETE`, `CHECK`, nesting functions, normalization | ✅ |
| 3 | `likes` | Many-to-many, join tables, composite primary keys, cascade chains | ✅ |
| 4 | `comments` | Putting it together: two foreign keys, `CHECK`, `ON DELETE`, nullable foreign keys | ✅ |
| 5 | `friendships` | Self-referencing tables, ENUM types, multi-column `CHECK`, unique index on expressions | ✅ |

### Queries (`db/queries.sql`)

| Exercise | Concepts | Status |
|---|---|---|
| 1 | `SELECT`, `WHERE`, `ORDER BY`, `LIMIT`, `IS NULL` vs `=` | ✅ |
| 2 | `JOIN`, aliases, `AS`, joining the same table twice | ✅ |
| 3 | `count()`, `GROUP BY`, `LEFT JOIN`, `count(*)` vs `count(column)` | ✅ |
| 4 | The news feed: `CASE`, `OR`, subqueries, correlated subqueries, join fan-out | ✅ |

### API (`src/`)

| Lesson | Concepts | Status |
|---|---|---|
| 1 | Express, routes, HTTP methods, status codes, JSON | ✅ |
| 2 | `pg` connection pool, `.env`, `async`/`await`, `BIGINT` as text | ✅ |
| 3 | `GET /feed`, parameterized queries and SQL injection, input validation | ✅ |
| 4 | `POST`, `req.body`, middleware, `INSERT ... RETURNING`, `try`/`catch`, Postgres error codes | ✅ |
| 5 | Route parameters, `DELETE`, `rowCount`, 204/404/409 | ✅ |
| 6 | `UPDATE`, `PATCH`, mass assignment, full CRUD | ✅ |
| 7 | Authentication: password hashing, login tokens, protected routes | next |
