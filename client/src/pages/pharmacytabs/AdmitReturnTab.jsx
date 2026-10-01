import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Pill, Plus, Minus, Trash2, Check, AlertCircle, 
  User, Calendar, Clock, CheckCircle2, Bed, RotateCcw, 
  FileText, CornerDownLeft, Sparkles, Building2, Stethoscope, Shield
} from 'lucide-react';
import api from '../../services/api';
import socket from '../../services/socket';
import { useAuth } from '../../contexts/AuthContext';

export default function AdmitReturnTab() {
  const { user } = useAuth();
  const [anInput, setAnInput] = useState('');
  const [currentAn, setCurrentAn] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Data from backend
  const [patient, setPatient] = useState(null);
  const [availableDrugs, setAvailableDrugs] = useState([]);
  const [rounds, setRounds] = useState([]);

  // Filter state for left column
  const [leftFilter, setLeftFilter] = useState('');

  // Right column selected drugs for current round
  const [selectedDrugs, setSelectedDrugs] = useState([]);
  const [roundNote, setRoundNote] = useState('');
  const [savingRound, setSavingRound] = useState(false);

  // Custom drug search at bottom of right column
  const [customSearchQuery, setCustomSearchQuery] = useState('');
  const [customSearchResults, setCustomSearchResults] = useState([]);
  const [searchingCustom, setSearchingCustom] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const anInputRef = useRef(null);

  // Focus AN input on mount
  useEffect(() => {
    anInputRef.current?.focus();
  }, []);

  // Click outside to close custom drug dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search for custom drugs from HOSxP drugitems
  useEffect(() => {
    const q = customSearchQuery.trim();
    if (!q || q.length < 2) {
      setCustomSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingCustom(true);
      try {
        const res = await api.get(`/workflow/drugs/search?q=${encodeURIComponent(q)}`);
        setCustomSearchResults(res.data || []);
        setShowDropdown(true);
      } catch (err) {
        console.error('Custom drug search error:', err);
      } finally {
        setSearchingCustom(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customSearchQuery]);

  // Subscribe to socket updates
  useEffect(() => {
    const handleUpdate = (data) => {
      if (data?.an && data.an === currentAn) {
        fetchAdmitReturnData(currentAn, false);
      }
    };
    socket.on('workflow:updated', handleUpdate);
    return () => socket.off('workflow:updated', handleUpdate);
  }, [currentAn]);

  const fetchAdmitReturnData = async (anToFetch, showLoader = true) => {
    if (!anToFetch) return;
    if (showLoader) setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.get(`/workflow/pharmacy/admit-return/${anToFetch}`);
      setPatient(res.data.patient || null);
      setAvailableDrugs(res.data.drugs || []);
      setRounds(res.data.rounds || []);
      setCurrentAn(anToFetch);
    } catch (err) {
      console.error('Fetch admit return error:', err);
      setErrorMsg(err.response?.data?.error || 'ไม่พบข้อมูลผู้ป่วยสำหรับ AN นี้ หรือเกิดข้อผิดพลาดในการโหลด');
      setPatient(null);
      setAvailableDrugs([]);
      setRounds([]);
      setCurrentAn('');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const cleanAn = anInput.trim();
    if (!cleanAn) return;
    setSelectedDrugs([]);
    setRoundNote('');
    fetchAdmitReturnData(cleanAn, true);
  };

  // Add drug from left column to right column
  const handleSelectDrugFromLeft = (drug) => {
    // Check if already in right column
    const exists = selectedDrugs.some(d => d.icode === drug.icode);
    if (exists) return;

    setSelectedDrugs(prev => [
      ...prev,
      {
        icode: drug.icode,
        drug_name: drug.drug_name || drug.name,
        units: drug.units || '',
        qty: 1,
        source: 'prescribed'
      }
    ]);
  };

  // Add custom drug from search dropdown
  const handleSelectCustomDrug = (drug) => {
    // Check if already in right column
    const exists = selectedDrugs.some(d => d.icode === drug.icode);
    if (exists) {
      alert('ยานี้ถูกเลือกในรายการคืนแล้ว');
      setShowDropdown(false);
      return;
    }

    setSelectedDrugs(prev => [
      ...prev,
      {
        icode: drug.icode,
        drug_name: drug.drug_name || drug.name,
        units: drug.units || '',
        qty: 1,
        source: 'custom'
      }
    ]);
    setCustomSearchQuery('');
    setCustomSearchResults([]);
    setShowDropdown(false);
  };

  // Quantity handlers
  const handleUpdateQty = (index, delta) => {
    setSelectedDrugs(prev => {
      const next = [...prev];
      const newQty = Math.max(1, (next[index].qty || 1) + delta);
      next[index] = { ...next[index], qty: newQty };
      return next;
    });
  };

  const handleSetQty = (index, value) => {
    const val = parseInt(value, 10);
    setSelectedDrugs(prev => {
      const next = [...prev];
      next[index] = { ...next[index], qty: isNaN(val) ? 1 : Math.max(1, val) };
      return next;
    });
  };

  // Remove drug from right column
  const handleRemoveDrug = (index) => {
    setSelectedDrugs(prev => prev.filter((_, i) => i !== index));
  };

  // Submit new round
  const handleSaveRound = async () => {
    if (selectedDrugs.length === 0) {
      alert('กรุณาเลือกรายการยาที่ต้องการคืนอย่างน้อย 1 รายการ');
      return;
    }

    if (!confirm(`ยืนยันบันทึกการคืนยาจำนวน ${selectedDrugs.length} รายการ?`)) return;

    setSavingRound(true);
    try {
      await api.post(`/workflow/pharmacy/admit-return/${currentAn}`, {
        note: roundNote.trim(),
        items: selectedDrugs.map(d => ({
          icode: d.icode,
          drug_name: d.drug_name,
          qty: d.qty,
          units: d.units
        }))
      });

      alert('บันทึกการคืนยาเรียบร้อยแล้ว');
      setSelectedDrugs([]);
      setRoundNote('');
      // Reload rounds
      await fetchAdmitReturnData(currentAn, false);
    } catch (err) {
      console.error('Save round error:', err);
      alert('ไม่สามารถบันทึกได้: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingRound(false);
    }
  };

  // Filter available drugs on left column
  const filteredAvailableDrugs = availableDrugs.filter(d => {
    if (!leftFilter.trim()) return true;
    const term = leftFilter.trim().toLowerCase();
    return (
      (d.drug_name && d.drug_name.toLowerCase().includes(term)) ||
      (d.icode && d.icode.toLowerCase().includes(term))
    );
  });

  const selectedIcodesSet = new Set(selectedDrugs.map(d => d.icode));

  return (
    <div className="space-y-6">
      {/* Top Search Card */}
      <div className="bg-card rounded-2xl border border-border shadow-xs p-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-emerald-600" />
              <span>บันทึกคืนยา (ระหว่าง Admit)</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              คีย์รายการยาคืนสำหรับผู้ป่วยที่กำลังพักรักษาตัวในหอผู้ป่วย สามารถบันทึกได้หลายรอบ
            </p>
          </div>

          {/* AN Input Field (Top Right) */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <input
                ref={anInputRef}
                type="text"
                value={anInput}
                onChange={(e) => setAnInput(e.target.value)}
                placeholder="ใส่ AN คนไข้ (เช่น 6900...)"
                className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-background font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !anInput.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>ค้นหา</span>
                </>
              )}
            </button>
          </form>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Patient Info Banner */}
      {patient && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50/40 border border-emerald-200 rounded-2xl p-5 shadow-xs animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs shrink-0">
                <User className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-slate-800">
                    {patient.pname}{patient.fname} {patient.lname}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                    HN: {patient.hn}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 font-mono">
                    AN: {patient.an}
                  </span>
                  {patient.dchdate ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      Discharge แล้ว
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                      กำลัง Admit
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                  <span>อายุ: <strong className="text-slate-700">{patient.age_y ? patient.age_y + ' ปี' : '-'}</strong></span>
                  <span>•</span>
                  <span>หอผู้ป่วย: <strong className="text-slate-700">{patient.ward_name || '-'}</strong></span>
                  <span>•</span>
                  <span>เตียง: <strong className="text-slate-700">{patient.bedno || '-'}</strong></span>
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-1 md:text-right bg-white/70 px-4 py-2.5 rounded-xl border border-emerald-100 shadow-xs">
              <div>
                <span className="text-slate-400">วันที่ Admit: </span>
                <span className="font-semibold text-slate-700">
                  {patient.admit_date ? new Date(patient.admit_date).toLocaleDateString('th-TH') : '-'}
                  {patient.admit_time ? ` (${patient.admit_time.substring(0, 5)} น.)` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-400">สิทธิ์: </span>
                <span className="font-semibold text-slate-700">{patient.pttype_name || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400">แพทย์เจ้าของไข้: </span>
                <span className="font-semibold text-slate-700">{patient.doctor_name || '-'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2-Columns Layout (Only when patient is selected) */}
      {patient && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* ================= LEFT COLUMN: Available Prescribed Drugs ================= */}
          <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden flex flex-col h-[580px]">
            <div className="p-4 border-b border-border bg-muted/20 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                  <Pill className="w-4 h-4 text-emerald-600" />
                  <span>รายการยาที่ผู้ป่วยใช้ (ยาฉีด/ยาควบคุม)</span>
                </div>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {availableDrugs.length} รายการ
                </span>
              </div>

              {/* Filter in Left Column */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={leftFilter}
                  onChange={(e) => setLeftFilter(e.target.value)}
                  placeholder="ค้นหาชื่อยาหรือรหัสในรายการนี้..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-background"
                />
              </div>
            </div>

            {/* List of Available Drugs */}
            <div className="p-3 overflow-y-auto flex-1 space-y-2">
              {filteredAvailableDrugs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground text-xs">
                  <Pill className="w-8 h-8 text-slate-300 mb-2" />
                  <p>ไม่พบรายการยาที่เข้าเกณฑ์สำหรับ AN นี้</p>
                  <p className="text-[11px] text-slate-400 mt-1">สามารถพิมพ์ค้นหายาเพิ่มได้ที่คอลัมน์ด้านขวา</p>
                </div>
              ) : (
                filteredAvailableDrugs.map((drug, index) => {
                  const isSelected = selectedIcodesSet.has(drug.icode);
                  return (
                    <div
                      key={drug.icode || index}
                      onClick={() => !isSelected && handleSelectDrugFromLeft(drug)}
                      className={`p-3 rounded-xl border text-xs transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-slate-50 border-dashed border-slate-300 opacity-55 cursor-not-allowed select-none'
                          : 'bg-card border-border hover:border-emerald-400 hover:bg-emerald-50/40 cursor-pointer shadow-2xs hover:shadow-xs'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {drug.icode}
                          </span>
                          <span className="font-semibold text-slate-800 truncate">
                            {drug.drug_name || drug.name}
                          </span>
                        </div>
                        {drug.units && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            หน่วย: {drug.units}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0">
                        {isSelected ? (
                          <span className="px-2 py-1 text-[11px] font-medium text-slate-500 bg-slate-200/70 rounded-lg flex items-center gap-1">
                            <Check className="w-3 h-3 text-slate-600" />
                            <span>เลือกแล้ว</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>เลือกคืน</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="p-2.5 bg-muted/10 border-t border-border text-[11px] text-muted-foreground text-center">
              คลิกที่รายการยาเพื่อเพิ่มลงในรายการคืนรอบนี้
            </div>
          </div>

          {/* ================= RIGHT COLUMN: Selected Return Drugs (This Round) ================= */}
          <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden flex flex-col h-[580px]">
            <div className="p-4 border-b border-border bg-emerald-50/40 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-950">
                <RotateCcw className="w-4 h-4 text-emerald-600" />
                <span>รายการยาคืน (รอบนี้)</span>
              </div>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-600 text-white">
                {selectedDrugs.length} รายการ
              </span>
            </div>

            {/* Selected Drugs List */}
            <div className="p-3 overflow-y-auto flex-1 space-y-2">
              {selectedDrugs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground text-xs">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                    <Pill className="w-6 h-6" />
                  </div>
                  <p className="font-medium text-slate-700">ยังไม่มีรายการยาคืนในรอบนี้</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                    เลือกยาจากคอลัมน์ด้านซ้าย หรือพิมพ์ค้นหายาเพื่อเพิ่มเองในแถวด้านล่าง
                  </p>
                </div>
              ) : (
                selectedDrugs.map((item, index) => (
                  <div
                    key={item.icode ? `${item.icode}-${index}` : index}
                    className="p-3 bg-white rounded-xl border border-emerald-200/80 shadow-2xs flex items-center justify-between gap-3 animate-in fade-in duration-150"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <span className="font-semibold text-slate-800 text-xs truncate">
                          {item.drug_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        {item.icode && (
                          <span className="font-mono text-[10px] text-slate-400">[{item.icode}]</span>
                        )}
                        <span>หน่วย: {item.units || '-'}</span>
                        {item.source === 'custom' && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.2 rounded border border-amber-200">
                            เพิ่มนอกรายการ
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(index, -1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-300 disabled:opacity-40 active:scale-95 transition-all"
                        title="ลดจำนวน"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => handleSetQty(index, e.target.value)}
                        className="w-12 h-7 text-center font-bold text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(index, 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold border border-emerald-300 active:scale-95 transition-all"
                        title="เพิ่มจำนวน"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveDrug(index)}
                        className="w-7 h-7 ml-1 flex items-center justify-center rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors"
                        title="ลบรายการนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Row: Custom Drug Search (แถวสุดท้าย: คีย์ยาเพิ่มเองนอกเหนือรายการ) */}
            <div className="p-3 border-t border-border bg-slate-50/70 space-y-3">
              <div className="relative" ref={dropdownRef}>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={customSearchQuery}
                      onChange={(e) => setCustomSearchQuery(e.target.value)}
                      onFocus={() => {
                        if (customSearchResults.length > 0) setShowDropdown(true);
                      }}
                      placeholder="พิมพ์ค้นหายาเพิ่มจากคลัง HOSxP (อย่างน้อย 2 ตัวอักษร)..."
                      className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white text-slate-800"
                    />
                    {searchingCustom && (
                      <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin absolute right-2.5 top-2.5" />
                    )}
                  </div>
                </div>

                {/* Dropdown Results */}
                {showDropdown && customSearchResults.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 bottom-full mb-1 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100 animate-in fade-in">
                    {customSearchResults.map((drug) => (
                      <button
                        key={drug.icode}
                        type="button"
                        onClick={() => handleSelectCustomDrug(drug)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 transition-colors flex items-center justify-between gap-2"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-slate-800 truncate">
                            {drug.drug_name || drug.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            รหัส: {drug.icode} • หน่วย: {drug.units || '-'}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 shrink-0">
                          + เลือก
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Note / หมายเหตุ */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={roundNote}
                  onChange={(e) => setRoundNote(e.target.value)}
                  placeholder="หมายเหตุประจำรอบ (ถ้ามี เช่น คืนยาเนื่องจากเปลี่ยนแผนการรักษา)..."
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white text-slate-800"
                />
              </div>

              {/* Save Button */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="text-[11px] text-slate-500">
                  ผู้บันทึก: <strong className="text-slate-700">{user?.name || user?.loginname}</strong>
                </div>

                <button
                  type="button"
                  disabled={selectedDrugs.length === 0 || savingRound}
                  onClick={handleSaveRound}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {savingRound ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>บันทึกการคืนยา (รอบที่ {rounds.filter(r => !r.is_audit_source).length + 1})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ================= BOTTOM SECTION: History Cards (แต่ละรอบ) ================= */}
      {patient && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              <span>ประวัติการคืนยาสำหรับ AN นี้ ({rounds.length} รอบ)</span>
            </h3>
            <span className="text-xs text-muted-foreground">
              บันทึกแล้วไม่สามารถแก้ไขได้ (Audit Trail)
            </span>
          </div>

          {rounds.length === 0 ? (
            <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
              <Pill className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p>ยังไม่มีประวัติการบันทึกคืนยาสำหรับ AN นี้</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rounds.map((round, idx) => {
                const isAuditSource = round.is_audit_source === true || round.source === 'discharge_audit';
                return (
                  <div
                    key={round.id || idx}
                    className={`rounded-2xl border p-5 shadow-xs flex flex-col justify-between gap-4 transition-all ${
                      isAuditSource
                        ? 'bg-gradient-to-br from-purple-50/50 via-white to-blue-50/30 border-purple-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    {/* Card Header */}
                    <div>
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          {isAuditSource ? (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5 text-purple-600" />
                              <span>{round.round_no}</span>
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              รอบที่ {round.round_no}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {round.created_at
                              ? new Date(round.created_at).toLocaleString('th-TH', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) + ' น.'
                              : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Note if any */}
                      {round.note && (
                        <div className="mt-2.5 px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700">
                          <strong className="text-slate-500">หมายเหตุ:</strong> {round.note}
                        </div>
                      )}

                      {/* Items List */}
                      <div className="mt-3.5 space-y-1.5">
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          รายการยาที่คืน ({round.items?.length || 0})
                        </div>
                        <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50/40">
                          {round.items && round.items.length > 0 ? (
                            round.items.map((it, itemIdx) => (
                              <div
                                key={it.id || itemIdx}
                                className="px-3 py-2 flex items-center justify-between text-xs gap-2"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="text-[10px] text-slate-400 w-4 font-mono">
                                    {itemIdx + 1}.
                                  </span>
                                  <span className="font-medium text-slate-800 truncate">
                                    {it.drug_name}
                                  </span>
                                </div>
                                <div className="shrink-0 flex items-center gap-1.5">
                                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                                    {it.qty}
                                  </span>
                                  <span className="text-slate-500 text-[11px]">{it.units || ''}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-3 text-center text-xs text-slate-400">
                              ไม่มีรายการยา
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>ผู้บันทึก: <strong className="text-slate-700">{round.created_by_name || round.created_by}</strong></span>
                      </div>
                      <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {isAuditSource ? 'Discharge Return' : 'IPD Return'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Initial Empty State before entering AN */}
      {!patient && !loading && (
        <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 shadow-xs">
            <RotateCcw className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-foreground">กรุณาระบุ AN ผู้ป่วยที่มุมขวาบน</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            ใส่หมายเลข AN ผู้ป่วยที่กำลัง Admit เพื่อดูรายการยาที่สั่งใช้ คีย์ยาคืน และดูประวัติการคืนยาแต่ละรอบ
          </p>
        </div>
      )}
    </div>
  );
}
