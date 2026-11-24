const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const { resetDb, pool, signupAndLogin } = require('./helpers');

let fay;

before(async () => {
    await resetDb();
    fay = await signupAndLogin('fay@mail.com', 'Fay');
    await signupAndLogin('gus@mail.com', 'Gus');
    await signupAndLogin('gustav@mail.com', 'Gustav');
});

after(() => pool.end());

test('search ignores case and sorts by name', async () => {
    const res = await request(app)
        .get('/users/search')
        .query({ q: 'GU' })
        .set('Authorization', `Bearer ${fay.token}`);

    assert.strictEqual(res.status, 200);
    const names = res.body.users.map(u => u.display_name);
    assert.deepStrictEqual(names, ['Gus', 'Gustav']);
});

test('you never find yourself', async () => {
    const res = await request(app)
        .get('/users/search')
        .query({ q: 'fay' })
        .set('Authorization', `Bearer ${fay.token}`);

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.users, []);
});

test('a missing q is 400', async () => {
    const res = await request(app)
        .get('/users/search')
        .set('Authorization', `Bearer ${fay.token}`);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'q is required');
});

test('search needs a login', async () => {
    const res = await request(app)
        .get('/users/search')
        .query({ q: 'gus' });

    assert.strictEqual(res.status, 401);
});
