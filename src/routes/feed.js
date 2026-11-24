const express = require('express');
const router = express.Router();
const pool = require('../db');
const requireAuth = require('../middleware/auth');
router.use(requireAuth);


router.get('/', async (req, res) => {
    const limit= req.query.limit === undefined? 20: Number(req.query.limit);
    if (!Number.isInteger(limit)||limit <1|| limit > 50){
        return res.status(400).json({error: 'limit must be a whole number from 1 to 50'});
    }

    let cursor=null;
    if (req.query.cursor !== undefined){
        cursor= Number(req.query.cursor);
        if (!Number.isInteger(cursor)||cursor<1){
            return res.status(400).json({error: 'cursor must be a valid post id'})
        }
    }

    const result = await pool.query(
        `select p.id ,p.body, p.time_created, u.display_name, count (l.user_id)::int as likes, 
        (select count (*)::int from comments c where c.post_id=p.id) as comments
        from posts p
        join users u on u.id = p.user_id
        left join likes l on l.post_id=p.id
        where (p.user_id =$1 
        or p.user_id in (select case when sender_id=$1 then  receiver_id else sender_id end as friend_id
        from friendships
        where (sender_id = $1 or receiver_id =$1) and status='accepted'))
          and ($2::bigint is null
               or (p.time_created, p.id) < (select time_created, id from posts where id = $2))
        group by p.id, u.id
        order by p.time_created desc, p.id desc
        limit $3;
        `, [req.userId, cursor, limit+1]
    );
   const rows = result.rows;
   const hasMore = rows.length > limit;
   const posts = rows.slice(0, limit);
   const nextCursor = hasMore ? posts[posts.length - 1].id : null;
   res.json({ posts: posts, nextCursor: nextCursor });
});

module.exports=router;
