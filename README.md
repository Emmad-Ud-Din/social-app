# Social App (Mini Facebook)

A learning project: a small social network backend on PostgreSQL.

| Lesson | What it covers | Files |
|---|---|---|
| 1. Data model | Tables, primary/foreign keys, constraints, indexes, joins, CTEs | `db/` |
| 2. API (next) | Node + Express, connection pool, parameterized queries, REST | — |
| 3. Auth (next) | Password hashing, sessions/JWT, authorization | — |

## Set up the database

```bash
sudo -u postgres psql -c "CREATE ROLE minifb LOGIN PASSWORD 'minifb'" -c "CREATE DATABASE minifb OWNER minifb"
psql -U minifb -h localhost -d minifb -f db/schema.sql
psql -U minifb -h localhost -d minifb -f db/seed.sql
psql -U minifb -h localhost -d minifb      # open a shell, then try db/queries.sql
```

Handy psql commands: `\dt` list tables, `\d posts` describe a table, `\q` quit.

## Tables

```
users ─┬─< posts ─┬─< comments >── users
       │          └─< likes    >── users
       └─< friendships >── users   (requester → addressee, pending/accepted)
```
`─<` means "one to many".
