const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const { resetDb, pool, signupAndLogin } = require('./helpers');

let fay;
let gus;
let postWithComments;
let postWithoutComments;

before(async () => {
    await resetDb();
    fay = await signupAndLogin('fay@mail.com', 'Fay');
    gus = await signupAndLogin('gus@mail.com', 'Gus');

    // Fay writes two posts
    const p1 = await request(app).post('/posts')
        .set('Authorization', `Bearer ${fay.token}`)
        .send({ body: 'A post people will talk about' });
    assert.strictEqual(p1.status, 201);
    postWithComments = p1.body.id;

    const p2 = await request(app).post('/posts')
        .set('Authorization', `Bearer ${fay.token}`)
        .send({ body: 'A post nobody comments on' });
    assert.strictEqual(p2.status, 201);
    postWithoutComments = p2.body.id;

    // Gus comments first, then Fay replies
    const c1 = await request(app).post(`/posts/${postWithComments}/comments`)
        .set('Authorization', `Bearer ${gus.token}`)
        .send({ body: 'Gus writes the first comment' });
    assert.strictEqual(c1.status, 201);

    const c2 = await request(app).post(`/posts/${postWithComments}/comments`)
        .set('Authorization', `Bearer ${fay.token}`)
        .send({ body: 'Fay replies to Gus here' });
    assert.strictEqual(c2.status, 201);
});

after(() => pool.end());

test('comments come back oldest first, with names', async () => {
    const res = await request(app)
        .get(`/posts/${postWithComments}/comments`)
        .set('Authorization', `Bearer ${gus.token}`);

    assert.strictEqual(res.status, 200);
    const names = res.body.comments.map(c => c.display_name);
    assert.deepStrictEqual(names, ['Gus', 'Fay']);
    assert.strictEqual(res.body.comments[0].author_id, gus.id);
    assert.strictEqual(res.body.comments[0].body, 'Gus writes the first comment');
});

test('a post with no comments gives an empty list', async () => {
    const res = await request(app)
        .get(`/posts/${postWithoutComments}/comments`)
        .set('Authorization', `Bearer ${gus.token}`);

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.comments, []);
});

test('comments of a post that does not exist is 404', async () => {
    const res = await request(app)
        .get('/posts/99999/comments')
        .set('Authorization', `Bearer ${gus.token}`);

    assert.strictEqual(res.status, 404);
});

test('a post id of 0 is 400', async () => {
    const res = await request(app)
        .get('/posts/0/comments')
        .set('Authorization', `Bearer ${gus.token}`);

    assert.strictEqual(res.status, 400);
});

test('reading comments needs a login', async () => {
    const res = await request(app)
        .get(`/posts/${postWithComments}/comments`);

    assert.strictEqual(res.status, 401);
});
