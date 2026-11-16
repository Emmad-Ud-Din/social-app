const {test, before, after}= require ('node:test');
const assert = require ('node:assert');
const request = require ('supertest');
const app = require('../src/app');
const { resetDb, pool}= require ('./helpers');

before(resetDb);
after(()=>pool.end());

test('signup creates a user and never returns the hash', async()=>{
    const res = await request(app)
    .post('/signup')
    .send({email: 'fay@mail.com', display_name:'Fay', password:'correct horse battery'});

    assert.strictEqual(res.status,201);
    assert.strictEqual(res.body.email, 'fay@mail.com');
    assert.strictEqual(res.body.password_hash, undefined);
});

test('signup with the same email is 409', async()=>{
    const res= await request(app)
    .post('/signup')
    .send({email:'fay@mail.com', display_name:'Fay',password:'blahblahblah'});

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.error, 'email already registered');
});

test('signup with short password is 400', async ()=>{
    const res = await request(app)
    .post('/signup')
    .send({email:'fay@mail.com', display_name:'Fay',password:'blabla'});

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'password must be at least 8 characters')
})

test('login with the right password returns a token', async ()=>{
    const res= await request(app)
    .post('/login')
    .send({email:'fay@mail.com', password:"correct horse battery"});

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
})

test('login with the wrong password is 401', async()=>{
    const res= await request(app)
    .post('/login')
    .send({email:'fay@mail.com', password:'wrongpassword'});

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'invalid email or password');
    assert.strictEqual(res.body.token, undefined);
})

test('feed without a token is 401', async()=>{
    const res= await request(app)
    .get('/feed')
    
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'login required')
})
