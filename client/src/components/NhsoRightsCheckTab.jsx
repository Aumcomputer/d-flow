import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import api from '../services/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { 
  ShieldCheck, 
  Shield,
  AlertTriangle,
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Copy, 
  Check, 
  Save, 
  Database, 
  Building2, 
  User, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  Sparkles,
  Info,
  X,
  FileText
} from 'lucide-react';

const formatCid = (cid) => {
  if (!cid) return '-';
  const clean = String(cid).replace(/\D/g, '');
  if (clean.length === 13) {
    return clean.replace(/^(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})$/, '$1-$2-$3-$4-$5');
  }
  return clean;
};

export default function NhsoRightsCheckTab({ onSelectPatient }) {
  const [patients, setPatients] = useState([]);
  const [wards, setWards] = useState([]);
  const [stats, setStats] = useState({ total: 0, checked: 0, unchecked: 0, has_authen: 0, no_authen: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWard, setSelectedWard] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // all, unchecked, checked, has_authen, no_authen
  const [copiedCid, setCopiedCid] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Checking individual / batch
  const [checkingVns, setCheckingVns] = useState(new Set());
  const [selectedAnList, setSelectedAnList] = useState(new Set());
  const [isBatchChecking, setIsBatchChecking] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const stopBatchCheckRef = useRef(false);

  // Patient Detail & Comparison Modal State (คลิกแต่ละแถว)
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailPatient, setDetailPatient] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingIptPttype, setSavingIptPttype] = useState(false);
  const [detailActionError, setDetailActionError] = useState('');
  const [detailActionSuccess, setDetailActionSuccess] = useState('');

  // Fetch patients list
  const fetchInpatients = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get('/nhso-authen/inpatients');
      if (res.data) {
        setPatients(res.data.patients || []);
        setWards(res.data.wards || []);
        setStats(res.data.stats || { total: 0, checked: 0, unchecked: 0, has_authen: 0, no_authen: 0 });
      }
    } catch (err) {
      console.error('Failed to fetch admitted inpatients for NHSO check:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInpatients();
  }, [fetchInpatients]);

  // Copy CID helper
  const handleCopyCid = (cid, e) => {
    e?.stopPropagation();
    if (!cid) return;
    navigator.clipboard.writeText(cid);
    setCopiedCid(cid);
    setTimeout(() => setCopiedCid(null), 2000);
  };

  // Filter patients
  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchHn = (p.hn || '').toLowerCase().includes(query);
        const matchAn = (p.an || '').toLowerCase().includes(query);
        const matchVn = (p.vn || '').toLowerCase().includes(query);
        const matchCid = (p.cid || '').includes(query);
        const matchName = (p.ptname || '').toLowerCase().includes(query);
        if (!matchHn && !matchAn && !matchVn && !matchCid && !matchName) {
          return false;
        }
      }

      // 2. Ward Filter
      if (selectedWard !== 'all') {
        if (p.ward_code !== selectedWard) return false;
      }

      // 3. Status Filter
      if (statusFilter === 'unchecked') {
        if (p.nhso?.has_checked) return false;
      } else if (statusFilter === 'checked') {
        if (!p.nhso?.has_checked) return false;
      } else if (statusFilter === 'has_authen') {
        if (!p.nhso?.claim_code) return false;
      } else if (statusFilter === 'no_authen') {
        if (p.nhso?.claim_code) return false;
      }

      return true;
    });
  }, [patients, searchQuery, selectedWard, statusFilter]);

  // Paginated items
  const totalPages = Math.ceil(filteredPatients.length / pageSize) || 1;
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPatients.slice(start, start + pageSize);
  }, [filteredPatients, currentPage, pageSize]);

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedWard, statusFilter, pageSize]);

  // Check single patient with NHSO API
  const handleCheckSingle = async (p, e) => {
    e?.stopPropagation();
    if (!p.vn || !p.cid) return;

    setCheckingVns(prev => new Set(prev).add(p.vn));
    try {
      const res = await api.post('/nhso-authen/check', {
        vn: p.vn,
        an: p.an,
        cid: p.cid,
        admit_date: p.admit_date,
        vstdate: p.admit_date,
        force: true
      });

      if (res.data?.success && res.data?.data) {
        const updated = res.data.data;
        setPatients(prev => prev.map(item => {
          if (item.vn === p.vn) {
            return {
              ...item,
              nhso: {
                has_checked: true,
                right_check_date: updated.right_check_date,
                maininscl_id: updated.maininscl_id || '',
                maininscl_name: updated.maininscl_name || '',
                subinscl_id: updated.subinscl_id || '',
                subinscl_name: updated.subinscl_name || '',
                hospmain_code: updated.hospmain_code || '',
                hospmain_name: updated.hospmain_name || '',
                hospsub_code: updated.hospsub_code || '',
                hospsub_name: updated.hospsub_name || '',
                card_id: updated.card_id || '',
                right_start_date: updated.right_start_date ? String(updated.right_start_date).slice(0, 10) : '',
                claim_code: updated.claim_code || '',
                claim_type_name: updated.claim_type_name || '',
                create_date: updated.create_date,
                received_datetime: updated.received_datetime,
                source_channel: updated.source_channel || '',
                updated_at: updated.updated_at
              }
            };
          }
          return item;
        }));
      }
    } catch (err) {
      console.error(`Check NHSO failed for VN ${p.vn}:`, err);
      alert(err.response?.data?.error || `ตรวจสอบสิทธิ์ สปสช. ล้มเหลว: ${err.message}`);
    } finally {
      setCheckingVns(prev => {
        const next = new Set(prev);
        next.delete(p.vn);
        return next;
      });
    }
  };

  // Toggle selection for batch
  const handleToggleSelect = (an) => {
    setSelectedAnList(prev => {
      const next = new Set(prev);
      if (next.has(an)) next.delete(an);
      else next.add(an);
      return next;
    });
  };

  const handleSelectAllCurrentPage = () => {
    const pageAns = paginatedPatients.map(p => p.an);
    const allSelected = pageAns.every(an => selectedAnList.has(an));
    setSelectedAnList(prev => {
      const next = new Set(prev);
      if (allSelected) {
        pageAns.forEach(an => next.delete(an));
      } else {
        pageAns.forEach(an => next.add(an));
      }
      return next;
    });
  };

  // Helper for batch checking array of patients with cancellation support
  const executeBatchCheck = async (targetPatients) => {
    if (!targetPatients || targetPatients.length === 0) return;

    setIsBatchChecking(true);
    stopBatchCheckRef.current = false;
    setBatchProgress({ current: 0, total: targetPatients.length });

    for (let i = 0; i < targetPatients.length; i++) {
      if (stopBatchCheckRef.current) {
        console.log('Batch check stopped by user');
        break;
      }
      const p = targetPatients[i];
      setBatchProgress({ current: i + 1, total: targetPatients.length });
      setCheckingVns(prev => new Set(prev).add(p.vn));
      try {
        const res = await api.post('/nhso-authen/check', {
          vn: p.vn,
          an: p.an,
          cid: p.cid,
          admit_date: p.admit_date,
          vstdate: p.admit_date,
          force: true
        });
        if (res.data?.success && res.data?.data) {
          const updated = res.data.data;
          setPatients(prev => prev.map(item => {
            if (item.vn === p.vn) {
              return {
                ...item,
                nhso: {
                  has_checked: true,
                  right_check_date: updated.right_check_date,
                  maininscl_id: updated.maininscl_id || '',
                  maininscl_name: updated.maininscl_name || '',
                  subinscl_id: updated.subinscl_id || '',
                  subinscl_name: updated.subinscl_name || '',
                  hospmain_code: updated.hospmain_code || '',
                  hospmain_name: updated.hospmain_name || '',
                  hospsub_code: updated.hospsub_code || '',
                  hospsub_name: updated.hospsub_name || '',
                  card_id: updated.card_id || '',
                  right_start_date: updated.right_start_date ? String(updated.right_start_date).slice(0, 10) : '',
                  claim_code: updated.claim_code || '',
                  claim_type_name: updated.claim_type_name || '',
                  create_date: updated.create_date,
                  received_datetime: updated.received_datetime,
                  source_channel: updated.source_channel || '',
                  updated_at: updated.updated_at
                }
              };
            }
            return item;
          }));
        }
      } catch (err) {
        console.error(`Batch check error for ${p.vn}:`, err);
      } finally {
        setCheckingVns(prev => {
          const next = new Set(prev);
          next.delete(p.vn);
          return next;
        });
      }
    }

    setIsBatchChecking(false);
    setSelectedAnList(new Set());
    fetchInpatients(true);
  };

  // Batch Check Selected Patients (Checkbox)
  const handleBatchCheck = async () => {
    const targetPatients = patients.filter(p => selectedAnList.has(p.an));
    if (targetPatients.length === 0) return;

    if (!confirm(`คุณต้องการตรวจสอบสิทธิ์ สปสช. สำหรับผู้ป่วยที่เลือกจำนวน ${targetPatients.length} ราย หรือไม่?`)) {
      return;
    }
    await executeBatchCheck(targetPatients);
  };

  // Check ALL Patients (or All in current filter)
  const handleCheckAll = async () => {
    const targetPatients = filteredPatients.length > 0 ? filteredPatients : patients;
    if (targetPatients.length === 0) return;

    const confirmMsg = filteredPatients.length !== patients.length
      ? `คุณต้องการตรวจสอบสิทธิ์ สปสช. สำหรับผู้ป่วยตามตัวกรองปัจจุบันจำนวน ${targetPatients.length} ราย (จากทั้งหมด ${stats.total} ราย) หรือไม่?`
      : `คุณต้องการตรวจสอบสิทธิ์ สปสช. สำหรับผู้ป่วยทั้งหมดจำนวน ${targetPatients.length} ราย หรือไม่?`;

    if (!confirm(confirmMsg)) {
      return;
    }
    await executeBatchCheck(targetPatients);
  };

  // Row click opens the comparison and detail modal
  const handleRowClick = async (p) => {
    setDetailPatient(p);
    setDetailData(null);
    setDetailActionError('');
    setDetailActionSuccess('');
    setDetailModalOpen(true);
    setDetailLoading(true);

    try {
      const res = await api.get(`/nhso-authen/rights-summary/${p.an}`);
      if (res.data) {
        setDetailData(res.data);
      }
    } catch (err) {
      console.error('Failed to load rights details:', err);
      setDetailActionError(err.response?.data?.error || `ไม่สามารถโหลดข้อมูลสิทธิได้: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  // Check NHSO within the Modal
  const handleCheckNhsoInModal = async () => {
    if (!detailPatient) return;
    setDetailLoading(true);
    setDetailActionError('');
    setDetailActionSuccess('');
    try {
      await api.post('/nhso-authen/check', {
        vn: detailPatient.vn,
        an: detailPatient.an,
        cid: detailPatient.cid,
        admit_date: detailPatient.admit_date,
        vstdate: detailPatient.admit_date,
        force: true
      });
      const res = await api.get(`/nhso-authen/rights-summary/${detailPatient.an}`);
      if (res.data) {
        setDetailData(res.data);
      }
      fetchInpatients(true);
    } catch (err) {
      console.error('Check NHSO error:', err);
      setDetailActionError(err.response?.data?.error || `ตรวจสอบสิทธิ์ล้มเหลว: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  // Save/Sync to ipt_pttype only (เฉพาะ row ที่สิทธิ์ตรงกัน)
  const handleSaveIptPttype = async () => {
    if (!detailData || !detailData.comparison?.is_match || !detailData.comparison?.matched_row) {
      return;
    }
    setSavingIptPttype(true);
    setDetailActionError('');
    setDetailActionSuccess('');

    try {
      const matched = detailData.comparison.matched_row;
      const apiRow = detailData.rows?.find(r => r.source_name === 'api');
      const authCodeVal = apiRow?.auth_code || apiRow?.claim_code || detailData.authen?.claim_code || null;

      const res = await api.post('/nhso-authen/sync-ipt-pttype', {
        an: detailData.an,
        vn: detailData.vn,
        target: {
          pttype: matched.pttype,
          pttype_number: matched.number,
          pttypeno: (apiRow?.pttypeno && apiRow.pttypeno !== '-') ? apiRow.pttypeno : (detailData?.cid ? formatCid(detailData.cid) : null),
          hospmain: apiRow?.hospmain !== '-' ? apiRow?.hospmain : null,
          hospsub: apiRow?.hospsub !== '-' ? apiRow?.hospsub : null,
          begin_date: (apiRow?.begin_date && apiRow.begin_date !== '-') ? apiRow.begin_date : null,
          expire_date: (apiRow?.expire_date && apiRow.expire_date !== '-') ? apiRow.expire_date : null,
          auth_code: authCodeVal
        }
      });

      if (res.data?.success) {
        setDetailActionSuccess(res.data.message || 'บันทึกข้อมูลเข้าตาราง ipt_pttype เรียบร้อยแล้ว!');
        const reloadRes = await api.get(`/nhso-authen/rights-summary/${detailData.an}`);
        if (reloadRes.data) {
          setDetailData(reloadRes.data);
        }
        fetchInpatients(true);
      }
    } catch (err) {
      console.error('Failed to save to ipt_pttype:', err);
      setDetailActionError(err.response?.data?.error || `บันทึกข้อมูลล้มเหลว: ${err.message}`);
    } finally {
      setSavingIptPttype(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar & Quick Stats */}
      <div className="bg-card rounded-2xl p-4 sm:p-5 border border-border shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-foreground">
                ตรวจสอบสิทธิผู้รับบริการ สปสช. (HOSxP - NHSO)
              </h2>
              <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700 border-slate-200">
                ผู้ป่วยใน (Admitted {stats.total} ราย)
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              แสดงรายชื่อคนไข้ที่นอนพักรักษาตัวในโรงพยาบาล พร้อมเปรียบเทียบสิทธิการรักษาและเชื่อมโยง NHSO API
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isBatchChecking ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => { stopBatchCheckRef.current = true; }}
                className="text-xs font-medium shadow-xs"
                title="หยุดการตรวจสอบที่กำลังทำงาน"
              >
                <X className="w-3.5 h-3.5 mr-1.5" />
                หยุดการตรวจ ({batchProgress.current}/{batchProgress.total})
              </Button>
            ) : (
              <>
                {selectedAnList.size > 0 && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleBatchCheck}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    เช็ค สปสช. ที่เลือก ({selectedAnList.size})
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="default"
                  onClick={handleCheckAll}
                  disabled={loading || refreshing || filteredPatients.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs"
                  title="ตรวจสอบสิทธิ์ สปสช. ผู้ป่วยทั้งหมดในรายการ"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  เช็ค สปสช. ทั้งหมด ({filteredPatients.length})
                </Button>
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchInpatients(true)}
              disabled={loading || refreshing || isBatchChecking}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              รีเฟรชข้อมูล
            </Button>
          </div>
        </div>

        {/* Filter KPI Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <span>ทั้งหมด</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {stats.total}
            </span>
          </button>

          {/* Special filter requested by user: ยังไม่ได้กดเช็ค สปสช */}
          <button
            onClick={() => setStatusFilter('unchecked')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              statusFilter === 'unchecked'
                ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>ยังไม่ได้เช็ค สปสช.</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'unchecked' ? 'bg-white/20' : 'bg-rose-200 text-rose-800'}`}>
              {stats.unchecked}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('checked')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              statusFilter === 'checked'
                ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>เช็ค สปสช. แล้ว</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'checked' ? 'bg-white/20' : 'bg-emerald-200 text-emerald-800'}`}>
              {stats.checked}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('has_authen')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              statusFilter === 'has_authen'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
            }`}
          >
            <span>มี Authen Code</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'has_authen' ? 'bg-white/20' : 'bg-blue-200 text-blue-800'}`}>
              {stats.has_authen}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('no_authen')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              statusFilter === 'no_authen'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <span>ยังไม่มี Authen Code</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'no_authen' ? 'bg-white/20' : 'bg-amber-200 text-amber-800'}`}>
              {stats.no_authen}
            </span>
          </button>
        </div>

        {/* Search & Ward Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="ค้นหา HN, AN, VN, เลขบัตรประชาชน (CID), หรือชื่อ-สกุล..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs sm:text-sm bg-background h-9 rounded-xl"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <Building2 className="w-3.5 h-3.5" />
              <span>หอผู้ป่วย:</span>
            </div>
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="text-xs bg-background border border-border rounded-xl px-2.5 py-1.5 h-9 text-foreground focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
            >
              <option value="all">ทุกหอผู้ป่วย (ทั้งหมด {stats.total} ราย)</option>
              {wards.map(w => (
                <option key={w.code} value={w.code}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Main Inpatients Table */}
      <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/60 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider select-none">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={paginatedPatients.length > 0 && paginatedPatients.every(p => selectedAnList.has(p.an))}
                    onChange={handleSelectAllCurrentPage}
                    className="rounded border-border text-blue-600 focus:ring-blue-500"
                    title="เลือกทั้งหมดในหน้านี้"
                  />
                </th>
                <th className="p-3 whitespace-nowrap min-w-[120px]">เวลา / VN / AN</th>
                <th className="p-3 whitespace-nowrap min-w-[130px]">HN / เลขบัตร (CID)</th>
                <th className="p-3 whitespace-nowrap min-w-[140px]">ชื่อ - สกุล</th>
                <th className="p-3 whitespace-nowrap min-w-[130px]">หอผู้ป่วย</th>
                <th className="p-3 whitespace-nowrap min-w-[200px] bg-sky-50/70 text-sky-950">ipt_pttype (สิทธิ์ใน HOSxP)</th>
                <th className="p-3 whitespace-nowrap min-w-[170px] bg-emerald-50/50">สิทธิ สปสช. (API)</th>
                <th className="p-3 whitespace-nowrap min-w-[130px] bg-emerald-50/70">Authen Code (API)</th>
                <th className="p-3 whitespace-nowrap min-w-[120px]">ผู้บันทึก (ipt.staff)</th>
                <th className="p-3 whitespace-nowrap text-center min-w-[100px] sticky right-0 bg-muted/90 backdrop-blur-xs">
                  การจัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="p-3 text-center"><Skeleton className="w-4 h-4 mx-auto rounded" /></td>
                    <td className="p-3"><Skeleton className="h-4 w-24 mb-1" /><Skeleton className="h-3 w-16" /></td>
                    <td className="p-3"><Skeleton className="h-4 w-20 mb-1" /><Skeleton className="h-3 w-28" /></td>
                    <td className="p-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="p-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="p-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="p-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="p-3 text-center"><Skeleton className="h-7 w-20 mx-auto rounded-lg" /></td>
                  </tr>
                ))
              ) : paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                    <p className="text-sm font-medium">ไม่พบข้อมูลผู้ป่วยตามเงื่อนไขที่เลือก</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">ลองเปลี่ยนคำค้นหา หรือเลือกตัวกรองหอผู้ป่วยอื่น</p>
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((p) => {
                  const isCheckedWithNhso = Boolean(p.nhso?.has_checked || p.nhso?.right_check_date);
                  const isCheckingThis = checkingVns.has(p.vn);
                  const isSelected = selectedAnList.has(p.an);

                  const nhsoMainCode = p.nhso?.hospmain_code ? String(p.nhso.hospmain_code).trim() : '';
                  const nhsoSubCode = p.nhso?.hospsub_code ? String(p.nhso.hospsub_code).trim() : '';

                  const isHospmainMatch = nhsoMainCode 
                    ? (p.ipt_pttype_list?.some(ip => String(ip.hospmain || '').trim() === nhsoMainCode) ?? false)
                    : true;
                  const isHospsubMatch = nhsoSubCode 
                    ? (p.ipt_pttype_list?.some(ip => String(ip.hospsub || '').trim() === nhsoSubCode) ?? false)
                    : true;
                  const isHospMatch = isHospmainMatch && isHospsubMatch;

                  // ตรวจสอบ mismatch: ถ้าเช็คแล้ว และสิทธิ์ไม่ตรง หรือ รพ.หลัก/รอง ไม่ตรง
                  const isMismatch = p.is_mismatch !== undefined
                    ? p.is_mismatch
                    : (isCheckedWithNhso && (p.comparison ? p.comparison.is_mismatch : (!p.comparison?.is_rights_match || !isHospMatch)));

                  return (
                    <tr 
                      key={p.an} 
                      onClick={() => handleRowClick(p)}
                      className={`cursor-pointer transition-colors ${
                        isMismatch 
                          ? 'bg-red-50/90 hover:bg-red-100/90 border-b border-red-200' 
                          : isSelected 
                          ? 'bg-sky-50/60 hover:bg-sky-50/80' 
                          : 'hover:bg-sky-50/40'
                      }`}
                      title="คลิกเพื่อดูรายละเอียดสิทธิ์และเปรียบเทียบกับ สปสช. (API)"
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(p.an)}
                          className="rounded border-border text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* เวลา / VN / AN */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-semibold text-foreground">
                          {p.admit_date} <span className="text-muted-foreground font-normal">{p.admit_time}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          VN: {p.vn}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                          <span>AN: {p.an}</span>
                          <a
                            href={`/dcdetail/${p.an}?tab=documents`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-0.5 text-muted-foreground hover:text-blue-600 transition-colors inline-flex items-center"
                            title="เปิดในแท็บใหม่ (Discharge Detail)"
                          >
                            <ExternalLink className="w-2.5 h-2.5 opacity-60 hover:opacity-100" />
                          </a>
                        </div>
                      </td>

                      {/* HN / CID */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-bold text-foreground font-mono">
                          {p.hn}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                          <span>{formatCid(p.cid)}</span>
                          {p.cid && (
                            <button
                              onClick={(e) => handleCopyCid(p.cid, e)}
                              className="p-0.5 hover:text-foreground text-muted-foreground/70 rounded"
                              title="คัดลอกเลขบัตรประชาชน"
                            >
                              {copiedCid === p.cid ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* ชื่อ - สกุล */}
                      <td className="p-3">
                        <div 
                          className="font-medium text-foreground hover:text-blue-600 flex items-center gap-1"
                        >
                          <span>{p.ptname}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {p.age_y ? `${p.age_y} ปี` : '-'}
                        </div>
                      </td>

                      {/* หอผู้ป่วย */}
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                          {p.ward_name || '-'}
                        </span>
                      </td>

                      {/* ipt_pttype (แสดงทุกสิทธิ์: pttype, hospmain, hospsub, authen_code) */}
                      <td className={`p-3 ${isMismatch ? 'bg-red-50/40' : 'bg-sky-50/20'}`}>
                        {p.ipt_pttype_list && p.ipt_pttype_list.length > 0 ? (
                          <div className="space-y-1.5 min-w-[190px]">
                            {p.ipt_pttype_list.map((ip, idx) => {
                              const ipHospmain = String(ip.hospmain || '').trim();
                              const ipHospsub = String(ip.hospsub || '').trim();
                              const mainMatches = nhsoMainCode && ipHospmain === nhsoMainCode;
                              const subMatches = nhsoSubCode && ipHospsub === nhsoSubCode;

                              return (
                                <div key={idx} className="bg-white/90 p-2 rounded-lg border border-sky-100 shadow-2xs text-xs space-y-1">
                                  <div className="font-semibold text-slate-900 flex items-center justify-between gap-1">
                                    <div className="truncate">
                                      <span className="bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono font-bold mr-1 text-[11px]">
                                        {p.ipt_pttype_list.length > 1 ? `#${ip.pttype_number} ` : ''}{ip.pttype}
                                      </span>
                                      <span className="text-slate-700 text-[11px]">{ip.pttype_name}</span>
                                    </div>
                                  </div>
                                  <div className="text-[10px] text-slate-500 space-y-0.5">
                                    <div className="flex items-center gap-1">
                                      <span>รพ.หลัก: <strong className="font-mono text-slate-700">{ip.hospmain || '-'}</strong></span>
                                      {mainMatches && <span className="text-emerald-600 font-bold text-xs" title="รหัส รพ.หลัก ตรงกับ สปสช.">✓</span>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span>รพ.รอง: <strong className="font-mono text-slate-700">{ip.hospsub || '-'}</strong></span>
                                      {subMatches && <span className="text-emerald-600 font-bold text-xs" title="รหัส รพ.รอง ตรงกับ สปสช.">✓</span>}
                                    </div>
                                  </div>
                                  <div className="text-[10px] flex items-center gap-1 font-mono">
                                    <span className="text-muted-foreground">Auth:</span>
                                    <span className={`font-semibold ${ip.auth_code ? 'text-emerald-700 bg-emerald-50 px-1 rounded' : 'text-slate-400'}`}>
                                      {ip.auth_code || ip.claim_code || '-'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-700 min-w-[160px]">
                            <span className="bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded font-mono mr-1">
                              {p.ipt?.pttype || '-'}
                            </span>
                            <span className="text-[11px]">{p.ipt?.pttype_name || ''}</span>
                            <div className="text-[10px] text-slate-400 mt-1">Auth: -</div>
                          </div>
                        )}
                      </td>

                      {/* สิทธิ สปสช. (API) */}
                      <td className={`p-3 ${isMismatch ? 'bg-red-50/40' : 'bg-emerald-50/20'}`}>
                        {isCheckedWithNhso ? (
                          <div className="space-y-0.5 min-w-[170px]">
                            <div className="font-semibold text-emerald-900">
                              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-mono mr-1">
                                {p.nhso.maininscl_id || '-'}
                              </span>
                              <span>{p.nhso.subinscl_name || p.nhso.maininscl_name || '-'}</span>
                            </div>
                            {(p.nhso.hospmain_name || p.nhso.hospmain_code) && (
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <span>รพ.หลัก: {p.nhso.hospmain_code ? `${p.nhso.hospmain_code} ` : ''}{p.nhso.hospmain_name || ''}</span>
                                {isHospmainMatch && <span className="text-emerald-600 font-bold text-xs" title="รหัส รพ.หลัก ตรงกับ HOS">✓</span>}
                              </div>
                            )}
                            {(p.nhso.hospsub_name || p.nhso.hospsub_code) && (
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <span>รพ.รอง: {p.nhso.hospsub_code ? `${p.nhso.hospsub_code} ` : ''}{p.nhso.hospsub_name || ''}</span>
                                {isHospsubMatch && <span className="text-emerald-600 font-bold text-xs" title="รหัส รพ.รอง ตรงกับ HOS">✓</span>}
                              </div>
                            )}
                            <div className="text-[10px] flex items-center gap-1 font-mono">
                              <span className="text-muted-foreground">Auth:</span>
                              <span className={`font-semibold ${p.nhso.claim_code ? 'text-emerald-700 bg-emerald-50 px-1 rounded' : 'text-slate-400'}`}>
                                {p.nhso.claim_code || '-'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                            ยังไม่ได้เช็ค สปสช.
                          </Badge>
                        )}
                      </td>

                      {/* Authen Code (API) */}
                      <td className={`p-3 whitespace-nowrap ${isMismatch ? 'bg-red-50/40' : 'bg-emerald-50/30'}`}>
                        {p.nhso?.claim_code ? (
                          <div className="space-y-0.5">
                            <div className="font-mono font-bold text-emerald-700 text-xs flex items-center gap-1">
                              <span>{p.nhso.claim_code}</span>
                              <button
                                onClick={(e) => handleCopyCid(p.nhso.claim_code, e)}
                                className="p-0.5 hover:text-emerald-900 text-emerald-600 rounded"
                                title="คัดลอก Authen Code"
                              >
                                {copiedCid === p.nhso.claim_code ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        ) : isCheckedWithNhso ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                            ไม่มี Authen Code
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground italic">-</span>
                        )}
                      </td>

                      {/* ผู้บันทึก (Staff ดึงจาก ipt.staff) */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-mono font-bold text-foreground">
                          {p.ipt?.staff || p.primary_staff?.code || '-'}
                        </div>
                        {(p.ipt?.staff_name || p.primary_staff?.name) && (p.ipt?.staff_name || p.primary_staff?.name) !== '-' && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                            {p.ipt?.staff_name || p.primary_staff?.name}
                          </div>
                        )}
                      </td>

                      {/* การจัดการ (Actions) - ลบปุ่ม บันทึก hos ตามคำขอ */}
                      <td className="p-3 whitespace-nowrap text-center sticky right-0 bg-background/95 backdrop-blur-xs border-l border-border/40 shadow-xs" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Check NHSO button */}
                          <Button
                            size="sm"
                            variant={isCheckedWithNhso ? "outline" : "default"}
                            onClick={(e) => handleCheckSingle(p, e)}
                            disabled={isCheckingThis}
                            className={`h-7 px-2.5 text-xs font-medium rounded-lg ${
                              isCheckedWithNhso
                                ? 'text-slate-700 hover:text-slate-900 border-border'
                                : 'bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-xs'
                            }`}
                            title="ตรวจสอบสิทธิ์จาก NHSO SRM API"
                          >
                            <RefreshCw className={`w-3 h-3 mr-1 ${isCheckingThis ? 'animate-spin' : ''}`} />
                            {isCheckedWithNhso ? 'เช็คซ้ำ' : 'เช็ค สปสช.'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 3. Pagination Footer */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>แสดง {paginatedPatients.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} ถึง {Math.min(currentPage * pageSize, filteredPatients.length)} จากทั้งหมด {filteredPatients.length} ราย</span>
            <span className="text-muted-foreground/60">•</span>
            <span>แสดงหน้าละ:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-background border border-border rounded-lg px-2 py-1 text-xs"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1}
              className="h-8 px-2.5 text-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              ก่อนหน้า
            </Button>
            <span className="px-2 font-medium text-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="h-8 px-2.5 text-xs"
            >
              ถัดไป
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* 4. Patient Detail & Rights Comparison Modal (คลิกแต่ละแถว) */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-card w-full max-w-6xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-100 text-sky-700 rounded-xl">
                  <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base sm:text-lg flex items-center gap-2">
                    <span>รายละเอียดสิทธิการรักษา และเปรียบเทียบ สปสช. (API)</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    เปรียบเทียบสิทธิใน ipt_pttype กับระบบ สปสช. เพื่อบันทึก Authen Code เข้า HOSxP
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
              {detailLoading && !detailData ? (
                <div className="py-16 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-sky-600 animate-spin mx-auto" />
                  <p className="text-muted-foreground font-medium text-sm">กำลังโหลดข้อมูลสิทธิ์การรักษาและ API สปสช...</p>
                </div>
              ) : detailPatient ? (
                <>
                  {/* 1. Patient Information Banner */}
                  <div className="bg-muted/40 p-3.5 sm:p-4 rounded-xl border border-border flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
                        <span>{detailPatient.ptname}</span>
                        <span className="text-xs font-normal text-muted-foreground">({detailPatient.age_y ? `${detailPatient.age_y} ปี` : '-'})</span>
                      </div>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                        <span>HN: <strong className="font-mono text-foreground">{detailPatient.hn}</strong></span>
                        <span>AN: <strong className="font-mono text-foreground">{detailPatient.an}</strong></span>
                        <span>VN: <strong className="font-mono text-foreground">{detailPatient.vn}</strong></span>
                        <span>หอผู้ป่วย: <strong className="text-foreground">{detailPatient.ward_name}</strong></span>
                        <span>Admit: <strong className="text-foreground">{detailPatient.admit_date} {detailPatient.admit_time}</strong></span>
                      </div>
                    </div>
                    <div className="text-muted-foreground font-mono bg-background px-3 py-1.5 rounded-lg border border-border text-xs">
                      CID: <strong className="text-foreground">{formatCid(detailPatient.cid)}</strong>
                    </div>
                  </div>

                  {/* สิทธิ์หลัก และ ผู้บันทึก (กล่องเดียวกระชับ ประหยัดพื้นที่) */}
                  <div className="bg-sky-50/60 border border-sky-200/90 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-600 font-medium">สิทธิ์หลัก:</span>
                      <span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-mono font-bold">
                        {detailPatient.ipt?.pttype || detailData?.ipt?.pttype || '-'}
                      </span>
                      <span className="font-semibold text-slate-900 text-sm">
                        {detailPatient.ipt?.pttype_name || detailData?.ipt?.pttype_name || '-'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="font-medium">ผู้บันทึก:</span>
                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800 font-semibold shadow-2xs">
                        {detailPatient.ipt?.staff || detailData?.ipt?.staff || '-'}
                      </span>
                      <span className="text-slate-900 font-semibold">
                        {detailPatient.ipt?.staff_name || detailData?.ipt?.staff_name || '-'}
                      </span>
                    </div>
                  </div>

                  {/* ตารางเปรียบเทียบ pttype และ api สปสช */}
                  <div className="space-y-2.5">
                    <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-purple-600" />
                        <span>ตารางเปรียบเทียบสิทธิ pttype และ API สปสช.</span>
                      </div>
                      {detailData?.comparison?.has_api && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 text-[11px]">
                          ข้อมูลจาก API วันที่ {detailData.authen?.right_check_date || '-'}
                        </Badge>
                      )}
                    </div>

                    {detailData?.rows ? (
                      <div className="border border-border rounded-xl overflow-x-auto shadow-2xs bg-white">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-muted/60 text-muted-foreground border-b border-border font-semibold">
                            <tr>
                              <th className="p-2.5 whitespace-nowrap min-w-[130px]">แหล่งข้อมูล</th>
                              <th className="p-2.5 whitespace-nowrap min-w-[80px]">รหัสสิทธิ</th>
                              <th className="p-2.5 whitespace-nowrap min-w-[150px]">ชื่อสิทธิการรักษา</th>
                              <th className="p-2.5 whitespace-nowrap min-w-[100px]">เลขที่สิทธิ</th>
                              <th className="p-2.5 whitespace-nowrap min-w-[120px]">รพ.หลัก / รอง</th>
                              <th className="p-2.5 whitespace-nowrap min-w-[120px]">วันเริ่ม - หมดอายุ</th>
                              <th className="p-2.5 whitespace-nowrap min-w-[130px]">Authen Code</th>
                              <th className="p-2.5 whitespace-nowrap min-w-[100px]">ผู้บันทึก (staff)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {detailData.rows
                              .filter(r => r.source_name === 'ipt_pttype' || r.source_name === 'api')
                              .map((row, idx) => {
                                const isApi = row.source_name === 'api';
                                const isIptPttype = row.source_name === 'ipt_pttype';
                                return (
                                  <tr
                                    key={idx}
                                    className={`transition-colors ${
                                      isApi ? 'bg-purple-50/40 font-medium' : isIptPttype ? 'bg-sky-50/20' : ''
                                    }`}
                                  >
                                    <td className="p-2.5 whitespace-nowrap font-semibold">
                                      <span className={`px-2 py-0.5 rounded ${
                                        isApi 
                                          ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                                          : isIptPttype
                                          ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}>
                                        {row.source_label}
                                      </span>
                                    </td>
                                    <td className="p-2.5 whitespace-nowrap font-mono font-bold">
                                      <span className={isApi ? 'text-purple-700' : 'text-slate-900'}>
                                        {row.pttype}
                                      </span>
                                    </td>
                                    <td className="p-2.5 min-w-[150px]">{row.pttype_name}</td>
                                    <td className="p-2.5 whitespace-nowrap font-mono">{row.pttypeno}</td>
                                    <td className="p-2.5 whitespace-nowrap text-[11px] space-y-0.5">
                                      <div><span className="text-muted-foreground text-[10px]">หลัก:</span> <span className="font-mono font-semibold">{row.hospmain || '-'}</span> {row.hospmain_name && row.hospmain_name !== '-' ? <span className="text-muted-foreground text-[10px]">({row.hospmain_name})</span> : null}</div>
                                      <div><span className="text-muted-foreground text-[10px]">รอง:</span> <span className="font-mono">{row.hospsub || '-'}</span> {row.hospsub_name && row.hospsub_name !== '-' ? <span className="text-muted-foreground text-[10px]">({row.hospsub_name})</span> : null}</div>
                                    </td>
                                    <td className="p-2.5 whitespace-nowrap font-mono text-[11px]">
                                      {row.begin_date !== '-' || row.expire_date !== '-' 
                                        ? `${row.begin_date} - ${row.expire_date}` 
                                        : '-'}
                                    </td>
                                    <td className="p-2.5 whitespace-nowrap font-mono font-semibold">
                                      <span className={row.auth_code && row.auth_code !== '-' ? (isApi ? 'text-purple-700 select-all' : 'text-emerald-700 select-all') : 'text-slate-400'}>
                                        {row.auth_code || row.claim_code || '-'}
                                      </span>
                                    </td>
                                    <td className="p-2.5 whitespace-nowrap">
                                      <span className="font-mono text-slate-700">{row.staff}</span>
                                      {row.staff_name && row.staff_name !== '-' && (
                                        <span className="text-[10px] text-muted-foreground block truncate max-w-[100px]">{row.staff_name}</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 bg-muted/30 rounded-xl text-center text-muted-foreground">
                        ยังไม่มีข้อมูลตารางเปรียบเทียบ
                      </div>
                    )}
                  </div>

                  {/* 4. บอกด้วยว่าสิทธิ์ตรงหรือไม่ตรง */}
                  <div className="pt-1">
                    {detailData?.comparison?.has_api ? (
                      detailData.comparison.is_match ? (
                        /* ตรงกัน (Match) */
                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                            <span className="font-bold text-sm sm:text-base text-emerald-900">
                              ✓ สิทธิ์ตรงกัน (Match)
                            </span>
                            <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0 border-0">
                              สิทธิ์ตรงกัน
                            </Badge>
                          </div>
                          <p className="text-xs text-emerald-800 pl-7">
                            สิทธิ์จาก สปสช. API (<strong className="font-mono">[{detailData.comparison.api_pttype}]</strong> {detailData.comparison.api_pttype_name}) ตรงกับตาราง ipt_pttype{' '}
                            {detailData.comparison.matched_row ? (
                              <>ลำดับที่ <strong className="font-mono">#{detailData.comparison.matched_row.number}</strong>: <strong className="font-mono">[{detailData.comparison.matched_row.pttype}]</strong> {detailData.comparison.matched_row.pttype_name}</>
                            ) : null}
                          </p>
                          <p className="text-[11px] text-emerald-700 pl-7 pt-0.5">
                            คุณสามารถกดปุ่ม <strong>"บันทึก HOS"</strong> ด้านล่างเพื่ออัปเดต Authen Code และข้อมูลสิทธิ์เข้าตาราง <code>ipt_pttype</code> เฉพาะแถวที่ตรงกันนี้ได้
                          </p>
                        </div>
                      ) : (
                        /* ไม่ตรงกัน (Mismatch) */
                        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                            <span className="font-bold text-sm sm:text-base text-rose-900">
                              ✗ สิทธิ์ไม่ตรงกัน (Mismatch)
                            </span>
                            <Badge className="bg-rose-600 text-white text-[10px] px-2 py-0 border-0">
                              ไม่ตรงกัน
                            </Badge>
                          </div>
                          <div className="text-xs text-rose-800 pl-7 space-y-1">
                            <div>
                              สิทธิ์ใน ipt_pttype ({detailData.comparison.ipt_pttypes?.length || 0} สิทธิ์):{' '}
                              {detailData.comparison.ipt_pttypes && detailData.comparison.ipt_pttypes.length > 0 ? (
                                detailData.comparison.ipt_pttypes.map((p, idx) => (
                                  <span key={idx} className="mr-2 inline-block">
                                    <span className="font-mono font-semibold bg-rose-100 px-1 py-0.2 rounded text-rose-900">
                                      #{p.number} [{p.pttype}]
                                    </span>{' '}
                                    {p.pttype_name}
                                  </span>
                                ))
                              ) : (
                                <strong className="font-mono">[{detailData.comparison.ipt_pttype}] {detailData.comparison.ipt_pttype_name}</strong>
                              )}
                            </div>
                            <div>
                              สปสช. API:{' '}
                              <strong className="font-mono text-purple-700">[{detailData.comparison.api_pttype}]</strong> ({detailData.comparison.api_pttype_name})
                            </div>
                            <p className="text-[11px] text-rose-700 pt-1">
                              * ปุ่มบันทึก HOS ถูกปิดการใช้งานเนื่องจากไม่มีสิทธิ์ใน <code>ipt_pttype</code> แถวใดที่ตรงกับสิทธิ์ สปสช. API
                            </p>
                          </div>
                        </div>
                      )
                    ) : (
                      /* ยังไม่ได้เช็ค API */
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <Info className="w-5 h-5 text-amber-600 shrink-0" />
                          <div>
                            <div className="font-bold text-sm text-amber-900">
                              ยังไม่ได้ตรวจสอบสิทธิ์กับ สปสช. (API)
                            </div>
                            <div className="text-xs text-amber-700 mt-0.5">
                              กรุณากดปุ่มเพื่อส่งคำขอตรวจสอบสิทธิ์และดึงข้อมูล Authen Code จากระบบ สปสช. อัตโนมัติ
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={handleCheckNhsoInModal}
                          disabled={detailLoading}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-xs self-start sm:self-center"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${detailLoading ? 'animate-spin' : ''}`} />
                          {detailLoading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบสิทธิ์ สปสช.'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Action Feedback Alerts */}
                  {detailActionError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{detailActionError}</span>
                    </div>
                  )}

                  {detailActionSuccess && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>{detailActionSuccess}</span>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-muted/30 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {detailData?.comparison?.is_match ? (
                  <span className="text-emerald-700 font-medium">
                    * สิทธิ์ตรงกัน: จะบันทึกเข้าแค่ตาราง <code>ipt_pttype</code> แถวที่ตรงกัน (ลำดับที่ #{detailData.comparison.matched_row?.number}) และคง staff เดิม
                  </span>
                ) : detailData?.comparison?.has_api ? (
                  <span className="text-rose-600">
                    * สิทธิ์ไม่ตรงกัน: ไม่สามารถบันทึกได้
                  </span>
                ) : (
                  <span>
                    * กรุณาตรวจสอบสิทธิ์กับ สปสช. ก่อนบันทึก
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDetailModalOpen(false)}
                  disabled={savingIptPttype}
                  className="cursor-pointer"
                >
                  ปิด
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveIptPttype}
                  disabled={
                    savingIptPttype || 
                    detailLoading || 
                    !detailData?.comparison?.is_match ||
                    !detailData?.comparison?.matched_row
                  }
                  className={`font-semibold shadow-xs cursor-pointer ${
                    detailData?.comparison?.is_match
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                  }`}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {savingIptPttype 
                    ? 'กำลังบันทึก...' 
                    : detailData?.comparison?.is_match
                    ? `บันทึก HOS (ipt_pttype #${detailData.comparison.matched_row.number})`
                    : 'บันทึก HOS'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
