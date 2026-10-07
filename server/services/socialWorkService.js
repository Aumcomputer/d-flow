const { getDflowConnection, getHisConnection } = require('../config/database');

const DEFAULT_REASONS = [
    { name: 'ไม่มีเงินจ่ายค่ารักษาและค่ารักษาพยาบาล', is_other: 0, sort_order: 1 },
    { name: 'มีหนังสือขออนุเคราะห์จากหน่วยงานอื่น', is_other: 0, sort_order: 2 },
    { name: 'ไม่มีเงินรับรักษาต่อ', is_other: 0, sort_order: 3 },
    { name: 'มีหนังสือรับรองว่าเป็นผู้มีรายได้น้อยจากกำนัน ผู้ใหญ่บ้าน', is_other: 0, sort_order: 4 },
    { name: 'มีปัญหาทางครอบครัวหรือจิตใจ', is_other: 0, sort_order: 5 },
    { name: 'มีบัตรสงเคราะห์การรักษาพยาบาล', is_other: 0, sort_order: 6 },
    { name: 'อื่นๆระบุ', is_other: 1, sort_order: 7 }
];

async function initSocialWorkTables() {
    let conn;
    try {
        conn = await getDflowConnection();

        // 1. social_work_reasons table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS social_work_reasons (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                is_other TINYINT(1) DEFAULT 0,
                sort_order INT DEFAULT 0,
                is_active TINYINT(1) DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Check if social_work_reasons is empty, if so seed defaults
        const countRes = await conn.query('SELECT COUNT(*) as cnt FROM social_work_reasons');
        if (Number(countRes[0]?.cnt || 0) === 0) {
            for (const r of DEFAULT_REASONS) {
                await conn.query(
                    'INSERT INTO social_work_reasons (name, is_other, sort_order) VALUES (?, ?, ?)',
                    [r.name, r.is_other, r.sort_order]
                );
            }
            console.log('Seeded default social_work_reasons');
        }

        // 2. social_work_requests table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS social_work_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                an VARCHAR(15) NOT NULL,
                reason_id INT DEFAULT NULL,
                reason_name VARCHAR(255) NOT NULL,
                reason_other TEXT DEFAULT NULL,
                nurse_comment TEXT DEFAULT NULL,
                sent_by VARCHAR(50) NOT NULL,
                sent_by_name VARCHAR(150) DEFAULT NULL,
                sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                social_worker_comment TEXT DEFAULT NULL,
                social_worker_by VARCHAR(50) DEFAULT NULL,
                social_worker_by_name VARCHAR(150) DEFAULT NULL,
                social_worker_at DATETIME DEFAULT NULL,
                
                status ENUM('pending', 'answered', 'cancelled') NOT NULL DEFAULT 'pending',
                cancelled_by VARCHAR(50) DEFAULT NULL,
                cancelled_by_name VARCHAR(150) DEFAULT NULL,
                cancelled_at DATETIME DEFAULT NULL,
                cancel_reason VARCHAR(255) DEFAULT NULL,
                
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_an (an),
                INDEX idx_status (status),
                INDEX idx_sent_at (sent_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log('Social work tables initialized successfully');
    } catch (err) {
        console.error('Failed to init social work tables:', err);
    } finally {
        if (conn) conn.release();
    }
}

async function getSocialWorkReasons() {
    let conn;
    try {
        conn = await getDflowConnection();
        const rows = await conn.query(
            'SELECT id, name, is_other, sort_order FROM social_work_reasons WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
        );
        return rows;
    } finally {
        if (conn) conn.release();
    }
}

async function getSocialWorkRequestByAn(an) {
    if (!an) return null;
    let conn;
    try {
        conn = await getDflowConnection();
        const rows = await conn.query(
            `SELECT * FROM social_work_requests 
             WHERE an = ? AND status != 'cancelled'
             ORDER BY id DESC LIMIT 1`,
            [an]
        );
        return rows[0] || null;
    } finally {
        if (conn) conn.release();
    }
}

async function createSocialWorkRequest({ an, reason_id, reason_name, reason_other, nurse_comment, sent_by, sent_by_name }) {
    let conn;
    try {
        conn = await getDflowConnection();
        const result = await conn.query(
            `INSERT INTO social_work_requests 
             (an, reason_id, reason_name, reason_other, nurse_comment, sent_by, sent_by_name, sent_at, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'pending')`,
            [an, reason_id || null, reason_name, reason_other || null, nurse_comment || null, sent_by, sent_by_name]
        );
        const insertId = result.insertId;
        const rows = await conn.query('SELECT * FROM social_work_requests WHERE id = ?', [insertId]);
        return rows[0];
    } finally {
        if (conn) conn.release();
    }
}

async function updateSocialWorkRequest(id, { reason_id, reason_name, reason_other, nurse_comment, updated_by, updated_by_name }) {
    let conn;
    try {
        conn = await getDflowConnection();
        await conn.query(
            `UPDATE social_work_requests 
             SET reason_id = ?, reason_name = ?, reason_other = ?, nurse_comment = ?, updated_at = NOW()
             WHERE id = ? AND status = 'pending'`,
            [reason_id || null, reason_name, reason_other || null, nurse_comment || null, id]
        );
        const rows = await conn.query('SELECT * FROM social_work_requests WHERE id = ?', [id]);
        return rows[0];
    } finally {
        if (conn) conn.release();
    }
}

async function cancelSocialWorkRequest(id, { cancelled_by, cancelled_by_name, cancel_reason }) {
    let conn;
    try {
        conn = await getDflowConnection();
        await conn.query(
            `UPDATE social_work_requests 
             SET status = 'cancelled', cancelled_by = ?, cancelled_by_name = ?, cancelled_at = NOW(), cancel_reason = ?
             WHERE id = ? AND status = 'pending'`,
            [cancelled_by, cancelled_by_name, cancel_reason || null, id]
        );
        return true;
    } finally {
        if (conn) conn.release();
    }
}

async function answerSocialWorkRequest(id, { social_worker_comment, social_worker_by, social_worker_by_name }) {
    let conn;
    try {
        conn = await getDflowConnection();
        await conn.query(
            `UPDATE social_work_requests 
             SET social_worker_comment = ?, social_worker_by = ?, social_worker_by_name = ?, social_worker_at = NOW(), status = 'answered'
             WHERE id = ?`,
            [social_worker_comment, social_worker_by, social_worker_by_name, id]
        );
        const rows = await conn.query('SELECT * FROM social_work_requests WHERE id = ?', [id]);
        return rows[0];
    } finally {
        if (conn) conn.release();
    }
}

// Fetch pending or answered requests joined with HIS patient details
async function getSocialWorkRequestsList(status = 'pending') {
    let dflowConn;
    let hisConn;
    try {
        dflowConn = await getDflowConnection();
        const requests = await dflowConn.query(
            `SELECT * FROM social_work_requests 
             WHERE status = ? 
             ORDER BY ${status === 'pending' ? 'sent_at ASC' : 'social_worker_at DESC'}
             LIMIT 150`,
            [status]
        );

        if (requests.length === 0) return [];

        const ans = requests.map(r => r.an);

        // Fetch patient details from HIS
        try {
            hisConn = await getHisConnection();
            const hisPatients = await hisConn.query(
                `SELECT 
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
                 WHERE i.an IN (?)`,
                [ans]
            );

            const patientMap = new Map();
            for (const p of hisPatients) {
                patientMap.set(p.an, p);
            }

            for (const req of requests) {
                const pat = patientMap.get(req.an);
                if (pat) {
                    req.hn = pat.hn;
                    req.patient_name = `${pat.pname || ''}${pat.fname || ''} ${pat.lname || ''}`.trim();
                    req.age_y = pat.age_y;
                    req.ward_name = pat.ward_name;
                    req.pttype_name = pat.pttype_name;
                    req.doctor_name = pat.doctor_name;
                    req.admit_date = pat.admit_date;
                }
            }
        } catch (e) {
            console.error('Error fetching HIS patient details for social work:', e);
        }

        return requests;
    } finally {
        if (dflowConn) dflowConn.release();
        if (hisConn) hisConn.release();
    }
}

module.exports = {
    initSocialWorkTables,
    getSocialWorkReasons,
    getSocialWorkRequestByAn,
    createSocialWorkRequest,
    updateSocialWorkRequest,
    cancelSocialWorkRequest,
    answerSocialWorkRequest,
    getSocialWorkRequestsList
};
