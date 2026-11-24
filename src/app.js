const express = require('express');
const path = require('path');
const app = express()
const pool = require('./db')
const authRouter = require('./routes/auth');
const postsRouter = require('./routes/posts');
const feedRouter = require('./routes/feed');
const friendshipsRouter = require('./routes/friendships');
const { notFound, errorHandler } = require('./middleware/errors');

app.use(express.json());

// Serve the web front end (public/index.html, style.css, app.js) from the same server.
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/', authRouter);
app.use('/posts', postsRouter);
app.use('/feed', feedRouter);
app.use('/friendships', friendshipsRouter);

app.get('/hello', (req, res) => {
    res.json({ message: ' Hello from my API' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/db-check', async (req, res) => {
    const result = await pool.query('SELECT count(*)::int from posts');
    res.json({ posts: result.rows[0].count });
});

// These two must come LAST: Express only reaches them if nothing above answered.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
