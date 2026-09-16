const express = require('express');
const crypto = require('crypto');
const { getHisConnection, getDflowConnection } = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { getIO } = require('../lib/socket');

// Support BigInt serialization in JSON responses
BigInt.prototype.toJSON = function() {
    return Number(this);
};

const router = express.Router();

async function getWorkflowPatients(status, historyOf = null, reqDate = null) {
    let hisConn, dflowConn;
    try {
        hisConn = await getHisConnection();
        dflowConn = await getDflowConnection();
        
        let queryStr = `SELECT * FROM an_detail WHERE 1=1`;
        let params = [];

        if (historyOf) {
            const filterDate = reqDate || new Date().toISOString().split('T')[0];
            if (historyOf === 'pharmacy') {
                queryStr += ` AND pharmacy_done_by IS NOT NULL AND DATE(pharmacy_done_date) = ?`;
            } else if (historyOf === 'discharge_center') {
                queryStr += ` AND dc_done_by IS NOT NULL AND DATE(dc_done_date) = ?`;
            } else if (historyOf === 'finance') {
                queryStr += ` AND finance_done_by IS NOT NULL AND DATE(finance_done_date) = ?`;
            }
            params.push(filterDate);
        } else if (status === 'pharmacy') {
            queryStr += ` AND chk_hm = 1 AND pharmacy_done_by IS NULL AND workflow_status != 'completed' AND (discharge_by IS NOT NULL OR sent_dc_by IS NOT NULL OR sent_pharmacy_by IS NOT NULL)`;
        } else {
            queryStr += ` AND workflow_status = ?`;
            params.push(status);
        }

        const anRows = await dflowConn.query(queryStr, params);
        
        if (anRows.length === 0) {
            return [];
        }
        
        const ans = anRows.map(r => r.an);
        const placeholders = ans.map(() => '?').join(',');
        
        const query = `
            SELECT 
                i.an, i.hn, p.pname, p.fname, p.lname,
                TIMESTAMPDIFF(YEAR, p.birthday, CURDATE()) as age_y,
                pt.name as pttype_name,
                i.regdate as admit_date,
                w.name as ward_name,
                CONCAT(d.pname, d.fname, ' ', d.lname) as doctor_name,
                COALESCE(ast.income, 0) as total_income,
                COALESCE(ast.rcpt_money, 0) as rcpt_money,
                COALESCE(ast.paid_money, 0) as paid_money,
                (SELECT COALESCE(SUM(deposit_amount), 0) FROM finance_deposit fd WHERE fd.vn = i.an) AS total_deposit,
                i.dchdate, i.dchtime,
                dct.name as dchtype_name,
                dcs.name as dchstts_name
            FROM ipt i
            INNER JOIN patient p ON i.hn = p.hn
            LEFT JOIN pttype pt ON i.pttype = pt.pttype
            LEFT JOIN ward w ON i.ward = w.ward
            LEFT JOIN doctor d ON i.admdoctor = d.code
            LEFT JOIN an_stat ast ON i.an = ast.an
            LEFT JOIN dchtype dct ON i.dchtype = dct.dchtype
            LEFT JOIN dchstts dcs ON i.dchstts = dcs.dchstts
            WHERE i.an IN (${placeholders})
        `;
        
        const rows = await hisConn.query(query, ans);
        
        const result = rows.map(row => {
            const rowCopy = { ...row };
            for (const key in rowCopy) {
                if (typeof rowCopy[key] === 'bigint') {
                    rowCopy[key] = Number(rowCopy[key]);
                }
            }
            const detail = anRows.find(d => d.an === rowCopy.an);
            return { ...rowCopy, ...detail };
        });
        
        result.sort((a, b) => {
            let dateA, dateB;
            if (historyOf === 'pharmacy' || status === 'pharmacy') {
                dateA = new Date(a.sent_pharmacy_date || 0);
                dateB = new Date(b.sent_pharmacy_date || 0);
            } else if (historyOf === 'discharge_center' || status === 'discharge_center') {
                dateA = new Date(a.sent_dc_date || 0);
                dateB = new Date(b.sent_dc_date || 0);
            } else if (historyOf === 'finance' || status === 'finance') {
                dateA = new Date(a.sent_finance_date || 0);
                dateB = new Date(b.sent_finance_date || 0);
            } else {
                dateA = new Date(a.discharge_date || 0);
                dateB = new Date(b.discharge_date || 0);
            }
            return dateA - dateB;
        });

        return result;
        
    } finally {
        if (hisConn) hisConn.release();
        if (dflowConn) dflowConn.release();
    }
}

router.get('/pharmacy', authMiddleware, async (req, res) => {
    try {
        const patients = await getWorkflowPatients('pharmacy');
        res.json(patients);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/discharge-center', authMiddleware, async (req, res) => {
    try {
        const patients = await getWorkflowPatients('discharge_center');
        res.json(patients);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/finance', authMiddleware, async (req, res) => {
    let hisConn, dflowConn;
    try {
        let patients = await getWorkflowPatients('finance');
        
        if (patients.length > 0) {
            hisConn = await getHisConnection();
            dflowConn = await getDflowConnection();
            const ans = patients.map(p => p.an);
            const placeholders = ans.map(() => '?').join(',');
            
            const query = `
                SELECT r.vn, MAX(r.bill_date_time) as bill_time
                FROM rcpt_print r
                JOIN ipt i ON r.vn = i.an
                WHERE r.vn IN (${placeholders}) 
                AND DATE(r.bill_date_time) = i.dchdate
                GROUP BY r.vn
            `;
            const autoCompleted = await hisConn.query(query, ans);
            
            if (autoCompleted.length > 0) {
                const completedAns = autoCompleted.map(r => r.vn);
                for (const row of autoCompleted) {
                    const detailRows = await dflowConn.query('SELECT chk_hm FROM an_detail WHERE an = ?', [row.vn]);
                    const hasHm = detailRows.length > 0 && detailRows[0].chk_hm === 1;
                    const nextStatus = hasHm ? 'pharmacy' : 'completed';
                    const setClause = hasHm
                        ? `UPDATE an_detail 
                           SET workflow_status = 'pharmacy', 
                               finance_done_date = ?, 
                               finance_done_by = 'Auto (HIS)',
                               sent_pharmacy_by = 'Auto (HIS)',
                               sent_pharmacy_date = NOW()
                           WHERE an = ?`
                        : `UPDATE an_detail 
                           SET workflow_status = 'completed', 
                               finance_done_date = ?, 
                               finance_done_by = 'Auto (HIS)' 
                           WHERE an = ?`;

                    await dflowConn.query(setClause, [row.bill_time, row.vn]);
                    const { getIO } = require('../lib/socket');
                    getIO().emit('workflow:updated', { an: row.vn, status: nextStatus });
                }
                
                patients = patients.filter(p => !completedAns.includes(p.an));
            }
        }
        
        res.json(patients);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (hisConn) hisConn.release();
        if (dflowConn) dflowConn.release();
    }
});

router.get('/pharmacy/history', authMiddleware, async (req, res) => {
    try {
        const patients = await getWorkflowPatients(null, 'pharmacy', req.query.date);
        res.json(patients);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/discharge-center/history', authMiddleware, async (req, res) => {
    try {
        const patients = await getWorkflowPatients(null, 'discharge_center', req.query.date);
        res.json(patients);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/finance/history', authMiddleware, async (req, res) => {
    try {
        const patients = await getWorkflowPatients(null, 'finance', req.query.date);
        res.json(patients);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Search drugs from HIS drugitems table
router.get('/drugs/search', authMiddleware, async (req, res) => {
    let hisConn;
    try {
        const query = (req.query.q || '').trim();
        if (!query) {
            return res.json([]);
        }
        hisConn = await getHisConnection();
        const sql = `
            SELECT icode, name, strength, units, dosageform,
                   CONCAT(name, IF(strength IS NOT NULL AND strength != '', CONCAT(' ', strength), '')) AS drug_name
            FROM drugitems
            WHERE istatus = 'Y' AND (name LIKE ? OR icode LIKE ?)
            ORDER BY name ASC
            LIMIT 30
        `;
        const rows = await hisConn.query(sql, [`%${query}%`, `%${query}%`]);
        res.json(rows);
    } catch (err) {
        console.error('Drug search error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (hisConn) hisConn.release();
    }
});

// Fetch patients who have return meds for pharmacy audit
router.get('/pharmacy/return-meds', authMiddleware, async (req, res) => {
    let hisConn, dflowConn;
    try {
        dflowConn = await getDflowConnection();
        hisConn = await getHisConnection();

        const anRows = await dflowConn.query(`
            SELECT 
                COALESCE(a.an, rd_ans.an) AS an,
                a.chk_returnmed,
                a.phar_chk_returnmed,
                a.phar_chk_returnmed_date,
                a.sent_dc_date,
                a.sent_pharmacy_date,
                a.discharge_date,
                a.workflow_status,
                a.ward_phone,
                a.created_at,
                a.updated_at,
                (SELECT COUNT(*) FROM return_drugs rd WHERE rd.an = COALESCE(a.an, rd_ans.an) AND rd.qty > 0) AS return_drug_count,
                (SELECT MAX(created_at) FROM return_drugs rd WHERE rd.an = COALESCE(a.an, rd_ans.an)) AS return_drug_created_at
            FROM (
                SELECT DISTINCT CAST(an AS CHAR) COLLATE utf8mb4_unicode_ci AS an 
                FROM return_drugs 
                WHERE qty > 0
            ) rd_ans
            LEFT JOIN an_detail a ON a.an COLLATE utf8mb4_unicode_ci = rd_ans.an
            WHERE COALESCE(a.chk_returnmed, 1) = 1
            ORDER BY 
              CASE WHEN a.phar_chk_returnmed IS NULL THEN 0 ELSE 1 END ASC,
              COALESCE(a.sent_dc_date, a.sent_pharmacy_date, a.discharge_date, (SELECT MAX(created_at) FROM return_drugs rd WHERE rd.an = COALESCE(a.an, rd_ans.an)), a.updated_at, a.created_at) DESC
        `);

        if (anRows.length === 0) {
            return res.json([]);
        }

        const ans = anRows.map(r => r.an);
        const placeholders = ans.map(() => '?').join(',');

        const hisQuery = `
            SELECT 
                i.an, i.hn, p.pname, p.fname, p.lname,
                TIMESTAMPDIFF(YEAR, p.birthday, CURDATE()) as age_y,
                pt.name as pttype_name,
                i.regdate as admit_date,
                w.name as ward_name,
                CONCAT(d.pname, d.fname, ' ', d.lname) as doctor_name
            FROM ipt i
            INNER JOIN patient p ON i.hn = p.hn
            LEFT JOIN pttype pt ON i.pttype = pt.pttype
            LEFT JOIN ward w ON i.ward = w.ward
            LEFT JOIN doctor d ON i.admdoctor = d.code
            WHERE i.an IN (${placeholders})
        `;
        const patientRows = await hisConn.query(hisQuery, ans);
        const patientMap = {};
        patientRows.forEach(p => { patientMap[p.an] = p; });

        const { getNamesByLoginnames } = require('../lib/userService');
        const staffNames = await getNamesByLoginnames(anRows.map(r => r.phar_chk_returnmed));

        const result = anRows.map(r => {
            const p = patientMap[r.an] || {};
            const combined = {
                ...p,
                ...r,
                return_drug_count: Number(r.return_drug_count || 0),
                age_y: p.age_y !== undefined && p.age_y !== null ? Number(p.age_y) : null,
                phar_chk_returnmed_name: staffNames[r.phar_chk_returnmed] || r.phar_chk_returnmed || null,
            };
            for (const key in combined) {
                if (typeof combined[key] === 'bigint') {
                    combined[key] = Number(combined[key]);
                }
            }
            return combined;
        });

        res.json(result);
    } catch (err) {
        console.error('Fetch return-meds patients error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (hisConn) hisConn.release();
        if (dflowConn) dflowConn.release();
    }
});

// Fetch return drugs for a specific patient for pharmacy audit
router.get('/pharmacy/return-meds/:an', authMiddleware, async (req, res) => {
    let hisConn, dflowConn;
    try {
        const { an } = req.params;
        dflowConn = await getDflowConnection();
        hisConn = await getHisConnection();

        const returnRows = await dflowConn.query(
            `SELECT id, an, icode, qty, is_correct, actual_qty, remark, checked_by, checked_at, created_by, created_at, updated_by, updated_at
             FROM return_drugs
             WHERE an = ?
             ORDER BY id ASC`,
            [an]
        );

        if (returnRows.length === 0) {
            return res.json([]);
        }

        const icodes = returnRows.map(r => r.icode);
        const placeholders = icodes.map(() => '?').join(',');

        const drugRows = await hisConn.query(
            `SELECT icode, name, strength, units,
                    CONCAT(name, IF(strength IS NOT NULL AND strength != '', CONCAT(' ', strength), '')) AS drug_name
             FROM drugitems
             WHERE icode IN (${placeholders})`,
            icodes
        );
        const drugMap = {};
        drugRows.forEach(d => { drugMap[d.icode] = d; });

        const { getNamesByLoginnames } = require('../lib/userService');
        const staffLogins = returnRows.map(r => r.checked_by || r.updated_by || r.created_by);
        const staffNames = await getNamesByLoginnames(staffLogins);

        const result = returnRows.map(r => {
            const d = drugMap[r.icode] || {};
            return {
                ...r,
                drug_name: d.drug_name || r.icode,
                name: d.name || '',
                strength: d.strength || '',
                units: d.units || '',
                checked_by_name: staffNames[r.checked_by] || r.checked_by || null,
                recorded_by_name: staffNames[r.updated_by || r.created_by] || null,
            };
        });

        res.json(result);
    } catch (err) {
        console.error('Fetch patient return drugs error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (hisConn) hisConn.release();
        if (dflowConn) dflowConn.release();
    }
});

// Save return drugs audit results from pharmacy
router.post('/pharmacy/return-meds/:an', authMiddleware, async (req, res) => {
    let dflowConn;
    try {
        const { an } = req.params;
        const loginname = req.user.loginname;
        const items = req.body.items || [];

        dflowConn = await getDflowConnection();

        for (const item of items) {
            const icode = String(item.icode || '').trim();
            if (!icode) continue;

            const qty = parseInt(item.qty, 10) || 0;
            const isCorrect = item.is_correct === false || item.is_correct === 0 ? 0 : 1;
            const actualQty = isCorrect === 0 ? (parseInt(item.actual_qty, 10) || 0) : null;
            const remark = item.remark ? String(item.remark).trim() : null;

            await dflowConn.query(
                `INSERT INTO return_drugs (an, icode, qty, is_correct, actual_qty, remark, checked_by, checked_at, created_by, updated_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
                 ON DUPLICATE KEY UPDATE
                    qty = IF(VALUES(qty) > 0, VALUES(qty), qty),
                    is_correct = VALUES(is_correct),
                    actual_qty = VALUES(actual_qty),
                    remark = VALUES(remark),
                    checked_by = VALUES(checked_by),
                    checked_at = NOW(),
                    updated_by = VALUES(updated_by),
                    updated_at = NOW()`,
                [an, icode, qty, isCorrect, actualQty, remark, loginname, loginname, loginname]
            );
        }

        // Mark phar_chk_returnmed in an_detail
        await dflowConn.query(
            `INSERT INTO an_detail (an, phar_chk_returnmed, phar_chk_returnmed_date, chk_returnmed)
             VALUES (?, ?, NOW(), 1)
             ON DUPLICATE KEY UPDATE 
                phar_chk_returnmed = VALUES(phar_chk_returnmed),
                phar_chk_returnmed_date = NOW(),
                chk_returnmed = 1`,
            [an, loginname]
        );

        // Activity log
        await dflowConn.query(
            'INSERT INTO activity_logs (an, action_type, loginname) VALUES (?, ?, ?)',
            [an, 'PHAR_CHK_RETURNMED_AUDIT', loginname]
        );

        const { getIO } = require('../lib/socket');
        getIO().emit('workflow:updated', { an, type: 'pharmacy_return_med_audit' });

        res.json({ success: true });
    } catch (err) {
        console.error('Save pharmacy return-meds audit error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dflowConn) dflowConn.release();
    }
});

async function updateWorkflowStatus(req, res, setClause, values, newStatus, actionType) {
    let conn;
    try {
        const { an } = req.params;
        const loginname = req.user.loginname;
        conn = await getDflowConnection();
        
        await conn.query(
            `INSERT INTO an_detail (an, discharge_by, discharge_date, workflow_status) 
             VALUES (?, ?, NOW(), ?) 
             ON DUPLICATE KEY UPDATE 
             discharge_by = IFNULL(discharge_by, VALUES(discharge_by)),
             discharge_date = IFNULL(discharge_date, VALUES(discharge_date)),
             workflow_status = VALUES(workflow_status)`,
            [an, loginname, newStatus]
        );
        
        if (setClause) {
            await conn.query(
                `UPDATE an_detail SET ${setClause} WHERE an = ?`,
                [...values, an]
            );
        }

        // Save or clear return_drugs
        if (req.body.returnmed === 0) {
            await conn.query('DELETE FROM return_drugs WHERE an = ?', [an]);
        } else if (Array.isArray(req.body.return_drugs)) {
            for (const item of req.body.return_drugs) {
                const icode = String(item.icode || '').trim();
                const qty = parseInt(item.qty, 10);
                if (!icode) continue;
                if (isNaN(qty) || qty <= 0) {
                    await conn.query('DELETE FROM return_drugs WHERE an = ? AND icode = ?', [an, icode]);
                } else {
                    await conn.query(
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
        }
        
        await conn.query(
            'INSERT INTO activity_logs (an, action_type, loginname) VALUES (?, ?, ?)',
            [an, actionType, loginname]
        );
        
        getIO().emit('workflow:updated', { an, status: newStatus });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Workflow update error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
}

router.post('/:an/send-pharmacy', authMiddleware, async (req, res) => {
    const { phone, hm, returnmed } = req.body;
    let setClause = 'sent_pharmacy_by = ?, sent_pharmacy_date = NOW()';
    const values = [req.user.loginname];
    
    if (phone) { setClause += ', ward_phone = ?'; values.push(phone); }
    if (hm !== undefined) { setClause += ', chk_hm = ?'; values.push(hm ? 1 : 0); }
    if (returnmed !== undefined) { setClause += ', chk_returnmed = ?'; values.push(returnmed ? 1 : 0); }
    
    await updateWorkflowStatus(req, res, setClause, values, 'pharmacy', 'SEND_PHARMACY');
});

router.post('/:an/send-dc', authMiddleware, async (req, res) => {
    const { phone, hm, returnmed } = req.body;
    let setClause = 'sent_dc_by = ?, sent_dc_date = NOW()';
    const values = [req.user.loginname];
    
    if (phone) { setClause += ', ward_phone = ?'; values.push(phone); }
    if (hm !== undefined) { setClause += ', chk_hm = ?'; values.push(hm ? 1 : 0); }
    if (returnmed !== undefined) { setClause += ', chk_returnmed = ?'; values.push(returnmed ? 1 : 0); }

    await updateWorkflowStatus(req, res, setClause, values, 'discharge_center', 'SEND_DC');
});

router.post('/:an/pharmacy-check', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { an } = req.params;
        const { type } = req.body;
        const loginname = req.user.loginname;
        
        let setClause = '';
        let actionType = '';
        if (type === 'hm') {
            setClause = 'phar_chk_hm = ?, phar_chk_hm_date = NOW()';
            actionType = 'PHAR_CHK_HM';
        } else if (type === 'returnmed') {
            setClause = 'phar_chk_returnmed = ?, phar_chk_returnmed_date = NOW()';
            actionType = 'PHAR_CHK_RETURNMED';
        } else {
            return res.status(400).json({ error: 'Invalid check type' });
        }
        
        const { getDflowConnection } = require('../config/database');
        conn = await getDflowConnection();
        await conn.query(`UPDATE an_detail SET ${setClause} WHERE an = ?`, [loginname, an]);
        await conn.query('INSERT INTO activity_logs (an, action_type, loginname) VALUES (?, ?, ?)', [an, actionType, loginname]);
        
        const { getIO } = require('../lib/socket');
        getIO().emit('workflow:updated', { an, type: 'pharmacy_check' });
        
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

router.post('/:an/pharmacy-done', authMiddleware, async (req, res) => {
    await updateWorkflowStatus(
        req, res,
        'pharmacy_done_by = ?, pharmacy_done_date = NOW(), phar_chk_hm = 1, phar_chk_hm_date = NOW()',
        [req.user.loginname],
        'completed',
        'PHARMACY_DONE'
    );
});

router.post('/:an/dc-done', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { an } = req.params;
        const loginname = req.user.loginname;
        const chk_payment = req.body.chk_payment !== undefined ? (Number(req.body.chk_payment) === 1 ? 1 : 0) : 0;

        conn = await getDflowConnection();
        const detailRows = await conn.query('SELECT chk_hm FROM an_detail WHERE an = ?', [an]);
        const chk_hm = detailRows.length > 0 && detailRows[0].chk_hm === 1 ? 1 : 0;

        let nextStatus;
        let setClause;
        let values;
        let actionType;

        if (chk_hm === 0 && chk_payment === 0) {
            // Case 1: ไม่มียา HM, ไม่มียอดต้องชำระ -> รอกลับบ้าน (ward_waiting)
            nextStatus = 'ward_waiting';
            setClause = 'dc_done_by = ?, dc_done_date = NOW(), chk_payment = ?';
            values = [loginname, chk_payment];
            actionType = 'DC_DONE_WAITING_WARD';
        } else if (chk_hm === 0 && chk_payment === 1) {
            // Case 2: ไม่มียา HM, มียอดต้องชำระ -> ไปการเงิน (finance)
            nextStatus = 'finance';
            setClause = 'dc_done_by = ?, dc_done_date = NOW(), chk_payment = ?, sent_finance_by = ?, sent_finance_date = NOW()';
            values = [loginname, chk_payment, loginname];
            actionType = 'DC_DONE_SEND_FINANCE';
        } else if (chk_hm === 1 && chk_payment === 0) {
            // Case 3: มียา HM, ไม่มียอดต้องชำระ -> ไปห้องยา (pharmacy)
            nextStatus = 'pharmacy';
            setClause = 'dc_done_by = ?, dc_done_date = NOW(), chk_payment = ?, sent_pharmacy_by = ?, sent_pharmacy_date = NOW()';
            values = [loginname, chk_payment, loginname];
            actionType = 'DC_DONE_SEND_PHARMACY';
        } else {
            // Case 4: มียา HM, มียอดต้องชำระ -> ไปการเงินก่อน (finance)
            nextStatus = 'finance';
            setClause = 'dc_done_by = ?, dc_done_date = NOW(), chk_payment = ?, sent_finance_by = ?, sent_finance_date = NOW()';
            values = [loginname, chk_payment, loginname];
            actionType = 'DC_DONE_SEND_FINANCE';
        }

        conn.release();
        conn = null;

        await updateWorkflowStatus(req, res, setClause, values, nextStatus, actionType);
    } catch (err) {
        if (conn) conn.release();
        console.error('DC done workflow error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/:an/send-finance', authMiddleware, async (req, res) => {
    await updateWorkflowStatus(
        req, res,
        'dc_done_by = ?, dc_done_date = NOW(), sent_finance_by = ?, sent_finance_date = NOW()',
        [req.user.loginname, req.user.loginname],
        'finance',
        'SEND_FINANCE'
    );
});

router.post('/:an/finance-done', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { an } = req.params;
        const loginname = req.user.loginname;
        conn = await getDflowConnection();
        const detailRows = await conn.query('SELECT chk_hm FROM an_detail WHERE an = ?', [an]);
        const hasHm = detailRows.length > 0 && detailRows[0].chk_hm === 1;
        conn.release();
        conn = null;

        if (hasHm) {
            // Case 4: มียา HM -> ส่งต่อไปห้องยา
            await updateWorkflowStatus(
                req, res,
                'finance_done_by = ?, finance_done_date = NOW(), sent_pharmacy_by = ?, sent_pharmacy_date = NOW()',
                [loginname, loginname],
                'pharmacy',
                'FINANCE_DONE_SEND_PHARMACY'
            );
        } else {
            // Case 2: ไม่มียา HM -> เสร็จสิ้น
            await updateWorkflowStatus(
                req, res,
                'finance_done_by = ?, finance_done_date = NOW()',
                [loginname],
                'completed',
                'FINANCE_DONE'
            );
        }
    } catch (err) {
        if (conn) conn.release();
        console.error('Finance done error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/:an/ward-done', authMiddleware, async (req, res) => {
    await updateWorkflowStatus(
        req, res,
        'ward_done_by = ?, ward_done_date = NOW()',
        [req.user.loginname],
        'completed',
        'WARD_DONE'
    );
});

// Cancel forward from discharge center (requires password confirmation)
router.post('/:an/cancel-dc-forward', authMiddleware, async (req, res) => {
    let hisConn, dflowConn;
    try {
        const { an } = req.params;
        const { password } = req.body;
        const loginname = req.user.loginname;

        if (!password) {
            return res.status(400).json({ error: 'กรุณาระบุรหัสผ่านเพื่อยืนยัน' });
        }

        // 1. Verify password with HIS (opduser)
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

        // 2. Reset workflow status in an_detail back to discharge_center
        dflowConn = await getDflowConnection();
        await dflowConn.query(
            `UPDATE an_detail SET 
                workflow_status = 'discharge_center',
                dc_done_by = NULL,
                dc_done_date = NULL,
                sent_finance_by = NULL,
                sent_finance_date = NULL,
                finance_done_by = NULL,
                finance_done_date = NULL
             WHERE an = ?`,
            [an]
        );

        // 3. Log to activity_logs
        await dflowConn.query(
            'INSERT INTO activity_logs (an, action_type, loginname) VALUES (?, ?, ?)',
            [an, 'CANCEL_FORWARD_DC', loginname]
        );

        // 4. Emit socket event
        try {
            getIO().emit('workflow:updated', { an, status: 'discharge_center' });
        } catch (e) {
            console.error('Socket emit error:', e);
        }

        res.json({ success: true, message: 'ยกเลิกการส่งต่อเรียบร้อยแล้ว' });
    } catch (error) {
        console.error('Cancel DC forward error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (hisConn) hisConn.release();
        if (dflowConn) dflowConn.release();
    }
});

module.exports = router;
