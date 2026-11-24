const express = require('express');
const router = express.Router();
const pool = require('../db');
const requireAuth = require('../middleware/auth');
router.use(requireAuth);

router.get('/search', async(req,res)=>{
    const raw = req.query.q;
    if (typeof raw !== 'string'){
        return res.status(400).json({error: 'q is required'});
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

module.exports=router;
