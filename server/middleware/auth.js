const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    // Check cookie first, fallback to header if needed
    let token = req.cookies?.token;
    
    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized, missing or invalid token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized, token expired or invalid' });
    }
};

module.exports = authMiddleware;
