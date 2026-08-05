const express = require('express');
const { getHisConnection, getDflowConnection } = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { getIO } = require('../lib/socket');

const router = express.Router();

async function getWorkflowPatients(status, historyOf = null) {
    let hisConn, dflowConn;
    try {
        hisConn = await getHisConnection();
        dflowConn = await getDflowConnection();
        
        let queryStr = `SELECT * FROM an_detail WHERE DATE(discharge_date) = CURDATE()`;
        let params = [];

        if (historyOf === 'pharmacy') {
            queryStr += ` AND pharmacy_done_by IS NOT NULL`;
        } else if (historyOf === 'discharge_center') {
            queryStr += ` AND dc_done_by IS NOT NULL`;
        } else if (historyOf === 'finance') {
            queryStr += ` AND finance_done_by IS NOT NULL`;
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
                COALESCE(ast.paid_money, 0) as paid_money
            FROM ipt i
            INNER JOIN patient p ON i.hn = p.hn
            LEFT JOIN pttype pt ON i.pttype = pt.pttype
            LEFT JOIN ward w ON i.ward = w.ward
            LEFT JOIN doctor d ON i.admdoctor = d.code
            LEFT JOIN an_stat ast ON i.an = ast.an
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
    try {
        const patients = await getWorkflowPatients('finance');
        res.json(patients);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/pharmacy/history', authMiddleware, async (req, res) => {
    try {
        const patients = await getWorkflowPatients(null, 'pharmacy');
        res.json(patients);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/discharge-center/history', authMiddleware, async (req, res) => {
    try {
        const patients = await getWorkflowPatients(null, 'discharge_center');
        res.json(patients);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/finance/history', authMiddleware, async (req, res) => {
    try {
        const patients = await getWorkflowPatients(null, 'finance');
        res.json(patients);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
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
    const { phone } = req.body;
    const phoneUpdate = phone ? ', ward_phone = ?' : '';
    const values = phone ? [req.user.loginname, phone] : [req.user.loginname];
    
    await updateWorkflowStatus(
        req, res,
        `sent_pharmacy_by = ?, sent_pharmacy_date = NOW()${phoneUpdate}`,
        values,
        'pharmacy',
        'SEND_PHARMACY'
    );
});

router.post('/:an/send-dc', authMiddleware, async (req, res) => {
    const { phone } = req.body;
    const phoneUpdate = phone ? ', ward_phone = ?' : '';
    const values = phone ? [req.user.loginname, phone] : [req.user.loginname];

    await updateWorkflowStatus(
        req, res,
        `sent_dc_by = ?, sent_dc_date = NOW()${phoneUpdate}`,
        values,
        'discharge_center',
        'SEND_DC'
    );
});

router.post('/:an/pharmacy-done', authMiddleware, async (req, res) => {
    await updateWorkflowStatus(
        req, res,
        'pharmacy_done_by = ?, pharmacy_done_date = NOW(), sent_dc_date = NOW()',
        [req.user.loginname],
        'discharge_center',
        'PHARMACY_DONE'
    );
});

router.post('/:an/dc-done', authMiddleware, async (req, res) => {
    await updateWorkflowStatus(
        req, res,
        'dc_done_by = ?, dc_done_date = NOW()',
        [req.user.loginname],
        'completed',
        'DC_DONE'
    );
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
    await updateWorkflowStatus(
        req, res,
        'finance_done_by = ?, finance_done_date = NOW()',
        [req.user.loginname],
        'completed',
        'FINANCE_DONE'
    );
});

module.exports = router;
