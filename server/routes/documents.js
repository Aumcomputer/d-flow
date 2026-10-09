const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { getDflowConnection, getHisConnection } = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { parsePdf } = require('../services/pdfClassifier');
const { resizeImage } = require('../services/imageResizer');

const router = express.Router();

const getUploadBaseDir = () => {
    return process.env.UPLOAD_DIR 
        ? path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR)
        : path.join(__dirname, '..', 'documents');
};

const upload = multer({ dest: path.join(__dirname, '..', 'temp_uploads') });

// ============================================================
// File serving — supports token in cookie
// ============================================================
router.get('/file/:an/:filename', (req, res) => {
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
            return res.status(401).json({ error: 'Unauthorized, token invalid' });
        }

        const { an, filename } = req.params;
        // Prevent path traversal
        if (an.includes('..') || filename.includes('..')) {
            return res.status(400).json({ error: 'Invalid path' });
        }
        const filePath = path.join(getUploadBaseDir(), an, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        res.sendFile(path.resolve(filePath));
    } catch (error) {
        console.error('Serve file error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ============================================================
// Helper: generate next running number for AN
// ============================================================
async function getNextRunning(conn, an) {
    const rows = await conn.query(
        'SELECT COUNT(*) as cnt FROM documents WHERE an = ?',
        [an]
    );
    return (Number(rows[0].cnt) || 0) + 1;
}

// ============================================================
// Auth-protected routes
// ============================================================
router.use(authMiddleware);

router.get('/types', async (req, res) => {
    let conn;
    try {
        const { getRedisClient } = require('../lib/redis');
        const redis = getRedisClient();
        const cacheKey = 'cache:master:doc_types';
        try {
            const cached = await redis.get(cacheKey);
            if (cached) return res.json(JSON.parse(cached));
        } catch (e) { console.error('Redis Get Error:', e); }

        conn = await getDflowConnection();
        const rows = await conn.query('SELECT id, name, name_en, is_required FROM document_types ORDER BY id');
        try {
            await redis.setEx(cacheKey, 86400, JSON.stringify(rows)); // 24h
        } catch (e) { console.error('Redis Set Error:', e); }

        res.json(rows);
    } catch (error) {
        console.error('Fetch document types error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

// GET /api/documents/inpatients
// Get current inpatients categorized by document completeness:
// - no_docs: patients with 0 required documents
// - incomplete: patients with 1 or 2 required documents (out of 3: บัตรประชาชน, ใบตรวจสอบสิทธิ์, Authen Code)
router.get('/inpatients', async (req, res) => {
    let hisConn, dflowConn;
    try {
        const { getRedisClient } = require('../lib/redis');
        const redis = getRedisClient();
        const cacheKey = 'cache:hospital:inpatients_his';
        let hisPatients = [];

        try {
            const cached = await redis.get(cacheKey);
            if (cached) hisPatients = JSON.parse(cached);
        } catch (e) { console.error('Redis Get Error:', e); }

        if (hisPatients.length === 0) {
            hisConn = await getHisConnection();
            const hisQuery = `
                SELECT 
                    i.an, i.hn, i.vn, i.regdate as admit_date, i.regtime as admit_time,
                    p.pname, p.fname, p.lname, p.birthday,
                    (YEAR(CURDATE()) - YEAR(p.birthday)) - (RIGHT(CURDATE(),5) < RIGHT(p.birthday,5)) AS age_y,
                    w.name AS ward_name,
                    w.ward AS ward_code,
                    COALESCE(
                        (SELECT GROUP_CONCAT(pt_sub.name ORDER BY ip.pttype_number SEPARATOR ', ')
                         FROM ipt_pttype ip
                         JOIN pttype pt_sub ON ip.pttype = pt_sub.pttype
                         WHERE ip.an = i.an),
                        pt.name
                    ) AS pttype_name,
                    pt.pttype AS pttype_code,
                    COALESCE(d.name, d2.name) AS doctor_name,
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
            hisPatients = await hisConn.query(hisQuery);
            if (hisPatients.length > 0) {
                try {
                    await redis.setEx(cacheKey, 60, JSON.stringify(hisPatients)); // 60s
                } catch (e) { console.error('Redis Set Error:', e); }
            }
        }

        if (!hisPatients || hisPatients.length === 0) {
            return res.json({ no_docs: [], incomplete: [], no_docs_count: 0, incomplete_count: 0 });
        }

        dflowConn = await getDflowConnection();

        // 2. Fetch documents, exempt pttypes, and API claim codes for these admitted ANs
        const ans = hisPatients.map(p => p.an);
        const vns = hisPatients.map(p => p.vn).filter(Boolean);
        const placeholders = ans.map(() => '?').join(',');
        const [docs, exemptRows, authenRows] = await Promise.all([
            dflowConn.query(
                `SELECT an, doc_type_id FROM documents WHERE is_deleted = 0 AND an IN (${placeholders})`,
                ans
            ),
            dflowConn.query('SELECT UPPER(pttype) as code FROM nhso_no_authen_exempt_pttypes WHERE is_active = 1'),
            vns.length > 0
                ? dflowConn.query(
                    `SELECT vn, claim_code FROM vn_nhso_authen WHERE vn IN (${vns.map(() => '?').join(',')}) AND claim_code IS NOT NULL AND claim_code != ''`,
                    vns
                  ).catch(() => [])
                : []
        ]);

        const exemptCodes = new Set((exemptRows || []).map(r => String(r.code).trim().toUpperCase()));
        const apiAuthenVnSet = new Set((authenRows || []).map(r => r.vn));

        const docMap = new Map();
        docs.forEach(d => {
            if (!docMap.has(d.an)) docMap.set(d.an, new Set());
            if (d.doc_type_id) docMap.get(d.an).add(d.doc_type_id);
        });

        const no_docs = [];
        const incomplete = [];

        hisPatients.forEach(p => {
            const docSet = docMap.get(p.an) || new Set();
            const has_id_card = docSet.has(1);
            const has_pttype_check = docSet.has(2);
            
            const isExempt = p.pttype_code && exemptCodes.has(String(p.pttype_code).trim().toUpperCase());
            const hasApiAuthen = p.vn ? apiAuthenVnSet.has(p.vn) : false;
            const has_authen_code = docSet.has(3) || isExempt || hasApiAuthen;

            const doc_count = (has_id_card ? 1 : 0) + (has_pttype_check ? 1 : 0) + (has_authen_code ? 1 : 0);

            const item = {
                ...p,
                has_id_card,
                has_pttype_check,
                has_authen_code,
                doc_count,
                is_exempt_authen: isExempt,
                has_api_authen: hasApiAuthen
            };

            if (doc_count === 0) {
                no_docs.push(item);
            } else if (doc_count < 3) {
                incomplete.push(item);
            }
        });

        res.json({
            no_docs,
            incomplete,
            no_docs_count: no_docs.length,
            incomplete_count: incomplete.length
        });
    } catch (error) {
        console.error('Fetch inpatients document status error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (hisConn) hisConn.release();
        if (dflowConn) dflowConn.release();
    }
});

router.get('/:an', async (req, res) => {
    let conn;
    try {
        const { an } = req.params;
        conn = await getDflowConnection();
        const rows = await conn.query(
            `SELECT d.id, d.an, d.hn, d.doc_type_id, d.original_filename, d.stored_filename,
                    d.file_path, d.file_size, d.mime_type, d.auto_classified,
                    d.extracted_text, d.extracted_cid,
                    d.uploaded_by, d.uploaded_at,
                    dt.name as doc_type_name 
             FROM documents d 
             LEFT JOIN document_types dt ON d.doc_type_id = dt.id 
             WHERE d.an = ? AND d.is_deleted = 0
             ORDER BY d.uploaded_at DESC`,
            [an]
        );
        res.json(rows);
    } catch (error) {
        console.error('Fetch documents error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

// GET /api/documents/:an/benefit-certificate
// Fetch special room welfare certificate from teamcom3_pis by AN
router.get('/:an/benefit-certificate', async (req, res) => {
    let teamcomConn;
    try {
        const { an } = req.params;
        const { getRedisClient } = require('../lib/redis');
        const redis = getRedisClient();
        const cacheKey = `cache:documents:${an}:benefit_certificate`;
        try {
            const cached = await redis.get(cacheKey);
            if (cached) return res.json(JSON.parse(cached));
        } catch (e) { console.error('Redis Get Error:', e); }

        const { getTeamcom3Connection } = require('../config/database');
        teamcomConn = await getTeamcom3Connection();

        const query = `
            SELECT 
                dr.id AS request_id,
                dr.request_code,
                drp.an,
                drp.patient_name,
                CASE drp.relationship
                    WHEN 'self' THEN 'ตนเอง'
                    WHEN 'father' THEN 'บิดา'
                    WHEN 'mother' THEN 'มารดา'
                    WHEN 'child' THEN 'บุตร'
                    WHEN 'spouse' THEN 'คู่สมรส'
                    ELSE COALESCE(drp.relationship, '-')
                END AS relationship,
                drp.ward_room,
                CONCAT(COALESCE(req_emp.Pname, ''), req_emp.Fname, ' ', req_emp.Lname) AS requester_name,
                COALESCE(req_pos.po_name, '-') AS requester_position,
                COALESCE(req_dep.dep_name, '-') AS requester_department,
                CASE 
                    WHEN UPPER(COALESCE(dr.outcome, '')) IN ('APPROVE', 'APPROVED', 'COMPLETED') THEN 'อนุมัติ'
                    WHEN UPPER(COALESCE(dr.outcome, '')) IN ('REJECT', 'REJECTED') THEN 'ไม่อนุมัติ'
                    WHEN UPPER(COALESCE(dr.status, '')) = 'SUBMITTED' THEN 'รอพิจารณา'
                    ELSE COALESCE(dr.status, '-')
                END AS status_text,
                dr.status,
                dr.outcome,
                COALESCE(CONCAT(COALESCE(app_emp.Pname, ''), app_emp.Fname, ' ', app_emp.Lname), '-') AS approver_name,
                COALESCE(app_pos.po_name, '-') AS approver_position,
                dr.created_at AS request_date,
                dr.approved_at AS approve_date
            FROM document_request_patients drp
            INNER JOIN document_requests dr ON drp.request_id = dr.id
            LEFT JOIN pis_employee req_emp ON dr.requester_empid = req_emp.EmpId
            LEFT JOIN pis_position req_pos ON req_emp.po_code = req_pos.po_code
            LEFT JOIN pis_department req_dep ON req_emp.dep_code = req_dep.dep_code
            LEFT JOIN pis_employee app_emp ON dr.approver_empid = app_emp.EmpId
            LEFT JOIN pis_position app_pos ON app_emp.po_code = app_pos.po_code
            WHERE drp.an = ?
            ORDER BY dr.id DESC
            LIMIT 1
        `;

        const rows = await teamcomConn.query(query, [an]);
        const result = rows.length === 0 
            ? { hasCertificate: false, certificate: null }
            : { hasCertificate: true, certificate: rows[0] };

        try {
            await redis.setEx(cacheKey, 900, JSON.stringify(result)); // 15m
        } catch (e) { console.error('Redis Set Error:', e); }

        res.json(result);
    } catch (error) {
        console.error('Fetch benefit certificate error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (teamcomConn) teamcomConn.release();
    }
});

router.post('/upload', upload.single('file'), async (req, res) => {
    let conn;
    try {
        const { an, hn, doc_type_id } = req.body;
        const file = req.file;

        if (!file || !an || !hn) {
            if (file) fs.unlinkSync(file.path);
            return res.status(400).json({ error: 'File, an, and hn are required' });
        }

        const ext = path.extname(file.originalname).toLowerCase();
        const isPdf = ext === '.pdf';
        const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);

        // --- PDF parsing: classify + extract text + extract CID ---
        let finalDocTypeId = doc_type_id ? parseInt(doc_type_id, 10) : null;
        let extractedText = null;
        let extractedCid = null;

        if (isPdf) {
            const pdfResult = await parsePdf(file.path);
            extractedText = pdfResult.extractedText;
            extractedCid = pdfResult.extractedCid;
            if (!finalDocTypeId && pdfResult.docTypeId) {
                finalDocTypeId = pdfResult.docTypeId;
            }
        } else if (isImage && finalDocTypeId === 1) {
            const { extractCidFromImage } = require('../services/ocrService');
            extractedCid = await extractCidFromImage(file.path);
        }

        // --- Generate filename: {AN}_{running}.{ext} ---
        conn = await getDflowConnection();
        const running = await getNextRunning(conn, an);
        const newFilename = `${an}_${String(running).padStart(3, '0')}${ext}`;

        // --- Ensure target directory ---
        const targetDir = path.join(getUploadBaseDir(), an);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const targetPath = path.join(targetDir, newFilename);

        // --- Process file: resize image or move PDF ---
        if (isImage) {
            await resizeImage(file.path, targetPath, 900);
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } else {
            fs.renameSync(file.path, targetPath);
        }

        const fileStats = fs.statSync(targetPath);
        const filePathRelative = path.posix.join(an, newFilename);

        // --- Insert record ---
        const result = await conn.query(
            `INSERT INTO documents 
             (an, hn, doc_type_id, original_filename, stored_filename, file_path, file_size, mime_type, auto_classified, extracted_text, extracted_cid, uploaded_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                an, hn, finalDocTypeId,
                file.originalname, newFilename, filePathRelative,
                fileStats.size, file.mimetype,
                finalDocTypeId && !doc_type_id ? 1 : 0,
                extractedText, extractedCid,
                req.user.loginname
            ]
        );

        const newId = result.insertId ? Number(result.insertId) : null;

        try {
            const { getIO } = require('../lib/socket');
            getIO().emit('documents:updated', { an, type: 'upload' });
            getIO().emit('workflow:updated', { an, type: 'document_uploaded' });
        } catch (sErr) {}

        if (!finalDocTypeId) {
            return res.json({
                needsClassification: true,
                tempId: newId,
                file_path: filePathRelative,
                extracted_cid: extractedCid,
            });
        }

        res.json({
            success: true,
            id: newId,
            file_path: filePathRelative,
            doc_type_id: finalDocTypeId,
            extracted_cid: extractedCid,
        });

    } catch (error) {
        console.error('Upload document error:', error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

router.patch('/:id/classify', async (req, res) => {
    let conn;
    try {
        const { id } = req.params;
        const { doc_type_id } = req.body;
        
        if (!doc_type_id) {
            return res.status(400).json({ error: 'doc_type_id is required' });
        }

        conn = await getDflowConnection();
        await conn.query(
            'UPDATE documents SET doc_type_id = ? WHERE id = ?',
            [doc_type_id, id]
        );

        try {
            const { getIO } = require('../lib/socket');
            getIO().emit('documents:updated', { id, type: 'classify' });
            getIO().emit('workflow:updated', { type: 'document_classified' });
        } catch (sErr) {}

        res.json({ success: true });
    } catch (error) {
        console.error('Classify document error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

router.delete('/:id', async (req, res) => {
    let conn;
    try {
        const { id } = req.params;
        conn = await getDflowConnection();
        await conn.query(
            'UPDATE documents SET is_deleted = 1, deleted_at = NOW(), deleted_by = ? WHERE id = ?',
            [req.user.loginname, id]
        );

        try {
            const { getIO } = require('../lib/socket');
            getIO().emit('documents:updated', { id, type: 'delete' });
            getIO().emit('workflow:updated', { type: 'document_deleted' });
        } catch (sErr) {}

        res.json({ success: true });
    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

router.get('/:an/completeness', async (req, res) => {
    let conn, hisConn;
    try {
        const { an } = req.params;
        conn = await getDflowConnection();
        hisConn = await getHisConnection();
        
        const [reqTypesResult, docsResult, exemptRows, patientRows] = await Promise.all([
            conn.query('SELECT id, name FROM document_types WHERE id IN (1, 2, 3) ORDER BY id ASC'),
            conn.query('SELECT doc_type_id FROM documents WHERE an = ? AND is_deleted = 0 AND doc_type_id IN (1, 2, 3)', [an]),
            conn.query('SELECT UPPER(pttype) as code FROM nhso_no_authen_exempt_pttypes WHERE is_active = 1'),
            hisConn.query(`
                SELECT i.vn, i.pttype as ipt_pttype, o.pttype as ovst_pttype,
                       (SELECT GROUP_CONCAT(ip.pttype) FROM ipt_pttype ip WHERE ip.an = i.an) as all_ipt_pttypes
                FROM ipt i
                LEFT JOIN ovst o ON i.vn = o.vn
                WHERE i.an = ?
                LIMIT 1
            `, [an])
        ]);

        const p = patientRows?.[0] || {};
        const authenRows = p.vn
            ? await conn.query('SELECT claim_code FROM vn_nhso_authen WHERE vn = ? AND claim_code IS NOT NULL AND claim_code != "" LIMIT 1', [p.vn]).catch(() => [])
            : [];

        const reqTypes = reqTypesResult || [];
        const uploadedTypeIds = new Set((docsResult || []).map(d => d.doc_type_id));
        const exemptCodes = new Set((exemptRows || []).map(r => String(r.code).trim().toUpperCase()));

        // Check if patient's pttype is exempt from Authen Code
        const pttypeCandidates = [
            p.ipt_pttype,
            p.ovst_pttype,
            ...(p.all_ipt_pttypes ? String(p.all_ipt_pttypes).split(',') : [])
        ].filter(Boolean).map(c => String(c).trim().toUpperCase());

        const isExemptAuthen = pttypeCandidates.some(c => exemptCodes.has(c));
        const hasApiAuthen = Boolean(authenRows?.[0]?.claim_code);

        const details = reqTypes.map(t => {
            let hasDoc = uploadedTypeIds.has(t.id);
            let exempt = false;
            let fromApi = false;

            if (t.id === 3) { // Authen Code
                if (isExemptAuthen) {
                    hasDoc = true;
                    exempt = true;
                } else if (hasApiAuthen) {
                    hasDoc = true;
                    fromApi = true;
                }
            }

            return {
                type_id: t.id,
                type_name: t.name,
                has_document: hasDoc,
                is_exempt: exempt,
                from_api: fromApi
            };
        });

        const uploadedCount = details.filter(d => d.has_document).length;
        const total = 3;

        res.json({
            complete: uploadedCount === total,
            total,
            uploaded: uploadedCount,
            details,
            is_exempt_authen: isExemptAuthen,
            has_api_authen: hasApiAuthen
        });

    } catch (error) {
        console.error('Completeness error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
        if (hisConn) hisConn.release();
    }
});

module.exports = router;
