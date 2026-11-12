const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


router.post("/signup", async (req, res) => {
    const { email, display_name, password } = req.body;
    if (!email || !display_name || !password) {
        return res.status(400).json({ error: 'email, display_name and password are required' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'password must be at least 8 characters' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (email, display_name, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, email, display_name, date_created`,
            [email, display_name, passwordHash]
        );
        res.status(201).json(result.rows[0]);

    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'email already registered' });
        }
        console.error(err);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required' });
    }

    try {
        const result = await pool.query(
            `SELECT id, password_hash FROM users WHERE email=$1`,
            [email]
        );
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: "invalid email or password" });
        }

        const passOk = await bcrypt.compare(password, user.password_hash);

        if (!passOk) {
            return res.status(401).json({ error: "invalid email or password" });
        }

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        res.status(200).json({ token: token });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong' });
    }


})

module.exports = router;
