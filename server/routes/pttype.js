const express = require('express');
const crypto = require('crypto');
const { getHisConnection, getDflowConnection } = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/pttype/doctors
// Get active doctors from HIS for searchable doctor dropdown
router.get('/doctors', authMiddleware, async (req, res) => {
    let conn;
    try {
        conn = await getHisConnection();
        const rows = await conn.query(
            "SELECT code, name FROM doctor WHERE active = 'Y' ORDER BY name ASC"
        );
        res.json(rows);
    } catch (error) {
        console.error('Fetch doctors error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

// GET /api/pttype/pttypes
// Get active pttypes from HIS (where isuse = 'Y') for searchable select
router.get('/pttypes', authMiddleware, async (req, res) => {
    let conn;
    try {
        conn = await getHisConnection();
        const rows = await conn.query(
            "SELECT pttype, name FROM pttype WHERE isuse = 'Y' ORDER BY name ASC"
        );
        res.json(rows);
    } catch (error) {
        console.error('Fetch pttypes error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

// GET /api/pttype/unverified
// Get all current inpatients in the hospital where an_detail.chk_right is null or not checked
router.get('/unverified', authMiddleware, async (req, res) => {
    let hisConn, dflowConn;
    try {
        hisConn = await getHisConnection();
        dflowConn = await getDflowConnection();

        // 1. Fetch all admitted inpatients in the hospital (dchstts IS NULL)
        const hisQuery = `
            SELECT 
                i.an, i.hn, i.regdate as admit_date, i.regtime as admit_time,
                p.pname, p.fname, p.lname, p.birthday,
                (YEAR(CURDATE()) - YEAR(p.birthday)) - (RIGHT(CURDATE(),5) < RIGHT(p.birthday,5)) AS age_y,
                w.name AS ward_name,
                w.ward AS ward_code,
                COALESCE(d.name, d2.name) AS doctor_name,
                pt.name AS pttype_name,
                pt.pttype AS pttype_code,
                iptb.bedno,
                COALESCE(aa.income, 0) AS total_income
            FROM ipt i
            LEFT JOIN patient p ON i.hn = p.hn
            LEFT JOIN ward w ON i.ward = w.ward
            LEFT JOIN doctor d ON i.incharge_doctor = d.code
            LEFT JOIN doctor d2 ON i.admdoctor = d2.code
            LEFT JOIN pttype pt ON i.pttype = pt.pttype
            LEFT JOIN iptadm iptb ON i.an = iptb.an
            LEFT JOIN an_stat aa ON aa.an = i.an
            WHERE i.dchstts IS NULL
            GROUP BY i.an
            ORDER BY w.name ASC, iptb.bedno ASC, i.regdate DESC
        `;
        const hisPatients = await hisConn.query(hisQuery);

        if (hisPatients.length === 0) {
            return res.json({ patients: [], count: 0 });
        }

        // 2. Fetch an_detail records to check which patients already have chk_right checked
        const ans = hisPatients.map(p => p.an);
        const placeholders = ans.map(() => '?').join(',');
        const dflowQuery = `
            SELECT an, chk_right, discharge_date 
            FROM an_detail 
            WHERE an IN (${placeholders})
        `;
        const dflowRows = await dflowConn.query(dflowQuery, ans);

        // A patient is considered "checked" if chk_right is filled or already discharged in D-Flow
        const checkedAnSet = new Set(
            dflowRows
                .filter(r => (r.chk_right && r.chk_right.trim() !== '') || r.discharge_date !== null)
                .map(r => r.an)
        );

        // 3. Filter only patients where chk_right is null / not checked
        const unverifiedPatients = hisPatients
            .filter(p => !checkedAnSet.has(p.an))
            .map(row => {
                const item = { ...row };
                for (const key in item) {
                    if (typeof item[key] === 'bigint') {
                        item[key] = Number(item[key]);
                    }
                }
                return item;
            });

        res.json({
            patients: unverifiedPatients,
            count: unverifiedPatients.length,
            totalAdmitted: hisPatients.length
        });
    } catch (error) {
        console.error('Fetch pttype unverified patients error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (hisConn) hisConn.release();
        if (dflowConn) dflowConn.release();
    }
});

// POST /api/pttype/consult/:an
// Submit right consultation (ส่งปรึกษาสิทธิการรักษา)
router.post('/consult/:an', authMiddleware, async (req, res) => {
    let dflowConn;
    try {
        const { an } = req.params;
        const { urgency, reason, doctor_code, doctor_name } = req.body;
        const loginname = req.user?.loginname;

        if (!urgency || !reason) {
            return res.status(400).json({ error: 'กรุณาระบุความเร่งด่วนและสาเหตุที่ส่งปรึกษา' });
        }

        dflowConn = await getDflowConnection();

        // Upsert into an_detail
        await dflowConn.query(
            `INSERT INTO an_detail (
                an, 
                consult_pttype_urgency, 
                consult_pttype_reason, 
                consult_pttype_doctor_code, 
                consult_pttype_doctor_name, 
                consult_pttype_by, 
                consult_pttype_date, 
                consult_pttype_status
            ) VALUES (?, ?, ?, ?, ?, ?, NOW(), 'pending')
            ON DUPLICATE KEY UPDATE
                consult_pttype_urgency = VALUES(consult_pttype_urgency),
                consult_pttype_reason = VALUES(consult_pttype_reason),
                consult_pttype_doctor_code = VALUES(consult_pttype_doctor_code),
                consult_pttype_doctor_name = VALUES(consult_pttype_doctor_name),
                consult_pttype_by = VALUES(consult_pttype_by),
                consult_pttype_date = NOW(),
                consult_pttype_status = 'pending'`,
            [an, urgency, reason, doctor_code || null, doctor_name || null, loginname]
        );

        // Record activity log
        await dflowConn.query(
            'INSERT INTO activity_logs (an, action_type, loginname) VALUES (?, ?, ?)',
            [an, 'CONSULT_PTTYPE', loginname]
        );

        // WebSocket notification
        const { getIO } = require('../lib/socket');
        try {
            getIO().emit('pttype:consult_updated', { 
                an, 
                urgency, 
                doctor_name, 
                sender: req.user?.name || loginname 
            });
            getIO().emit('workflow:updated', { an, type: 'pttype_consult' });
        } catch (e) {
            console.error('Socket emit error:', e);
        }

        res.json({ success: true, message: 'ส่งปรึกษาสิทธิการรักษาเรียบร้อยแล้ว' });
    } catch (error) {
        console.error('Submit pttype consult error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dflowConn) dflowConn.release();
    }
});

// POST /api/pttype/cancel-consult/:an
// Cancel right consultation with password verification
router.post('/cancel-consult/:an', authMiddleware, async (req, res) => {
    let dflowConn, hisConn;
    try {
        const { an } = req.params;
        const { password } = req.body;
        const loginname = req.user?.loginname;

        if (!password) {
            return res.status(400).json({ error: 'กรุณาระบุรหัสผ่านเพื่อยืนยัน' });
        }

        // Verify password against opduser
        hisConn = await getHisConnection();
        const hashedPassword = crypto.createHash('md5').update(password).digest('hex');
        const userRows = await hisConn.query(
            'SELECT loginname, name, account_disable FROM opduser WHERE loginname = ? AND passweb = ?',
            [loginname, hashedPassword]
        );

        if (userRows.length === 0) {
            return res.status(400).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
        }

        if (userRows[0].account_disable === 'Y') {
            return res.status(403).json({ error: 'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน' });
        }

        dflowConn = await getDflowConnection();
        await dflowConn.query(
            `UPDATE an_detail SET
                consult_pttype_urgency = NULL,
                consult_pttype_reason = NULL,
                consult_pttype_doctor_code = NULL,
                consult_pttype_doctor_name = NULL,
                consult_pttype_by = NULL,
                consult_pttype_date = NULL,
                consult_pttype_status = NULL,
                grant_pttype_code = NULL,
                grant_pttype_name = NULL,
                grant_pttype_is_other = 0,
                grant_pttype_other_text = NULL,
                grant_pttype_asm_type = NULL,
                grant_pttype_by = NULL,
                grant_pttype_date = NULL
             WHERE an = ?`,
            [an]
        );

        await dflowConn.query(
            'INSERT INTO activity_logs (an, action_type, loginname) VALUES (?, ?, ?)',
            [an, 'CANCEL_CONSULT_PTTYPE', loginname]
        );

        const { getIO } = require('../lib/socket');
        try {
            getIO().emit('pttype:consult_updated', { an, status: 'cancelled' });
            getIO().emit('workflow:updated', { an, type: 'pttype_consult_cancelled' });
        } catch (e) {
            console.error('Socket emit error:', e);
        }

        res.json({ success: true, message: 'ยกเลิกการส่งปรึกษาสิทธิเรียบร้อยแล้ว' });
    } catch (error) {
        console.error('Cancel consult error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dflowConn) dflowConn.release();
        if (hisConn) hisConn.release();
    }
});

// POST /api/pttype/grant/:an
// Save granted right by rights officer (สำหรับเจ้าหน้าที่งานสิทธิ์มากรอกให้สิทธิ์)
router.post('/grant/:an', authMiddleware, async (req, res) => {
    let dflowConn;
    try {
        const { an } = req.params;
        const { pttype_code, pttype_name, is_other, other_text, asm_type, comment } = req.body;
        const loginname = req.user?.loginname;

        if (is_other) {
            if (!other_text || !other_text.trim()) {
                return res.status(400).json({ error: 'กรุณากรอกรายละเอียดสิทธิ์อื่นๆ' });
            }
        } else {
            if (!pttype_name || !pttype_name.trim()) {
                return res.status(400).json({ error: 'กรุณาเลือกสิทธิ์การรักษา' });
            }
        }

        dflowConn = await getDflowConnection();

        await dflowConn.query(
            `UPDATE an_detail SET
                grant_pttype_code = ?,
                grant_pttype_name = ?,
                grant_pttype_is_other = ?,
                grant_pttype_other_text = ?,
                grant_pttype_asm_type = ?,
                grant_pttype_by = ?,
                grant_pttype_date = NOW()
             WHERE an = ?`,
            [
                is_other ? null : (pttype_code || null),
                is_other ? other_text.trim() : (pttype_name || null),
                is_other ? 1 : 0,
                is_other ? other_text.trim() : null,
                asm_type || null,
                loginname,
                an
            ]
        );

        // If comment was provided during grant, save it to pttype_comments
        if (comment && comment.trim()) {
            await dflowConn.query(
                'INSERT INTO pttype_comments (an, comment, created_by, created_at) VALUES (?, ?, ?, NOW())',
                [an, comment.trim(), loginname]
            );
        }

        // Record activity log
        await dflowConn.query(
            'INSERT INTO activity_logs (an, action_type, loginname) VALUES (?, ?, ?)',
            [an, 'GRANT_PTTYPE', loginname]
        );

        // WebSocket notification
        const { getIO } = require('../lib/socket');
        try {
            getIO().emit('pttype:consult_updated', { an, status: 'granted' });
            getIO().emit('workflow:updated', { an, type: 'pttype_granted' });
        } catch (e) {
            console.error('Socket emit error:', e);
        }

        res.json({ success: true, message: 'บันทึกการให้สิทธิ์เรียบร้อยแล้ว' });
    } catch (error) {
        console.error('Grant pttype error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dflowConn) dflowConn.release();
    }
});

// POST /api/pttype/cancel-grant/:an
// Cancel granted right with password confirmation
router.post('/cancel-grant/:an', authMiddleware, async (req, res) => {
    let dflowConn, hisConn;
    try {
        const { an } = req.params;
        const { password } = req.body;
        const loginname = req.user?.loginname;

        if (!password) {
            return res.status(400).json({ error: 'กรุณาระบุรหัสผ่านเพื่อยืนยัน' });
        }

        // Verify password against opduser
        hisConn = await getHisConnection();
        const hashedPassword = crypto.createHash('md5').update(password).digest('hex');
        const userRows = await hisConn.query(
            'SELECT loginname, name, account_disable FROM opduser WHERE loginname = ? AND passweb = ?',
            [loginname, hashedPassword]
        );

        if (userRows.length === 0) {
            return res.status(400).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
        }

        if (userRows[0].account_disable === 'Y') {
            return res.status(403).json({ error: 'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน' });
        }

        dflowConn = await getDflowConnection();
        await dflowConn.query(
            `UPDATE an_detail SET
                grant_pttype_code = NULL,
                grant_pttype_name = NULL,
                grant_pttype_is_other = 0,
                grant_pttype_other_text = NULL,
                grant_pttype_asm_type = NULL,
                grant_pttype_by = NULL,
                grant_pttype_date = NULL
             WHERE an = ?`,
            [an]
        );

        await dflowConn.query(
            'INSERT INTO activity_logs (an, action_type, loginname) VALUES (?, ?, ?)',
            [an, 'CANCEL_GRANT_PTTYPE', loginname]
        );

        const { getIO } = require('../lib/socket');
        try {
            getIO().emit('pttype:consult_updated', { an, status: 'grant_cancelled' });
            getIO().emit('workflow:updated', { an, type: 'pttype_grant_cancelled' });
        } catch (e) {
            console.error('Socket emit error:', e);
        }

        res.json({ success: true, message: 'ยกเลิกข้อมูลการให้สิทธิ์เรียบร้อยแล้ว' });
    } catch (error) {
        console.error('Cancel grant error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dflowConn) dflowConn.release();
        if (hisConn) hisConn.release();
    }
});

// GET /api/pttype/consults
// Get list of consulted patients for tab "อนุมัติสิทธิ์"
// Query param: ?history=true to fetch approved consults, default to pending consults
router.get('/consults', authMiddleware, async (req, res) => {
    let dflowConn, hisConn;
    try {
        dflowConn = await getDflowConnection();
        const { history } = req.query;

        // 1. Fetch patients with consult_pttype_date from an_detail
        // If history === 'true', fetch already granted/approved consults
        // Otherwise (default), fetch only pending consults (where grant_pttype_date IS NULL)
        const sql = history === 'true' ? `
            SELECT 
                an, 
                consult_pttype_urgency, 
                consult_pttype_reason, 
                consult_pttype_doctor_code, 
                consult_pttype_doctor_name, 
                consult_pttype_by, 
                consult_pttype_date, 
                consult_pttype_status,
                grant_pttype_code,
                grant_pttype_name,
                grant_pttype_is_other,
                grant_pttype_other_text,
                grant_pttype_asm_type,
                grant_pttype_by,
                grant_pttype_date
            FROM an_detail 
            WHERE consult_pttype_date IS NOT NULL 
              AND grant_pttype_date IS NOT NULL
            ORDER BY grant_pttype_date DESC
            LIMIT 100
        ` : `
            SELECT 
                an, 
                consult_pttype_urgency, 
                consult_pttype_reason, 
                consult_pttype_doctor_code, 
                consult_pttype_doctor_name, 
                consult_pttype_by, 
                consult_pttype_date, 
                consult_pttype_status,
                grant_pttype_code,
                grant_pttype_name,
                grant_pttype_is_other,
                grant_pttype_other_text,
                grant_pttype_asm_type,
                grant_pttype_by,
                grant_pttype_date
            FROM an_detail 
            WHERE consult_pttype_date IS NOT NULL 
              AND grant_pttype_date IS NULL
            ORDER BY 
                CASE WHEN consult_pttype_urgency = 'ฉุกเฉิน' THEN 1 ELSE 2 END,
                consult_pttype_date DESC
        `;

        const consultRows = await dflowConn.query(sql);

        if (consultRows.length === 0) {
            return res.json({ consults: [], count: 0 });
        }

        const ans = consultRows.map(r => r.an);
        const placeholders = ans.map(() => '?').join(',');

        // 2. Fetch patient demographic from HIS
        hisConn = await getHisConnection();
        const hisQuery = `
            SELECT 
                i.an, i.hn, i.regdate as admit_date, i.regtime as admit_time,
                p.pname, p.fname, p.lname, p.birthday,
                (YEAR(CURDATE()) - YEAR(p.birthday)) - (RIGHT(CURDATE(),5) < RIGHT(p.birthday,5)) AS age_y,
                w.name AS ward_name,
                pt.name AS pttype_name,
                iptb.bedno,
                COALESCE(d.name, '') AS incharge_doctor_name
            FROM ipt i
            LEFT JOIN patient p ON i.hn = p.hn
            LEFT JOIN ward w ON i.ward = w.ward
            LEFT JOIN doctor d ON i.incharge_doctor = d.code
            LEFT JOIN pttype pt ON i.pttype = pt.pttype
            LEFT JOIN iptadm iptb ON i.an = iptb.an
            WHERE i.an IN (${placeholders})
            GROUP BY i.an
        `;
        const hisRows = await hisConn.query(hisQuery, ans);
        const hisMap = new Map();
        hisRows.forEach(r => hisMap.set(r.an, r));

        // 3. Resolve user names for consult_pttype_by and grant_pttype_by
        const loginnames = [
            ...new Set(
                consultRows.flatMap(r => [r.consult_pttype_by, r.grant_pttype_by]).filter(Boolean)
            )
        ];
        const userMap = {};
        if (loginnames.length > 0) {
            const userPlaceholders = loginnames.map(() => '?').join(',');
            const users = await hisConn.query(
                `SELECT loginname, name FROM opduser WHERE loginname IN (${userPlaceholders})`,
                loginnames
            );
            users.forEach(u => {
                userMap[u.loginname] = u.name;
            });
        }

        // 4. Merge results
        const merged = consultRows.map(c => {
            const his = hisMap.get(c.an) || {};
            return {
                an: c.an,
                hn: his.hn || '-',
                pname: his.pname || '',
                fname: his.fname || '',
                lname: his.lname || '',
                age_y: his.age_y ?? null,
                ward_name: his.ward_name || '-',
                bedno: his.bedno || '-',
                pttype_name: his.pttype_name || '-',
                admit_date: his.admit_date || null,
                incharge_doctor_name: his.incharge_doctor_name || '',
                consult_pttype_urgency: c.consult_pttype_urgency,
                consult_pttype_reason: c.consult_pttype_reason,
                consult_pttype_doctor_code: c.consult_pttype_doctor_code,
                consult_pttype_doctor_name: c.consult_pttype_doctor_name,
                consult_pttype_by: c.consult_pttype_by,
                consult_pttype_by_name: userMap[c.consult_pttype_by] || c.consult_pttype_by || '-',
                consult_pttype_date: c.consult_pttype_date,
                consult_pttype_status: c.consult_pttype_status || 'pending',
                grant_pttype_code: c.grant_pttype_code,
                grant_pttype_name: c.grant_pttype_name,
                grant_pttype_is_other: c.grant_pttype_is_other,
                grant_pttype_other_text: c.grant_pttype_other_text,
                grant_pttype_asm_type: c.grant_pttype_asm_type,
                grant_pttype_by: c.grant_pttype_by,
                grant_pttype_by_name: userMap[c.grant_pttype_by] || c.grant_pttype_by || '-',
                grant_pttype_date: c.grant_pttype_date
            };
        });

        res.json({
            consults: merged,
            count: merged.length
        });
    } catch (error) {
        console.error('Fetch pttype consults error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dflowConn) dflowConn.release();
        if (hisConn) hisConn.release();
    }
});

// GET /api/pttype/comments/:an
// Get list of comments for an AN
router.get('/comments/:an', authMiddleware, async (req, res) => {
    let dflowConn, hisConn;
    try {
        const { an } = req.params;
        dflowConn = await getDflowConnection();
        const rows = await dflowConn.query(
            'SELECT id, an, comment, created_by, created_at FROM pttype_comments WHERE an = ? ORDER BY created_at ASC',
            [an]
        );

        if (rows.length === 0) {
            return res.json([]);
        }

        // Resolve names for created_by
        const loginnames = [...new Set(rows.map(r => r.created_by).filter(Boolean))];
        const userMap = {};

        if (loginnames.length > 0) {
            const { getRedisClient } = require('../lib/redis');
            const redis = getRedisClient();
            const missingNames = [];

            try {
                const keys = loginnames.map(u => `user:name:${u}`);
                const cachedNames = await redis.mGet(keys);
                loginnames.forEach((u, index) => {
                    if (cachedNames[index]) userMap[u] = cachedNames[index];
                    else missingNames.push(u);
                });
            } catch (err) {
                console.error('Redis MGET Error:', err);
                missingNames.push(...loginnames);
            }

            if (missingNames.length > 0) {
                hisConn = await getHisConnection();
                const placeholders = missingNames.map(() => '?').join(',');
                const users = await hisConn.query(
                    `SELECT loginname, name FROM opduser WHERE loginname IN (${placeholders})`,
                    missingNames
                );
                const multi = redis.multi();
                users.forEach(u => {
                    userMap[u.loginname] = u.name;
                    multi.setEx(`user:name:${u.loginname}`, 604800, u.name);
                });
                try {
                    await multi.exec();
                } catch (err) {
                    console.error('Redis SETEX Error:', err);
                }
            }
        }

        const comments = rows.map(r => ({
            id: r.id,
            an: r.an,
            comment: r.comment,
            created_by: r.created_by,
            created_by_name: userMap[r.created_by] || r.created_by || '-',
            created_at: r.created_at
        }));

        res.json(comments);
    } catch (error) {
        console.error('Fetch pttype comments error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dflowConn) dflowConn.release();
        if (hisConn) hisConn.release();
    }
});

// POST /api/pttype/comments/:an
// Add a new comment for an AN
router.post('/comments/:an', authMiddleware, async (req, res) => {
    let dflowConn;
    try {
        const { an } = req.params;
        const { comment } = req.body;
        const loginname = req.user?.loginname;

        if (!comment || !comment.trim()) {
            return res.status(400).json({ error: 'กรุณากรอกข้อความความเห็น' });
        }

        dflowConn = await getDflowConnection();
        const result = await dflowConn.query(
            'INSERT INTO pttype_comments (an, comment, created_by, created_at) VALUES (?, ?, ?, NOW())',
            [an, comment.trim(), loginname]
        );

        // Record activity log
        await dflowConn.query(
            'INSERT INTO activity_logs (an, action_type, loginname) VALUES (?, ?, ?)',
            [an, 'ADD_PTTYPE_COMMENT', loginname]
        );

        // WebSocket notification
        const { getIO } = require('../lib/socket');
        try {
            getIO().emit('pttype:comment_added', { an });
            getIO().emit('workflow:updated', { an, type: 'pttype_comment_added' });
        } catch (e) {
            console.error('Socket emit error:', e);
        }

        res.json({
            success: true,
            id: Number(result.insertId),
            message: 'บันทึกความเห็นเรียบร้อยแล้ว'
        });
    } catch (error) {
        console.error('Add pttype comment error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dflowConn) dflowConn.release();
    }
});

module.exports = router;
