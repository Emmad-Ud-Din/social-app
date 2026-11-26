const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const { resetDb, pool, signupAndLogin } = require('./helpers');

let ann;
let ben;
let cara;
let dev;

function auth(user) {
    return `Bearer ${user.token}`;
}

// `from` sends `to` a friend request and checks it worked.
async function sendRequest(from, to) {
    const res = await request(app).post('/friendships')
        .set('Authorization', auth(from))
        .send({ receiver_id: to.id });
    assert.strictEqual(res.status, 201);
}

// `user` removes whatever is between them and `otherId`.
function remove(user, otherId) {
    return request(app)
        .delete(`/friendships/${otherId}`)
        .set('Authorization', auth(user));
}

// How many friendship rows exist between two users (in either direction).
async function rowsBetween(a, b) {
    const res = await pool.query(
        `select count(*)::int as n from friendships
        where (sender_id = $1 and receiver_id = $2) or (sender_id = $2 and receiver_id = $1)`,
        [a.id, b.id]
    );
    return res.rows[0].n;
}

before(async () => {
    await resetDb();
    ann = await signupAndLogin('ann@mail.com', 'Ann');
    ben = await signupAndLogin('ben@mail.com', 'Ben');
    cara = await signupAndLogin('cara@mail.com', 'Cara');
    dev = await signupAndLogin('dev@mail.com', 'Dev');

    // Ann and Ben are friends, and Ben has a post Ann can see in her feed
    await sendRequest(ann, ben);
    const accepted = await request(app).patch(`/friendships/${ann.id}`)
        .set('Authorization', auth(ben))
        .send({ status: 'accepted' });
    assert.strictEqual(accepted.status, 200);

    const post = await request(app).post('/posts')
        .set('Authorization', auth(ben))
        .send({ body: 'Ben posts for his friends' });
    assert.strictEqual(post.status, 201);

    await sendRequest(cara, ann);   // Cara -> Ann, for rejecting
    await sendRequest(ann, dev);    // Ann -> Dev, for cancelling
    await sendRequest(ben, cara);   // Ben -> Cara, which Ann is not part of
});

after(() => pool.end());

test('unfriending removes their posts from your feed', async () => {
    const before = await request(app).get('/feed').set('Authorization', auth(ann));
    assert.strictEqual(before.body.posts.length, 1);

    const res = await remove(ann, ben.id);
    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.text, '');   // 204 has no body

    const after = await request(app).get('/feed').set('Authorization', auth(ann));
    assert.strictEqual(after.body.posts.length, 0);
    assert.strictEqual(await rowsBetween(ann, ben), 0);
});

test('removing it again is 404', async () => {
    const res = await remove(ann, ben.id);

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'no friendship or request with that user');
});

test('after unfriending you can send a new request', async () => {
    await sendRequest(ann, ben);   // checks for 201
    assert.strictEqual(await rowsBetween(ann, ben), 1);
});

test('rejecting a request removes it from your pending list', async () => {
    const res = await remove(ann, cara.id);
    assert.strictEqual(res.status, 204);

    const pending = await request(app).get('/friendships/pending').set('Authorization', auth(ann));
    assert.deepStrictEqual(pending.body.requests, []);
});

test('you can cancel a request you sent', async () => {
    const res = await remove(ann, dev.id);

    assert.strictEqual(res.status, 204);
    assert.strictEqual(await rowsBetween(ann, dev), 0);
});

test("you cannot remove a request between two other users", async () => {
    // Ann asks to remove "whatever is between her and Cara": that is nothing now,
    // and the Ben -> Cara request must be left alone.
    const res = await remove(ann, cara.id);

    assert.strictEqual(res.status, 404);
    assert.strictEqual(await rowsBetween(ben, cara), 1);
});

test('an invalid user id is 400', async () => {
    const res = await remove(ann, 'abc');

    assert.strictEqual(res.status, 400);
});

test('removing a friendship needs a login', async () => {
    const res = await request(app).delete(`/friendships/${ben.id}`);

    assert.strictEqual(res.status, 401);
});
