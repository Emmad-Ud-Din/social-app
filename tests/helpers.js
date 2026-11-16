const fs = require('fs');
const path = require('path');
const request = require('supertest');
const pool = require('../src/db');
const app = require('../src/app');

const schema = fs.readFileSync(path.join(__dirname,'../db/schema.sql'), 'utf8');

async function resetDb(){
    await pool.query('DROP SCHEMA public CASCADE ; CREATE SCHEMA public;');
    await pool.query(schema);
}

async function signupAndLogin(email, name) {
    const password = 'correct horse battery';

    const signup = await request(app)
        .post('/signup')
        .send({ email: email, display_name: name, password: password });

    const login = await request(app)
        .post('/login')
        .send({ email: email, password: password });

    return { id: signup.body.id, token: login.body.token };
}

module.exports={resetDb, pool, signupAndLogin};
