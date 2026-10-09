const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getDflowConnection, getHisConnection } = require('../config/database');
const { 
    MODULE_KEYS, 
    DEFAULT_DRUG_SETTINGS,
    DEFAULT_XRAY_SETTINGS,
    isUserAdmin, 
    getUserPermissions,
    getDrugSettingsSync,
    saveDrugSettings,
    getDrugDetailsByIcodes,
    searchDrugitems,
    getXraySettingsSync,
    getParsedXrayFilters,
    saveXraySettings,
    getXrayGroupsList,
    getXrayDetailsByIcodes,
    searchXrayItems
} = require('../services/settingsService');
const { getIO } = require('../lib/socket');

const router = express.Router();

const MODULE_DEFINITIONS = [
    { key: 'documents', name: 'เวชระเบียน', desc: 'จัดการเอกสารผู้ป่วยใน', icon: 'FileText' },
    { key: 'pttype', name: 'งานสิทธิ์', desc: 'ข้อมูลสิทธิผู้ป่วย', icon: 'ShieldCheck' },
    { key: 'ward', name: 'หอผู้ป่วย', desc: 'ข้อมูลหอผู้ป่วย', icon: 'Building2' },
    { key: 'pharmacy', name: 'ห้องยา', desc: 'ระบบห้องยา', icon: 'Pill' },
    { key: 'discharge', name: 'ศูนย์จำหน่าย', desc: 'ศูนย์จำหน่ายผู้ป่วย', icon: 'ClipboardList' },
    { key: 'finance', name: 'การเงิน', desc: 'ระบบการเงิน', icon: 'Wallet' },
    { key: 'social_work', name: 'สังคมสงเคราะห์', desc: 'ระบบงานสังคมสงเคราะห์และให้คำปรึกษา', icon: 'HeartHandshake' }
];

// Middleware: Require Admin
const requireAdmin = async (req, res, next) => {
    try {
        const loginname = req.user?.loginname;
        if (!loginname) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const adminStatus = await isUserAdmin(loginname);
        if (!adminStatus) {
            return res.status(403).json({ error: 'Forbidden: คุณไม่มีสิทธิ์เข้าถึงส่วนผู้ดูแลระบบ (Admin Only)' });
        }
        next();
    } catch (err) {
        console.error('Error in requireAdmin middleware:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// 1. Get current user's permissions and admin status
router.get('/my-permissions', authMiddleware, async (req, res) => {
    try {
        const loginname = req.user?.loginname;
        const groupname = req.user?.groupname;
        const permissions = await getUserPermissions(loginname, groupname);
        res.json(permissions);
    } catch (err) {
        console.error('Error fetching my-permissions:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 2. Get list of system admins (Admin only)
router.get('/admins', authMiddleware, requireAdmin, async (req, res) => {
    let dflowConn;
    let hisConn;
    try {
        dflowConn = await getDflowConnection();
        const admins = await dflowConn.query(`
            SELECT id, loginname, name, created_by, created_at, updated_at 
            FROM system_admins 
            ORDER BY id ASC
        `);

        // Fetch up-to-date name and groupname from HIS opduser
        if (admins.length > 0) {
            try {
                hisConn = await getHisConnection();
                const loginnames = admins.map(a => a.loginname);
                const hisUsers = await hisConn.query(
                    'SELECT loginname, name, groupname FROM opduser WHERE loginname IN (?)',
                    [loginnames]
                );
                const userMap = new Map();
                for (const u of hisUsers) {
                    userMap.set(u.loginname, u);
                }

                for (const admin of admins) {
                    const hisUser = userMap.get(admin.loginname);
                    if (hisUser) {
                        admin.hisName = hisUser.name;
                        admin.groupname = hisUser.groupname;
                        if (!admin.name && hisUser.name) admin.name = hisUser.name;
                    }
                }
            } catch (e) {
                console.error('Error fetching HIS details for admins:', e);
            }
        }

        res.json({ admins });
    } catch (err) {
        console.error('Error in GET /admins:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dflowConn) dflowConn.release();
        if (hisConn) hisConn.release();
    }
});

// 3. Add an admin (Admin only)
router.post('/admins', authMiddleware, requireAdmin, async (req, res) => {
    const { loginname } = req.body;
    if (!loginname || !loginname.trim()) {
        return res.status(400).json({ error: 'กรุณาระบุ Username (loginname)' });
    }

    const cleanLoginname = loginname.trim();

    let dflowConn;
    let hisConn;
    try {
        dflowConn = await getDflowConnection();

        // Check if already an admin
        const existing = await dflowConn.query(
            'SELECT id FROM system_admins WHERE loginname = ? LIMIT 1',
            [cleanLoginname]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'ผู้ใช้งานนี้ได้รับการตั้งค่าเป็น Admin อยู่แล้ว' });
        }

        // Verify user exists in HIS opduser and get their name
        hisConn = await getHisConnection();
        const hisUser = await hisConn.query(
            'SELECT loginname, name, groupname FROM opduser WHERE loginname = ? LIMIT 1',
            [cleanLoginname]
        );

        if (hisUser.length === 0) {
            return res.status(404).json({ error: `ไม่พบผู้ใช้งาน "${cleanLoginname}" ในระบบ HOSxP` });
        }

        const name = hisUser[0].name || cleanLoginname;
        const currentAdmin = req.user?.loginname || 'admin';

        await dflowConn.query(
            'INSERT INTO system_admins (loginname, name, created_by) VALUES (?, ?, ?)',
            [cleanLoginname, name, currentAdmin]
        );

        try {
            getIO().emit('settings:admins_updated');
        } catch (e) {}

        res.json({
            success: true,
            message: `เพิ่ม "${name}" (${cleanLoginname}) เป็น Admin เรียบร้อยแล้ว`,
            admin: {
                loginname: cleanLoginname,
                name,
                groupname: hisUser[0].groupname,
                created_by: currentAdmin,
                created_at: new Date()
            }
        });
    } catch (err) {
        console.error('Error in POST /admins:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dflowConn) dflowConn.release();
        if (hisConn) hisConn.release();
    }
});

// 4. Delete an admin (Admin only)
router.delete('/admins/:loginname', authMiddleware, requireAdmin, async (req, res) => {
    const { loginname } = req.params;
    if (!loginname) {
        return res.status(400).json({ error: 'Missing loginname' });
    }

    let dflowConn;
    try {
        dflowConn = await getDflowConnection();

        // Check total admin count
        const total = await dflowConn.query('SELECT COUNT(*) as cnt FROM system_admins');
        const count = Number(total[0]?.cnt || 0);
        if (count <= 1) {
            return res.status(400).json({ error: 'ไม่สามารถลบ Admin คนสุดท้ายได้ ระบบต้องมี Admin อย่างน้อย 1 คน' });
        }

        const result = await dflowConn.query(
            'DELETE FROM system_admins WHERE loginname = ?',
            [loginname]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'ไม่พบ Admin ที่ต้องการลบ' });
        }

        try {
            getIO().emit('settings:admins_updated');
        } catch (e) {}

        res.json({ success: true, message: `ลบ Admin (${loginname}) เรียบร้อยแล้ว` });
    } catch (err) {
        console.error('Error in DELETE /admins:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dflowConn) dflowConn.release();
    }
});

// 5. Search users from HOSxP opduser (Admin only)
router.get('/users/search', authMiddleware, requireAdmin, async (req, res) => {
    const query = req.query.q || '';
    if (!query.trim() || query.trim().length < 2) {
        return res.json({ users: [] });
    }

    let hisConn;
    try {
        hisConn = await getHisConnection();
        const searchTerm = `%${query.trim()}%`;
        const users = await hisConn.query(`
            SELECT loginname, name, groupname 
            FROM opduser 
            WHERE (loginname LIKE ? OR name LIKE ?) 
              AND (account_disable IS NULL OR account_disable != 'Y')
              AND groupname NOT IN ('RBH_Userที่ถูกยกเลิกการใช้งาน', 'ยกเลิก')
            ORDER BY name ASC 
            LIMIT 20
        `, [searchTerm, searchTerm]);

        res.json({ users });
    } catch (err) {
        console.error('Error searching opduser:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (hisConn) hisConn.release();
    }
});

// 6. Get available user groups from HOSxP opduser (Admin only)
router.get('/groups', authMiddleware, requireAdmin, async (req, res) => {
    let hisConn;
    try {
        hisConn = await getHisConnection();
        const rows = await hisConn.query(`
            SELECT DISTINCT groupname 
            FROM opduser 
            WHERE groupname IS NOT NULL 
              AND groupname != '' 
              AND groupname NOT IN ('RBH_Userที่ถูกยกเลิกการใช้งาน', 'ยกเลิก')
            ORDER BY groupname ASC
        `);

        const groups = rows.map(r => r.groupname);
        res.json({ groups });
    } catch (err) {
        console.error('Error fetching opduser groups:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (hisConn) hisConn.release();
    }
});

// 7. Get module role permissions (Admin only)
router.get('/roles', authMiddleware, requireAdmin, async (req, res) => {
    let dflowConn;
    try {
        dflowConn = await getDflowConnection();
        const rows = await dflowConn.query(`
            SELECT module_key, groupname 
            FROM module_role_permissions 
            ORDER BY module_key, groupname ASC
        `);

        const permissions = {};
        for (const k of MODULE_KEYS) {
            permissions[k] = [];
        }

        for (const row of rows) {
            if (permissions[row.module_key]) {
                permissions[row.module_key].push(row.groupname);
            }
        }

        res.json({
            modules: MODULE_DEFINITIONS,
            permissions
        });
    } catch (err) {
        console.error('Error in GET /roles:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dflowConn) dflowConn.release();
    }
});

// 8. Update module role permissions (Admin only)
router.post('/roles', authMiddleware, requireAdmin, async (req, res) => {
    const { module_key, groupnames, permissions } = req.body;
    const currentAdmin = req.user?.loginname || 'admin';

    let dflowConn;
    try {
        dflowConn = await getDflowConnection();

        if (module_key) {
            // Update single module
            if (!MODULE_KEYS.includes(module_key)) {
                return res.status(400).json({ error: `Invalid module key: ${module_key}` });
            }

            const cleanGroups = Array.isArray(groupnames) 
                ? [...new Set(groupnames.map(g => String(g).trim()).filter(Boolean))] 
                : [];

            await dflowConn.query(
                'DELETE FROM module_role_permissions WHERE module_key = ?',
                [module_key]
            );

            for (const group of cleanGroups) {
                await dflowConn.query(
                    'INSERT INTO module_role_permissions (module_key, groupname, created_by) VALUES (?, ?, ?)',
                    [module_key, group, currentAdmin]
                );
            }
        } else if (permissions && typeof permissions === 'object') {
            // Batch update all modules
            for (const [key, groups] of Object.entries(permissions)) {
                if (MODULE_KEYS.includes(key)) {
                    const cleanGroups = Array.isArray(groups)
                        ? [...new Set(groups.map(g => String(g).trim()).filter(Boolean))]
                        : [];

                    await dflowConn.query(
                        'DELETE FROM module_role_permissions WHERE module_key = ?',
                        [key]
                    );

                    for (const group of cleanGroups) {
                        await dflowConn.query(
                            'INSERT INTO module_role_permissions (module_key, groupname, created_by) VALUES (?, ?, ?)',
                            [key, group, currentAdmin]
                        );
                    }
                }
            }
        } else {
            return res.status(400).json({ error: 'ต้องระบุ module_key หรือ permissions' });
        }

        try {
            getIO().emit('settings:permissions_updated');
        } catch (e) {}

        res.json({ success: true, message: 'บันทึกการตั้งค่าสิทธิ์เรียบร้อยแล้ว' });
    } catch (err) {
        console.error('Error updating module role permissions:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dflowConn) dflowConn.release();
    }
});

// 9. Get drug filter settings (Admin only)
router.get('/drugs', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const settings = getDrugSettingsSync();
        const icodes = (settings.RETURN_MED_INCLUDE_ICODES || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
        const resolvedDrugs = await getDrugDetailsByIcodes(icodes);

        res.json({
            settings,
            defaults: DEFAULT_DRUG_SETTINGS,
            resolvedDrugs
        });
    } catch (err) {
        console.error('Error in GET /drugs:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 10. Update drug filter settings (Admin only)
router.post('/drugs', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { settings } = req.body;
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Invalid settings payload' });
        }

        const currentAdmin = req.user?.loginname || 'admin';
        const updatedSettings = await saveDrugSettings(settings, currentAdmin);

        const icodes = (updatedSettings.RETURN_MED_INCLUDE_ICODES || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
        const resolvedDrugs = await getDrugDetailsByIcodes(icodes);

        try {
            getIO().emit('settings:drugs_updated', { settings: updatedSettings });
        } catch (e) {}

        res.json({
            success: true,
            message: 'บันทึกการตั้งค่าตัวกรองยาคืนเรียบร้อยแล้ว',
            settings: updatedSettings,
            resolvedDrugs
        });
    } catch (err) {
        console.error('Error in POST /drugs:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 11. Search drug items from HOSxP drugitems (Admin only)
router.get('/drugs/search', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const query = req.query.q || '';
        const drugs = await searchDrugitems(query);
        res.json({ drugs });
    } catch (err) {
        console.error('Error in GET /drugs/search:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 12. Get X-ray duplicate filter settings (Admin only)
router.get('/xray', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const settings = getXraySettingsSync();
        const parsed = getParsedXrayFilters();
        const [allGroups, resolvedIcodes] = await Promise.all([
            getXrayGroupsList(),
            getXrayDetailsByIcodes(parsed.excludeIcodes)
        ]);

        res.json({
            settings,
            defaults: DEFAULT_XRAY_SETTINGS,
            allGroups,
            resolvedIcodes
        });
    } catch (err) {
        console.error('Error in GET /xray:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 13. Update X-ray duplicate filter settings (Admin only)
router.post('/xray', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { settings } = req.body;
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Invalid settings payload' });
        }

        const currentAdmin = req.user?.loginname || 'admin';
        const updatedSettings = await saveXraySettings(settings, currentAdmin);
        const parsed = getParsedXrayFilters();
        const [allGroups, resolvedIcodes] = await Promise.all([
            getXrayGroupsList(),
            getXrayDetailsByIcodes(parsed.excludeIcodes)
        ]);

        try {
            getIO().emit('settings:xray_updated', { settings: updatedSettings });
        } catch (e) {}

        res.json({
            success: true,
            message: 'บันทึกการตั้งค่ายกเว้นรายการ X-ray เรียบร้อยแล้ว',
            settings: updatedSettings,
            allGroups,
            resolvedIcodes
        });
    } catch (err) {
        console.error('Error in POST /xray:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 14. Search X-ray items from HOSxP (Admin only)
router.get('/xray/search', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const query = req.query.q || '';
        const items = await searchXrayItems(query);
        res.json({ items });
    } catch (err) {
        console.error('Error in GET /xray/search:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 15. Get all X-ray groups master (Admin only)
router.get('/xray/groups', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const groups = await getXrayGroupsList();
        res.json({ groups });
    } catch (err) {
        console.error('Error in GET /xray/groups:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 16. Get No Authen Code exempt pttypes (Admin only)
router.get('/no-authen-pttypes', authMiddleware, requireAdmin, async (req, res) => {
    let dflowConn;
    try {
        dflowConn = await getDflowConnection();
        const rows = await dflowConn.query(`
            SELECT id, pttype, name, is_active, note, created_at, updated_at, created_by 
            FROM nhso_no_authen_exempt_pttypes 
            ORDER BY pttype ASC
        `);
        res.json({ pttypes: rows });
    } catch (err) {
        console.error('Error in GET /no-authen-pttypes:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dflowConn) dflowConn.release();
    }
});

// 17. Search pttype from HOSxP (Admin only)
router.get('/no-authen-pttypes/search', authMiddleware, requireAdmin, async (req, res) => {
    const query = req.query.q || '';
    let hisConn;
    try {
        hisConn = await getHisConnection();
        const searchTerm = `%${query.trim()}%`;
        const rows = await hisConn.query(`
            SELECT pttype, name 
            FROM pttype 
            WHERE (pttype LIKE ? OR name LIKE ?) 
            ORDER BY pttype ASC 
            LIMIT 30
        `, [searchTerm, searchTerm]);
        res.json({ pttypes: rows });
    } catch (err) {
        console.error('Error in GET /no-authen-pttypes/search:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (hisConn) hisConn.release();
    }
});

// 18. Add No Authen Code exempt pttype (Admin only)
router.post('/no-authen-pttypes', authMiddleware, requireAdmin, async (req, res) => {
    const { pttype, name, note } = req.body;
    if (!pttype || !String(pttype).trim()) {
        return res.status(400).json({ error: 'กรุณาระบุรหัสสิทธิ (pttype)' });
    }

    const cleanPttype = String(pttype).trim();
    let dflowConn, hisConn;
    try {
        dflowConn = await getDflowConnection();

        // Check if exists
        const existing = await dflowConn.query(
            'SELECT id FROM nhso_no_authen_exempt_pttypes WHERE pttype = ? LIMIT 1',
            [cleanPttype]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: `รหัสสิทธิ "${cleanPttype}" ได้รับการยกเว้น Authen อยู่แล้ว` });
        }

        let pttypeName = name ? String(name).trim() : null;
        if (!pttypeName) {
            hisConn = await getHisConnection();
            const hRows = await hisConn.query('SELECT name FROM pttype WHERE pttype = ? LIMIT 1', [cleanPttype]);
            if (hRows.length > 0) {
                pttypeName = hRows[0].name;
            }
        }

        const currentAdmin = req.user?.loginname || 'admin';
        await dflowConn.query(
            'INSERT INTO nhso_no_authen_exempt_pttypes (pttype, name, is_active, note, created_by) VALUES (?, ?, 1, ?, ?)',
            [cleanPttype, pttypeName || cleanPttype, note || 'ยกเว้นการบังคับมี Authen Code', currentAdmin]
        );

        try {
            getIO().emit('settings:no_authen_updated');
            getIO().emit('workflow:updated', { type: 'no_authen_updated' });
        } catch (e) {}

        res.json({
            success: true,
            message: `เพิ่มรหัสสิทธิ "${cleanPttype} - ${pttypeName || ''}" ในรายการยกเว้น Authen Code เรียบร้อยแล้ว`
        });
    } catch (err) {
        console.error('Error in POST /no-authen-pttypes:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dflowConn) dflowConn.release();
        if (hisConn) hisConn.release();
    }
});

// 19. Delete No Authen Code exempt pttype (Admin only)
router.delete('/no-authen-pttypes/:id', authMiddleware, requireAdmin, async (req, res) => {
    const { id } = req.params;
    let dflowConn;
    try {
        dflowConn = await getDflowConnection();
        const result = await dflowConn.query(
            'DELETE FROM nhso_no_authen_exempt_pttypes WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'ไม่พบรายการที่ต้องการลบ' });
        }

        try {
            getIO().emit('settings:no_authen_updated');
            getIO().emit('workflow:updated', { type: 'no_authen_updated' });
        } catch (e) {}

        res.json({ success: true, message: 'ลบรายการยกเว้น Authen Code เรียบร้อยแล้ว' });
    } catch (err) {
        console.error('Error in DELETE /no-authen-pttypes:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dflowConn) dflowConn.release();
    }
});

module.exports = router;
