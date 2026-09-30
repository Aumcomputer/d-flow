import React, { useState, useEffect, useRef } from 'react';
import { 
  CornerDownLeft, Building2, Search, CheckCircle2, XCircle, 
  Clock, User, Stethoscope, FileText, AlertCircle, Trash2, 
  Plus, ArrowRight, Check, X, ShieldAlert, Sparkles
} from 'lucide-react';
import api from '../../services/api';
import socket from '../../services/socket';
import { useAuth } from '../../contexts/AuthContext';

const REASON_PRESETS = [
  'ดูแลต่อหลังผ่าตัด',
  'ให้ยาต่อ',
  'กายภาพบำบัด',
  'ล้างแผล / ตัดไหม',
  'ใกล้บ้าน / สะดวกผู้ป่วย',
  'รักษาตามอาการ'
];

export default function ReferbackTab({ an, patient, details }) {
  const { user } = useAuth();

  // Records state
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patientDiag, setPatientDiag] = useState(null);

  // Form states
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [hospSearch, setHospSearch] = useState('');
  const [hospResults, setHospResults] = useState([]);
  const [searchingHosp, setSearchingHosp] = useState(false);
  const [showHospDropdown, setShowHospDropdown] = useState(false);

  const [diagnosis, setDiagnosis] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('accepted'); // 'accepted' | 'rejected'
  const [responderName, setResponderName] = useState('');
  const [remark, setRemark] = useState('');

  // Default contact_datetime is now in local ISO string for datetime-local
  const getNowLocal = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  const [contactDatetime, setContactDatetime] = useState(getNowLocal());

  const searchBoxRef = useRef(null);

  // Fetch initial data
  const fetchRecords = async () => {
    try {
      const res = await api.get(`/referback/${an}`);
      setRecords(res.data || []);
    } catch (err) {
      console.error('Failed to fetch referback records:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientDiagnosis = async () => {
    try {
      const res = await api.get(`/referback/patient-diag/${an}`);
      setPatientDiag(res.data);
      if (res.data?.pdxName) {
        setDiagnosis(`${res.data.pdx} : ${res.data.pdxName}`);
      } else if (res.data?.diagList?.length > 0) {
        const first = res.data.diagList[0];
        setDiagnosis(`${first.icd10} : ${first.diag_name}`);
      }
    } catch (err) {
      console.error('Failed to fetch patient diagnosis:', err);
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchPatientDiagnosis();

    // Socket real-time updates
    const handleUpdate = (data) => {
      if (data?.an === an) {
        fetchRecords();
      }
    };
    socket.on('referback:updated', handleUpdate);

    return () => {
      socket.off('referback:updated', handleUpdate);
    };
  }, [an]);

  // Click outside to close hospital dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setShowHospDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced hospital search
  useEffect(() => {
    if (!hospSearch.trim() || selectedHospital) {
      setHospResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingHosp(true);
      try {
        const res = await api.get(`/referback/hospitals?q=${encodeURIComponent(hospSearch.trim())}`);
        setHospResults(res.data || []);
        setShowHospDropdown(true);
      } catch (err) {
        console.error('Hospital search error:', err);
      } finally {
        setSearchingHosp(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [hospSearch, selectedHospital]);

  // Select hospital
  const handleSelectHospital = (hosp) => {
    setSelectedHospital(hosp);
    setHospSearch(`${hosp.hospcode} - ${hosp.name}`);
    setShowHospDropdown(false);
  };

  // Clear hospital selection
  const handleClearHospital = () => {
    setSelectedHospital(null);
    setHospSearch('');
    setHospResults([]);
  };

  // Submit new refer-back record
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedHospital) {
      alert('กรุณาเลือกโรงพยาบาลที่ประสานส่งกลับ');
      return;
    }
    if (!reason.trim()) {
      alert('กรุณาระบุเหตุที่ส่งกลับ');
      return;
    }
    if (!responderName.trim()) {
      alert('กรุณาระบุชื่อผู้ตอบ รับ / ปฏิเสธ');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/referback/${an}`, {
        hospcode: selectedHospital.hospcode,
        hospname: selectedHospital.name,
        diagnosis: diagnosis.trim() || null,
        reason: reason.trim(),
        status,
        responder_name: responderName.trim(),
        remark: remark.trim() || null,
        contact_datetime: contactDatetime || new Date().toISOString()
      });

      // Reset form partially (keep diag, clear hospital, responder, remark)
      handleClearHospital();
      setReason('');
      setResponderName('');
      setRemark('');
      setStatus('accepted');
      setContactDatetime(getNowLocal());

      await fetchRecords();
    } catch (err) {
      console.error('Save refer back error:', err);
      alert(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  // Delete a record
  const handleDelete = async (id, hospname) => {
    if (!window.confirm(`ยืนยันการลบประวัติการประสานงานกับ "${hospname}" ใช่หรือไม่?`)) {
      return;
    }
    try {
      await api.delete(`/referback/${id}`);
      await fetchRecords();
    } catch (err) {
      console.error('Delete error:', err);
      alert('ไม่สามารถลบรายการได้');
    }
  };

  const formatThaiDateTime = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const acceptedCount = records.filter(r => r.status === 'accepted').length;
  const rejectedCount = records.filter(r => r.status === 'rejected').length;
  const latestRecord = records.length > 0 ? records[0] : null;

  return (
    <div className="py-4 space-y-5 w-full text-slate-800">
      {/* Header Summary Banner */}
      <div className="bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-blue-500/10 border border-teal-200/60 rounded-2xl p-4 sm:p-4.5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-500/20 shrink-0">
              <CornerDownLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                ประสานส่งตัวกลับ รพ.ต้นทาง (Refer Back)
                {records.length > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-teal-100 text-teal-800 border border-teal-300">
                    ประสานแล้ว {records.length} ครั้ง
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                บันทึกประวัติการประสานงานส่งตัวผู้ป่วยกลับ รพ.ต้นทาง หรือ รพ.ใกล้บ้าน พร้อมผลตอบรับ/ปฏิเสธ
              </p>
            </div>
          </div>

          {/* Quick Stat Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 border border-slate-200 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-slate-500 font-medium">รับ:</span>
              <span className="text-sm font-bold text-emerald-700">{acceptedCount}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 border border-slate-200 shadow-xs">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span className="text-xs text-slate-500 font-medium">ปฏิเสธ:</span>
              <span className="text-sm font-bold text-rose-700">{rejectedCount}</span>
            </div>
            {latestRecord && (
              <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 shadow-xs ${
                latestRecord.status === 'accepted' 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                  : 'bg-rose-50 text-rose-800 border-rose-300'
              }`}>
                <span>สถานะล่าสุด:</span>
                <span>{latestRecord.status === 'accepted' ? '🟢 รับแล้ว' : '🔴 ปฏิเสธ'}</span>
                <span className="text-slate-500 font-normal">({latestRecord.hospname})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Form on Left, History on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Input Form (5 cols) */}
        <div className="lg:col-span-5 bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-teal-500 to-emerald-500" />
          <div className="px-5 py-3.5 border-b border-border bg-muted/20">
            <h3 className="font-bold text-base flex items-center gap-2 text-slate-800">
              <Plus className="w-4.5 h-4.5 text-teal-600" />
              บันทึกการประสานส่งตัวกลับ
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              กรอกข้อมูลการติดต่อ รพ. และผลการตอบรับ
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* 1. โรงพยาบาลที่ประสานส่งกลับ (Searchable hospcode / name) */}
            <div className="relative" ref={searchBoxRef}>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                1. โรงพยาบาลที่ประสานส่งกลับ <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={hospSearch}
                  onChange={(e) => {
                    setHospSearch(e.target.value);
                    if (selectedHospital) setSelectedHospital(null);
                  }}
                  onFocus={() => {
                    if (hospResults.length > 0 && !selectedHospital) {
                      setShowHospDropdown(true);
                    }
                  }}
                  placeholder="พิมพ์ชื่อ รพ. หรือ รหัส 5 หลัก (hospcode)..."
                  className={`w-full pl-9 pr-8 py-2 text-sm border rounded-lg transition-all focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${
                    selectedHospital 
                      ? 'border-teal-500 bg-teal-50/50 text-teal-900 font-semibold shadow-xs' 
                      : 'border-slate-300 bg-white'
                  }`}
                />
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                {selectedHospital ? (
                  <button
                    type="button"
                    onClick={handleClearHospital}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 p-0.5 rounded-full hover:bg-slate-200 transition-colors"
                    title="ล้างข้อมูลเพื่อค้นหาใหม่"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : searchingHosp ? (
                  <div className="absolute right-3 top-2.5">
                    <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : null}
              </div>

              {/* Dropdown Results */}
              {showHospDropdown && hospResults.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100">
                  {hospResults.map((hosp) => (
                    <button
                      key={hosp.hospcode}
                      type="button"
                      onClick={() => handleSelectHospital(hosp)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-teal-50/80 transition-colors flex items-start gap-2.5 text-xs"
                    >
                      <span className="font-mono font-bold text-teal-800 bg-teal-100 px-1.5 py-0.5 rounded text-[11px] shrink-0 mt-0.5">
                        {hosp.hospcode}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 text-xs truncate">{hosp.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {hosp.province_name ? `จ.${hosp.province_name}` : ''} {hosp.hosptype ? `(${hosp.hosptype})` : ''}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showHospDropdown && !searchingHosp && hospSearch.length >= 2 && hospResults.length === 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 p-3 bg-white border border-slate-200 rounded-xl shadow-lg text-xs text-center text-slate-500">
                  ไม่พบข้อมูลโรงพยาบาลที่ค้นหา
                </div>
              )}
            </div>

            {/* 2. การวินิจฉัย (Diagnosis) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-slate-500" />
                  2. การวินิจฉัย (Diagnosis)
                </label>
                {patientDiag?.pdx && (
                  <button
                    type="button"
                    onClick={() => setDiagnosis(`${patientDiag.pdx} : ${patientDiag.pdxName || ''}`)}
                    className="text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded-md border border-teal-200 transition-colors flex items-center gap-1"
                    title="คลิกเพื่อดึงการวินิจฉัยหลัก (PDX) จากระบบ HIS"
                  >
                    <Sparkles className="w-3 h-3" />
                    ใช้ PDX ({patientDiag.pdx})
                  </button>
                )}
              </div>
              <input
                type="text"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="เช่น I21.9 Acute myocardial infarction หรือพิมพ์การวินิจฉัย..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
              />
              {/* Secondary diag chips if any */}
              {patientDiag?.diagList && patientDiag.diagList.length > 1 && (
                <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                  <span className="text-[11px] font-medium text-slate-500 mr-1">รหัสโรคอื่น:</span>
                  {patientDiag.diagList.slice(0, 4).map((d, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setDiagnosis(`${d.icd10} : ${d.diag_name || ''}`)}
                      className="text-xs font-medium bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 px-2 py-0.5 rounded border border-slate-200 transition-colors"
                    >
                      {d.icd10}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 3. เหตุที่ส่งกลับ */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                3. เหตุที่ส่งกลับ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="เช่น ดูแลต่อหลังผ่าตัด, ให้ยาต่อ, กายภาพบำบัด..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors mb-2"
              />
              {/* Preset suggestion chips */}
              <div className="flex flex-wrap gap-1.5">
                {REASON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      if (!reason) {
                        setReason(preset);
                      } else if (!reason.includes(preset)) {
                        setReason(`${reason}, ${preset}`);
                      }
                    }}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${
                      reason.includes(preset)
                        ? 'bg-teal-100 text-teal-800 border-teal-300 font-semibold shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. โรงพยาบาลที่ประสานส่งกลับ รับ / ปฏิเสธ */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                4. ผลการประสานงาน <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatus('accepted')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 font-bold text-sm transition-all ${
                    status === 'accepted'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2 className={`w-4.5 h-4.5 ${status === 'accepted' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>รับ (Accepted)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('rejected')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 font-bold text-sm transition-all ${
                    status === 'rejected'
                      ? 'border-rose-500 bg-rose-50 text-rose-800 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <XCircle className={`w-4.5 h-4.5 ${status === 'rejected' ? 'text-rose-600' : 'text-slate-400'}`} />
                  <span>ปฏิเสธ (Rejected)</span>
                </button>
              </div>
            </div>

            {/* 5. ชื่อผู้ตอบ รับ / ปฏิเสธ */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                5. ชื่อผู้ตอบ รับ / ปฏิเสธ <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={responderName}
                  onChange={(e) => setResponderName(e.target.value)}
                  placeholder="ระบุชื่อ-สกุล หรือตำแหน่งผู้ตอบ เช่น พว.สมศรี (ห้องฉุกเฉิน), นพ.วิชัย..."
                  className="w-full pl-9 pr-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* 6. วันและเวลาที่ประสานงาน & หมายเหตุ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  วัน-เวลาที่ประสานงาน
                </label>
                <input
                  type="datetime-local"
                  value={contactDatetime}
                  onChange={(e) => setContactDatetime(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  หมายเหตุเพิ่มเติม
                </label>
                <input
                  type="text"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="เช่น เตียงเต็ม, นัดส่งตัว 09.00 น."
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-1.5">
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <CornerDownLeft className="w-4 h-4" />
                    <span>บันทึกผลการประสานส่งกลับ</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: History / Multiple attempts list (7 cols) */}
        <div className="lg:col-span-7 bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500" />
          <div className="px-5 py-3.5 border-b border-border bg-muted/20 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2 text-slate-800">
                <Clock className="w-4.5 h-4.5 text-teal-600" />
                ประวัติการประสานส่งตัวกลับ
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {records.length} รายการ
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                เรียงตามวันเวลาที่ประสานงานล่าสุดขึ้นก่อน
              </p>
            </div>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
                <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">กำลังโหลดประวัติการประสานส่งกลับ...</span>
              </div>
            ) : records.length === 0 ? (
              <div className="py-14 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                <p className="text-sm font-bold text-slate-700">ยังไม่มีประวัติการประสานส่งตัวกลับ</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  เมื่อมีการติดต่อประสานงานส่งตัวผู้ป่วยกลับ รพ.ต้นทาง สามารถกรอกข้อมูลในฟอร์มด้านซ้ายและบันทึกได้ทันที
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {records.map((rec, index) => {
                  const isAccepted = rec.status === 'accepted';
                  const attemptNum = records.length - index;

                  return (
                    <div
                      key={rec.id}
                      className={`relative rounded-xl border p-4 transition-all shadow-xs ${
                        isAccepted
                          ? 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-300'
                          : 'border-rose-200 bg-rose-50/40 hover:border-rose-300'
                      }`}
                    >
                      {/* Top row: Hospital name & Status badge & Action */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-md font-bold mt-0.5 shrink-0 ${
                            isAccepted ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            ครั้งที่ {attemptNum}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                                {rec.hospname}
                              </h4>
                              <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-white/90 text-slate-700 rounded-md border border-slate-200 shadow-2xs">
                                {rec.hospcode}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>ประสานเมื่อ: {formatThaiDateTime(rec.contact_datetime)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold shadow-xs ${
                            isAccepted
                              ? 'bg-emerald-600 text-white'
                              : 'bg-rose-600 text-white'
                          }`}>
                            {isAccepted ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>รับ (Accepted)</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5" />
                                <span>ปฏิเสธ (Rejected)</span>
                              </>
                            )}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleDelete(rec.id, rec.hospname)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="ลบรายการนี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Detail Grid */}
                      <div className="mt-3 pt-3 border-t border-slate-200/70 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                        <div>
                          <span className="text-slate-500 font-medium">ผู้ตอบรับ/ปฏิเสธ: </span>
                          <span className="font-semibold text-slate-800">{rec.responder_name}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium">เหตุผลที่ส่งกลับ: </span>
                          <span className="font-semibold text-slate-800">{rec.reason}</span>
                        </div>
                        {rec.diagnosis && (
                          <div className="sm:col-span-2">
                            <span className="text-slate-500 font-medium">การวินิจฉัย: </span>
                            <span className="font-medium text-slate-800">{rec.diagnosis}</span>
                          </div>
                        )}
                        {rec.remark && (
                          <div className="sm:col-span-2 bg-white/80 p-2.5 rounded-lg border border-slate-200 text-xs">
                            <span className="text-slate-500 font-medium">หมายเหตุ: </span>
                            <span className="font-medium text-slate-800">{rec.remark}</span>
                          </div>
                        )}
                      </div>

                      {/* Footer: User who recorded */}
                      <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>บันทึกโดย: <strong className="text-slate-700">{rec.recorded_by_name || rec.recorded_by || '-'}</strong></span>
                        </span>
                        <span>{formatThaiDateTime(rec.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
