const express = require('express');
const app = express()
const pool = require('./db')
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
app.use(express.json());

function requireAuth(req,res,next){
    const header=req.headers.authorization;
    if(!header||!header.startsWith('Bearer ')){
        return res.status(401).json({error:"login required"});
    }
    const token= header.slice(7);
    try{
        const data=jwt.verify(token,process.env.JWT_SECRET);
        req.userId=data.userId;
        next();
    }
    catch(err){
        return res.status(401).json({error:"invalid or expired token"});
    }
}

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

app.post('/posts',requireAuth, async(req,res)=>{
    try{
    const result=await pool.query(
        'INSERT INTO posts (user_id,body) VALUES ($1,$2) RETURNING *',
        [req.userId, req.body.body]
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

app.post('/users/:id/friendships', async(req,res)=>{
    const userId=Number(req.params.id);
    if(!Number.isInteger(userId)||userId<1){
        return res.status(400).json({error:"user id must be a valid number"});
    }

    try{
        const result=await pool.query(
            "INSERT INTO friendships (sender_id, receiver_id) VALUES ($1, $2) RETURNING *",
            [userId, req.body.receiver_id]
        );
        res.status(201).json(result.rows[0]);
    }

    catch(err){
        if(err.code === "23514"){
            return res.status(400).json({error: "You cannot friend request yourself"});
        }
        if(err.code==="23505"){
            return res.status(409).json({error:"Friend request already exists"});
        }
        if(err.code==="23503"){
            return res.status(404).json({error:"User not found"});
        }
        if(err.code==="23502"){
            return res.status(400).json({error:"Receiver id is required"});
        }
        if(err.code==="22P02"){
            return res.status(400).json({error:"Receiver id must be a valid number"});
        }
        console.error(err);
        res.status(500).json({ error: 'Something went wrong'});
    }
})

app.patch('/users/:id/friendships/:senderId', async(req,res)=>{
    const receiverId=Number(req.params.id);
    const senderId=Number(req.params.senderId);

    if(!Number.isInteger(receiverId)||receiverId<1||!Number.isInteger(senderId)||senderId<1){
        return res.status(400).json({error:"User IDs must be valid numbers"});
    }

    if(req.body.status!== 'accepted'){
        return res.status(400).json({error:"status must be 'accepted'"});
    }

    try{
        const result=await pool.query(
            `UPDATE friendships
            SET status = 'accepted'
            WHERE sender_id=$1 AND receiver_id=$2 AND status='pending'
            RETURNING *
            `,
            [senderId,receiverId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'no pending friend request from this user' });
        }
        
        res.status(200).json(result.rows[0]);
    }
    catch(err){
        console.error(err);
        res.status(500).json({ error: 'Something went wrong' });
    }

})

app.post("/signup", async(req,res)=>{
    const {email, display_name,password}=req.body;
    if (!email || !display_name|| !password) {
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

app.post("/login", async(req,res)=>{
    const{email,password}=req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required' });
    }

    try{
        const result=await pool.query(
            `SELECT id, password_hash FROM users WHERE email=$1`,
            [email]
        );
        const user=result.rows[0];

        if(!user){
            return res.status(401).json({error:"invalid email or password"});
        }

        const passOk=await bcrypt.compare(password, user.password_hash);

        if(!passOk){
            return res.status(401).json({error:"invalid email or password"});
        }

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        res.status(200).json({ token: token });
    }
    catch(err){
        console.error(err);
        res.status(500).json({ error: 'Something went wrong' });
    }


})
