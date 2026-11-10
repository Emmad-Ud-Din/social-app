const express = require('express');
const app = express()
const pool = require('./db')

app.get('/hello', (req,res)=>{
res.json ({message:' Hello from my API'});
});

app.listen(3000, ()=>{
    console.log('API running on localhost:3000');
});

app.get('/health', (req,res)=>{
    res.json({status:'ok'});
});

app.get('/db-check', async (req,res)=>{
    const result = await pool.query('SELECT count(*)::int from posts');
    res.json ({ posts: result.rows[0].count});
});

app.get('/feed', async (req,res)=>{
    const result = await pool.query (
        `select p.body, p.time_created, u.display_name, count (l.user_id)::int as likes, 
        (select count (*)::int from comments c where c.post_id=p.id) as comments
        from posts p
        join users u on u.id = p.user_id
        left join likes l on l.post_id=p.id
        where p.user_id =$1 
        or p.user_id in (select case when sender_id=$1 then  receiver_id else sender_id end as friend_id
        from friendships
        where (sender_id = $1 or receiver_id =$1) and status='accepted')
        group by p.id, u.id
        order by p.time_created desc;
        `, [req.query.user_id]
    );
    res.json (result.rows);
});
