const express = require('express');
const app = express()
const pool = require('./db')
app.use(express.json());

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
    const userId = Number(req.query.user_id);
    if (!req.query.user_id) {
        return res.status(400).json({ error: 'user_id is required' });
    }
    if(!(Number.isInteger(userId))||userId<1){
        return res.status(400).json({error:"user_id must be a number"})
  }
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
        `, [userId]
    );
    res.json (result.rows);
});

app.post('/posts', async(req,res)=>{
    try{
    const result=await pool.query(
        'INSERT INTO posts (user_id,body) VALUES ($1,$2) RETURNING *',
        [req.body.user_id, req.body.body]
    );
    res.status(201).json(result.rows[0]);}
    catch (err){
         if (err.code === '23514') {
      return res.status(400).json({error: "body must be between 10 and 500 characters"});
    }
    if (err.code==='23503'){
        return res.status(400).json({error: "User does not exist"})
    }
    console.error(err);
    res.status(500).json({error: "something went wrong" });
  }
    
})

app.post('/posts/:id/likes', async (req,res)=>{
const postId = Number(req.params.id);

if(!Number.isInteger(postId)|| postId<1){
    return res.status(400).json({error: "post id must be a number"});
}

try{
const result= await pool.query(
    'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) RETURNING * ',
    [req.body.user_id, postId]
);

res.status(201).json(result.rows[0]);}
catch (err){
if (err.code==='23505'){
    return res.status(409).json({error: 'already liked'});
}
if(err.code==='23503'){
    return res.status(404).json({error:"post or user not found"});
}
console.error(err);
res.status(500).json({error: "Something went wrong"});
}

});

app.delete('/posts/:id/likes', async (req,res)=>{
    const postId= Number(req.params.id)

    if(!Number.isInteger(postId)||postId<1){
        return res.status(400).json({error:"post id must be a number"})
    }

    try{
        const result= await pool.query(
            "DELETE FROM likes WHERE user_id = $1 and post_id= $2 ",
            [req.body.user_id,postId]
        );

        if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Post was never liked' });
        }
        res.status(204).end(); 
    }  
    catch(err){
        if (err.code === '22P02') {
            return res.status(400).json({ error: 'user_id must be a number' });
    }
        console.error(err);
        res.status(500).json({error: "Something went wrong"});
    }
});

app.post('/posts/:id/comments', async (req,res)=>{
    const postId=Number(req.params.id);
    if (!Number.isInteger(postId)||postId<1){
        return res.status(400).json({error:"post id must be a number"})
    }

    try{
        const result = await pool.query(
            "INSERT INTO comments (post_id,user_id, body) VALUES ($1, $2, $3) RETURNING *",
            [postId,req.body.user_id, req.body.body]
        );
        res.status(201).json(result.rows[0]);
    }
    catch(err){
        if (err.code==="23514"){
            return res.status(400).json({error:"comment must be between 10 and 500 characters"});
        }

        if(err.code==="23503"){
            return res.status(404).json({error:"the post or user does not exist"})
        }

        if(err.code==="22P02"){
            return res.status(400).json({error:"Invalid user id"})
        }
        console.error(err);
        res.status(500).json({ error: 'Something went wrong' });
    }
});
