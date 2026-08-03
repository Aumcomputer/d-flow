const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getHisConnection } = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
    let conn;
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

        conn = await getHisConnection();
        const rows = await conn.query(
            'SELECT loginname, name, account_disable FROM opduser WHERE loginname = ? AND passweb = ?',
            [username, hashedPassword]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = rows[0];
        if (user.account_disable === 'Y') {
            return res.status(403).json({ error: 'Account disabled' });
        }

        const tokenPayload = { loginname: user.loginname, name: user.name };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '8h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.USE_HTTPS === 'true',
            sameSite: 'lax',
            maxAge: 8 * 60 * 60 * 1000 // 8 hours
        });

        res.json({ success: true, user: tokenPayload });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

router.get('/me', authMiddleware, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
