const express = require('express');
const crypto = require('crypto');
const { getHisConnection } = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/:an', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { an } = req.params;
        conn = await getHisConnection();

        const sql = `
            SELECT 
              i.an, i.hn, i.regdate, i.regtime, i.ward AS ward_code, i.dchdate, i.dchtime,
              CONCAT(p.pname, p.fname, ' ', p.lname) AS fullname,
              p.sex, p.birthday, p.cid,
              pt.name AS pttype_name,
              w.name AS ward_name,
              d.name AS doctor_name,
              i.incharge_doctor AS doctor_code,
              ia.bedno,
              aa.income AS total_income,
              aa.rcpt_money,
              aa.paid_money,
              (SELECT COALESCE(SUM(deposit_amount), 0) FROM finance_deposit fd WHERE fd.vn = i.an) AS total_deposit,
              dct.name AS dchtype_name,
              dcs.name AS dchstts_name
            FROM ipt i
            JOIN patient p ON i.hn = p.hn
            LEFT JOIN pttype pt ON i.pttype = pt.pttype
            LEFT JOIN ward w ON i.ward = w.ward
            LEFT JOIN doctor d ON i.incharge_doctor = d.code
            LEFT JOIN iptadm ia ON ia.an = i.an
            LEFT JOIN an_stat aa ON aa.an = i.an
            LEFT JOIN dchtype dct ON i.dchtype = dct.dchtype
            LEFT JOIN dchstts dcs ON i.dchstts = dcs.dchstts
            WHERE i.an = ?
        `;

        const rows = await conn.query(sql, [an]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        const patient = rows[0];
        if (patient.birthday) {
            const today = new Date();
            const birthDate = new Date(patient.birthday);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            patient.age = age;
        } else {
            patient.age = null;
        }

        res.json(patient);
    } catch (error) {
        console.error('Fetch patient error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});
// Serve patient photo from HIS_DB patient_image
// Supports token via cookie
const jwt = require('jsonwebtoken');

router.get('/:hn/image', async (req, res) => {
    let conn;
    try {
        // Check auth from cookie or header
        let token = req.cookies?.token;
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
        }

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        try {
            jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        } catch (err) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { hn } = req.params;
        conn = await getHisConnection();

        const rows = await conn.query(
            'SELECT image FROM patient_image WHERE hn = ? ORDER BY capture_date DESC LIMIT 1',
            [hn]
        );

        if (!rows.length || !rows[0].image) {
            return res.status(404).json({ error: 'No image found' });
        }

        const imgBuffer = rows[0].image;
        // Detect image type from magic bytes
        let contentType = 'image/jpeg';
        if (imgBuffer[0] === 0x89 && imgBuffer[1] === 0x50) {
            contentType = 'image/png';
        } else if (imgBuffer[0] === 0x47 && imgBuffer[1] === 0x49) {
            contentType = 'image/gif';
        }

        res.set({
            'Content-Type': contentType,
            'Content-Length': imgBuffer.length,
            'Cache-Control': 'private, max-age=3600',
        });
        res.send(imgBuffer);
    } catch (error) {
        console.error('Fetch patient image error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

const { getDflowConnection } = require('../config/database');

// Get AN details (discharge info, checklist)
router.get('/:an/detail', authMiddleware, async (req, res) => {
    let conn, hisConn;
    try {
        const { an } = req.params;
        conn = await getDflowConnection();
        const rows = await conn.query('SELECT * FROM an_detail WHERE an = ?', [an]);
        if (rows.length === 0) {
            return res.json({ an });
        }
        
        let detail = rows[0];
        const loginnames = [
            detail.chk_right, detail.chk_nurse, detail.chk_bed, 
            detail.chk_lab_dup, detail.chk_cost_dup, detail.chk_opnote,
            detail.discharge_by, detail.sent_pharmacy_by, detail.pharmacy_pack_by, detail.pharmacy_done_by,
            detail.sent_dc_by, detail.dc_done_by, detail.sent_finance_by, detail.finance_done_by,
            detail.ward_done_by,
            detail.discount_by, detail.consult_pttype_by, detail.grant_pttype_by
        ].filter(Boolean);

        if (loginnames.length > 0) {
            const { getRedisClient } = require('../lib/redis');
            const redis = getRedisClient();
            const uniqueLoginNames = [...new Set(loginnames)];
            const userMap = {};
            const missingNames = [];

            try {
                const keys = uniqueLoginNames.map(u => `user:name:${u}`);
                const cachedNames = await redis.mGet(keys);
                uniqueLoginNames.forEach((u, index) => {
                    if (cachedNames[index]) userMap[u] = cachedNames[index];
                    else missingNames.push(u);
                });
            } catch (err) {
                console.error('Redis MGET Error:', err);
                missingNames.push(...uniqueLoginNames);
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
                    multi.setEx(`user:name:${u.loginname}`, 604800, u.name); // 7 days TTL
                });
                
                try {
                    await multi.exec();
                } catch (err) {
                    console.error('Redis SETEX Error:', err);
                }
            }

            detail.chk_right_name = userMap[detail.chk_right] || null;
            detail.chk_nurse_name = userMap[detail.chk_nurse] || null;
            detail.chk_bed_name = userMap[detail.chk_bed] || null;
            detail.chk_lab_dup_name = userMap[detail.chk_lab_dup] || null;
            detail.chk_cost_dup_name = userMap[detail.chk_cost_dup] || null;
            detail.chk_opnote_name = userMap[detail.chk_opnote] || null;

            detail.discharge_by_name = userMap[detail.discharge_by] || null;
            detail.sent_pharmacy_by_name = userMap[detail.sent_pharmacy_by] || null;
            detail.pharmacy_pack_by_name = userMap[detail.pharmacy_pack_by] || null;
            detail.pharmacy_done_by_name = userMap[detail.pharmacy_done_by] || null;
            detail.sent_dc_by_name = userMap[detail.sent_dc_by] || null;
            detail.dc_done_by_name = userMap[detail.dc_done_by] || null;
            detail.sent_finance_by_name = userMap[detail.sent_finance_by] || null;
            detail.finance_done_by_name = userMap[detail.finance_done_by] || null;
            detail.ward_done_by_name = userMap[detail.ward_done_by] || null;
            detail.discount_by_name = userMap[detail.discount_by] || null;
            detail.consult_pttype_by_name = userMap[detail.consult_pttype_by] || detail.consult_pttype_by || null;
            detail.grant_pttype_by_name = userMap[detail.grant_pttype_by] || detail.grant_pttype_by || null;
        }

        res.json(detail);
    } catch (error) {
        console.error('Fetch an_detail error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
        if (hisConn) hisConn.release();
    }
});

// Save discount
router.post('/:an/discount', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { an } = req.params;
        const { discount_money, discount_detail } = req.body;
        const loginname = req.user.loginname;
        conn = await getDflowConnection();
        
        await conn.query(
            `INSERT INTO an_detail (an, discount_money, discount_detail, discount_by) 
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
             discount_money = VALUES(discount_money), 
             discount_detail = VALUES(discount_detail), 
             discount_by = VALUES(discount_by)`,
            [an, discount_money, discount_detail, loginname]
        );

        await conn.query(
            'INSERT INTO activity_logs (an, action_type, loginname) VALUES (?, ?, ?)',
            [an, 'UPDATE_DISCOUNT', loginname]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Save discount error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

// Discharge patient
router.post('/:an/discharge', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { an } = req.params;
        const loginname = req.user.loginname;
        conn = await getDflowConnection();
        
        await conn.query(
            `INSERT INTO an_detail (an, discharge_by, discharge_date) 
             VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE discharge_by = VALUES(discharge_by), discharge_date = VALUES(discharge_date)`,
            [an, loginname]
        );

        await conn.query(
            'INSERT INTO activity_logs (an, action_type, loginname) VALUES (?, ?, ?)',
            [an, 'DISCHARGE', loginname]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Discharge error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

// Cancel discharge
router.post('/:an/cancel-discharge', authMiddleware, async (req, res) => {
    let conn, hisConn;
    try {
        const { an } = req.params;
        const { password } = req.body;
        const loginname = req.user.loginname;

        if (!password) {
            return res.status(400).json({ error: 'กรุณาระบุรหัสผ่านเพื่อยืนยัน' });
        }

        // Verify password with HIS opduser
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

        conn = await getDflowConnection();
        
        await conn.query(
            `UPDATE an_detail SET 
                discharge_by = NULL, discharge_date = NULL,
                workflow_status = NULL,
                sent_pharmacy_by = NULL, sent_pharmacy_date = NULL,
                pharmacy_done_by = NULL, pharmacy_done_date = NULL,
                sent_dc_by = NULL, sent_dc_date = NULL,
                dc_done_by = NULL, dc_done_date = NULL,
                sent_finance_by = NULL, sent_finance_date = NULL,
                finance_done_by = NULL, finance_done_date = NULL,
                chk_hm = NULL, chk_returnmed = NULL,
                phar_chk_hm = NULL, phar_chk_returnmed = NULL,
                phar_chk_hm_date = NULL, phar_chk_returnmed_date = NULL
             WHERE an = ?`,
            [an]
        );
        
        const { getIO } = require('../lib/socket');
        try {
            getIO().emit('workflow:updated', { an, status: null });
        } catch (e) {
            console.error('Socket emit error:', e);
        }

        await conn.query(
            'INSERT INTO activity_logs (an, action_type, loginname) VALUES (?, ?, ?)',
            [an, 'CANCEL_DISCHARGE', loginname]
        );

        res.json({ success: true, message: 'ยกเลิก Discharge เรียบร้อยแล้ว' });
    } catch (error) {
        console.error('Cancel discharge error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
        if (hisConn) hisConn.release();
    }
});

// Update checklist
router.post('/:an/checklist', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { an } = req.params;
        const { field, checked } = req.body; // field e.g. 'chk_med'
        const loginname = req.user.loginname;
        
        const validFields = ['chk_med', 'chk_nurse', 'chk_lab', 'chk_opnote', 'chk_right', 'chk_bed', 'chk_lab_dup', 'chk_cost_dup'];
        if (!validFields.includes(field)) {
            return res.status(400).json({ error: 'Invalid field' });
        }

        conn = await getDflowConnection();
        
        const updateValue = checked ? loginname : null;
        
        await conn.query(
            `INSERT INTO an_detail (an, ${field}) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE ${field} = VALUES(${field})`,
            [an, updateValue]
        );

        const actionType = checked ? `CHECK_${field.toUpperCase()}` : `UNCHECK_${field.toUpperCase()}`;
        await conn.query(
            'INSERT INTO activity_logs (an, action_type, loginname) VALUES (?, ?, ?)',
            [an, actionType, loginname]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Update checklist error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

// Get activity logs
router.get('/:an/activity-logs', authMiddleware, async (req, res) => {
    let conn, hisConn;
    try {
        const { an } = req.params;
        conn = await getDflowConnection();
        
        const logs = await conn.query(
            `SELECT * FROM activity_logs 
             WHERE an = ?
             ORDER BY created_at DESC`,
            [an]
        );
        
        if (logs.length === 0) {
            return res.json([]);
        }

        hisConn = await getHisConnection();
        const loginnames = [...new Set(logs.map(l => l.loginname).filter(Boolean))];
        let userMap = {};
        
        if (loginnames.length > 0) {
            const placeholders = loginnames.map(() => '?').join(',');
            const users = await hisConn.query(
                `SELECT loginname, name FROM opduser WHERE loginname IN (${placeholders})`,
                loginnames
            );
            users.forEach(u => userMap[u.loginname] = u.name);
        }

        const formattedLogs = logs.map(log => ({
            ...log,
            fullname: userMap[log.loginname] || log.loginname
        }));

        res.json(formattedLogs);
    } catch (error) {
        console.error('Fetch activity logs error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
        if (hisConn) hisConn.release();
    }
});
// Get operations
router.get('/:an/operations', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { an } = req.params;
        const { getSmartorConnection } = require('../config/database');
        conn = await getSmartorConnection();
        
        const rows = await conn.query(`
            SELECT  
                ab.op_date, 
                ats.step_6 as start_time, 
                ats.step_7 as end_time,
                ap.fullname as surgeon,
                COALESCE(aon.post_diag, ab.post_diag) AS post_diag, 
                ab.title_opra,
                aon.operative_procedure
            FROM app_book ab 
            LEFT JOIN app_op_note aon ON ab.reg_id = aon.reg_id 
            LEFT JOIN app_person ap ON ab.surgeon = ap.license 
            LEFT JOIN app_time_stamp ats on ats.reg_id = ab.reg_id
            WHERE ab.an = ?
            ORDER BY ab.op_date DESC, ats.step_6 DESC
        `, [an]);
        
        res.json(rows);
    } catch (error) {
        console.error('Operations error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

// ==================== Automated Audit Checklist ====================

router.get('/:an/audit', authMiddleware, async (req, res) => {
    let conn;
    let localConn;
    let smartorConn;
    try {
        const { an } = req.params;
        conn = await getHisConnection();

        // 1. Lab without specimen
        const labRows = await conn.query(`
            SELECT COUNT(*) AS cnt
            FROM lab_head h
            WHERE h.vn = ? AND (h.receive_date IS NULL OR h.receive_date = '' OR h.receive_date = '0000-00-00')
        `, [an]);
        const labNoSpecimen = Number(labRows[0]?.cnt || 0);

        // 2. Duplicate charges (same conditions as drug profile: exclude income 07, 81, 82)
        const dupRows = await conn.query(`
            SELECT COUNT(*) AS cnt FROM (
                SELECT order_no, icode, COUNT(*) as c
                FROM opitemrece
                WHERE an = ? AND income NOT IN ('07', '81', '82')
                GROUP BY order_no, icode
                HAVING c > 1
            ) dup
        `, [an]);
        const duplicateCharges = Number(dupRows[0]?.cnt || 0);

        // 3. Bed charges (income = 01) completeness
        const admitRows = await conn.query(`
            SELECT i.regdate, i.dchdate FROM ipt i WHERE i.an = ?
        `, [an]);

        let bedMissingDays = 0;
        let bedMissingDates = [];
        if (admitRows.length > 0) {
            const regdate = admitRows[0].regdate;
            const dchdate = admitRows[0].dchdate;

            const toLocalISODate = (d) => {
                if (!(d instanceof Date) || isNaN(d)) return null;
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            const startDate = new Date(regdate);
            const endDate = dchdate ? new Date(dchdate) : new Date();
            
            // Normalize times to midnight to avoid skipping/duplicate days due to DST/time shifts
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);

            // Get all dates that have income 01
            const bedRows = await conn.query(`
                SELECT DISTINCT o.rxdate FROM opitemrece o
                WHERE o.an = ? AND o.income = '01'
            `, [an]);
            
            const bedDates = new Set();
            for (const r of bedRows) {
                // Handle case where rxdate is string or Date object
                const d = r.rxdate instanceof Date ? r.rxdate : new Date(r.rxdate);
                const localDateStr = toLocalISODate(d);
                if (localDateStr) bedDates.add(localDateStr);
            }

            // Check each day
            const cursor = new Date(startDate);
            while (cursor <= endDate) {
                const dateStr = toLocalISODate(cursor);
                if (dateStr && !bedDates.has(dateStr)) {
                    bedMissingDays++;
                    bedMissingDates.push(dateStr);
                }
                cursor.setDate(cursor.getDate() + 1);
            }
        }

        // 4. Document completeness
        const { getDflowConnection } = require('../config/database');
        localConn = await getDflowConnection();
        const docRows = await localConn.query(`
            SELECT doc_type_id FROM documents WHERE an = ?
        `, [an]);
        const uploadedTypes = new Set(docRows.map(r => r.doc_type_id));
        const requiredDocTypes = [1, 2, 3]; // บัตรประชาชน, ใบตรวจสอบสิทธิ์, Authen Code
        const missingDocs = requiredDocTypes.filter(id => !uploadedTypes.has(id));

        // 5. Operation completeness
        const { getSmartorConnection } = require('../config/database');
        smartorConn = await getSmartorConnection();
        const opRows = await smartorConn.query(`
            SELECT 
                COUNT(*) as total_ops,
                SUM(CASE WHEN aon.operative_procedure IS NOT NULL AND aon.operative_procedure != '' THEN 1 ELSE 0 END) as opnotes_completed
            FROM app_book ab
            LEFT JOIN app_op_note aon ON ab.reg_id = aon.reg_id
            WHERE ab.an = ?
        `, [an]);
        const totalOps = Number(opRows[0]?.total_ops || 0);
        const opnotesCompleted = Number(opRows[0]?.opnotes_completed || 0);

        res.json({
            labNoSpecimen,
            duplicateCharges,
            bedMissingDays,
            bedMissingDates,
            docComplete: missingDocs.length === 0,
            docMissing: missingDocs.length,
            totalOps,
            opnotesCompleted
        });
    } catch (error) {
        console.error('Audit checklist error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
        if (localConn) localConn.release();
        if (smartorConn) smartorConn.release();
    }
});

// ==================== Drug Profile ====================

// Drug Profile Headers (Order list)
router.get('/:an/drugs', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { an } = req.params;
        const { getRedisClient } = require('../lib/redis');
        const redis = getRedisClient();
        const cacheKey = `cache:patients:${an}:drugs`;
        
        try {
            const cached = await redis.get(cacheKey);
            if (cached) return res.json(JSON.parse(cached));
        } catch (e) { console.error('Redis Get Error:', e); }

        conn = await getHisConnection();

        const sql = `
            SELECT i.order_type, i.rxdate, i.rxtime, i.order_no,
                   i.item_count, i.amount, i.entry_staff, o.name as entry_staff_name
            FROM ipt_order_no i
            LEFT JOIN opduser o ON i.entry_staff = o.loginname
            WHERE i.an = ?
              AND i.order_type IN ('IRx','EMx','TRx','Hme','ATO','CRx','BCH')
            ORDER BY i.rxdate DESC, i.rxtime DESC
        `;
        const rows = await conn.query(sql, [an]);

        // Check for duplicate icode per order_no
        if (rows.length > 0) {
            const orderNos = rows.map(r => r.order_no);
            const placeholders = orderNos.map(() => '?').join(',');
            const dupSql = `
                SELECT order_no, icode, COUNT(*) as cnt
                FROM opitemrece
                WHERE an = ? AND order_no IN (${placeholders})
                  AND income NOT IN ('07', '81', '82')
                GROUP BY order_no, icode
                HAVING cnt > 1
            `;
            const dupRows = await conn.query(dupSql, [an, ...orderNos]);
            const dupOrderNos = new Set(dupRows.map(r => r.order_no));

            for (const row of rows) {
                row.has_duplicate = dupOrderNos.has(row.order_no);
            }
        }

        try {
            await redis.setEx(cacheKey, 60, JSON.stringify(rows));
        } catch (e) { console.error('Redis Set Error:', e); }

        res.json(rows);
    } catch (error) {
        console.error('Fetch drugs error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

// Drug Profile Details (items in a specific order)
router.get('/:an/drugs/:orderNo', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { an, orderNo } = req.params;
        conn = await getHisConnection();

        const sql = `
            SELECT o.item_no, o.icode, o.income,
                   CONCAT(s.name, ' ', s.strength, ' ', s.units) AS drug_name,
                   o.qty, d.shortlist AS usage_note,
                   o.unitprice, o.sum_price,
                   u.name as staff_name
            FROM opitemrece o
            LEFT JOIN s_drugitems s ON s.icode = o.icode
            LEFT JOIN drugusage d ON d.drugusage = o.drugusage
            LEFT JOIN opduser u ON u.loginname = o.staff
            WHERE o.an = ? AND o.order_no = ?
            ORDER BY o.item_no
        `;
        const rows = await conn.query(sql, [an, orderNo]);

        // Detect duplicate icodes within this order, ignoring income 81 and 82
        const icodeCount = {};
        for (const row of rows) {
            if (row.income != '07' && row.income != '81' && row.income != '82') {
                icodeCount[row.icode] = (icodeCount[row.icode] || 0) + 1;
            }
        }
        for (const row of rows) {
            if (row.income != '07' && row.income != '81' && row.income != '82') {
                row.is_duplicate = icodeCount[row.icode] > 1;
            } else {
                row.is_duplicate = false;
            }
        }

        res.json(rows);
    } catch (error) {
        console.error('Fetch drug details error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

// Returnable Drugs (รายการยาสำหรับตรวจสอบยาคืนของ AN นี้ทั้งหมด)
const getReturnDrugsHandler = async (req, res) => {
    let conn;
    try {
        const { an } = req.params;

        // Parse dosageforms and categories/icodes from .env
        const dosageforms = (process.env.RETURN_MED_DOSAGEFORMS || 'INJECTIONS')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

        const excludeCategories = (process.env.RETURN_MED_EXCLUDE_CATEGORIES || 'FLUIDS AND ELECTROLYTES,INTRAVENOUS SOLOTION,INTRAVENOUS SOLUTION,INTRAVENOUS ANAESTHETICS,LOCAL ANAESTHETICS')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

        const excludeCategoriesLike = (process.env.RETURN_MED_EXCLUDE_CATEGORIES_LIKE || 'ANAESTHETICS')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

        const includeCategoriesLike = (process.env.RETURN_MED_INCLUDE_CATEGORIES_LIKE || 'ANXIOLYTICS,OPIOID,SEDATIVES')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

        const includeIcodes = (process.env.RETURN_MED_INCLUDE_ICODES || '1500513,1460536,1590016,1490407')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

        const excludeNameLike = (process.env.RETURN_MED_EXCLUDE_NAME_LIKE || 'วิสัญญี')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

        conn = await getHisConnection();

        let sql = `
            SELECT DISTINCT o.icode,
                   CONCAT(d.name, IF(d.strength IS NOT NULL AND d.strength != '', CONCAT(' ', d.strength), '')) AS drug_name,
                   d.name, d.strength, d.units
            FROM opitemrece o
            INNER JOIN drugitems d ON d.icode = o.icode
            WHERE o.an = ?
        `;
        const params = [an];

        const orConditions = [];

        // Condition 1: dosageform IN (...) AND drugcategory NOT IN (...) AND drugcategory NOT LIKE ...
        if (dosageforms.length > 0) {
            const dosagePlaceholders = dosageforms.map(() => '?').join(',');
            let cond = `(d.dosageform IN (${dosagePlaceholders})`;
            params.push(...dosageforms);

            const notCategoryConds = [];
            if (excludeCategories.length > 0) {
                const excludePlaceholders = excludeCategories.map(() => '?').join(',');
                notCategoryConds.push(`d.drugcategory NOT IN (${excludePlaceholders})`);
                params.push(...excludeCategories);
            }
            for (const catLike of excludeCategoriesLike) {
                notCategoryConds.push('d.drugcategory NOT LIKE ?');
                params.push(`%${catLike}%`);
            }

            if (notCategoryConds.length > 0) {
                cond += ` AND (d.drugcategory IS NULL OR (${notCategoryConds.join(' AND ')}))`;
            }
            cond += ')';
            orConditions.push(cond);
        }

        // Condition 2: drugcategory LIKE '%...%' (ANXIOLYTICS, OPIOID, SEDATIVES, etc.)
        for (const catLike of includeCategoriesLike) {
            orConditions.push('d.drugcategory LIKE ?');
            params.push(`%${catLike}%`);
        }

        // Condition 3: specific icodes
        if (includeIcodes.length > 0) {
            const icodePlaceholders = includeIcodes.map(() => '?').join(',');
            orConditions.push(`o.icode IN (${icodePlaceholders})`);
            params.push(...includeIcodes);
        }

        if (orConditions.length > 0) {
            sql += ` AND (${orConditions.join(' OR ')})`;
        }

        for (const nameLike of excludeNameLike) {
            sql += ` AND d.name NOT LIKE ?`;
            params.push(`%${nameLike}%`);
        }

        sql += ` ORDER BY drug_name ASC`;

        const rows = await conn.query(sql, params);

        // Fetch saved return drugs from D-Flow DB
        let dflowConn;
        const savedMap = {};
        try {
            dflowConn = await getDflowConnection();
            const savedRows = await dflowConn.query(
                'SELECT icode, qty, created_by, created_at, updated_by, updated_at FROM return_drugs WHERE an = ?',
                [an]
            );
            savedRows.forEach(r => {
                savedMap[r.icode] = {
                    qty: r.qty,
                    created_by: r.created_by,
                    created_at: r.created_at,
                    updated_by: r.updated_by,
                    updated_at: r.updated_at
                };
            });
        } catch (dflowErr) {
            console.error('Fetch return_drugs error from dflow:', dflowErr);
        } finally {
            if (dflowConn) dflowConn.release();
        }

        const result = rows.map(r => {
            const saved = savedMap[r.icode];
            return {
                ...r,
                return_qty: saved ? saved.qty : 0,
                created_by: saved?.created_by || null,
                created_at: saved?.created_at || null,
                updated_by: saved?.updated_by || null,
                updated_at: saved?.updated_at || null
            };
        });

        res.json(result);
    } catch (error) {
        console.error('Fetch return drugs error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
};

router.get('/:an/today-return-drugs', authMiddleware, getReturnDrugsHandler);
router.get('/:an/return-drugs', authMiddleware, getReturnDrugsHandler);

// Save return drugs for an AN
router.post('/:an/return-drugs', authMiddleware, async (req, res) => {
    let dflowConn;
    try {
        const { an } = req.params;
        const loginname = req.user.loginname;
        const items = req.body.items || (req.body.icode !== undefined ? [{ icode: req.body.icode, qty: req.body.qty }] : []);

        dflowConn = await getDflowConnection();

        for (const item of items) {
            const icode = String(item.icode || '').trim();
            const qty = parseInt(item.qty, 10);
            if (!icode) continue;

            if (isNaN(qty) || qty <= 0) {
                await dflowConn.query(
                    'DELETE FROM return_drugs WHERE an = ? AND icode = ?',
                    [an, icode]
                );
            } else {
                await dflowConn.query(
                    `INSERT INTO return_drugs (an, icode, qty, created_by, updated_by)
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        qty = VALUES(qty),
                        updated_by = VALUES(updated_by),
                        updated_at = NOW()`,
                    [an, icode, qty, loginname, loginname]
                );
            }
        }

        // If any return drugs have qty > 0, ensure chk_returnmed is set to 1 in an_detail
        const hasPositiveQty = items.some(it => parseInt(it.qty, 10) > 0);
        if (hasPositiveQty) {
            await dflowConn.query(
                `INSERT INTO an_detail (an, chk_returnmed) VALUES (?, 1)
                 ON DUPLICATE KEY UPDATE chk_returnmed = 1`,
                [an]
            );
        }

        await dflowConn.query(
            'INSERT INTO activity_logs (an, action_type, loginname) VALUES (?, ?, ?)',
            [an, 'UPDATE_RETURN_DRUGS', loginname]
        );

        try {
            const { getIO } = require('../lib/socket');
            getIO().emit('workflow:updated', { an, type: 'update_return_drugs' });
        } catch (e) {
            // Socket might not be initialized in test environments
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Save return drugs error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dflowConn) dflowConn.release();
    }
});

// Update return med checkbox status immediately
router.post('/:an/return-med-status', authMiddleware, async (req, res) => {
    let dflowConn;
    try {
        const { an } = req.params;
        const { chk_returnmed } = req.body;
        const val = chk_returnmed === 1 ? 1 : (chk_returnmed === 0 ? 0 : null);
        const loginname = req.user.loginname;

        dflowConn = await getDflowConnection();
        await dflowConn.query(
            `INSERT INTO an_detail (an, chk_returnmed) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE chk_returnmed = VALUES(chk_returnmed)`,
            [an, val]
        );

        await dflowConn.query(
            'INSERT INTO activity_logs (an, action_type, loginname) VALUES (?, ?, ?)',
            [an, val === 1 ? 'SET_RETURN_MED_YES' : (val === 0 ? 'SET_RETURN_MED_NO' : 'SET_RETURN_MED_NULL'), loginname]
        );

        try {
            const { getIO } = require('../lib/socket');
            getIO().emit('workflow:updated', { an, type: 'return_med_status', chk_returnmed: val });
        } catch (e) {}

        res.json({ success: true });
    } catch (err) {
        console.error('Update return med status error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dflowConn) dflowConn.release();
    }
});

// ==================== Expenses ====================

// Expenses by category
router.get('/:an/expenses', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { an } = req.params;
        conn = await getHisConnection();

        const sql = `
            SELECT o.income AS code, i.name,
                   SUM(o.sum_price) AS total,
                   SUM(IF(o.paidst IN ('01', '03'), o.sum_price, 0)) AS pending
            FROM opitemrece o
            LEFT JOIN income i ON i.income = o.income
            WHERE o.an = ?
            GROUP BY o.income, i.name
            ORDER BY o.income
        `;
        const rows = await conn.query(sql, [an]);
        res.json(rows);
    } catch (error) {
        console.error('Fetch expenses error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

// Expense detail by income code
router.get('/:an/expenses/:incomeCode', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { an, incomeCode } = req.params;
        conn = await getHisConnection();

        const sql = `
            SELECT o.rxdate, o.rxtime, o.icode,
                   COALESCE(d.name, n.name) AS name,
                   o.qty, o.unitprice, o.sum_price, o.paidst,
                   u.name AS entry_staff
            FROM opitemrece o
            LEFT JOIN drugitems d ON d.icode = o.icode
            LEFT JOIN nondrugitems n ON n.icode = o.icode
            LEFT JOIN opduser u ON u.loginname = o.staff
            WHERE o.an = ? AND o.income = ?
            ORDER BY o.rxdate DESC, o.rxtime DESC
        `;
        const rows = await conn.query(sql, [an, incomeCode]);
        res.json(rows);
    } catch (error) {
        console.error('Fetch expense detail error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

// ==================== Lab ====================

router.get('/:an/labs', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { an } = req.params;
        conn = await getHisConnection();

        const sql = `
            SELECT h.lab_order_number, h.order_date, h.order_time,
                   h.receive_date, h.receive_time,
                   h.report_date, h.report_time,
                   h.confirm_report,
                   d.name AS doctor_name,
                   h.form_name,
                   GROUP_CONCAT(DISTINCT s.lab_name SEPARATOR ', ') AS lab_names,
                   SUM(s.price) AS total_price
            FROM lab_head h
            LEFT JOIN doctor d ON d.code = h.doctor_code
            LEFT JOIN lab_order_service s ON s.lab_order_number = h.lab_order_number
            WHERE h.vn = ?
            GROUP BY h.lab_order_number, h.order_date, h.order_time,
                     h.receive_time, h.report_time, h.confirm_report,
                     d.name, h.form_name
            ORDER BY h.order_date DESC, h.order_time DESC
        `;
        const rows = await conn.query(sql, [an]);
        res.json(rows);
    } catch (error) {
        console.error('Fetch labs error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

// ==================== EMR Scan Autologin ====================
router.get('/:hn/emrscan-url', authMiddleware, async (req, res) => {
    try {
        const { hn } = req.params;
        const loginname = req.user.loginname;
        const autologinsecret = process.env.AUTOLOGIN_SECRET;

        if (!autologinsecret) {
            return res.status(500).json({ error: 'AUTOLOGIN_SECRET is not configured on server' });
        }

        const response = await fetch('http://emrscan.local/getTokenAutologin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                loginname,
                hn,
                autologinsecret
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Fetch EMR Scan URL error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ==================== Receipts ====================
router.get('/:an/receipts', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { an } = req.params;
        conn = await getHisConnection();
        const sql = `
            SELECT 
              r.finance_number, r.rcpno, r.bill_date_time, 
              r.total_amount, r.discount, r.bill_amount,
              pt.name as pttype_name,
              o.name as staff_name
            FROM rcpt_print r
            LEFT JOIN pttype pt ON r.pttype = pt.pttype
            LEFT JOIN opduser o ON r.user = o.loginname
            WHERE r.vn = ?
            ORDER BY r.bill_date_time DESC
        `;
        const rows = await conn.query(sql, [an]);
        res.json(rows);
    } catch (error) {
        console.error('Fetch receipts error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

router.get('/:an/receipts/:finance_number', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { finance_number } = req.params;
        conn = await getHisConnection();
        const sql = `
            SELECT 
              d.income as incomecode,
              i.name as income_name,
              d.paidst,
              d.rcptamt as amount,
              d.discount,
              d.total_amount
            FROM rcpt_print_detail d
            LEFT JOIN income i ON d.income = i.income
            WHERE d.finance_number = ?
        `;
        const rows = await conn.query(sql, [finance_number]);
        res.json(rows);
    } catch (error) {
        console.error('Fetch receipt details error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

module.exports = router;
