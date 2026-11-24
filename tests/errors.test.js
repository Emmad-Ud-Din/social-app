const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const { resetDb, pool, signupAndLogin } = require('./helpers');
const { MAX_FAILURES } = require('../src/middleware/loginLimiter');

let fay;

before(async () => {
    await resetDb();
    fay = await signupAndLogin('fay@mail.com', 'Fay');
});

after(() => pool.end());

// ---- central error handling ----

test('an unknown route is a JSON 404', async () => {
    const res = await request(app).get('/no-such-route');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'not found');
});

test('a body that is not valid JSON is a JSON 400', async () => {
    const res = await request(app)
        .post('/login')
        .set('Content-Type', 'application/json')
        .send('{"email": "fay@mail.com", ');      // cut off half way
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'request body is not valid JSON');
});

test('a database error in a route without try/catch is a JSON 500', async () => {
    // Make the feed's query fail on purpose: rename the posts table for a moment.
    await pool.query('ALTER TABLE posts RENAME TO posts_hidden');
    try {
        const res = await request(app)
            .get('/feed')
            .set('Authorization', `Bearer ${fay.token}`);
        assert.strictEqual(res.status, 500);
        assert.strictEqual(res.body.error, 'Something went wrong');
    } finally {
        await pool.query('ALTER TABLE posts_hidden RENAME TO posts');
    }
});

// ---- login rate limiting ----

test(`after ${MAX_FAILURES} wrong passwords, login is blocked with 429`, async () => {
    for (let i = 1; i <= MAX_FAILURES; i++) {
        const res = await request(app)
            .post('/login')
            .send({ email: 'fay@mail.com', password: 'wrong password ' + i });
        assert.strictEqual(res.status, 401);
    }

    const blocked = await request(app)
        .post('/login')
        .send({ email: 'fay@mail.com', password: 'wrong password again' });
    assert.strictEqual(blocked.status, 429);
    assert.ok(Number(blocked.headers['retry-after']) > 0);
});

test('while blocked, even the right password is refused', async () => {
    const res = await request(app)
        .post('/login')
        .send({ email: 'fay@mail.com', password: 'correct horse battery' });
    assert.strictEqual(res.status, 429);
    assert.strictEqual(res.body.token, undefined);
});

test('other accounts are not blocked', async () => {
    await signupAndLogin('gus@mail.com', 'Gus');
    const res = await request(app)
        .post('/login')
        .send({ email: 'gus@mail.com', password: 'correct horse battery' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
});
