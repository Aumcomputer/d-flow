/**
 * NHSO to HOSxP Pttype Mapping Service
 * Handles mapping of NHSO Main/Sub Inscl codes to HOSxP pttype codes,
 * respecting Ratchaburi Out-CUP hospitals, Sub-centers, and exemption lists.
 */

const RBR_OUT_CUP_MAIN_HOSPITALS = [
  '11276', // รพ.ปากท่อ
  '11458', // รพ.สมเด็จพระยุพราชจอมบึง
  '11273', // รพ.สวนผึ้ง
  '10730', // รพ.โพธาราม
  '10728', // รพ.ดำเนินสะดวก
  '28858', // รพ.บ้านคา
  '10729', // รพ.บ้านโป่ง
  '11277', // รพ.วัดเพลง
  '11274', // รพ.บางแพ
  '11275', // รพ.เจ็ดเสมียน
  '11519'  // รพ.ค่ายภาณุรังษี
];

const RBR_UCS_OUT_CUP_SUB_CENTERS = ['14317', '08003', '08004', '08005'];

function isRbrOutCup(hcode) {
  if (!hcode) return false;
  return RBR_OUT_CUP_MAIN_HOSPITALS.includes(String(hcode).trim());
}

function formatCid(cid) {
  if (!cid) return null;
  const clean = String(cid).replace(/\D/g, '');
  if (clean.length === 13) {
    return clean.replace(/^(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})$/, '$1-$2-$3-$4-$5');
  }
  return clean;
}

function formatDateOnly(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (str.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return null;
}

/**
 * Map NHSO Right to HOSxP pttype code
 */
function mapNhsoToHosPttype(mainId, subId, hospmain, hospsub = '', currentHosPttype = '', dynamicSubCenters = null) {
  const main = (mainId || '').trim().toUpperCase();
  const sub = (subId || '').trim().toUpperCase();
  const hcode = (hospmain || '').trim();
  const subcode = (hospsub || '').trim();
  const isOwnHosp = (hcode === '10677');
  const isOutCup = isRbrOutCup(hcode);

  const subCentersList = dynamicSubCenters && Array.isArray(dynamicSubCenters) && dynamicSubCenters.length > 0
    ? dynamicSubCenters
    : RBR_UCS_OUT_CUP_SUB_CENTERS;

  // 1. คนพิการ (DIS)
  if (main === 'DIS' || sub === '74') {
    if (sub === 'D1') return '64';
    if (isOwnHosp) return '74';
    if (isOutCup) return '89';
    return '90';
  }

  // 2. บัตรทอง (UCS / WEL)
  if (main === 'UCS' || main === 'WEL') {
    // ข้อยกเว้นพิเศษ: hospmain 10677 แต่ hospsub เป็น รพ.สต. ในกลุ่ม ให้เป็น 92
    if (isOwnHosp && subCentersList.includes(subcode)) {
      return '92';
    }
    if (isOwnHosp) return '91';
    if (isOutCup) return '92';
    return '93';
  }

  // 3. ข้าราชการ กรมบัญชีกลาง & กรุงเทพมหานคร (OFC)
  if (main === 'OFC') {
    const ofcMap = {
      'O1': '2A',
      'O2': '2B',
      'O3': '2C',
      'O4': '2D',
      'O5': '2E',
      'B1': '2F', // ข้าราชการ กทม.
      'B2': '2G', // ลูกจ้างประจำ กทม.
      'B3': '2H', // ผู้รับบำนาญ กทม.
      'B4': '2I', // บุคคลในครอบครัว กทม.
      'B5': '2J', // ครอบครัวผู้รับบำนาญ กทม.
      'E1': '5B',
      'E2': '5D',
      'G3': '2V',
      'G4': '2W',
      'T1': '2M',
      'T2': '2N',
      'T3': '2O',
      'T4': '2P',
      'T5': '2Q',
      'C4': '2S',
      'G1': '20'
    };
    return ofcMap[sub] || '2A';
  }

  // 4. ข้าราชการท้องถิ่น (LGO)
  if (main === 'LGO') {
    const lgoMap = {
      'L1': '6A',
      'L2': '6B',
      'L3': '6C',
      'L4': '6D'
    };
    return lgoMap[sub] || '6A';
  }

  // 5. ประกันสังคม (SSS / SSI)
  if (main === 'SSS' || main === 'SSI' || main === '34' || sub === '34') {
    if (sub === 'S6') return '33';
    if (isOwnHosp || main === '34' || sub === '34') {
      if (currentHosPttype === '35') return '35';
      return '34';
    }
    return '36';
  }

  // 6. บุคคลที่มีปัญหาสถานะและสิทธิ (ST / STP)
  if (sub === 'ST' || main === 'STP') {
    return isOwnHosp ? '79' : '80';
  }

  // 7. สิทธิครูเอกชน (PVT)
  if (main === 'PVT' || sub === 'P1') {
    return '25';
  }

  // Fallback
  return currentHosPttype || '10';
}

module.exports = {
  RBR_OUT_CUP_MAIN_HOSPITALS,
  RBR_UCS_OUT_CUP_SUB_CENTERS,
  isRbrOutCup,
  formatCid,
  formatDateOnly,
  mapNhsoToHosPttype
};
