const express = require('express');
const { hisPool, dflowPool, getHisWriteConnection, getDflowConnection } = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { formatCid, formatDateOnly, mapNhsoToHosPttype } = require('../services/nhsoMapping');

const router = express.Router();
router.use(authMiddleware);

const getNhsoBaseUrl = () => {
    return process.env.NHSO_AUTHEN_URL || 'http://nhso-authen.local';
};

// ============================================================
// 1. GET /inpatients: List all admitted inpatients with 4 tables + NHSO status
// ============================================================
router.get('/inpatients', async (req, res) => {
    let hisConn, dflowConn;
    try {
        hisConn = await hisPool.getConnection();
        dflowConn = await dflowPool.getConnection();

        // 1. Base query for all admitted inpatients (ipt.dchdate IS NULL)
        const patients = await hisConn.query(`
            SELECT 
                i.an, i.vn, i.hn, DATE_FORMAT(i.regdate, '%Y-%m-%d') as admit_date, i.regtime as admit_time,
                p.pname, p.fname, p.lname, p.cid,
                TIMESTAMPDIFF(YEAR, p.birthday, CURDATE()) as age_y,
                w.ward as ward_code, w.name as ward_name,
                i.pttype as ipt_pttype, pt_ipt.name as ipt_pttype_name, i.staff as ipt_staff,
                o.pttype as ovst_pttype, pt_ovst.name as ovst_pttype_name,
                o.pttypeno as ovst_pttypeno, o.hospmain as ovst_hospmain, o.hospsub as ovst_hospsub, o.staff as ovst_staff
            FROM ipt i
            INNER JOIN patient p ON i.hn = p.hn
            LEFT JOIN ward w ON i.ward = w.ward
            LEFT JOIN ovst o ON i.vn = o.vn
            LEFT JOIN pttype pt_ipt ON i.pttype = pt_ipt.pttype
            LEFT JOIN pttype pt_ovst ON o.pttype = pt_ovst.pttype
            WHERE i.dchdate IS NULL
            ORDER BY i.regdate DESC, i.regtime DESC
        `);

        if (!patients || patients.length === 0) {
            return res.json({
                patients: [],
                wards: [],
                stats: { total: 0, checked: 0, unchecked: 0, has_authen: 0, no_authen: 0 }
            });
        }

        const ans = patients.map(p => p.an);
        const vns = patients.map(p => p.vn).filter(Boolean);

        // 2. Fetch ipt_pttype, visit_pttype, opduser, authen, and sub-centers concurrently
        const [iptPttypeRows, visitPttypeRows, staffRows, nhsoRows, subCenterRows, exemptRows] = await Promise.all([
            hisConn.query(`
                SELECT ip.an, ip.pttype_number, ip.pttype, p.name as pttype_name,
                       ip.pttypeno, ip.hospmain, ip.hospsub, ip.begin_date, ip.expire_date,
                       ip.auth_code, ip.claim_code, ip.staff
                FROM ipt_pttype ip
                INNER JOIN ipt i ON ip.an = i.an AND i.dchdate IS NULL
                LEFT JOIN pttype p ON ip.pttype = p.pttype
                ORDER BY ip.an, ip.pttype_number ASC
            `),
            hisConn.query(`
                SELECT vp.vn, vp.pttype_number, vp.pttype, p.name as pttype_name,
                       vp.pttypeno, vp.hospmain, vp.hospsub, vp.begin_date, vp.expire_date,
                       vp.auth_code, vp.claim_code, vp.staff
                FROM visit_pttype vp
                INNER JOIN ipt i ON vp.vn = i.vn AND i.dchdate IS NULL
                LEFT JOIN pttype p ON vp.pttype = p.pttype
                ORDER BY vp.vn, vp.pttype_number ASC
            `),
            hisConn.query(`SELECT loginname, name FROM opduser`),
            vns.length > 0 
                ? dflowConn.query(`
                    SELECT vn, pid, right_check_date, maininscl_id, maininscl_name,
                           subinscl_id, subinscl_name, hospmain_code, hospmain_name,
                           hospsub_code, hospsub_name, card_id, right_start_date,
                           claim_code, claim_type_name, create_date, received_datetime,
                           authen_status, source_channel, updated_at
                    FROM vn_nhso_authen
                    WHERE vn IN (?)
                `, [vns])
                : [],
            dflowConn.query('SELECT UPPER(hospcode) as code FROM nhso_ucs_sub_centers WHERE is_active = 1').catch(() => []),
            dflowConn.query('SELECT UPPER(pttype) as code FROM nhso_exempt_pttypes WHERE is_active = 1').catch(() => [])
        ]);

        const dynamicSubCenters = Array.isArray(subCenterRows) && subCenterRows.length > 0 ? subCenterRows.map(r => r.code) : null;
        const exemptCodes = Array.isArray(exemptRows) && exemptRows.length > 0 ? exemptRows.map(r => r.code) : [];

        // Build Staff Name Lookup
        const staffMap = new Map();
        for (const s of staffRows) {
            staffMap.set(String(s.loginname).trim(), s.name);
        }

        // Build ipt_pttype Map by AN
        const iptPttypeMap = new Map();
        for (const row of iptPttypeRows) {
            const an = row.an;
            if (!iptPttypeMap.has(an)) iptPttypeMap.set(an, []);
            iptPttypeMap.get(an).push({
                pttype_number: row.pttype_number,
                pttype: row.pttype,
                pttype_name: row.pttype_name || '-',
                pttypeno: row.pttypeno || '',
                hospmain: row.hospmain || '',
                hospsub: row.hospsub || '',
                begin_date: formatDateOnly(row.begin_date),
                expire_date: formatDateOnly(row.expire_date),
                auth_code: row.auth_code || row.claim_code || '',
                staff: row.staff || '',
                staff_name: row.staff ? (staffMap.get(String(row.staff).trim()) || row.staff) : ''
            });
        }

        // Build visit_pttype Map by VN
        const visitPttypeMap = new Map();
        for (const row of visitPttypeRows) {
            const vn = row.vn;
            if (!visitPttypeMap.has(vn)) visitPttypeMap.set(vn, []);
            visitPttypeMap.get(vn).push({
                pttype_number: row.pttype_number,
                pttype: row.pttype,
                pttype_name: row.pttype_name || '-',
                pttypeno: row.pttypeno || '',
                hospmain: row.hospmain || '',
                hospsub: row.hospsub || '',
                begin_date: formatDateOnly(row.begin_date),
                expire_date: formatDateOnly(row.expire_date),
                auth_code: row.auth_code || row.claim_code || '',
                staff: row.staff || '',
                staff_name: row.staff ? (staffMap.get(String(row.staff).trim()) || row.staff) : ''
            });
        }

        // Build NHSO Authen Map by VN
        const nhsoMap = new Map();
        for (const row of nhsoRows) {
            nhsoMap.set(row.vn, row);
        }

        // Distinct Wards
        const wardMap = new Map();
        patients.forEach(p => {
            if (p.ward_code && !wardMap.has(p.ward_code)) {
                wardMap.set(p.ward_code, { code: p.ward_code, name: p.ward_name || p.ward_code });
            }
        });
        const wards = Array.from(wardMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'th'));

        // Stats counters
        let checkedCount = 0;
        let hasAuthenCount = 0;

        // Merge patient records
        const resultPatients = patients.map(p => {
            const nhso = nhsoMap.get(p.vn) || null;
            const hasChecked = Boolean(nhso && nhso.right_check_date);
            const hasClaimCode = Boolean(nhso && nhso.claim_code);

            if (hasChecked) checkedCount++;
            if (hasClaimCode) hasAuthenCount++;

            const iptList = iptPttypeMap.get(p.an) || [];
            const visitList = visitPttypeMap.get(p.vn) || [];

            // Staff determination: ดึงจาก ipt.staff
            const primaryStaffCode = p.ipt_staff || '';
            const primaryStaffName = primaryStaffCode ? (staffMap.get(String(primaryStaffCode).trim()) || primaryStaffCode) : '';

            // Match checking between ipt_pttype and NHSO API
            let mappedPttype = null;
            let isRightsMatch = false;
            let isHospmainMatch = true;
            let isHospsubMatch = true;
            let isHospMatch = true;
            let isMismatch = false;

            if (hasChecked && nhso) {
                const currentPttype = p.ipt_pttype || p.ovst_pttype || '';
                const isExempt = currentPttype && exemptCodes.includes(String(currentPttype).trim().toUpperCase());
                if (isExempt) {
                    mappedPttype = currentPttype;
                } else {
                    mappedPttype = mapNhsoToHosPttype(
                        nhso.maininscl_id,
                        nhso.subinscl_id,
                        nhso.hospmain_code,
                        nhso.hospsub_code,
                        currentPttype,
                        dynamicSubCenters
                    );
                }

                if (mappedPttype) {
                    isRightsMatch = iptList.some(ip => String(ip.pttype || '').trim().toLowerCase() === String(mappedPttype).trim().toLowerCase());
                }

                const nhsoMainCode = nhso.hospmain_code ? String(nhso.hospmain_code).trim() : '';
                const nhsoSubCode = nhso.hospsub_code ? String(nhso.hospsub_code).trim() : '';

                if (nhsoMainCode) {
                    isHospmainMatch = iptList.some(ip => String(ip.hospmain || '').trim() === nhsoMainCode);
                }
                if (nhsoSubCode) {
                    isHospsubMatch = iptList.some(ip => String(ip.hospsub || '').trim() === nhsoSubCode);
                }

                isHospMatch = isHospmainMatch && isHospsubMatch;
                isMismatch = !isRightsMatch || !isHospMatch;
            }

            return {
                an: p.an,
                vn: p.vn,
                hn: p.hn,
                cid: p.cid,
                ptname: `${p.pname || ''}${p.fname || ''} ${p.lname || ''}`.trim(),
                age_y: p.age_y,
                admit_date: p.admit_date,
                admit_time: p.admit_time ? String(p.admit_time).slice(0, 5) : '',
                ward_code: p.ward_code,
                ward_name: p.ward_name,
                is_mismatch: isMismatch,
                comparison: {
                    has_checked: hasChecked,
                    mapped_pttype: mappedPttype,
                    is_rights_match: isRightsMatch,
                    is_hospmain_match: isHospmainMatch,
                    is_hospsub_match: isHospsubMatch,
                    is_hosp_match: isHospMatch,
                    is_mismatch: isMismatch
                },
                
                // 1. ovst
                ovst: {
                    pttype: p.ovst_pttype || '',
                    pttype_name: p.ovst_pttype_name || '-',
                    pttypeno: p.ovst_pttypeno || '',
                    hospmain: p.ovst_hospmain || '',
                    hospsub: p.ovst_hospsub || '',
                    staff: p.ovst_staff || '',
                    staff_name: p.ovst_staff ? (staffMap.get(String(p.ovst_staff).trim()) || p.ovst_staff) : ''
                },

                // 2. ipt
                ipt: {
                    pttype: p.ipt_pttype || '',
                    pttype_name: p.ipt_pttype_name || '-',
                    staff: p.ipt_staff || '',
                    staff_name: p.ipt_staff ? (staffMap.get(String(p.ipt_staff).trim()) || p.ipt_staff) : ''
                },

                // 3. visit_pttype (list of all assigned rights)
                visit_pttype_list: visitList,

                // 4. ipt_pttype (list of all assigned rights)
                ipt_pttype_list: iptList,

                // NHSO API result
                nhso: nhso ? {
                    has_checked: true,
                    right_check_date: nhso.right_check_date,
                    maininscl_id: nhso.maininscl_id || '',
                    maininscl_name: nhso.maininscl_name || '',
                    subinscl_id: nhso.subinscl_id || '',
                    subinscl_name: nhso.subinscl_name || '',
                    hospmain_code: nhso.hospmain_code || '',
                    hospmain_name: nhso.hospmain_name || '',
                    hospsub_code: nhso.hospsub_code || '',
                    hospsub_name: nhso.hospsub_name || '',
                    card_id: (nhso.card_id && String(nhso.card_id).trim()) || (p.cid ? formatCid(p.cid) : ''),
                    right_start_date: formatDateOnly(nhso.right_start_date),
                    claim_code: nhso.claim_code || '',
                    claim_type_name: nhso.claim_type_name || '',
                    create_date: nhso.create_date,
                    received_datetime: nhso.received_datetime,
                    source_channel: nhso.source_channel || '',
                    updated_at: nhso.updated_at
                } : {
                    has_checked: false
                },

                // Primary Staff
                primary_staff: {
                    code: primaryStaffCode,
                    name: primaryStaffName
                }
            };
        });

        const stats = {
            total: resultPatients.length,
            checked: checkedCount,
            unchecked: resultPatients.length - checkedCount,
            has_authen: hasAuthenCount,
            no_authen: resultPatients.length - hasAuthenCount
        };

        res.json({
            patients: resultPatients,
            wards,
            stats
        });

    } catch (error) {
        console.error('[NhsoAuthen] Get inpatients error:', error);
        res.status(500).json({ error: 'Failed to fetch admitted inpatients: ' + error.message });
    } finally {
        if (hisConn) hisConn.release();
        if (dflowConn) dflowConn.release();
    }
});

// ============================================================
// 2. POST /check: Trigger NHSO right search and authen history by admit date
// ============================================================
router.post('/check', async (req, res) => {
    let hisConn, dflowConn;
    try {
        const { vn, an, cid, vstdate, admit_date, force = true } = req.body;
        if (!vn || !cid) {
            return res.status(400).json({ error: 'VN and CID are required' });
        }

        hisConn = await hisPool.getConnection();

        // 1. Determine exact admit date from ipt table in HOSxP (วันที่ admit)
        let targetAdmitDate = admit_date || vstdate;
        if (!targetAdmitDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetAdmitDate)) {
            try {
                const iptRows = await hisConn.query(
                    "SELECT DATE_FORMAT(regdate, '%Y-%m-%d') as admit_date FROM ipt WHERE vn = ? OR an = ? LIMIT 1",
                    [vn, an || '']
                );
                if (iptRows.length > 0 && iptRows[0].admit_date) {
                    targetAdmitDate = iptRows[0].admit_date;
                }
            } catch (err) {
                console.warn('[NhsoAuthen] Failed to resolve admit date from ipt:', err.message);
            }
        }

        if (!targetAdmitDate) {
            targetAdmitDate = new Date().toISOString().slice(0, 10);
        }

        const nhsoUrl = getNhsoBaseUrl();

        // 2. Call check-and-save on nhso-authen microservice with admit date
        const response = await fetch(`${nhsoUrl}/api/vn-authen/check-and-save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vn,
                cid,
                vstdate: targetAdmitDate, // ส่งวันที่ admit ไปตรวจสอบ Authen Code
                force: Boolean(force)
            })
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            return res.status(response.status || 500).json({
                error: result.message || 'NHSO service returned an error',
                details: result
            });
        }

        let savedData = result.data;

        // 3. Fallback: If claim_code is still missing, search authen-history API for the admit date
        if (!savedData?.claim_code) {
            try {
                const todayStr = new Date().toISOString().slice(0, 10);
                const authRes = await fetch(`${nhsoUrl}/api/authen-history/${cid}?claimDateFrom=${targetAdmitDate}&claimDateTo=${todayStr}`);
                if (authRes.ok) {
                    const authJson = await authRes.json();
                    if (authJson.success && Array.isArray(authJson.data) && authJson.data.length > 0) {
                        // Pick latest matching authen code
                        const latestAuth = authJson.data[0];
                        if (latestAuth.claimCode) {
                            dflowConn = await dflowPool.getConnection();
                            await dflowConn.query(`
                                UPDATE vn_nhso_authen
                                SET 
                                    claim_code = ?,
                                    claim_type = COALESCE(?, claim_type),
                                    claim_type_name = COALESCE(?, claim_type_name),
                                    source_channel = COALESCE(?, source_channel),
                                    create_date = COALESCE(?, create_date),
                                    authen_json = ?
                                WHERE vn = ?
                            `, [
                                latestAuth.claimCode,
                                latestAuth.claimType || null,
                                latestAuth.claimTypeName || null,
                                latestAuth.sourceChannel || null,
                                latestAuth.createDate || null,
                                JSON.stringify(latestAuth),
                                vn
                            ]);
                            savedData.claim_code = latestAuth.claimCode;
                            savedData.claim_type_name = latestAuth.claimTypeName;
                            savedData.source_channel = latestAuth.sourceChannel;
                        }
                    }
                }
            } catch (authErr) {
                console.warn('[NhsoAuthen] Fallback authen query error:', authErr.message);
            }
        }

        res.json({
            success: true,
            message: `ตรวจสอบสิทธิ์และ Authen Code สปสช. สำเร็จ (วันที่ admit: ${targetAdmitDate})`,
            admit_date: targetAdmitDate,
            data: savedData
        });

    } catch (error) {
        console.error('[NhsoAuthen] Check right error:', error);
        res.status(500).json({
            error: `ไม่สามารถเชื่อมต่อระบบ สปสช. (${getNhsoBaseUrl()}): ${error.message}`
        });
    } finally {
        if (hisConn) hisConn.release();
        if (dflowConn) dflowConn.release();
    }
});

// ============================================================
// 3. GET /preview-sync/:an: Preview target data before writing to HOSxP
// ============================================================
router.get('/preview-sync/:an', async (req, res) => {
    let hisConn, dflowConn;
    try {
        const { an } = req.params;
        if (!an) return res.status(400).json({ error: 'AN is required' });

        hisConn = await hisPool.getConnection();
        dflowConn = await dflowPool.getConnection();

        // 1. Get visit in HOSxP
        const iptRows = await hisConn.query(`
            SELECT i.an, i.vn, i.hn, i.regdate, i.regtime, i.pttype as ipt_pttype,
                   pt_i.name as ipt_pttype_name, i.staff as ipt_staff,
                   p.cid, CONCAT(p.pname, p.fname, ' ', p.lname) as ptname,
                   o.pttype as ovst_pttype, pt_o.name as ovst_pttype_name,
                   o.pttypeno as ovst_pttypeno, o.hospmain as ovst_hospmain, o.hospsub as ovst_hospsub, o.staff as ovst_staff
            FROM ipt i
            INNER JOIN patient p ON i.hn = p.hn
            LEFT JOIN ovst o ON i.vn = o.vn
            LEFT JOIN pttype pt_i ON i.pttype = pt_i.pttype
            LEFT JOIN pttype pt_o ON o.pttype = pt_o.pttype
            WHERE i.an = ?
        `, [an]);

        if (!iptRows || iptRows.length === 0) {
            return res.status(404).json({ error: `ไม่พบข้อมูล AN ${an} ใน HOSxP` });
        }

        const patient = iptRows[0];
        const vn = patient.vn;

        // 2. Get visit_pttype and ipt_pttype
        const [vpRows, ipRows, dflowRows] = await Promise.all([
            hisConn.query(`
                SELECT vp.*, p.name as pttype_name 
                FROM visit_pttype vp
                LEFT JOIN pttype p ON vp.pttype = p.pttype
                WHERE vp.vn = ?
                ORDER BY vp.pttype_number ASC
            `, [vn]),
            hisConn.query(`
                SELECT ip.*, p.name as pttype_name 
                FROM ipt_pttype ip
                LEFT JOIN pttype p ON ip.pttype = p.pttype
                WHERE ip.an = ?
                ORDER BY ip.pttype_number ASC
            `, [an]),
            dflowConn.query(`SELECT * FROM vn_nhso_authen WHERE vn = ?`, [vn])
        ]);

        const dflowData = dflowRows.length > 0 ? dflowRows[0] : null;

        let rightJson = null;
        let authenJson = null;
        if (dflowData?.right_json) {
            try {
                rightJson = typeof dflowData.right_json === 'string' ? JSON.parse(dflowData.right_json) : dflowData.right_json;
            } catch (e) { }
        }
        if (dflowData?.authen_json) {
            try {
                authenJson = typeof dflowData.authen_json === 'string' ? JSON.parse(dflowData.authen_json) : dflowData.authen_json;
            } catch (e) { }
        }

        const fund = (rightJson?.funds && rightJson.funds[0]) || {};

        // Fetch active sub centers
        let dynamicSubCenters = null;
        try {
            const subRows = await dflowConn.query('SELECT UPPER(hospcode) as code FROM nhso_ucs_sub_centers WHERE is_active = 1');
            if (Array.isArray(subRows) && subRows.length > 0) {
                dynamicSubCenters = subRows.map(r => r.code);
            }
        } catch (e) { }

        // Fetch exempt pttypes
        let exemptCodes = [];
        try {
            const exRows = await dflowConn.query('SELECT UPPER(pttype) as code FROM nhso_exempt_pttypes WHERE is_active = 1');
            if (Array.isArray(exRows) && exRows.length > 0) {
                exemptCodes = exRows.map(r => r.code);
            }
        } catch (e) { }

        const mainInsclId = fund?.mainInscl?.id || dflowData?.maininscl_id || authenJson?.mainInscl || null;
        const subInsclId = fund?.subInscl?.id || dflowData?.subinscl_id || authenJson?.subInscl || null;
        const hospmainTarget = fund?.hospMainOp?.hcode || dflowData?.hospmain_op_code || fund?.hospMain?.hcode || dflowData?.hospmain_code || authenJson?.hmain || patient.ovst_hospmain || null;
        const hospsubTarget = fund?.hospSub?.hcode || dflowData?.hospsub_code || patient.ovst_hospsub || null;

        const currentPttype = patient.ipt_pttype || patient.ovst_pttype || '';
        const isExempt = currentPttype && exemptCodes.includes(String(currentPttype).trim().toUpperCase());

        let mappedPttype = currentPttype;
        if (!isExempt) {
            mappedPttype = mapNhsoToHosPttype(mainInsclId, subInsclId, hospmainTarget, hospsubTarget, currentPttype, dynamicSubCenters);
        }

        let targetPttypeName = '-';
        if (mappedPttype) {
            const ptRows = await hisConn.query(`SELECT name FROM pttype WHERE pttype = ?`, [mappedPttype]);
            if (ptRows.length > 0) targetPttypeName = ptRows[0].name;
        }

        // Card ID / pttypeno
        let pttypenoTarget = null;
        if (fund?.cardId && String(fund.cardId).trim()) {
            pttypenoTarget = String(fund.cardId).trim();
        } else if (dflowData?.card_id && String(dflowData.card_id).trim()) {
            pttypenoTarget = String(dflowData.card_id).trim();
        } else {
            pttypenoTarget = formatCid(patient.cid) || patient.ovst_pttypeno;
        }

        const beginDateTarget = formatDateOnly(fund?.startDateTime || dflowData?.right_start_date) || null;
        const expireDateTarget = formatDateOnly(fund?.expireDateTime) || null;
        const authCodeTarget = authenJson?.claimCode || dflowData?.claim_code || null;

        res.json({
            an,
            vn,
            hn: patient.hn,
            cid: patient.cid,
            ptname: patient.ptname,
            current: {
                ovst: {
                    pttype: patient.ovst_pttype,
                    pttype_name: patient.ovst_pttype_name,
                    pttypeno: patient.ovst_pttypeno,
                    hospmain: patient.ovst_hospmain,
                    hospsub: patient.ovst_hospsub
                },
                ipt: {
                    pttype: patient.ipt_pttype,
                    pttype_name: patient.ipt_pttype_name
                },
                visit_pttype_list: vpRows.map(r => ({
                    pttype_number: r.pttype_number,
                    pttype: r.pttype,
                    pttype_name: r.pttype_name,
                    pttypeno: r.pttypeno,
                    hospmain: r.hospmain,
                    hospsub: r.hospsub,
                    begin_date: formatDateOnly(r.begin_date),
                    expire_date: formatDateOnly(r.expire_date),
                    auth_code: r.auth_code,
                    staff: r.staff
                })),
                ipt_pttype_list: ipRows.map(r => ({
                    pttype_number: r.pttype_number,
                    pttype: r.pttype,
                    pttype_name: r.pttype_name,
                    pttypeno: r.pttypeno,
                    hospmain: r.hospmain,
                    hospsub: r.hospsub,
                    begin_date: formatDateOnly(r.begin_date),
                    expire_date: formatDateOnly(r.expire_date),
                    auth_code: r.auth_code,
                    staff: r.staff
                }))
            },
            target: {
                pttype: mappedPttype,
                pttype_name: targetPttypeName,
                pttypeno: pttypenoTarget,
                hospmain: hospmainTarget,
                hospsub: hospsubTarget,
                begin_date: beginDateTarget,
                expire_date: expireDateTarget,
                auth_code: authCodeTarget,
                is_exempt: isExempt
            }
        });

    } catch (error) {
        console.error('[NhsoAuthen] Preview sync error:', error);
        res.status(500).json({ error: 'Failed to preview sync: ' + error.message });
    } finally {
        if (hisConn) hisConn.release();
        if (dflowConn) dflowConn.release();
    }
});

// ============================================================
// 4. POST /sync-hos: Write/Sync to all 4 tables in HOSxP
// ============================================================
router.post('/sync-hos', async (req, res) => {
    let hisWriteConn, dflowConn;
    try {
        const { an, vn, target, options = {} } = req.body;
        if (!an || !vn) {
            return res.status(400).json({ error: 'AN and VN are required' });
        }
        if (!target || !target.pttype) {
            return res.status(400).json({ error: 'ข้อมูลสิทธิปลายทาง (pttype) ไม่ครบถ้วน' });
        }

        // Check if write DB credentials exist
        if (!process.env.HIS_WRITE_DB_USER) {
            return res.status(400).json({
                error: 'ยังไม่ได้กำหนด HIS_WRITE_DB_USER ใน .env (กรุณาระบุ Username และ Password สำหรับเขียนลงฐานข้อมูล HOSxP ในไฟล์ .env)'
            });
        }

        hisWriteConn = await getHisWriteConnection();
        dflowConn = await getDflowConnection();

        await hisWriteConn.beginTransaction();

        // ----------------------------------------------------
        // 1. Update ovst (เฉพาะ pttype, pttypeno, hospmain, hospsub — คง staff เดิม)
        // ----------------------------------------------------
        await hisWriteConn.query(`
            UPDATE ovst 
            SET 
                pttype = ?,
                pttypeno = ?,
                hospmain = ?,
                hospsub = ?
            WHERE vn = ?
        `, [
            target.pttype,
            target.pttypeno || null,
            target.hospmain || null,
            target.hospsub || null,
            vn
        ]);

        // ----------------------------------------------------
        // 2. Update ipt (เฉพาะ pttype — คง staff เดิม)
        // ----------------------------------------------------
        await hisWriteConn.query(`
            UPDATE ipt 
            SET pttype = ?
            WHERE an = ?
        `, [target.pttype, an]);

        // ----------------------------------------------------
        // 3. Update visit_pttype (คง staff เดิม!)
        // ----------------------------------------------------
        const vpRows = await hisWriteConn.query(`
            SELECT vn, pttype, pttype_number, staff 
            FROM visit_pttype 
            WHERE vn = ? 
            ORDER BY pttype_number ASC
        `, [vn]);

        if (!vpRows || vpRows.length === 0) {
            // INSERT แถวใหม่ ลำดับ 1
            await hisWriteConn.query(`
                INSERT INTO visit_pttype (
                    vn, pttype, pttypeno, hospmain, hospsub,
                    begin_date, expire_date, pttype_number, contract_id,
                    auth_code, claim_code, staff
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, NULL, NULL)
            `, [
                vn,
                target.pttype,
                target.pttypeno || null,
                target.hospmain || null,
                target.hospsub || null,
                target.begin_date || null,
                target.expire_date || null,
                target.auth_code || null
            ]);
        } else {
            // หาว่ามีแถวที่ pttype ตรงกันอยู่แล้วหรือไม่
            const exactMatch = vpRows.find(r => r.pttype === target.pttype);
            const targetRow = exactMatch || vpRows[0]; // ตรงกัน หรือแถวแรก

            await hisWriteConn.query(`
                UPDATE visit_pttype 
                SET 
                    pttype = ?,
                    pttypeno = ?,
                    hospmain = ?,
                    hospsub = ?,
                    begin_date = COALESCE(?, begin_date),
                    expire_date = COALESCE(?, expire_date),
                    auth_code = COALESCE(?, auth_code),
                    claim_code = NULL
                WHERE vn = ? AND pttype = ?
            `, [
                target.pttype,
                target.pttypeno || null,
                target.hospmain || null,
                target.hospsub || null,
                target.begin_date || null,
                target.expire_date || null,
                target.auth_code || null,
                vn,
                targetRow.pttype
            ]);
        }

        // ----------------------------------------------------
        // 4. Update ipt_pttype (คง staff เดิม!)
        // ----------------------------------------------------
        const ipRows = await hisWriteConn.query(`
            SELECT an, pttype, pttype_number, staff 
            FROM ipt_pttype 
            WHERE an = ? 
            ORDER BY pttype_number ASC
        `, [an]);

        if (!ipRows || ipRows.length === 0) {
            // INSERT แถวใหม่ ลำดับ 1
            await hisWriteConn.query(`
                INSERT INTO ipt_pttype (
                    an, pttype, pttypeno, hospmain, hospsub,
                    begin_date, expire_date, pttype_number, contract_id,
                    auth_code, claim_code, staff
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, NULL, NULL)
            `, [
                an,
                target.pttype,
                target.pttypeno || null,
                target.hospmain || null,
                target.hospsub || null,
                target.begin_date || null,
                target.expire_date || null,
                target.auth_code || null
            ]);
        } else {
            // หาว่ามีแถวที่ pttype ตรงกันอยู่แล้วหรือไม่
            const exactMatch = ipRows.find(r => r.pttype === target.pttype);
            const targetRow = exactMatch || ipRows[0]; // ตรงกัน หรือแถวแรก

            await hisWriteConn.query(`
                UPDATE ipt_pttype 
                SET 
                    pttype = ?,
                    pttypeno = ?,
                    hospmain = ?,
                    hospsub = ?,
                    begin_date = COALESCE(?, begin_date),
                    expire_date = COALESCE(?, expire_date),
                    auth_code = COALESCE(?, auth_code),
                    claim_code = NULL
                WHERE an = ? AND pttype = ?
            `, [
                target.pttype,
                target.pttypeno || null,
                target.hospmain || null,
                target.hospsub || null,
                target.begin_date || null,
                target.expire_date || null,
                target.auth_code || null,
                an,
                targetRow.pttype
            ]);
        }

        // Commit transaction
        await hisWriteConn.commit();

        // Update vn_nhso_authen timestamp in d-flow
        try {
            await dflowConn.query(`
                UPDATE vn_nhso_authen 
                SET updated_at = NOW() 
                WHERE vn = ?
            `, [vn]);
        } catch (e) { }

        // Log activity
        try {
            await dflowConn.query(`
                INSERT INTO activity_logs (an, action, details, user_id, created_at)
                VALUES (?, 'nhso_sync', ?, ?, NOW())
            `, [
                an,
                JSON.stringify({ vn, target, updated_by: req.user?.username || 'system' }),
                req.user?.id || null
            ]);
        } catch (e) { }

        res.json({
            success: true,
            message: 'บันทึกข้อมูลสิทธิและ Authen Code ลงฐานข้อมูล HOSxP ทั้ง 4 ตารางเรียบร้อยแล้ว',
            an,
            vn,
            savedData: target
        });

    } catch (error) {
        if (hisWriteConn) {
            try { await hisWriteConn.rollback(); } catch (e) { }
        }
        console.error('[NhsoAuthen] Sync to HOS error:', error);
        res.status(500).json({ error: 'บันทึกข้อมูลลง HOSxP ล้มเหลว: ' + error.message });
    } finally {
        if (hisWriteConn) hisWriteConn.release();
        if (dflowConn) dflowConn.release();
    }
});

// ============================================================
// 4.1 POST /sync-ipt-pttype: บันทึกเข้าแค่ตาราง ipt_pttype เฉพาะ row ที่สิทธิ์ตรงกัน
// ============================================================
router.post('/sync-ipt-pttype', async (req, res) => {
    let hisWriteConn, dflowConn;
    try {
        const { an, target } = req.body;
        if (!an) {
            return res.status(400).json({ error: 'AN is required' });
        }
        if (!target || !target.pttype) {
            return res.status(400).json({ error: 'ข้อมูลสิทธิปลายทาง (pttype) ไม่ครบถ้วน' });
        }

        if (!process.env.HIS_WRITE_DB_USER) {
            return res.status(400).json({
                error: 'ยังไม่ได้กำหนด HIS_WRITE_DB_USER ใน .env (กรุณาระบุ Username และ Password สำหรับเขียนลงฐานข้อมูล HOSxP ในไฟล์ .env)'
            });
        }

        hisWriteConn = await getHisWriteConnection();
        dflowConn = await getDflowConnection();

        await hisWriteConn.beginTransaction();

        // 1. ค้นหาแถวใน ipt_pttype ที่ตรงกับ pttype ของ target
        const ipRows = await hisWriteConn.query(`
            SELECT an, pttype, pttype_number, staff, auth_code, claim_code
            FROM ipt_pttype 
            WHERE an = ? AND pttype = ?
            ORDER BY pttype_number ASC
        `, [an, target.pttype]);

        if (!ipRows || ipRows.length === 0) {
            await hisWriteConn.rollback();
            return res.status(400).json({
                error: `ไม่พบแถวในตาราง ipt_pttype ที่มีรหัสสิทธิ [${target.pttype}] ตรงกัน ไม่สามารถบันทึกได้`
            });
        }

        const targetRow = (target.pttype_number
            ? ipRows.find(r => Number(r.pttype_number) === Number(target.pttype_number))
            : null) || ipRows[0];

        // 2. อัปเดตเฉพาะ ipt_pttype แถวที่ตรงกัน (คง staff เดิม และไม่ update claim_code!)
        const authCodeVal = (target.auth_code && target.auth_code !== '-' ? target.auth_code : null) || 
                            (target.claim_code && target.claim_code !== '-' ? target.claim_code : null);
        let pttypenoVal = (target.pttypeno && target.pttypeno !== '-') ? target.pttypeno : null;
        if (!pttypenoVal) {
            const pRows = await hisWriteConn.query('SELECT p.cid FROM ipt i JOIN patient p ON i.hn=p.hn WHERE i.an = ?', [an]);
            if (pRows && pRows.length > 0 && pRows[0].cid) {
                pttypenoVal = formatCid(pRows[0].cid);
            }
        }

        const hospmainVal = (target.hospmain && target.hospmain !== '-' && String(target.hospmain).trim() !== '') ? target.hospmain : null;
        const hospsubVal = (target.hospsub && target.hospsub !== '-' && String(target.hospsub).trim() !== '') ? target.hospsub : null;
        const beginDateVal = (target.begin_date && target.begin_date !== '-' && String(target.begin_date).trim() !== '') ? target.begin_date : null;
        // expire_date: ถ้าไม่มีค่า return จาก API หรือเป็นค่าว่าง ให้ใช้ค่าเดิมจาก HOS (COALESCE เก็บค่าเดิม)
        const expireDateVal = (target.expire_date && target.expire_date !== '-' && String(target.expire_date).trim() !== '') ? target.expire_date : null;

        await hisWriteConn.query(`
            UPDATE ipt_pttype 
            SET 
                pttypeno = COALESCE(?, pttypeno),
                hospmain = COALESCE(?, hospmain),
                hospsub = COALESCE(?, hospsub),
                begin_date = COALESCE(?, begin_date),
                expire_date = COALESCE(?, expire_date),
                auth_code = COALESCE(?, auth_code)
            WHERE an = ? AND pttype = ? AND pttype_number = ?
        `, [
            pttypenoVal || null,
            hospmainVal,
            hospsubVal,
            beginDateVal,
            expireDateVal,
            authCodeVal,
            an,
            target.pttype,
            targetRow.pttype_number
        ]);

        await hisWriteConn.commit();

        // Update vn_nhso_authen timestamp if vn provided
        if (req.body.vn) {
            try {
                await dflowConn.query(`UPDATE vn_nhso_authen SET updated_at = NOW() WHERE vn = ?`, [req.body.vn]);
            } catch (e) { }
        }

        // Log activity
        try {
            await dflowConn.query(`
                INSERT INTO activity_logs (an, action, details, user_id, created_at)
                VALUES (?, 'nhso_sync_ipt_pttype', ?, ?, NOW())
            `, [
                an,
                JSON.stringify({ target, pttype_number: targetRow.pttype_number, updated_by: req.user?.username || 'system' }),
                req.user?.id || null
            ]);
        } catch (e) { }

        res.json({
            success: true,
            message: `บันทึกข้อมูลสิทธิและ Authen Code เข้าตาราง ipt_pttype (ลำดับที่ ${targetRow.pttype_number}) เรียบร้อยแล้ว`,
            an,
            pttype: target.pttype,
            pttype_number: targetRow.pttype_number
        });

    } catch (error) {
        if (hisWriteConn) {
            try { await hisWriteConn.rollback(); } catch (e) { }
        }
        console.error('[NhsoAuthen] Sync ipt_pttype error:', error);
        res.status(500).json({ error: 'บันทึกข้อมูลลง ipt_pttype ล้มเหลว: ' + error.message });
    } finally {
        if (hisWriteConn) hisWriteConn.release();
        if (dflowConn) dflowConn.release();
    }
});

// ============================================================
// 5. GET /rights-summary/:an & /details/:an: Rights comparison table (5 sources) & Authen code details
// ============================================================
router.get(['/rights-summary/:an', '/details/:an'], async (req, res) => {
    let hisConn, dflowConn;
    try {
        const { an } = req.params;
        hisConn = await hisPool.getConnection();
        dflowConn = await dflowPool.getConnection();

        // 1. Get patient and admission info
        const iptRows = await hisConn.query(`
            SELECT 
                i.an, i.vn, i.hn, DATE_FORMAT(i.regdate, '%Y-%m-%d') as admit_date, i.regtime as admit_time,
                i.pttype as ipt_pttype, pt_i.name as ipt_pttype_name,
                i.staff as ipt_staff, i.rfrilct,
                p.pname, p.fname, p.lname, p.cid,
                TIMESTAMPDIFF(YEAR, p.birthday, CURDATE()) as age_y,
                w.ward as ward_code, w.name as ward_name,
                o.pttype as ovst_pttype, pt_o.name as ovst_pttype_name,
                o.pttypeno as ovst_pttypeno, o.hospmain as ovst_hospmain, o.hospsub as ovst_hospsub, o.staff as ovst_staff
            FROM ipt i
            INNER JOIN patient p ON i.hn = p.hn
            LEFT JOIN ward w ON i.ward = w.ward
            LEFT JOIN ovst o ON i.vn = o.vn
            LEFT JOIN pttype pt_i ON i.pttype = pt_i.pttype
            LEFT JOIN pttype pt_o ON o.pttype = pt_o.pttype
            WHERE i.an = ?
        `, [an]);

        if (!iptRows || iptRows.length === 0) {
            return res.status(404).json({ error: `ไม่พบข้อมูล AN ${an} ใน HOSxP` });
        }

        const patient = iptRows[0];
        const vn = patient.vn;

        // 2. Query visit_pttype, ipt_pttype, and vn_nhso_authen concurrently
        const [vpRows, ipRows, dflowRows] = await Promise.all([
            hisConn.query(`
                SELECT vp.*, p.name as pttype_name 
                FROM visit_pttype vp
                LEFT JOIN pttype p ON vp.pttype = p.pttype
                WHERE vp.vn = ?
                ORDER BY vp.pttype_number ASC
            `, [vn]),
            hisConn.query(`
                SELECT ip.*, p.name as pttype_name 
                FROM ipt_pttype ip
                LEFT JOIN pttype p ON ip.pttype = p.pttype
                WHERE ip.an = ?
                ORDER BY ip.pttype_number ASC
            `, [an]),
            dflowConn.query(`SELECT * FROM vn_nhso_authen WHERE vn = ?`, [vn])
        ]);

        const dflowData = dflowRows.length > 0 ? dflowRows[0] : null;

        // Collect hospital codes and staff logins for batch lookup
        const hospCodes = new Set();
        const staffLogins = new Set();

        if (patient.ovst_hospmain) hospCodes.add(String(patient.ovst_hospmain).trim());
        if (patient.ovst_hospsub) hospCodes.add(String(patient.ovst_hospsub).trim());
        if (patient.rfrilct) hospCodes.add(String(patient.rfrilct).trim());
        if (patient.ovst_staff) staffLogins.add(String(patient.ovst_staff).trim());
        if (patient.ipt_staff) staffLogins.add(String(patient.ipt_staff).trim());

        for (const r of vpRows) {
            if (r.hospmain) hospCodes.add(String(r.hospmain).trim());
            if (r.hospsub) hospCodes.add(String(r.hospsub).trim());
            if (r.staff) staffLogins.add(String(r.staff).trim());
        }
        for (const r of ipRows) {
            if (r.hospmain) hospCodes.add(String(r.hospmain).trim());
            if (r.hospsub) hospCodes.add(String(r.hospsub).trim());
            if (r.staff) staffLogins.add(String(r.staff).trim());
        }

        if (dflowData?.hospmain_code) hospCodes.add(String(dflowData.hospmain_code).trim());
        if (dflowData?.hospsub_code) hospCodes.add(String(dflowData.hospsub_code).trim());
        if (dflowData?.hospmain_op_code) hospCodes.add(String(dflowData.hospmain_op_code).trim());

        const hospArr = Array.from(hospCodes).filter(Boolean);
        const staffArr = Array.from(staffLogins).filter(Boolean);

        const [hospRows, staffRows] = await Promise.all([
            hospArr.length > 0 ? hisConn.query(`SELECT hospcode, name FROM hospcode WHERE hospcode IN (?)`, [hospArr]) : [],
            staffArr.length > 0 ? hisConn.query(`SELECT loginname, name FROM opduser WHERE loginname IN (?)`, [staffArr]) : []
        ]);

        const hospMap = new Map();
        for (const h of hospRows) hospMap.set(String(h.hospcode).trim(), h.name);

        const staffMap = new Map();
        for (const s of staffRows) staffMap.set(String(s.loginname).trim(), s.name);

        // 3. Parse NHSO JSONs & map NHSO Right
        let rightJson = null;
        let authenJson = null;
        if (dflowData?.right_json) {
            try {
                rightJson = typeof dflowData.right_json === 'string' ? JSON.parse(dflowData.right_json) : dflowData.right_json;
            } catch (e) { }
        }
        if (dflowData?.authen_json) {
            try {
                authenJson = typeof dflowData.authen_json === 'string' ? JSON.parse(dflowData.authen_json) : dflowData.authen_json;
            } catch (e) { }
        }

        const fund = (rightJson?.funds && rightJson.funds[0]) || {};

        let dynamicSubCenters = null;
        try {
            const subRows = await dflowConn.query('SELECT UPPER(hospcode) as code FROM nhso_ucs_sub_centers WHERE is_active = 1');
            if (Array.isArray(subRows) && subRows.length > 0) dynamicSubCenters = subRows.map(r => r.code);
        } catch (e) { }

        let exemptCodes = [];
        try {
            const exRows = await dflowConn.query('SELECT UPPER(pttype) as code FROM nhso_exempt_pttypes WHERE is_active = 1');
            if (Array.isArray(exRows) && exRows.length > 0) exemptCodes = exRows.map(r => r.code);
        } catch (e) { }

        const mainInsclId = fund?.mainInscl?.id || dflowData?.maininscl_id || authenJson?.mainInscl || null;
        const subInsclId = fund?.subInscl?.id || dflowData?.subinscl_id || authenJson?.subInscl || null;
        const hospmainTarget = fund?.hospMainOp?.hcode || dflowData?.hospmain_op_code || fund?.hospMain?.hcode || dflowData?.hospmain_code || authenJson?.hmain || patient.ovst_hospmain || null;
        const hospsubTarget = fund?.hospSub?.hcode || dflowData?.hospsub_code || patient.ovst_hospsub || null;

        const currentPttype = patient.ipt_pttype || patient.ovst_pttype || '';
        const isExempt = currentPttype && exemptCodes.includes(String(currentPttype).trim().toUpperCase());

        let mappedPttype = currentPttype;
        if (!isExempt) {
            mappedPttype = mapNhsoToHosPttype(mainInsclId, subInsclId, hospmainTarget, hospsubTarget, currentPttype, dynamicSubCenters);
        }

        let targetPttypeName = '-';
        if (mappedPttype) {
            const ptRows = await hisConn.query(`SELECT name FROM pttype WHERE pttype = ?`, [mappedPttype]);
            if (ptRows.length > 0) targetPttypeName = ptRows[0].name;
        }

        // 4. Build Table Rows for 5 Sources
        const rows = [];

        // 4.1 ovst
        rows.push({
            source_key: 'ovst',
            source_name: 'ovst',
            source_label: 'ovst (ข้อมูลส่งตรวจ)',
            pttype: patient.ovst_pttype || '-',
            pttype_name: patient.ovst_pttype_name || '-',
            pttypeno: patient.ovst_pttypeno || '-',
            hospmain: patient.ovst_hospmain || '-',
            hospmain_name: hospMap.get(String(patient.ovst_hospmain).trim()) || '-',
            hospsub: patient.ovst_hospsub || '-',
            hospsub_name: hospMap.get(String(patient.ovst_hospsub).trim()) || '-',
            begin_date: '-',
            expire_date: '-',
            auth_code: '-',
            claim_code: '-',
            staff: patient.ovst_staff || '-',
            staff_name: staffMap.get(String(patient.ovst_staff).trim()) || '-'
        });

        // 4.2 visit_pttype (all rows)
        if (vpRows.length === 0) {
            rows.push({
                source_key: 'visit_pttype',
                source_name: 'visit_pttype',
                source_label: 'visit_pttype',
                pttype: '-',
                pttype_name: '-',
                pttypeno: '-',
                hospmain: '-',
                hospmain_name: '-',
                hospsub: '-',
                hospsub_name: '-',
                begin_date: '-',
                expire_date: '-',
                auth_code: '-',
                claim_code: '-',
                staff: '-',
                staff_name: '-'
            });
        } else {
            vpRows.forEach((r, idx) => {
                const code = r.auth_code || r.claim_code || '-';
                rows.push({
                    source_key: `visit_pttype_${r.pttype_number || idx + 1}`,
                    source_name: 'visit_pttype',
                    source_label: vpRows.length > 1 ? `visit_pttype (#${r.pttype_number || idx + 1})` : 'visit_pttype',
                    pttype: r.pttype || '-',
                    pttype_name: r.pttype_name || '-',
                    pttypeno: r.pttypeno || '-',
                    hospmain: r.hospmain || '-',
                    hospmain_name: hospMap.get(String(r.hospmain).trim()) || '-',
                    hospsub: r.hospsub || '-',
                    hospsub_name: hospMap.get(String(r.hospsub).trim()) || '-',
                    begin_date: formatDateOnly(r.begin_date) || '-',
                    expire_date: formatDateOnly(r.expire_date) || '-',
                    auth_code: code,
                    claim_code: code,
                    staff: r.staff || '-',
                    staff_name: staffMap.get(String(r.staff).trim()) || '-'
                });
            });
        }

        // 4.3 ipt
        rows.push({
            source_key: 'ipt',
            source_name: 'ipt',
            source_label: 'ipt (ข้อมูล Admit)',
            pttype: patient.ipt_pttype || '-',
            pttype_name: patient.ipt_pttype_name || '-',
            pttypeno: '-',
            hospmain: patient.rfrilct || '-',
            hospmain_name: hospMap.get(String(patient.rfrilct).trim()) || '-',
            hospsub: '-',
            hospsub_name: '-',
            begin_date: '-',
            expire_date: '-',
            auth_code: '-',
            claim_code: '-',
            staff: patient.ipt_staff || '-',
            staff_name: staffMap.get(String(patient.ipt_staff).trim()) || '-'
        });

        // 4.4 ipt_pttype (all rows)
        if (ipRows.length === 0) {
            rows.push({
                source_key: 'ipt_pttype',
                source_name: 'ipt_pttype',
                source_label: 'ipt_pttype',
                pttype: '-',
                pttype_name: '-',
                pttypeno: '-',
                hospmain: '-',
                hospmain_name: '-',
                hospsub: '-',
                hospsub_name: '-',
                begin_date: '-',
                expire_date: '-',
                auth_code: '-',
                claim_code: '-',
                staff: '-',
                staff_name: '-'
            });
        } else {
            ipRows.forEach((r, idx) => {
                const code = r.auth_code || r.claim_code || '-';
                rows.push({
                    source_key: `ipt_pttype_${r.pttype_number || idx + 1}`,
                    source_name: 'ipt_pttype',
                    source_label: ipRows.length > 1 ? `ipt_pttype (#${r.pttype_number || idx + 1})` : 'ipt_pttype',
                    pttype: r.pttype || '-',
                    pttype_name: r.pttype_name || '-',
                    pttypeno: r.pttypeno || '-',
                    hospmain: r.hospmain || '-',
                    hospmain_name: hospMap.get(String(r.hospmain).trim()) || '-',
                    hospsub: r.hospsub || '-',
                    hospsub_name: hospMap.get(String(r.hospsub).trim()) || '-',
                    begin_date: formatDateOnly(r.begin_date) || '-',
                    expire_date: formatDateOnly(r.expire_date) || '-',
                    auth_code: code,
                    claim_code: code,
                    staff: r.staff || '-',
                    staff_name: staffMap.get(String(r.staff).trim()) || '-'
                });
            });
        }

        // 4.5 api (from vn_nhso_authen)
        const hasApiData = Boolean(dflowData);
        const rawCardId = (fund?.cardId && String(fund.cardId).trim()) || (dflowData?.card_id && String(dflowData.card_id).trim()) || null;
        const apiPttypeno = (rawCardId && rawCardId !== '-') ? rawCardId : (patient.cid ? formatCid(patient.cid) : '-');
        const apiHospmain = hospmainTarget || '-';
        const apiHospmainName = fund?.hospMainOp?.hname || fund?.hospMain?.hname || dflowData?.hospmain_op_name || dflowData?.hospmain_name || hospMap.get(String(hospmainTarget).trim()) || '-';
        const apiHospsub = hospsubTarget || '-';
        const apiHospsubName = fund?.hospSub?.hname || dflowData?.hospsub_name || hospMap.get(String(hospsubTarget).trim()) || '-';
        const apiBeginDate = formatDateOnly(fund?.startDateTime || dflowData?.right_start_date) || '-';
        const apiExpireDate = formatDateOnly(fund?.expireDateTime) || '-';
        const apiClaimCode = dflowData?.claim_code || authenJson?.claimCode || '-';

        rows.push({
            source_key: 'api',
            source_name: 'api',
            source_label: 'สปสช. (API)',
            has_data: hasApiData,
            pttype: hasApiData ? mappedPttype : '-',
            pttype_name: hasApiData ? targetPttypeName : '(ยังไม่มีข้อมูล API)',
            pttypeno: apiPttypeno,
            hospmain: apiHospmain,
            hospmain_name: apiHospmainName,
            hospsub: apiHospsub,
            hospsub_name: apiHospsubName,
            begin_date: apiBeginDate,
            expire_date: apiExpireDate,
            auth_code: apiClaimCode,
            claim_code: apiClaimCode,
            staff: hasApiData ? 'สปสช. (API)' : '-',
            staff_name: hasApiData ? 'ระบบ สปสช.' : '-'
        });

        // 5. Comparison summary: ตรวจสอบกับ ipt_pttype ซึ่งมีหลายสิทธิ์ ถ้าตรงสักสิทธิ์ ถือว่าใช้ได้
        const iptPttypeList = (ipRows && ipRows.length > 0)
            ? ipRows.map((r, idx) => ({
                number: r.pttype_number || idx + 1,
                pttype: String(r.pttype || '').trim(),
                pttype_name: r.pttype_name || '-'
            }))
            : (patient.ipt_pttype ? [{
                number: 1,
                pttype: String(patient.ipt_pttype).trim(),
                pttype_name: patient.ipt_pttype_name || '-'
            }] : []);

        const matchedRow = (hasApiData && mappedPttype)
            ? iptPttypeList.find(r => r.pttype.toLowerCase() === String(mappedPttype).trim().toLowerCase())
            : null;

        const isMatch = hasApiData ? Boolean(matchedRow) : null;
        let matchStatus = 'unchecked';
        let matchMessage = 'ยังไม่ได้ตรวจสอบสิทธิ์ สปสช. (API)';

        if (hasApiData) {
            if (isMatch) {
                matchStatus = 'match';
                matchMessage = `สิทธิ์ใน ipt_pttype (ลำดับที่ ${matchedRow.number}: [${matchedRow.pttype}] ${matchedRow.pttype_name}) ตรงกับ สปสช. API ([${mappedPttype}] ${targetPttypeName || ''})`;
            } else {
                matchStatus = 'mismatch';
                const iptPttypeDisplay = iptPttypeList.length > 0
                    ? iptPttypeList.map(r => `[#${r.number}] ${r.pttype}`).join(', ')
                    : (patient.ipt_pttype ? `[${patient.ipt_pttype}]` : '-');
                matchMessage = `สิทธิ์ใน ipt_pttype (${iptPttypeDisplay}) ไม่ตรงกับ สปสช. API ([${mappedPttype}] ${targetPttypeName || ''})`;
            }
        }

        // 6. Authen details
        const authenDetail = {
            has_authen: Boolean(dflowData?.claim_code),
            claim_code: dflowData?.claim_code || null,
            claim_type: dflowData?.claim_type || null,
            claim_type_name: dflowData?.claim_type_name || null,
            source_channel: dflowData?.source_channel || null,
            claim_authen: dflowData?.claim_authen || null,
            claim_status: dflowData?.claim_status || null,
            authen_status: dflowData?.authen_status || (dflowData?.claim_code ? 'ยืนยันแล้ว' : 'ยังไม่มี Authen Code'),
            create_date: dflowData?.create_date || null,
            received_datetime: dflowData?.received_datetime || null,
            authen_hcode: dflowData?.authen_hcode || null,
            authen_hname: dflowData?.authen_hname || null,
            tel: dflowData?.tel || null,
            trans_id: dflowData?.trans_id ? String(dflowData.trans_id) : null,
            right_check_date: dflowData?.right_check_date || null,
            maininscl_id: dflowData?.maininscl_id || null,
            maininscl_name: dflowData?.maininscl_name || null,
            subinscl_id: dflowData?.subinscl_id || null,
            subinscl_name: dflowData?.subinscl_name || null,
            card_id: dflowData?.card_id || null,
            hospmain_code: dflowData?.hospmain_code || null,
            hospmain_name: dflowData?.hospmain_name || null,
            hospsub_code: dflowData?.hospsub_code || null,
            hospsub_name: dflowData?.hospsub_name || null,
            hospmain_op_code: dflowData?.hospmain_op_code || null,
            hospmain_op_name: dflowData?.hospmain_op_name || null
        };

        res.json({
            an,
            vn,
            hn: patient.hn,
            cid: patient.cid,
            ptname: `${patient.pname || ''}${patient.fname || ''} ${patient.lname || ''}`.trim(),
            admit_date: patient.admit_date,
            admit_time: patient.admit_time,
            ward_code: patient.ward_code,
            ward_name: patient.ward_name,
            rows,
            ipt: {
                pttype: patient.ipt_pttype,
                pttype_name: patient.ipt_pttype_name,
                staff: patient.ipt_staff,
                staff_name: staffMap.get(String(patient.ipt_staff).trim()) || patient.ipt_staff || '-'
            },
            comparison: {
                has_api: hasApiData,
                ipt_pttype: patient.ipt_pttype,
                ipt_pttype_name: patient.ipt_pttype_name,
                ipt_pttypes: iptPttypeList,
                matched_row: matchedRow || null,
                api_pttype: hasApiData ? mappedPttype : null,
                api_pttype_name: hasApiData ? targetPttypeName : null,
                is_match: isMatch,
                status: matchStatus,
                message: matchMessage
            },
            authen: authenDetail
        });

    } catch (error) {
        console.error('[NhsoAuthen] Rights summary error:', error);
        res.status(500).json({ error: 'Failed to get rights summary: ' + error.message });
    } finally {
        if (hisConn) hisConn.release();
        if (dflowConn) dflowConn.release();
    }
});

module.exports = router;
