const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const { resetDb, pool, signupAndLogin } = require('./helpers');

let fay;
let gus;
let sam;
let una;

// Makes a post as `user` and checks it worked.
async function makePost(user, body) {
    const res = await request(app).post('/posts')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ body });
    assert.strictEqual(res.status, 201);
}

// Fay asks for a profile.
function viewAsFay(userId) {
    return request(app)
        .get(`/users/${userId}`)
        .set('Authorization', `Bearer ${fay.token}`);
}

before(async () => {
    await resetDb();
    fay = await signupAndLogin('fay@mail.com', 'Fay');
    gus = await signupAndLogin('gus@mail.com', 'Gus');
    sam = await signupAndLogin('sam@mail.com', 'Sam');
    una = await signupAndLogin('una@mail.com', 'Una');

    // Everyone has a post, so an empty list really means "hidden".
    await makePost(fay, 'Fay writes her first post');
    await makePost(fay, 'Fay writes her second post');
    await makePost(gus, 'Gus writes a post too');
    await makePost(sam, 'Sam writes a post too');
    await makePost(una, 'Una writes a private post');

    // Fay and Gus become friends
    const sent = await request(app).post('/friendships')
        .set('Authorization', `Bearer ${fay.token}`)
        .send({ receiver_id: gus.id });
    assert.strictEqual(sent.status, 201);
    const accepted = await request(app).patch(`/friendships/${fay.id}`)
        .set('Authorization', `Bearer ${gus.token}`)
        .send({ status: 'accepted' });
    assert.strictEqual(accepted.status, 200);

    // Sam sends Fay a request, which stays pending
    const pending = await request(app).post('/friendships')
        .set('Authorization', `Bearer ${sam.token}`)
        .send({ receiver_id: fay.id });
    assert.strictEqual(pending.status, 201);
});

after(() => pool.end());

test('your own profile shows your posts, newest first', async () => {
    const res = await viewAsFay(fay.id);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.relationship, 'self');
    assert.strictEqual(res.body.friend_count, 1);
    const bodies = res.body.posts.map(p => p.body);
    assert.deepStrictEqual(bodies, ['Fay writes her second post', 'Fay writes her first post']);
});

test("a friend's profile shows their posts", async () => {
    const res = await viewAsFay(gus.id);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.relationship, 'friends');
    assert.strictEqual(res.body.friend_count, 1);
    assert.strictEqual(res.body.posts.length, 1);
    assert.strictEqual(res.body.posts[0].body, 'Gus writes a post too');
});

test('a pending request does not show posts yet', async () => {
    const res = await viewAsFay(sam.id);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.relationship, 'request_received');
    assert.strictEqual(res.body.friend_count, 0);   // pending is not a friendship
    assert.deepStrictEqual(res.body.posts, []);
});

test('the sender of a pending request sees request_sent', async () => {
    const res = await request(app)
        .get(`/users/${fay.id}`)
        .set('Authorization', `Bearer ${sam.token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.relationship, 'request_sent');
    assert.deepStrictEqual(res.body.posts, []);
});

test("a stranger's posts are hidden", async () => {
    const res = await viewAsFay(una.id);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.relationship, 'none');
    assert.deepStrictEqual(res.body.posts, []);   // Una does have a post
});

test('a profile never includes the email or password hash', async () => {
    const res = await viewAsFay(gus.id);

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(Object.keys(res.body.user).sort(),
        ['bio', 'date_created', 'display_name', 'id']);
});

test('a user that does not exist is 404', async () => {
    const res = await viewAsFay(99999);

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'user not found');
});

test('an invalid user id is 400', async () => {
    const res = await viewAsFay('abc');

    assert.strictEqual(res.status, 400);
});

test('search still works next to /users/:id', async () => {
    const res = await request(app)
        .get('/users/search')
        .query({ q: 'gu' })
        .set('Authorization', `Bearer ${fay.token}`);

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.users.map(u => u.display_name), ['Gus']);
});

test('viewing a profile needs a login', async () => {
    const res = await request(app).get(`/users/${gus.id}`);

    assert.strictEqual(res.status, 401);
});
