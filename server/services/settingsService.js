const { getDflowConnection, getHisConnection } = require('../config/database');

const MODULE_KEYS = ['documents', 'pttype', 'ward', 'pharmacy', 'discharge', 'finance', 'social_work'];

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
    finance: ['F-ศูนย์เรียกเก็บ', 'F-ศูนย์เรียกเก็บ(Admin)'],
    social_work: ['นักสังคมสงเคราะห์']
};

const DEFAULT_DRUG_SETTINGS = {
    RETURN_MED_DOSAGEFORMS: {
        value: process.env.RETURN_MED_DOSAGEFORMS || "INJECTIONS,INJECTION",
        description: "รูปแบบยาที่ต้องส่งคืน (Dosage Forms)"
    },
    RETURN_MED_EXCLUDE_CATEGORIES: {
        value: process.env.RETURN_MED_EXCLUDE_CATEGORIES || "FLUIDS AND ELECTROLYTES,INTRAVENOUS SOLOTION,INTRAVENOUS SOLUTION,INTRAVENOUS ANAESTHETICS,LOCAL ANAESTHETICS",
        description: "หมวดหมู่ยาที่ยกเว้นแบบตรงตัว (Exact Exclude Categories)"
    },
    RETURN_MED_EXCLUDE_CATEGORIES_LIKE: {
        value: process.env.RETURN_MED_EXCLUDE_CATEGORIES_LIKE || "ANAESTHETICS",
        description: "หมวดหมู่ยาที่ยกเว้นแบบมีคำว่า (Exclude Categories LIKE)"
    },
    RETURN_MED_INCLUDE_CATEGORIES_LIKE: {
        value: process.env.RETURN_MED_INCLUDE_CATEGORIES_LIKE || "ANXIOLYTICS,OPIOID,SEDATIVES",
        description: "หมวดหมู่ยาที่บังคับรวมแบบมีคำว่า (Include Categories LIKE)"
    },
    RETURN_MED_INCLUDE_ICODES: {
        value: process.env.RETURN_MED_INCLUDE_ICODES || "1500513,1460536,1590016,1490407,1490100,1000244,1000245,1490114,1650084",
        description: "รหัสยาที่บังคับรวมเป็นพิเศษ (Include Drug Codes / icodes)"
    },
    RETURN_MED_EXCLUDE_NAME_LIKE: {
        value: process.env.RETURN_MED_EXCLUDE_NAME_LIKE || "วิสัญญี",
        description: "ชื่อยาที่ยกเว้นแบบมีคำว่า (Exclude Drug Name LIKE)"
    }
};

let cachedDrugSettings = null;

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

        // Seed default permissions for any modules not yet configured
        for (const [moduleKey, groups] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
            const mCount = await conn.query('SELECT COUNT(*) as cnt FROM module_role_permissions WHERE module_key = ?', [moduleKey]);
            if (Number(mCount[0]?.cnt || 0) === 0) {
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
                console.log(`Seeded default module_role_permissions for ${moduleKey}`);
            }
        }

        // 3. system_settings table (Key-Value configuration for return meds, etc.)
        await conn.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value TEXT,
                description VARCHAR(255),
                updated_by VARCHAR(50) DEFAULT 'system',
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        for (const [key, item] of Object.entries(DEFAULT_DRUG_SETTINGS)) {
            try {
                await conn.query(
                    `INSERT IGNORE INTO system_settings (setting_key, setting_value, description, updated_by)
                     VALUES (?, ?, ?, 'system_bootstrap')`,
                    [key, item.value, item.description]
                );
            } catch (e) {
                console.error('Error seeding drug setting:', key, e.message);
            }
        }

        // Preload drug settings into memory cache
        await loadDrugSettings();

        console.log('Settings tables initialized successfully');
    } catch (err) {
        console.error('Failed to initialize settings tables:', err);
    } finally {
        if (conn) conn.release();
    }
}

async function loadDrugSettings() {
    let conn;
    try {
        conn = await getDflowConnection();
        const rows = await conn.query('SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE "RETURN_MED_%"');
        const map = {};
        for (const r of rows) {
            map[r.setting_key] = r.setting_value;
        }

        cachedDrugSettings = {
            RETURN_MED_DOSAGEFORMS: map.RETURN_MED_DOSAGEFORMS !== undefined ? map.RETURN_MED_DOSAGEFORMS : DEFAULT_DRUG_SETTINGS.RETURN_MED_DOSAGEFORMS.value,
            RETURN_MED_EXCLUDE_CATEGORIES: map.RETURN_MED_EXCLUDE_CATEGORIES !== undefined ? map.RETURN_MED_EXCLUDE_CATEGORIES : DEFAULT_DRUG_SETTINGS.RETURN_MED_EXCLUDE_CATEGORIES.value,
            RETURN_MED_EXCLUDE_CATEGORIES_LIKE: map.RETURN_MED_EXCLUDE_CATEGORIES_LIKE !== undefined ? map.RETURN_MED_EXCLUDE_CATEGORIES_LIKE : DEFAULT_DRUG_SETTINGS.RETURN_MED_EXCLUDE_CATEGORIES_LIKE.value,
            RETURN_MED_INCLUDE_CATEGORIES_LIKE: map.RETURN_MED_INCLUDE_CATEGORIES_LIKE !== undefined ? map.RETURN_MED_INCLUDE_CATEGORIES_LIKE : DEFAULT_DRUG_SETTINGS.RETURN_MED_INCLUDE_CATEGORIES_LIKE.value,
            RETURN_MED_INCLUDE_ICODES: map.RETURN_MED_INCLUDE_ICODES !== undefined ? map.RETURN_MED_INCLUDE_ICODES : DEFAULT_DRUG_SETTINGS.RETURN_MED_INCLUDE_ICODES.value,
            RETURN_MED_EXCLUDE_NAME_LIKE: map.RETURN_MED_EXCLUDE_NAME_LIKE !== undefined ? map.RETURN_MED_EXCLUDE_NAME_LIKE : DEFAULT_DRUG_SETTINGS.RETURN_MED_EXCLUDE_NAME_LIKE.value,
        };
        return cachedDrugSettings;
    } catch (e) {
        console.error('Error loading drug settings:', e);
        if (!cachedDrugSettings) {
            cachedDrugSettings = {
                RETURN_MED_DOSAGEFORMS: DEFAULT_DRUG_SETTINGS.RETURN_MED_DOSAGEFORMS.value,
                RETURN_MED_EXCLUDE_CATEGORIES: DEFAULT_DRUG_SETTINGS.RETURN_MED_EXCLUDE_CATEGORIES.value,
                RETURN_MED_EXCLUDE_CATEGORIES_LIKE: DEFAULT_DRUG_SETTINGS.RETURN_MED_EXCLUDE_CATEGORIES_LIKE.value,
                RETURN_MED_INCLUDE_CATEGORIES_LIKE: DEFAULT_DRUG_SETTINGS.RETURN_MED_INCLUDE_CATEGORIES_LIKE.value,
                RETURN_MED_INCLUDE_ICODES: DEFAULT_DRUG_SETTINGS.RETURN_MED_INCLUDE_ICODES.value,
                RETURN_MED_EXCLUDE_NAME_LIKE: DEFAULT_DRUG_SETTINGS.RETURN_MED_EXCLUDE_NAME_LIKE.value,
            };
        }
        return cachedDrugSettings;
    } finally {
        if (conn) conn.release();
    }
}

function getDrugSettingsSync() {
    if (!cachedDrugSettings) {
        return {
            RETURN_MED_DOSAGEFORMS: DEFAULT_DRUG_SETTINGS.RETURN_MED_DOSAGEFORMS.value,
            RETURN_MED_EXCLUDE_CATEGORIES: DEFAULT_DRUG_SETTINGS.RETURN_MED_EXCLUDE_CATEGORIES.value,
            RETURN_MED_EXCLUDE_CATEGORIES_LIKE: DEFAULT_DRUG_SETTINGS.RETURN_MED_EXCLUDE_CATEGORIES_LIKE.value,
            RETURN_MED_INCLUDE_CATEGORIES_LIKE: DEFAULT_DRUG_SETTINGS.RETURN_MED_INCLUDE_CATEGORIES_LIKE.value,
            RETURN_MED_INCLUDE_ICODES: DEFAULT_DRUG_SETTINGS.RETURN_MED_INCLUDE_ICODES.value,
            RETURN_MED_EXCLUDE_NAME_LIKE: DEFAULT_DRUG_SETTINGS.RETURN_MED_EXCLUDE_NAME_LIKE.value,
        };
    }
    return cachedDrugSettings;
}

function getParsedReturnMedFilters() {
    const s = getDrugSettingsSync();
    return {
        dosageforms: (s.RETURN_MED_DOSAGEFORMS || '').split(',').map(x => x.trim()).filter(Boolean),
        excludeCategories: (s.RETURN_MED_EXCLUDE_CATEGORIES || '').split(',').map(x => x.trim()).filter(Boolean),
        excludeCategoriesLike: (s.RETURN_MED_EXCLUDE_CATEGORIES_LIKE || '').split(',').map(x => x.trim()).filter(Boolean),
        includeCategoriesLike: (s.RETURN_MED_INCLUDE_CATEGORIES_LIKE || '').split(',').map(x => x.trim()).filter(Boolean),
        includeIcodes: (s.RETURN_MED_INCLUDE_ICODES || '').split(',').map(x => x.trim()).filter(Boolean),
        excludeNameLike: (s.RETURN_MED_EXCLUDE_NAME_LIKE || '').split(',').map(x => x.trim()).filter(Boolean),
    };
}

async function saveDrugSettings(newSettings, updatedBy = 'system') {
    let conn;
    try {
        conn = await getDflowConnection();
        for (const [key, val] of Object.entries(newSettings)) {
            if (DEFAULT_DRUG_SETTINGS[key]) {
                const strVal = String(val ?? '').trim();
                await conn.query(
                    `INSERT INTO system_settings (setting_key, setting_value, description, updated_by)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE 
                        setting_value = VALUES(setting_value),
                        updated_by = VALUES(updated_by)`,
                    [key, strVal, DEFAULT_DRUG_SETTINGS[key].description, updatedBy]
                );
            }
        }
        await loadDrugSettings();
        return cachedDrugSettings;
    } catch (e) {
        console.error('Error saving drug settings:', e);
        throw e;
    } finally {
        if (conn) conn.release();
    }
}

async function getDrugDetailsByIcodes(icodes) {
    if (!Array.isArray(icodes) || icodes.length === 0) return [];
    let hisConn;
    try {
        hisConn = await getHisConnection();
        const rows = await hisConn.query(
            `SELECT icode, name, strength, units, dosageform, drugcategory 
             FROM drugitems 
             WHERE icode IN (?)
             ORDER BY name ASC`,
            [icodes]
        );
        return rows;
    } catch (e) {
        console.error('Error in getDrugDetailsByIcodes:', e);
        return [];
    } finally {
        if (hisConn) hisConn.release();
    }
}

async function searchDrugitems(searchQuery) {
    if (!searchQuery || searchQuery.trim().length < 2) return [];
    let hisConn;
    try {
        hisConn = await getHisConnection();
        const term = `%${searchQuery.trim()}%`;
        const rows = await hisConn.query(
            `SELECT icode, name, strength, units, dosageform, drugcategory 
             FROM drugitems 
             WHERE (icode LIKE ? OR name LIKE ?)
             ORDER BY name ASC 
             LIMIT 30`,
            [term, term]
        );
        return rows;
    } catch (e) {
        console.error('Error in searchDrugitems:', e);
        return [];
    } finally {
        if (hisConn) hisConn.release();
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
    DEFAULT_DRUG_SETTINGS,
    initSettingsTables,
    isUserAdmin,
    getUserPermissions,
    loadDrugSettings,
    getDrugSettingsSync,
    getParsedReturnMedFilters,
    saveDrugSettings,
    getDrugDetailsByIcodes,
    searchDrugitems
};
