# Social App (Mini Facebook)

![tests](https://github.com/Emmad-Ud-Din/social-app/actions/workflows/test.yml/badge.svg)

A learning project: a small social network backend with PostgreSQL and a
Node + Express API, built one exercise at a time.

```
db/
  schema.sql     tables, constraints and indexes
  seed.sql       sample data (Ann, Ben, Cara, Dev, Eve)
  queries.sql    practice queries, up to the news feed
src/
  index.js                 starts the server
  app.js                   creates the app and mounts the routers (used by the tests)
  db.js                    the Postgres connection pool
  middleware/auth.js       requireAuth: checks the login token
  middleware/errors.js     JSON 404 for unknown routes, central error handler
  middleware/loginLimiter.js  blocks login after 5 wrong passwords (15 min)
  routes/auth.js           /signup, /login
  routes/posts.js          /posts, /posts/:id, likes, comments
  routes/feed.js           /feed
  routes/friendships.js    /friendships
  routes/users.js          /users/search
public/
  index.html               the web front end's page
  style.css                its styles
  app.js                   its JavaScript: calls the API with fetch()
tests/
  helpers.js               resets the test database
  auth.test.js             sign-up, login and token tests
  posts.test.js            posting, likes and owner-only delete, as logged-in users
  feed.test.js             feed pagination: pages, cursors, friends only, bad input
  errors.test.js           error handling and login rate limiting
  friendships.test.js      the pending friend requests list
  users.test.js            user search: case, sorting, not finding yourself
.github/workflows/test.yml  runs npm test on GitHub for every push
.env.example     template for .env (never commit .env)
.env.test.example template for .env.test, used by npm test
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
values:

```
DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/DATABASE
JWT_SECRET=any-long-random-string
```

`JWT_SECRET` signs login tokens; anyone who knows it can log in as any user,
so keep it out of the code and out of Git. Restart the server after changing
`.env`.

**3. Install and run:**

```bash
npm install
npm run dev        # restarts on every save; use npm start for a plain run
```

The API listens on http://localhost:3000.

**4. Run the automated tests** (optional): create a separate, empty test
database, copy `.env.test.example` to `.env.test` pointing at it, then:

```bash
npm test
```

The tests delete and recreate every table in the test database on each run, so
never point `.env.test` at your real database.

Handy psql commands: `\dt` list tables, `\d posts` describe a table, `\q` quit.

## Web front end

The server also serves a simple web page from `public/` (plain HTML, CSS and
JavaScript, no build step). Start the server with `npm run dev`, then open
http://localhost:3000 in a browser. From there you can:

- sign up, log in and log out (the login token is kept in the browser's
  `localStorage`; after it expires, an hour later, you are sent back to the
  login screen)
- search for people by name and send them a friend request
- write posts (with a 10–500 character counter)
- read your feed 10 posts at a time, with a "Load more" button
- like and unlike, comment on, and delete posts
- click "2 comments" under a post to read its comments, oldest first
- see the friend requests sent to you, each with an Accept button

The page uses exactly the same API routes as curl or the tests do, with the
`Authorization: Bearer <token>` header, and shows the API's error messages.
Delete only appears on your own posts (the feed's `author_id`), and Like turns
into Unlike on posts you already liked (`liked_by_me`).

## API

### Accounts

| Method | Route | Body | Success | Errors |
|---|---|---|---|---|
| POST | `/signup` | `{ "email", "display_name", "password" }` | 201, the new user (never the password hash) | 400 missing field or password under 8 characters, 409 email already registered |
| POST | `/login` | `{ "email", "password" }` | 200 `{ "token": "..." }`, valid for 1 hour | 400 missing field, 401 invalid email or password, 429 after 5 wrong passwords for the same email (blocked for 15 minutes) |

Passwords are hashed with bcrypt before they are stored. The token is a JWT
signed with `JWT_SECRET`; its payload is `{ "userId": ... }`.

### Logged-in routes

These need the header `Authorization: Bearer <token>`. Without it they return
401 `login required`, and with a bad or expired token 401
`invalid or expired token`. **The user is always taken from the token**: any
`user_id` sent in the body is ignored.

| Method | Route | Body | Success | Errors |
|---|---|---|---|---|
| GET | `/feed?limit=&cursor=` | | 200 `{ posts, nextCursor }`: your posts and your friends' posts, newest first. Each post has `id`, `author_id`, `body`, `time_created`, `display_name`, `likes`, `comments` and `liked_by_me`. Pass `nextCursor` back as `cursor` for the next page; it is `null` on the last page. `limit` defaults to 20, max 50 | 400 invalid `limit` or `cursor` |
| POST | `/posts` | `{ "body" }` | 201, the new post | 400 body not 10–500 characters |
| DELETE | `/posts/:id` | | 204, no body; the post's likes and comments are removed too | 400 invalid post id, 403 not your post, 404 post not found |
| POST | `/posts/:id/likes` | | 201, the new like | 400 invalid post id, 404 post not found, 409 already liked |
| DELETE | `/posts/:id/likes` | | 204, no body | 400 invalid post id, 404 post was never liked |
| GET | `/posts/:id/comments` | | 200 `{ comments }`: the post's comments, oldest first. Each has `id`, `body`, `time_created`, `author_id` and `display_name`. A post with no comments gives `[]` | 400 invalid post id, 404 post not found |
| POST | `/posts/:id/comments` | `{ "body" }` | 201, the new comment | 400 invalid post id or body length, 404 post not found |
| POST | `/friendships` | `{ "receiver_id" }` | 201, a `pending` request from you | 400 to yourself, missing or invalid id; 404 user not found; 409 request already exists (either direction) |
| GET | `/users/search?q=` | | 200 `{ users }`: up to 20 users whose `display_name` contains `q` (any case), sorted by name, never including you. Each has only `id` and `display_name` | 400 `q` missing, blank or over 50 characters |
| GET | `/friendships/pending` | | 200 `{ requests }`: requests other users sent you that are still pending, newest first. Each has `sender_id`, `display_name` and `time_sent`. Requests you sent are not included | |
| PATCH | `/friendships/:senderId` | `{ "status": "accepted" }` | 200, the accepted request (only the receiver can accept) | 400 invalid id or status, 404 no pending request from that user |

### Other

| Method | Route | Success |
|---|---|---|
| GET | `/health` | 200 `{"status":"ok"}` |
| GET | `/db-check` | 200 `{"posts":7}` |

Unknown routes return 404 `{"error":"not found"}`, a body that isn't valid JSON
returns 400, a number too big for the database returns 400, a number too big for the database (e.g. a huge id) returns 400,
and unexpected errors return 500 `{"error":"Something went wrong"}`.
All of these come from one central error handler (`src/middleware/errors.js`);
error details are logged on the server and never sent to the client.

### Trying it with curl (PowerShell)

Sign up, then log in and keep the token in a variable:

```powershell
curl.exe -X POST http://localhost:3000/signup -H "Content-Type: application/json" --data "@test-signup.json"
$token = (curl.exe -s -X POST http://localhost:3000/login -H "Content-Type: application/json" --data "@test-login.json" | ConvertFrom-Json).token
```

`test-signup.json` and `test-login.json` hold the request bodies, e.g.
`{ "email": "fay@mail.com", "password": "correct horse battery" }`.
Then call a logged-in route:

```powershell
curl.exe -i http://localhost:3000/feed -H "Authorization: Bearer $token"
```

On macOS or Linux use `curl` and `TOKEN=$(...)`. The sample users in
`db/seed.sql` have placeholder password hashes and cannot log in; create your
own with `/signup`.

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
| 7 | Authentication: bcrypt password hashing, JWT login tokens, auth middleware, 401 vs 400 | ✅ |
| 8 | Authorization: owner-only delete, 401 vs 403, `ON DELETE CASCADE` | ✅ |
| 9 | Organising code: `express.Router()`, mounting, `require` paths, middleware order | ✅ |
| 10 | Automated tests: `node:test`, `supertest`, a separate test database, testing logged-in routes | ✅ |
| 11 | Pagination and performance: cursor pagination, row comparison, indexes, `EXPLAIN ANALYZE`, `WITH` (limit first, count after), indexing foreign keys | ✅ |
| 12 | Evolving an API: adding fields without breaking clients, `EXISTS`, using the new fields in the front end | ✅ |
| 13 | Central error handling, login rate limiting (429), continuous integration with GitHub Actions | ✅ |
| 14 | Feature: pending friend requests (`GET /friendships/pending`), only requests sent *to* the logged-in user | ✅ |
| 15 | Feature: user search, `req.query`, `ILIKE` and `%` wildcards, returning only public columns | ✅ |
| 16 | Feature: viewing comments, `select 1` to tell "not found" (404) from "empty" (200 `[]`), `JOIN` for names | ✅ |
