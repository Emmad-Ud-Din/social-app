const express = require('express');
const router = express.Router();
const pool = require('../db');
const requireAuth = require('../middleware/auth');
router.use(requireAuth);

router.post('/', async (req, res) => {

    try {
        const result = await pool.query(
            "INSERT INTO friendships (sender_id, receiver_id) VALUES ($1, $2) RETURNING *",
            [req.userId, req.body.receiver_id]
        );
        res.status(201).json(result.rows[0]);
    }

    catch (err) {
        if (err.code === "23514") {
            return res.status(400).json({ error: "You cannot friend request yourself" });
        }
        if (err.code === "23505") {
            return res.status(409).json({ error: "Friend request already exists" });
        }
        if (err.code === "23503") {
            return res.status(404).json({ error: "User not found" });
        }
        if (err.code === "23502") {
            return res.status(400).json({ error: "Receiver id is required" });
        }
        if (err.code === "22P02") {
            return res.status(400).json({ error: "Receiver id must be a valid number" });
        }
        console.error(err);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

router.patch('/:senderId', async (req, res) => {
    const senderId = Number(req.params.senderId);

    if (!Number.isInteger(senderId) || senderId < 1) {
        return res.status(400).json({ error: "User ID must be a valid number" });
    }

    if (req.body.status !== 'accepted') {
        return res.status(400).json({ error: "status must be 'accepted'" });
    }

    try {
        const result = await pool.query(
            `UPDATE friendships
            SET status = 'accepted'
            WHERE sender_id=$1 AND receiver_id=$2 AND status='pending'
            RETURNING *
            `,
            [senderId, req.userId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'no pending friend request from this user' });
        }

        res.status(200).json(result.rows[0]);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong' });
    }

});

module.exports=router;
