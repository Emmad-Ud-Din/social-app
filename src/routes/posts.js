const express = require('express');
const router = express.Router();
const pool = require('../db');
const requireAuth = require('../middleware/auth');
router.use(requireAuth);

router.post('/', async (req, res) => {
    try {
        const result = await pool.query(
            'INSERT INTO posts (user_id,body) VALUES ($1,$2) RETURNING *',
            [req.userId, req.body.body]
        );
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        if (err.code === '23514') {
            return res.status(400).json({ error: "body must be between 10 and 500 characters" });
        }
        if (err.code === '23503') {
            return res.status(400).json({ error: "User does not exist" })
        }
        console.error(err);
        res.status(500).json({ error: "something went wrong" });
    }

})

router.post('/:id/likes', async (req, res) => {
    const postId = Number(req.params.id);

    if (!Number.isInteger(postId) || postId < 1) {
        return res.status(400).json({ error: "post id must be a number" });
    }

    try {
        const result = await pool.query(
            'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) RETURNING * ',
            [req.userId, postId]
        );

        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'already liked' });
        }
        if (err.code === '23503') {
            return res.status(404).json({ error: "post or user not found" });
        }
        console.error(err);
        res.status(500).json({ error: "Something went wrong" });
    }

});

router.delete('/:id/likes', async (req, res) => {
    const postId = Number(req.params.id)

    if (!Number.isInteger(postId) || postId < 1) {
        return res.status(400).json({ error: "post id must be a number" })
    }

    try {
        const result = await pool.query(
            "DELETE FROM likes WHERE user_id = $1 and post_id= $2 ",
            [req.userId, postId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Post was never liked' });
        }
        res.status(204).end();
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong" });
    }

});

router.post('/:id/comments', async (req, res) => {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId) || postId < 1) {
        return res.status(400).json({ error: "post id must be a number" })
    }

    try {
        const result = await pool.query(
            "INSERT INTO comments (post_id,user_id, body) VALUES ($1, $2, $3) RETURNING *",
            [postId, req.userId, req.body.body]
        );
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        if (err.code === "23514") {
            return res.status(400).json({ error: "comment must be between 10 and 500 characters" });
        }

        if (err.code === "23503") {
            return res.status(404).json({ error: "the post or user does not exist" })
        }

        console.error(err);
        res.status(500).json({ error: 'Something went wrong' });
    }

});

router.delete("/:id", async (req,res)=>{
    const postId=Number(req.params.id);

    if (!Number.isInteger(postId) || postId < 1) {
        return res.status(400).json({ error: 'post id must be a number' });
    }

    try{
        const found= await pool.query(
            `SELECT user_id FROM posts WHERE id = $1`,
            [postId]
        );
        const post = found.rows[0]

        if(!post){
            return res.status(404).json({error:"Post not found"})
        }

        if(post.user_id !== req.userId){
            return res.status(403).json({error:"you can only delete your own post"});
        }

        await pool.query('DELETE FROM posts WHERE id=$1',[postId]);
        res.status(204).end();
    }
    catch(err){
        console.error(err);
        res.status(500).json({error:"Something went wrong"});

    }
});

module.exports = router;
