const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const { resetDb, pool, signupAndLogin } = require('./helpers');

let fay;
let gus;
let stranger;

before(async () => {
    await resetDb();
    fay = await signupAndLogin('fay@email.com', 'Fay');
    gus = await signupAndLogin('gus@email.com', 'Gus');
    stranger = await signupAndLogin('sam@email.com', 'Sam');

    //fay and gus become friends
    const req1 = await request(app).post('/friendships')
        .set('Authorization', `Bearer ${fay.token}`)
        .send({ receiver_id: gus.id });
    assert.strictEqual(req1.status, 201);

    const req2 = await request(app).patch(`/friendships/${fay.id}`)
        .set('Authorization', `Bearer ${gus.token}`)
        .send({ status: 'accepted' });
    assert.strictEqual(req2.status, 200);

    //fay makes 5 posts
    for (let i = 1; i <= 5; i++) {
        const p = await request(app).post('/posts')
            .set('Authorization', `Bearer ${fay.token}`)
            .send({ body: `Fay post number ${i}` });
        assert.strictEqual(p.status, 201);
    }

    //a stranger also posts, not gus friend
    const samPost = await request(app).post('/posts')
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ body: 'A post gus shouldnt be able to see' });
    assert.strictEqual(samPost.status, 201);

});


after(() => pool.end());

test('the first page has 2 posts and a cursor', async () => {
    const res = await request(app)
        .get('/feed?limit=2')
        .set('Authorization', `Bearer ${gus.token}`)

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.posts.length, 2);
    assert.strictEqual(res.body.nextCursor, res.body.posts[1].id);
});

test('paging through the feed returns every post exactly once', async () => {
    const seenIds = [];
    let cursor = null;

    do {
        const url = cursor === null ? '/feed?limit=2' : `/feed?limit=2&cursor=${cursor}`;
        const res = await request(app)
            .get(url)
            .set('Authorization', `Bearer ${gus.token}`);

        assert.strictEqual(res.status, 200);

        for (const post of res.body.posts) {
            seenIds.push(post.id);
        }
        cursor = res.body.nextCursor;
    } while (cursor !== null);

    assert.strictEqual(seenIds.length, 5)
    assert.strictEqual(new Set(seenIds).size, seenIds.length);
    assert.deepStrictEqual(seenIds, [...seenIds].sort((a, b) => b - a))
})

test('a non-friend post does not show up in a persons feed', async () => {

    const res = await request(app)
        .get('/feed')
        .set('Authorization', `Bearer ${gus.token}`);

    assert.strictEqual(res.status, 200);
    const hasSam = res.body.posts.some(post => post.display_name === 'Sam');


    assert.strictEqual(hasSam, false)
    assert.strictEqual(res.body.nextCursor, null)
    assert.strictEqual(res.body.posts.length, 5);
})

test('a limit of 0 is error 400', async () => {
    const res = await request(app)
        .get('/feed?limit=0')
        .set('Authorization', `Bearer ${gus.token}`);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'limit must be a whole number from 1 to 50');
})

test('a limit over 50 is error 400', async () => {
    const res = await request(app)
        .get('/feed?limit=51')
        .set('Authorization', `Bearer ${gus.token}`);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'limit must be a whole number from 1 to 50');
})

test('a cursor that is not a number is error 400', async () => {
    const res = await request(app)
        .get('/feed?cursor=abc')
        .set('Authorization', `Bearer ${gus.token}`);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'cursor must be a valid post id');
})

test("posts include the author's id", async () => {
    const res = await request(app)
        .get('/feed')
        .set('Authorization', `Bearer ${gus.token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.posts.length, 5);
    assert.strictEqual(res.body.posts.every(post => post.author_id === fay.id), true);
})

test('liked_by_me is false before liking', async () => {
    const res = await request(app)
        .get('/feed')
        .set('Authorization', `Bearer ${gus.token}`);

    assert.strictEqual(res.body.posts[0].liked_by_me, false);
})

test('liked_by_me is true after liking', async () => {
    const first = await request(app)
        .get('/feed')
        .set('Authorization', `Bearer ${gus.token}`);
    const postId = first.body.posts[0].id;

    const like = await request(app)
        .post(`/posts/${postId}/likes`)
        .set('Authorization', `Bearer ${gus.token}`);
    assert.strictEqual(like.status, 201);

    const res = await request(app)
        .get('/feed')
        .set('Authorization', `Bearer ${gus.token}`);
    const post = res.body.posts.find(p => p.id === postId);

    assert.strictEqual(post.liked_by_me, true);
    assert.strictEqual(post.likes, 1);
})

test('liked_by_me is per user', async () => {
    // Gus liked Fay's newest post in the previous test; Fay herself has not
    const res = await request(app)
        .get('/feed')
        .set('Authorization', `Bearer ${fay.token}`);

    assert.strictEqual(res.body.posts[0].likes, 1);
    assert.strictEqual(res.body.posts[0].liked_by_me, false);
})
