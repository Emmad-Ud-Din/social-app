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
        `with page as (
            select p.id, p.user_id, p.body, p.time_created, p.edited_at
            from posts p
            where (p.user_id = $1
                   or p.user_id in (select case when sender_id = $1 then receiver_id else sender_id end
                                    from friendships
                                    where (sender_id = $1 or receiver_id = $1) and status = 'accepted'))
              and ($2::bigint is null
                   or (p.time_created, p.id) < (select time_created, id from posts where id = $2))
            order by p.time_created desc, p.id desc
            limit $3
        )
        select page.id, page.user_id as author_id, page.body, page.time_created, page.edited_at, u.display_name,
               (select count(*)::int from likes l where l.post_id = page.id) as likes,
               (select count(*)::int from comments c where c.post_id = page.id) as comments,
               exists (select 1 from likes l where l.post_id = page.id and l.user_id = $1) as liked_by_me
        from page
        join users u on u.id = page.user_id
        order by page.time_created desc, page.id desc;
        `, [req.userId, cursor, limit+1]
    );
   const rows = result.rows;
   const hasMore = rows.length > limit;
   const posts = rows.slice(0, limit);
   const nextCursor = hasMore ? posts[posts.length - 1].id : null;
   res.json({ posts: posts, nextCursor: nextCursor });
});

module.exports=router;
