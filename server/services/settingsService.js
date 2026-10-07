const { getDflowConnection, getHisConnection } = require('../config/database');

const MODULE_KEYS = ['documents', 'pttype', 'ward', 'pharmacy', 'discharge', 'finance'];

const DEFAULT_ADMINS = [
    { loginname: 'admin', name: 'Administrator' },
    { loginname: 'rbh6207', name: 'สรวิศ จันทร์เพ็ญ,นพ.' },
    { loginname: 'rbh4802', name: 'สุวรรณี สุโขประสพชัย' }
];

const DEFAULT_ROLE_PERMISSIONS = {
    documents: ['เวชระเบียน', 'เวชระเบียน(Admin)'],
    pttype: ['F-ศูนย์เรียกเก็บ', 'RBH_ศูนย์Claiming', 'ศูนย์ประกันสุขภาพ', 'Iclaim', 'F-ศูนย์เรียกเก็บ(Admin)'],
    ward: [
        'RBH_OPD_IPD_NURSE',
        'RBH_OPD_NA',
        'RBH_STUDENT_NURSE',
        'RBH_OPD_NURSE',
        'อุบัติเหตุและฉุกเฉิน',
        'RBH_DOCTOR',
        'RBH_MED_SCHOOL'
    ],
    pharmacy: ['Rx-ห้องยาผู้ป่วยใน', 'Rx-ห้องยาผู้ป่วยนอก', 'Rx-ผู้ดูแลระบบ', 'ศูนย์แพ้ยา'],
    discharge: ['RBH_OPD_IPD_NURSE', 'RBH_OPD_NA', 'เวชระเบียน', 'Rx-ห้องยาผู้ป่วยใน'],
    finance: ['F-ศูนย์เรียกเก็บ', 'F-ศูนย์เรียกเก็บ(Admin)']
};

async function initSettingsTables() {
    let conn;
    try {
        conn = await getDflowConnection();

        // 1. system_admins table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS system_admins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                loginname VARCHAR(50) NOT NULL UNIQUE,
                name VARCHAR(150),
                created_by VARCHAR(50) DEFAULT 'system',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_loginname (loginname)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Check if system_admins is empty, if so seed defaults
        const adminCount = await conn.query('SELECT COUNT(*) as cnt FROM system_admins');
        if (Number(adminCount[0]?.cnt || 0) === 0) {
            for (const admin of DEFAULT_ADMINS) {
                try {
                    await conn.query(
                        'INSERT IGNORE INTO system_admins (loginname, name, created_by) VALUES (?, ?, ?)',
                        [admin.loginname, admin.name, 'system_bootstrap']
                    );
                } catch (e) {
                    console.error('Error seeding default admin:', admin.loginname, e.message);
                }
            }
            console.log('Seeded default system_admins');
        }

        // 2. module_role_permissions table
        await conn.query(`
            CREATE TABLE IF NOT EXISTS module_role_permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                module_key VARCHAR(50) NOT NULL,
                groupname VARCHAR(150) NOT NULL,
                created_by VARCHAR(50) DEFAULT 'system',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_module_group (module_key, groupname),
                INDEX idx_module (module_key),
                INDEX idx_group (groupname)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Check if module_role_permissions is empty, if so seed defaults
        const permCount = await conn.query('SELECT COUNT(*) as cnt FROM module_role_permissions');
        if (Number(permCount[0]?.cnt || 0) === 0) {
            for (const [moduleKey, groups] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
                for (const group of groups) {
                    try {
                        await conn.query(
                            'INSERT IGNORE INTO module_role_permissions (module_key, groupname, created_by) VALUES (?, ?, ?)',
                            [moduleKey, group, 'system_bootstrap']
                        );
                    } catch (e) {
                        console.error('Error seeding default permission:', moduleKey, group, e.message);
                    }
                }
            }
            console.log('Seeded default module_role_permissions');
        }

        console.log('Settings tables initialized successfully');
    } catch (err) {
        console.error('Failed to initialize settings tables:', err);
    } finally {
        if (conn) conn.release();
    }
}

async function isUserAdmin(loginname) {
    if (!loginname) return false;
    let conn;
    try {
        conn = await getDflowConnection();
        const rows = await conn.query('SELECT id FROM system_admins WHERE loginname = ? LIMIT 1', [loginname]);
        if (rows.length > 0) return true;

        // If system_admins is completely empty, fallback check
        const total = await conn.query('SELECT COUNT(*) as cnt FROM system_admins');
        if (Number(total[0]?.cnt || 0) === 0) {
            if (loginname === 'admin' || loginname === 'rbh6207' || loginname === 'rbh4802') {
                return true;
            }
        }
        return false;
    } catch (err) {
        console.error('Error checking isUserAdmin:', err);
        return false;
    } finally {
        if (conn) conn.release();
    }
}

async function getUserPermissions(loginname, providedGroupName) {
    const isAdmin = await isUserAdmin(loginname);
    if (isAdmin) {
        return {
            isAdmin: true,
            groupname: providedGroupName || '',
            allowedModules: [...MODULE_KEYS]
        };
    }

    let groupname = providedGroupName;
    // If groupname not provided or empty, try fetching from HIS opduser
    if (!groupname && loginname) {
        let hisConn;
        try {
            hisConn = await getHisConnection();
            const rows = await hisConn.query('SELECT groupname FROM opduser WHERE loginname = ? LIMIT 1', [loginname]);
            if (rows.length > 0 && rows[0].groupname) {
                groupname = rows[0].groupname;
            }
        } catch (e) {
            console.error('Error querying opduser groupname:', e);
        } finally {
            if (hisConn) hisConn.release();
        }
    }

    if (!groupname) {
        return {
            isAdmin: false,
            groupname: '',
            allowedModules: []
        };
    }

    let dflowConn;
    try {
        dflowConn = await getDflowConnection();
        const rows = await dflowConn.query(
            'SELECT DISTINCT module_key FROM module_role_permissions WHERE groupname = ?',
            [groupname]
        );
        const allowedModules = rows.map(r => r.module_key);
        return {
            isAdmin: false,
            groupname,
            allowedModules
        };
    } catch (err) {
        console.error('Error querying module permissions:', err);
        return {
            isAdmin: false,
            groupname,
            allowedModules: []
        };
    } finally {
        if (dflowConn) dflowConn.release();
    }
}

module.exports = {
    MODULE_KEYS,
    initSettingsTables,
    isUserAdmin,
    getUserPermissions
};
