const {test, before, after}= require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app= require ('../src/app');
const {resetDb, pool, signupAndLogin}= require ('./helpers');

let fay;
let gus;
let postId;

before(async()=>{
    await resetDb();
    fay = await signupAndLogin('fay@mail.com', 'Fay');
    gus = await signupAndLogin('gus@mail.com', 'Gus');
});

after(()=> pool.end());

test( 'Fay can create a post', async()=>{
    const res= await request(app)
    .post('/posts')
    .set('Authorization', `Bearer ${fay.token}`)
    .send({body: 'Hello from from an automated test'});

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.user_id, fay.id);
    postId=res.body.id;
});

test ('the author comes from the token, not the body', async()=>{
    const res= await request(app)
    .post('/posts')
    .set('Authorization', `Bearer ${fay.token}`)
    .send({user_id: gus.id, body:'my id comes from token not body'});

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.user_id, fay.id);
})

test ('a post that is too short is 400', async()=>{
    const res= await request(app)
    .post('/posts')
    .set('Authorization', `Bearer ${fay.token}`)
    .send({body:'short'});

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "body must be between 10 and 500 characters");

});

test("gus can like fay's post", async()=>{
    const res = await request(app)
    .post(`/posts/${postId}/likes`)
    .set('Authorization', `Bearer ${gus.token}`);

    assert.strictEqual(res.status, 201);
});

test("liking a post twice is 409", async()=>{
    const res = await request(app)
    .post(`/posts/${postId}/likes`)
    .set('Authorization', `Bearer ${gus.token}`);

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.error, 'already liked')
});

test("deleting someone else's post is 403", async()=>{
    const res= await request(app)
    .delete(`/posts/${postId}`)
    .set('Authorization', `Bearer ${gus.token}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, "you can only delete your own post");

    const check = await pool.query('SELECT count(*)::int AS n FROM posts WHERE id = $1',
         [postId]);
    assert.strictEqual(check.rows[0].n, 1);
})

test("fay deletes her own post is 204", async()=>{
    const res= await request(app)
    .delete(`/posts/${postId}`)
    .set('Authorization', `Bearer ${fay.token}`);

    assert.strictEqual(res.status, 204);
});

test('deleting a post also deletes its likes', async () => {
    const result = await pool.query(
        'SELECT count(*)::int AS n FROM likes WHERE post_id = $1',
        [postId]
    );
    assert.strictEqual(result.rows[0].n, 0);
});

test("deleting a deleted post is 404", async()=>{
    const res= await request(app)
    .delete(`/posts/${postId}`)
    .set('Authorization', `Bearer ${fay.token}`);

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, "Post not found")
});
