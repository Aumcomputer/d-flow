const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { getDflowConnection } = require('../config/database');
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
        conn = await getDflowConnection();
        const rows = await conn.query('SELECT id, name, name_en, is_required FROM document_types ORDER BY id');
        res.json(rows);
    } catch (error) {
        console.error('Fetch document types error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
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
        res.json({ success: true });
    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

router.get('/:an/completeness', async (req, res) => {
    let conn;
    try {
        const { an } = req.params;
        conn = await getDflowConnection();
        
        const reqTypesResult = await conn.query(
            'SELECT id, name FROM document_types WHERE id IN (1, 2, 3)'
        );
        const reqTypes = reqTypesResult || [];

        const docsResult = await conn.query(
            'SELECT doc_type_id FROM documents WHERE an = ? AND is_deleted = 0 AND doc_type_id IN (1, 2, 3)',
            [an]
        );

        const uploadedTypeIds = new Set((docsResult || []).map(d => d.doc_type_id));

        const details = reqTypes.map(t => ({
            type_id: t.id,
            type_name: t.name,
            has_document: uploadedTypeIds.has(t.id)
        }));

        const uploadedCount = details.filter(d => d.has_document).length;
        const total = 3;

        res.json({
            complete: uploadedCount === total,
            total,
            uploaded: uploadedCount,
            details
        });

    } catch (error) {
        console.error('Completeness error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

module.exports = router;
