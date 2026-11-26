const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const { resetDb, pool, signupAndLogin } = require('./helpers');

let ann;
let ben;

// Ann sends a PATCH /users/me with this body.
function editAnn(body) {
    return request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${ann.token}`)
        .send(body);
}

before(async () => {
    await resetDb();
    ann = await signupAndLogin('ann@mail.com', 'Ann');
    ben = await signupAndLogin('ben@mail.com', 'Ben');
    await pool.query("update users set bio = 'Coffee and climbing' where id = $1", [ann.id]);
});

after(() => pool.end());

test('changing only the bio keeps the name', async () => {
    const res = await editAnn({ bio: 'Coffee, climbing and books' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.bio, 'Coffee, climbing and books');
    assert.strictEqual(res.body.display_name, 'Ann');
});

test('changing only the name keeps the bio, and the name is trimmed', async () => {
    const res = await editAnn({ display_name: '  Annie  ' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.display_name, 'Annie');
    assert.strictEqual(res.body.bio, 'Coffee, climbing and books');
});

test('an empty bio removes it (NULL, not "")', async () => {
    const res = await editAnn({ bio: '' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.bio, null);
});

test('an edit only changes your own profile', async () => {
    const res = await pool.query('select display_name, bio from users where id = $1', [ben.id]);

    assert.deepStrictEqual(res.rows[0], { display_name: 'Ben', bio: null });
});

test('sending nothing to update is 400', async () => {
    const res = await editAnn({});

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'nothing to update');
});

test('a blank name is 400', async () => {
    const res = await editAnn({ display_name: '   ' });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'display_name must be 1 to 50 characters');
});

test('a bio over 160 characters is 400', async () => {
    const res = await editAnn({ bio: 'x'.repeat(161) });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'bio must be at most 160 characters');
});

test('a bio that is not text is 400', async () => {
    const res = await editAnn({ bio: 123 });

    assert.strictEqual(res.status, 400);
});

test('editing your profile needs a login', async () => {
    const res = await request(app).patch('/users/me').send({ bio: 'hello there' });

    assert.strictEqual(res.status, 401);
});
