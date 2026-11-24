const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const { resetDb, pool, signupAndLogin } = require('./helpers');

let fay;
let gus;
let sam;

before(async () => {
    await resetDb();
    fay = await signupAndLogin('fay@mail.com', 'Fay');
    gus = await signupAndLogin('gus@mail.com', 'Gus');
    sam = await signupAndLogin('sam@mail.com', 'Sam');

    // Fay sends Gus a request, which stays pending
    const req1 = await request(app).post('/friendships')
        .set('Authorization', `Bearer ${fay.token}`)
        .send({ receiver_id: gus.id });
    assert.strictEqual(req1.status, 201);
    //sam sends fay a request
    const req2 = await request(app).post('/friendships')
        .set('Authorization', `Bearer ${sam.token}`)
        .send({ receiver_id: fay.id });
    assert.strictEqual(req2.status, 201);
});

after(() => pool.end());

test("Gus sees Fay's pending request", async () => {
    const res = await request(app)
        .get('/friendships/pending')
        .set('Authorization', `Bearer ${gus.token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.requests.length, 1);
    assert.strictEqual(res.body.requests[0].sender_id, fay.id);
    assert.strictEqual(res.body.requests[0].display_name, 'Fay');
});

test('Fay sees requests sent to her, not ones she sent', async () => {
    const res = await request(app)
        .get('/friendships/pending')
        .set('Authorization', `Bearer ${fay.token}`)

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.requests.length, 1);
    assert.strictEqual(res.body.requests[0].sender_id, sam.id);

})

test('a user with no requests sees an empty list', async () => {
    const res = await request(app)
        .get('/friendships/pending')
        .set('Authorization', `Bearer ${sam.token}`)

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.requests, []);

})

test('accepted requests disappear from the list', async () => {
    // 1. Gus accepts Fay's request
    const accept = await request(app)
        .patch(`/friendships/${fay.id}`)
        .set('Authorization', `Bearer ${gus.token}`)
        .send({ status: 'accepted' });

    assert.strictEqual(accept.status, 200);
    assert.strictEqual(accept.body.status, 'accepted');

    // 2. Gus looks at his pending list again
    const res = await request(app)
        .get('/friendships/pending')
        .set('Authorization', `Bearer ${gus.token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.requests.length, 0);
});

test('pending requests need a login', async () => {
    const res = await request(app)
        .get('/friendships/pending');

    assert.strictEqual(res.status, 401);
});
