const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

const schema = fs.readFileSync(path.join(__dirname,'../db/schema.sql'), 'utf8');

async function resetDb(){
    await pool.query('DROP SCHEMA public CASCADE ; CREATE SCHEMA public;');
    await pool.query(schema);
}

module.exports={resetDb, pool};
