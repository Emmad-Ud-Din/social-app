const express = require('express');
const router = express.Router();
const pool = require('../db');
const requireAuth = require('../middleware/auth');
router.use(requireAuth);

router.get('/search', async (req, res) => {
    const raw = req.query.q;
    if (typeof raw !== 'string') {
        return res.status(400).json({ error: 'q is required' });
    }
    const q = raw.trim();
    if (q.length === 0) {
        return res.status(400).json({ error: 'q is required' });
    }
    if (q.length > 50) {
        return res.status(400).json({ error: 'q is too long' });
    }

    const pattern = '%' + q + '%';

    const result = await pool.query(
        `select id, display_name
        from users
        where display_name ILIKE $1
        and id <> $2
        order by display_name
        limit 20`,
        [pattern, req.userId]
    );
    res.json({ users: result.rows });
});

router.patch('/me', async(req,res)=>{
    let name = req.body?.display_name;
    let bio = req.body?.bio;

    if(name===undefined && bio===undefined){
        return res.status(400).json({error:'nothing to update'});
    }

    if(name!==undefined){
        if(typeof name !=='string' || name.trim().length<1||name.trim().length>50){
            return res.status(400).json({error:'display_name must be 1 to 50 characters'});
        }
        name = name.trim();
    }
    if(bio !== undefined){
        if(typeof bio !== 'string'||bio.trim().length>160){
            return res.status(400).json({error:'bio must be at most 160 characters'});
        }
        bio=bio.trim();
    }

    const result = await pool.query(`
        update users
        set display_name=coalesce($1, display_name),
        bio = nullif(coalesce($2,bio),'')
        where id=$3
        returning id, display_name, bio, date_created`,
    [name??null, bio??null, req.userId]
    );
    res.json(result.rows[0]);
});

router.get('/:id', async (req, res) => {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId < 1) {
        return res.status(400).json({ error: 'user id must be a number' });
    }

    const found = await pool.query(
        'select id, display_name, bio, date_created from users where id = $1',
        [userId]
    );
    const user = found.rows[0];
    if (!user) {
        return res.status(404).json({ error: 'user not found' });
    }

    const friends = await pool.query(
        `select count(*) as friend_count
    from friendships
    where (sender_id = $1 or receiver_id = $1)
    and status = 'accepted'`,
        [userId]
    );
    const friendCount = friends.rows[0].friend_count;

    let relationship;
    if (userId === req.userId) {
        relationship = 'self';
    } else {
        const link = await pool.query(
            `select sender_id, status from friendships
        where (sender_id = $1 and receiver_id = $2)
           or (sender_id = $2 and receiver_id = $1)`,
            [userId, req.userId]
        );
        const row = link.rows[0];
        if (!row) {
            relationship = 'none';
        } else if (row.status === 'accepted') {
            relationship = 'friends';
        } else if (row.sender_id === req.userId) {
            relationship = 'request_sent';
        } else {
            relationship = 'request_received';
        }
    }

    let posts=[];
    if(relationship==='self'||relationship==='friends'){
        const result = await pool.query(
            `select id, body, time_created, edited_at
            from posts
            where user_id = $1
            order by time_created desc, id desc
            limit 20`,
            [userId]
        );
        posts= result.rows;
    }
    res.json({user, friend_count:friendCount, relationship, posts});
})

module.exports = router;
