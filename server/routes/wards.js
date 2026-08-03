const express = require('express');
const { getHisConnection, getDflowConnection } = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get list of all wards
router.get('/', authMiddleware, async (req, res) => {
    let conn;
    try {
        conn = await getHisConnection();
        const rows = await conn.query('SELECT ward, name FROM ward WHERE ward_active = "Y" ORDER BY name ');
        res.json(rows);
    } catch (error) {
        console.error('Fetch wards error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

// Helper function to fetch document completion status for a list of ANs
async function getDocCompleteness(ans) {
    if (!ans || ans.length === 0) return {};
    
    let dflowConn;
    const completeness = {};
    ans.forEach(an => completeness[an] = false);

    try {
        dflowConn = await getDflowConnection();
        // Check if required documents are all uploaded
        const placeholders = ans.map(() => '?').join(',');
        
        // Find total required doc types
        const reqRows = await dflowConn.query('SELECT COUNT(*) as cnt FROM document_types WHERE is_required = 1');
        const totalRequired = Number(reqRows[0].cnt);

        if (totalRequired > 0) {
            // Count unique required doc types uploaded per AN (excluding soft-deleted)
            const query = `
                SELECT d.an, COUNT(DISTINCT d.doc_type_id) as uploaded_req_cnt
                FROM documents d
                JOIN document_types dt ON d.doc_type_id = dt.id
                WHERE d.an IN (${placeholders}) 
                  AND dt.is_required = 1 
                  AND (d.is_deleted = 0 OR d.is_deleted IS NULL)
                GROUP BY d.an
            `;
            const docRows = await dflowConn.query(query, ans);
            
            for (const row of docRows) {
                if (Number(row.uploaded_req_cnt) >= totalRequired) {
                    completeness[row.an] = true;
                }
            }
        }
    } catch (err) {
        console.error('getDocCompleteness error:', err);
    } finally {
        if (dflowConn) dflowConn.release();
    }
    
    return completeness;
}

// Get admitted patients in a specific ward
router.get('/:wardCode/patients', authMiddleware, async (req, res) => {
    const { wardCode } = req.params;
    let hisConn, dflowConn;
    
    try {
        hisConn = await getHisConnection();
        dflowConn = await getDflowConnection();
        
        // ipt.dchdate is often empty string or NULL if still admitted
        const query = `
            SELECT 
                i.an, i.hn, i.regdate as admit_date, i.regtime as admit_time,
                p.pname, p.fname, p.lname, p.birthday,
                (YEAR(CURDATE()) - YEAR(p.birthday)) - (RIGHT(CURDATE(),5) < RIGHT(p.birthday,5)) AS age_y,
                w.name AS ward_name,
                d.name AS doctor_name,
                pt.name AS pttype_name,
                iptb.bedno,
                aa.income AS total_income,
                aa.rcpt_money,
                aa.paid_money
            FROM ipt i
            LEFT JOIN patient p ON i.hn = p.hn
            LEFT JOIN ward w ON i.ward = w.ward
            LEFT JOIN doctor d ON i.incharge_doctor = d.code
            LEFT JOIN pttype pt ON i.pttype = pt.pttype
            LEFT JOIN iptadm iptb ON i.an = iptb.an
            LEFT JOIN an_stat aa ON aa.an = i.an
            WHERE i.ward = ? AND i.dchstts IS NULL
            GROUP BY i.an
            ORDER BY i.regdate DESC, i.regtime DESC
        `;
        
        const rows = await hisConn.query(query, [wardCode]);
        
        if (rows.length === 0) {
            return res.json([]);
        }

        const ans = rows.map(r => r.an);
        const completeness = await getDocCompleteness(ans);
        
        // Fetch discharge status from D-Flow DB (just in case they were discharged in D-Flow but not HIS yet)
        const placeholders = ans.map(() => '?').join(',');
        const anDetailRows = await dflowConn.query(`SELECT an, discharge_date FROM an_detail WHERE an IN (${placeholders})`, ans);
        const dischargedAns = new Set(anDetailRows.filter(r => r.discharge_date !== null).map(r => r.an));

        // Format result, filtering out those already discharged in D-Flow
        const result = rows
            .filter(row => !dischargedAns.has(row.an))
            .map(row => ({
                ...row,
                isComplete: completeness[row.an] || false
            }));

        res.json(result);
    } catch (error) {
        console.error('Fetch ward patients error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (hisConn) hisConn.release();
        if (dflowConn) dflowConn.release();
    }
});

// Get patients discharged today in D-Flow for a specific ward
router.get('/:wardCode/discharged', authMiddleware, async (req, res) => {
    const { wardCode } = req.params;
    let hisConn, dflowConn;
    
    try {
        dflowConn = await getDflowConnection();
        
        // Find ANs discharged today in D-Flow
        const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const anDetailRows = await dflowConn.query(
            `SELECT * 
             FROM an_detail 
             WHERE DATE(discharge_date) = ?`,
            [todayStr]
        );
        
        if (anDetailRows.length === 0) {
            return res.json([]);
        }
        
        const ans = anDetailRows.map(r => r.an);
        const placeholders = ans.map(() => '?').join(',');
        
        hisConn = await getHisConnection();
        // Fetch details from HIS, filtering by ward
        const query = `
            SELECT 
                i.an, i.hn, i.regdate as admit_date, i.regtime as admit_time,
                p.pname, p.fname, p.lname, p.birthday,
                (YEAR(CURDATE()) - YEAR(p.birthday)) - (RIGHT(CURDATE(),5) < RIGHT(p.birthday,5)) AS age_y,
                w.name AS ward_name,
                d.name AS doctor_name,
                pt.name AS pttype_name,
                iptb.bedno,
                aa.income AS total_income,
                aa.rcpt_money,
                aa.paid_money
            FROM ipt i
            LEFT JOIN patient p ON i.hn = p.hn
            LEFT JOIN ward w ON i.ward = w.ward
            LEFT JOIN doctor d ON i.dch_doctor = d.code
            LEFT JOIN pttype pt ON i.pttype = pt.pttype
            LEFT JOIN iptadm iptb ON i.an = iptb.an
            LEFT JOIN an_stat aa ON aa.an = i.an
            WHERE i.ward = ? AND i.an IN (${placeholders})
            GROUP BY i.an
            ORDER BY i.dchdate DESC, i.dchtime DESC
        `;
        
        const rows = await hisConn.query(query, [wardCode, ...ans]);
        
        const completeness = await getDocCompleteness(ans);
        
        // Merge D-Flow discharge details
        const result = rows.map(row => {
            const detail = anDetailRows.find(d => d.an === row.an);
            return {
                ...row,
                ...detail,
                isComplete: completeness[row.an] || false
            };
        });

        res.json(result);
    } catch (error) {
        console.error('Fetch discharged patients error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (hisConn) hisConn.release();
        if (dflowConn) dflowConn.release();
    }
});

module.exports = router;
