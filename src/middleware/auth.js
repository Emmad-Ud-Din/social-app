const jwt=require('jsonwebtoken')


function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: "login required" });
    }
    const token = header.slice(7);
    try {
        const data = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = data.userId;
        next();
    }
    catch (err) {
        return res.status(401).json({ error: "invalid or expired token" });
    }
}

module.exports=requireAuth;
