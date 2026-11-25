const {test, before, after}= require ('node:test');
const assert = require ('node:assert');
const request = require ('supertest');
const app = require('../src/app');
const { resetDb, pool, signupAndLogin}= require ('./helpers');

 let fay;
 let gus;
 let postId;

before(async()=>{
   

    await resetDb();
    fay= await signupAndLogin('fay@mail.com', 'Fay');
    gus= await signupAndLogin('gus@mail.com', 'Gus');

    const p1= await request(app).post('/posts')
    .set('Authorization', `Bearer ${fay.token}`)
    .send({body:'A post you can edit'});
    assert.strictEqual(p1.status,201);

    postId=p1.body.id;

})

after(()=>pool.end());

test('Fay can edit her own post', async()=>{
    const res= await request(app)
    .patch(`/posts/${postId}`)
    .set('Authorization', `Bearer ${fay.token}`)
    .send({body:'An edited post here'})

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.body, 'An edited post here');
    assert.notStrictEqual(res.body.edited_at,null);
});

test('Gus cannot edit Fays post', async()=>{
    const res= await request(app)
    .patch(`/posts/${postId}`)
    .set('Authorization', `Bearer ${gus.token}`)
    .send({body:'Gus tries to edit fays post'})

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, 'you can only edit your own post');

});

test('Fay tries to edit a post that does not exist', async()=>{
    const res= await request(app)
    .patch(`/posts/9999999`)
    .set('Authorization', `Bearer ${fay.token}`)
    .send({body:'fay tries to edit a post that does not exists'})

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, 'post not found');

});

test('Fay tries to edit a post with a short caption', async()=>{
    const res= await request(app)
    .patch(`/posts/${postId}`)
    .set('Authorization', `Bearer ${fay.token}`)
    .send({body:'short'})

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'post must be between 10 and 500 characters');
});

test('Fay tries to edit a post with an empty body', async()=>{
    const res= await request(app)
    .patch(`/posts/${postId}`)
    .set('Authorization', `Bearer ${fay.token}`)
    .send({})

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'body is required');
});

test('An edit cannot change the author', async()=>{
    const res= await request(app)
    .patch(`/posts/${postId}`)
    .set('Authorization', `Bearer ${fay.token}`)
    .send({body:'trying to change the author', user_id: gus.id});

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user_id, fay.id);
});

test('Editing a post without a user token', async()=>{
    const res= await request(app)
    .patch(`/posts/${postId}`)
    .send({body:'a valid body for editing without user token'})

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'login required');
});
