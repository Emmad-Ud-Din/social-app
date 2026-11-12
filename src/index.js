const express = require('express');
const app = express()
const pool = require('./db')
const authRouter = require('./routes/auth');
const postsRouter = require('./routes/posts');
const feedRouter = require('./routes/feed');
const friendshipsRouter = require('./routes/friendships');

app.use(express.json());

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

app.listen(3000, () => {
    console.log('API running on localhost:3000');
});
