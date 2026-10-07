const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getDflowConnection } = require('../config/database');
const { isUserAdmin } = require('../services/settingsService');
const { getIO } = require('../lib/socket');
const {
    getSocialWorkReasons,
    getSocialWorkRequestByAn,
    createSocialWorkRequest,
    updateSocialWorkRequest,
    cancelSocialWorkRequest,
    answerSocialWorkRequest,
    getSocialWorkRequestsList
} = require('../services/socialWorkService');

const router = express.Router();

// 1. Get active reasons list
router.get('/reasons', authMiddleware, async (req, res) => {
    try {
        const reasons = await getSocialWorkReasons();
        res.json({ reasons });
    } catch (err) {
        console.error('Error in GET /reasons:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 2. Get social work request for a patient by AN
router.get('/requests/patient/:an', authMiddleware, async (req, res) => {
    try {
        const { an } = req.params;
        const request = await getSocialWorkRequestByAn(an);
        res.json({ request });
    } catch (err) {
        console.error('Error in GET /requests/patient/:an:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 3. Create a new social work request
router.post('/requests', authMiddleware, async (req, res) => {
    try {
        const { an, reason_id, reason_name, reason_other, nurse_comment } = req.body;
        if (!an || !reason_name) {
            return res.status(400).json({ error: 'กรุณาระบุ AN และสาเหตุที่ส่งปรึกษา' });
        }
        if (!nurse_comment || !nurse_comment.trim()) {
            return res.status(400).json({ error: 'กรุณาระบุความเห็นของพยาบาลหัวหน้าตึกหรือหัวหน้าเวร' });
        }

        const sent_by = req.user?.loginname || 'unknown';
        const sent_by_name = req.user?.name || sent_by;

        const request = await createSocialWorkRequest({
            an,
            reason_id,
            reason_name,
            reason_other,
            nurse_comment: nurse_comment.trim(),
            sent_by,
            sent_by_name
        });

        try {
            getIO().emit('social_work:updated', { an, id: request.id, status: 'pending' });
        } catch (e) {}

        res.json({
            success: true,
            message: 'ส่งปรึกษานักสังคมสงเคราะห์เรียบร้อยแล้ว',
            request
        });
    } catch (err) {
        console.error('Error in POST /requests:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 4. Update an existing pending request
router.put('/requests/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason_id, reason_name, reason_other, nurse_comment } = req.body;
        if (!reason_name) {
            return res.status(400).json({ error: 'กรุณาระบุสาเหตุที่ส่งปรึกษา' });
        }
        if (!nurse_comment || !nurse_comment.trim()) {
            return res.status(400).json({ error: 'กรุณาระบุความเห็นของพยาบาลหัวหน้าตึกหรือหัวหน้าเวร' });
        }

        const updated_by = req.user?.loginname || 'unknown';
        const updated_by_name = req.user?.name || updated_by;

        const request = await updateSocialWorkRequest(id, {
            reason_id,
            reason_name,
            reason_other,
            nurse_comment,
            updated_by,
            updated_by_name
        });

        try {
            getIO().emit('social_work:updated', { an: request?.an, id, status: 'pending' });
        } catch (e) {}

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลส่งปรึกษาเรียบร้อยแล้ว',
            request
        });
    } catch (err) {
        console.error('Error in PUT /requests/:id:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 5. Cancel a request (Admin can cancel even if answered)
router.post('/requests/:id/cancel', authMiddleware, async (req, res) => {
    let conn;
    try {
        const { id } = req.params;
        const { cancel_reason } = req.body;
        const cancelled_by = req.user?.loginname || 'unknown';
        const cancelled_by_name = req.user?.name || cancelled_by;
        const isAdmin = await isUserAdmin(cancelled_by);

        conn = await getDflowConnection();
        const rows = await conn.query('SELECT * FROM social_work_requests WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'ไม่พบรายการส่งปรึกษานี้' });
        }
        const reqItem = rows[0];

        if (reqItem.status === 'answered' && !isAdmin) {
            return res.status(403).json({ error: 'รายการนี้ได้รับการตอบแล้ว ไม่สามารถยกเลิกได้ (เฉพาะผู้ดูแลระบบ Admin เท่านั้น)' });
        }

        const success = await cancelSocialWorkRequest(id, {
            cancelled_by,
            cancelled_by_name,
            cancel_reason,
            isAdmin
        });

        if (!success) {
            return res.status(400).json({ error: 'ไม่สามารถยกเลิกได้ หรือรายการถูกยกเลิกไปแล้ว' });
        }

        try {
            getIO().emit('social_work:updated', { an: reqItem.an, id, status: 'cancelled' });
            getIO().emit('workflow:updated', { an: reqItem.an, type: 'social_work_cancelled' });
        } catch (e) {}

        res.json({
            success: true,
            message: 'ยกเลิกการส่งปรึกษาเรียบร้อยแล้ว'
        });
    } catch (err) {
        console.error('Error in POST /requests/:id/cancel:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (conn) conn.release();
    }
});

// 6. Get pending requests list (for social worker tab 1)
router.get('/requests/pending', authMiddleware, async (req, res) => {
    try {
        const requests = await getSocialWorkRequestsList('pending');
        res.json({ requests });
    } catch (err) {
        console.error('Error in GET /requests/pending:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 7. Get answered history requests list (for social worker tab 2)
router.get('/requests/history', authMiddleware, async (req, res) => {
    try {
        const requests = await getSocialWorkRequestsList('answered');
        res.json({ requests });
    } catch (err) {
        console.error('Error in GET /requests/history:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 8. Social worker answer / opinion
router.post('/requests/:id/answer', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { social_worker_comment } = req.body;

        if (!social_worker_comment || !social_worker_comment.trim()) {
            return res.status(400).json({ error: 'กรุณากรอกความคิดเห็นของนักสังคมสงเคราะห์' });
        }

        const social_worker_by = req.user?.loginname || 'unknown';
        const social_worker_by_name = req.user?.name || social_worker_by;

        const request = await answerSocialWorkRequest(id, {
            social_worker_comment: social_worker_comment.trim(),
            social_worker_by,
            social_worker_by_name
        });

        try {
            getIO().emit('social_work:updated', { an: request?.an, id, status: 'answered' });
        } catch (e) {}

        res.json({
            success: true,
            message: 'บันทึกความคิดเห็นของนักสังคมสงเคราะห์เรียบร้อยแล้ว',
            request
        });
    } catch (err) {
        console.error('Error in POST /requests/:id/answer:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
