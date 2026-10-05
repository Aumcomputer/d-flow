const express = require('express');
const router = express.Router();
const { getDflowConnection, getHisConnection } = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { getIO } = require('../lib/socket');

// Helper to log activities
async function logActivity(conn, an, action, details, userId, role = 'user') {
    try {
        await conn.query(
            `INSERT INTO activity_logs (an, action, details, user_id, role) VALUES (?, ?, ?, ?, ?)`,
            [an, action, details, userId, role]
        );
    } catch (e) {
        console.error('Failed to log activity:', e);
    }
}

// 1. Search hospitals from HIS (hospcode table)
router.get('/hospitals', authMiddleware, async (req, res) => {
    let conn;
    try {
        const query = (req.query.q || '').trim();
        if (!query || query.length < 1) {
            return res.json([]);
        }

        const { getRedisClient } = require('../lib/redis');
        const redis = getRedisClient();
        const cacheKey = `cache:master:hospitals:${query.toLowerCase()}`;
        try {
            const cached = await redis.get(cacheKey);
            if (cached) return res.json(JSON.parse(cached));
        } catch (e) { console.error('Redis Get Error:', e); }

        conn = await getHisConnection();
        const pattern = `%${query}%`;
        const exactMatch = query;

        const sql = `
            SELECT hospcode, name, province_name, hosptype
            FROM hospcode
            WHERE hospcode LIKE ? OR name LIKE ?
            ORDER BY 
                CASE 
                    WHEN hospcode = ? THEN 1
                    WHEN name LIKE ? THEN 2
                    ELSE 3 
                END,
                name ASC
            LIMIT 30
        `;

        const rows = await conn.query(sql, [pattern, pattern, exactMatch, `${query}%`]);
        try {
            await redis.setEx(cacheKey, 604800, JSON.stringify(rows)); // 7d
        } catch (e) { console.error('Redis Set Error:', e); }

        res.json(rows);
    } catch (err) {
        console.error('Error searching hospitals:', err);
        res.status(500).json({ error: 'Failed to search hospitals', message: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// 2. Get patient default diagnosis from HIS
router.get('/patient-diag/:an', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { an } = req.params;
        conn = await getHisConnection();

        // 1. Check iptdiag
        const diagRows = await conn.query(`
            SELECT 
                id.diagtype, 
                id.icd10, 
                COALESCE(NULLIF(TRIM(id.diagnosis_note), ''), icd.name, '') as diag_name
            FROM iptdiag id 
            LEFT JOIN icd101 icd ON id.icd10 = icd.code 
            WHERE id.an = ?
            ORDER BY id.diagtype ASC
        `, [an]);

        // 2. Check an_stat for pdx
        const statRows = await conn.query(`
            SELECT a.pdx, icd.name as pdx_name 
            FROM an_stat a
            LEFT JOIN icd101 icd ON a.pdx = icd.code
            WHERE a.an = ?
        `, [an]);

        const pdx = statRows[0]?.pdx || null;
        const pdxName = statRows[0]?.pdx_name || null;

        res.json({
            pdx,
            pdxName,
            diagList: diagRows
        });
    } catch (err) {
        console.error('Error fetching patient diagnosis:', err);
        res.status(500).json({ error: 'Failed to fetch diagnosis', message: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// 3. Get all refer back records for an AN
router.get('/:an', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { an } = req.params;
        conn = await getDflowConnection();

        const sql = `
            SELECT 
                id, an, hospcode, hospname, diagnosis, reason, 
                status, responder_name, remark, 
                contact_datetime, recorded_by, recorded_by_name,
                created_at, updated_at
            FROM refer_backs
            WHERE an = ?
            ORDER BY contact_datetime DESC, id DESC
        `;

        const rows = await conn.query(sql, [an]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching refer back records:', err);
        res.status(500).json({ error: 'Failed to fetch refer back records', message: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// 4. Create a new refer back record
router.post('/:an', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { an } = req.params;
        const {
            hospcode,
            hospname,
            diagnosis,
            reason,
            status,
            responder_name,
            remark,
            contact_datetime
        } = req.body;

        // Validation
        if (!hospcode || !hospname) {
            return res.status(400).json({ error: 'กรุณาระบุโรงพยาบาลที่ประสานส่งกลับ' });
        }
        if (!reason || !reason.trim()) {
            return res.status(400).json({ error: 'กรุณาระบุเหตุผลที่ส่งกลับ' });
        }
        if (!status || !['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'กรุณาระบุผลการประสาน (รับ หรือ ปฏิเสธ)' });
        }
        if (!responder_name || !responder_name.trim()) {
            return res.status(400).json({ error: 'กรุณาระบุชื่อผู้ตอบ รับ / ปฏิเสธ' });
        }

        const userLoginname = req.user?.loginname || 'unknown';
        const userName = req.user?.name || req.user?.fullname || userLoginname;
        const contactTime = contact_datetime ? new Date(contact_datetime) : new Date();

        conn = await getDflowConnection();

        const insertSql = `
            INSERT INTO refer_backs (
                an, hospcode, hospname, diagnosis, reason, 
                status, responder_name, remark, contact_datetime, 
                recorded_by, recorded_by_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await conn.query(insertSql, [
            an,
            hospcode.trim(),
            hospname.trim(),
            diagnosis ? diagnosis.trim() : null,
            reason.trim(),
            status,
            responder_name.trim(),
            remark ? remark.trim() : null,
            contactTime,
            userLoginname,
            userName
        ]);

        const newId = Number(result.insertId);

        // Activity log
        const statusTh = status === 'accepted' ? 'รับ' : 'ปฏิเสธ';
        await logActivity(
            conn,
            an,
            'refer_back_created',
            `ประสานส่งกลับ ${hospname.trim()} (${statusTh}) โดยผู้ตอบ: ${responder_name.trim()}`,
            userLoginname,
            req.user?.role || 'user'
        );

        // Emit Socket event to update clients in real-time
        try {
            getIO().emit('referback:updated', { an, id: newId, status });
        } catch (socketErr) {
            console.warn('Socket emit error:', socketErr.message);
        }

        res.status(201).json({
            success: true,
            id: newId,
            message: 'บันทึกข้อมูลการประสานส่งกลับสำเร็จ'
        });
    } catch (err) {
        console.error('Error creating refer back record:', err);
        res.status(500).json({ error: 'Failed to create refer back record', message: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// 5. Delete a refer back record
router.delete('/:id', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { id } = req.params;
        conn = await getDflowConnection();

        const existing = await conn.query('SELECT an, hospname, status, responder_name FROM refer_backs WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Record not found' });
        }

        const record = existing[0];
        await conn.query('DELETE FROM refer_backs WHERE id = ?', [id]);

        // Activity log
        await logActivity(
            conn,
            record.an,
            'refer_back_deleted',
            `ลบรายการประสานส่งกลับ ${record.hospname} (ผู้ตอบ: ${record.responder_name})`,
            req.user?.loginname || 'unknown',
            req.user?.role || 'user'
        );

        // Emit Socket event
        try {
            getIO().emit('referback:updated', { an: record.an, deletedId: id });
        } catch (socketErr) {
            console.warn('Socket emit error:', socketErr.message);
        }

        res.json({ success: true, message: 'ลบรายการประสานส่งกลับเรียบร้อยแล้ว' });
    } catch (err) {
        console.error('Error deleting refer back record:', err);
        res.status(500).json({ error: 'Failed to delete refer back record', message: err.message });
    } finally {
        if (conn) conn.release();
    }
});

module.exports = router;
