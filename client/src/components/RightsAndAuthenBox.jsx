import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  CreditCard,
  KeyRound,
  Building2,
  Calendar,
  Phone,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import api from '../services/api';
import { Badge } from './ui/badge';

export default function RightsAndAuthenBox({ an, patient }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingApi, setCheckingApi] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const targetAn = an || patient?.an;

  const fetchSummary = useCallback(async (showLoading = true) => {
    if (!targetAn) return;
    if (showLoading) setLoading(true);
    setError('');
    try {
      const res = await api.get(`/nhso-authen/rights-summary/${targetAn}`);
      setData(res.data);
    } catch (err) {
      console.error('Fetch rights summary error:', err);
      setError(err.response?.data?.error || err.message || 'ไม่สามารถโหลดข้อมูลสิทธิ์และ Authen ได้');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [targetAn]);

  useEffect(() => {
    fetchSummary(true);
  }, [fetchSummary]);

  const handleCheckNhso = async () => {
    if (!data?.vn && !patient?.vn) return;
    const vn = data?.vn || patient?.vn;
    const cid = data?.cid || patient?.cid;
    const admitDate = data?.admit_date || patient?.regdate;

    setCheckingApi(true);
    try {
      await api.post('/nhso-authen/check', {
        vn,
        an: targetAn,
        cid,
        admit_date: admitDate,
        force: true
      });
      // Refresh summary after check
      await fetchSummary(false);
    } catch (err) {
      console.error('Check NHSO API error:', err);
      alert(err.response?.data?.error || 'ตรวจสอบสิทธิ์ สปสช. ล้มเหลว: ' + err.message);
    } finally {
      setCheckingApi(false);
    }
  };

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const formatThDate = (dateStr) => {
    if (!dateStr || dateStr === '-') return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatThDateTime = (dateStr) => {
    if (!dateStr || dateStr === '-') return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return `${d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;
    } catch {
      return dateStr;
    }
  };

  if (!targetAn) return null;

  return (
    <div className="w-full space-y-5 mb-2">
      {/* ======================================================== */}
      {/* กล่องที่ 1: สิทธิ์การรักษา */}
      {/* ======================================================== */}
      <div className="bg-card shadow-sm border border-border rounded-2xl overflow-hidden transition-all duration-200">
        <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        <div className="p-5 space-y-4">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base sm:text-lg flex items-center gap-2">
                  <span>1. สิทธิ์การรักษา</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  เปรียบเทียบข้อมูลสิทธิจาก: ovst • visit_pttype • ipt • ipt_pttype • สปสช. (API)
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={handleCheckNhso}
                disabled={checkingApi || loading}
                className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-sm transition-all disabled:opacity-50"
                title="กดเพื่อส่งคำขอตรวจสอบสิทธิ์ไปยัง สปสช. API"
              >
                <Sparkles className={`w-3.5 h-3.5 ${checkingApi ? 'animate-spin' : ''}`} />
                <span>{checkingApi ? 'กำลังเช็ค สปสช...' : 'เช็ค สปสช. (API)'}</span>
              </button>

              <button
                type="button"
                onClick={() => fetchSummary(true)}
                disabled={loading}
                className="cursor-pointer p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-border"
                title="รีเฟรชข้อมูล"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table Container (Transposed: Rows = Attributes, Columns = Sources) */}
          {loading && !data ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">กำลังโหลดตารางสิทธิ์การรักษา...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-xl border border-border/80 shadow-inner bg-slate-50/50">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/90 text-slate-700 font-semibold border-b border-border select-none">
                      {/* Left Header Column */}
                      <th className="py-3 px-3.5 whitespace-nowrap min-w-[130px] bg-slate-100 sticky left-0 z-20 border-r border-border/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                        หัวข้อ / รายการ
                      </th>
                      {/* Source Columns */}
                      {data?.rows?.map((col, idx) => {
                        const isApi = col.source_name === 'api';
                        const isIpt = col.source_name === 'ipt';

                        return (
                          <th
                            key={col.source_key || idx}
                            className={`py-3 px-3.5 whitespace-nowrap min-w-[155px] text-center ${
                              isApi
                                ? 'bg-purple-100/70 border-b border-purple-200'
                                : isIpt
                                ? 'bg-emerald-100/60 border-b border-emerald-200'
                                : 'border-b border-border'
                            }`}
                          >
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border shadow-xs ${
                                col.source_name === 'ovst'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : col.source_name === 'visit_pttype'
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : col.source_name === 'ipt'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-200/60'
                                  : col.source_name === 'ipt_pttype'
                                  ? 'bg-teal-50 text-teal-700 border-teal-200'
                                  : 'bg-purple-100 text-purple-800 border-purple-300 ring-1 ring-purple-200/60'
                              }`}
                            >
                              {col.source_label}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 bg-white">
                    {/* 1. pttype */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3.5 whitespace-nowrap bg-slate-50/95 sticky left-0 z-10 border-r border-border/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-800 text-xs">pttype</span>
                          <span className="text-[11px] text-muted-foreground font-normal">รหัส/ชื่อสิทธิ์</span>
                        </div>
                      </td>
                      {data?.rows?.map((col, idx) => {
                        const isApi = col.source_name === 'api';
                        const isIpt = col.source_name === 'ipt';
                        return (
                          <td
                            key={col.source_key || idx}
                            className={`py-2.5 px-3.5 ${
                              isApi ? 'bg-purple-50/20' : isIpt ? 'bg-emerald-50/15' : ''
                            }`}
                          >
                            <div className="flex flex-col items-center text-center">
                              <span className="font-mono font-bold text-slate-800 text-sm">
                                {col.pttype !== '-' ? col.pttype : '-'}
                              </span>
                              {col.pttype_name && col.pttype_name !== '-' && (
                                <span className="text-[11px] text-slate-600 mt-0.5 leading-tight max-w-[210px]">
                                  {col.pttype_name}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* 2. pttypeno */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3.5 whitespace-nowrap bg-slate-50/95 sticky left-0 z-10 border-r border-border/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-800 text-xs">pttypeno</span>
                          <span className="text-[11px] text-muted-foreground font-normal">เลขที่สิทธิ์</span>
                        </div>
                      </td>
                      {data?.rows?.map((col, idx) => {
                        const isApi = col.source_name === 'api';
                        const isIpt = col.source_name === 'ipt';
                        return (
                          <td
                            key={col.source_key || idx}
                            className={`py-2.5 px-3.5 ${
                              isApi ? 'bg-purple-50/20' : isIpt ? 'bg-emerald-50/15' : ''
                            }`}
                          >
                            <span className="font-mono text-slate-700 text-center block select-all">
                              {col.pttypeno || '-'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* 3. hospmain */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3.5 whitespace-nowrap bg-slate-50/95 sticky left-0 z-10 border-r border-border/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-800 text-xs">hospmain</span>
                          <span className="text-[11px] text-muted-foreground font-normal">สถานพยาบาลหลัก</span>
                        </div>
                      </td>
                      {data?.rows?.map((col, idx) => {
                        const isApi = col.source_name === 'api';
                        const isIpt = col.source_name === 'ipt';
                        return (
                          <td
                            key={col.source_key || idx}
                            className={`py-2.5 px-3.5 ${
                              isApi ? 'bg-purple-50/20' : isIpt ? 'bg-emerald-50/15' : ''
                            }`}
                          >
                            <div className="flex flex-col items-center text-center">
                              <span className="font-mono font-semibold text-slate-700">
                                {col.hospmain || '-'}
                              </span>
                              {col.hospmain_name && col.hospmain_name !== '-' && (
                                <span className="text-[11px] text-slate-500 mt-0.5 leading-tight max-w-[210px]" title={col.hospmain_name}>
                                  {col.hospmain_name}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* 4. hospsub */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3.5 whitespace-nowrap bg-slate-50/95 sticky left-0 z-10 border-r border-border/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-800 text-xs">hospsub</span>
                          <span className="text-[11px] text-muted-foreground font-normal">สถานพยาบาลรอง</span>
                        </div>
                      </td>
                      {data?.rows?.map((col, idx) => {
                        const isApi = col.source_name === 'api';
                        const isIpt = col.source_name === 'ipt';
                        return (
                          <td
                            key={col.source_key || idx}
                            className={`py-2.5 px-3.5 ${
                              isApi ? 'bg-purple-50/20' : isIpt ? 'bg-emerald-50/15' : ''
                            }`}
                          >
                            <div className="flex flex-col items-center text-center">
                              <span className="font-mono font-semibold text-slate-700">
                                {col.hospsub || '-'}
                              </span>
                              {col.hospsub_name && col.hospsub_name !== '-' && (
                                <span className="text-[11px] text-slate-500 mt-0.5 leading-tight max-w-[210px]" title={col.hospsub_name}>
                                  {col.hospsub_name}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* 5. begin_date */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3.5 whitespace-nowrap bg-slate-50/95 sticky left-0 z-10 border-r border-border/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-800 text-xs">begin_date</span>
                          <span className="text-[11px] text-muted-foreground font-normal">วันเริ่มใช้สิทธิ์</span>
                        </div>
                      </td>
                      {data?.rows?.map((col, idx) => {
                        const isApi = col.source_name === 'api';
                        const isIpt = col.source_name === 'ipt';
                        return (
                          <td
                            key={col.source_key || idx}
                            className={`py-2.5 px-3.5 ${
                              isApi ? 'bg-purple-50/20' : isIpt ? 'bg-emerald-50/15' : ''
                            }`}
                          >
                            <span className="font-mono text-slate-600 text-center block whitespace-nowrap">
                              {formatThDate(col.begin_date)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* 6. expire_date */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3.5 whitespace-nowrap bg-slate-50/95 sticky left-0 z-10 border-r border-border/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-800 text-xs">expire_date</span>
                          <span className="text-[11px] text-muted-foreground font-normal">วันหมดอายุสิทธิ์</span>
                        </div>
                      </td>
                      {data?.rows?.map((col, idx) => {
                        const isApi = col.source_name === 'api';
                        const isIpt = col.source_name === 'ipt';
                        return (
                          <td
                            key={col.source_key || idx}
                            className={`py-2.5 px-3.5 ${
                              isApi ? 'bg-purple-50/20' : isIpt ? 'bg-emerald-50/15' : ''
                            }`}
                          >
                            <span className="font-mono text-slate-600 text-center block whitespace-nowrap">
                              {formatThDate(col.expire_date)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* 7. auth_code */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3.5 whitespace-nowrap bg-slate-50/95 sticky left-0 z-10 border-r border-border/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-800 text-xs">auth_code</span>
                          <span className="text-[11px] text-muted-foreground font-normal">รหัสอนุมัติ (Auth / Claim Code)</span>
                        </div>
                      </td>
                      {data?.rows?.map((col, idx) => {
                        const isApi = col.source_name === 'api';
                        const isIpt = col.source_name === 'ipt';
                        const hasCode = col.auth_code && col.auth_code !== '-';
                        return (
                          <td
                            key={col.source_key || idx}
                            className={`py-2.5 px-3.5 ${
                              isApi ? 'bg-purple-50/20' : isIpt ? 'bg-emerald-50/15' : ''
                            }`}
                          >
                            <span className={`font-mono text-center block ${
                              hasCode ? (isApi ? 'font-semibold text-purple-700 select-all' : 'font-semibold text-emerald-700 select-all') : 'text-slate-600'
                            }`}>
                              {col.auth_code || '-'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* 8. claim_code */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3.5 whitespace-nowrap bg-slate-50/95 sticky left-0 z-10 border-r border-border/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-800 text-xs">claim_code</span>
                          <span className="text-[11px] text-muted-foreground font-normal">รหัสเคลม (Auth / Claim Code)</span>
                        </div>
                      </td>
                      {data?.rows?.map((col, idx) => {
                        const isApi = col.source_name === 'api';
                        const isIpt = col.source_name === 'ipt';
                        const hasCode = col.claim_code && col.claim_code !== '-';
                        return (
                          <td
                            key={col.source_key || idx}
                            className={`py-2.5 px-3.5 ${
                              isApi ? 'bg-purple-50/20 font-bold' : isIpt ? 'bg-emerald-50/15' : ''
                            }`}
                          >
                            <span className={`font-mono text-center block ${
                              hasCode ? 'font-semibold text-purple-700 select-all' : 'text-slate-600'
                            }`}>
                              {col.claim_code || '-'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* 9. staff */}
                    <tr className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3.5 whitespace-nowrap bg-slate-50/95 sticky left-0 z-10 border-r border-border/60 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-800 text-xs">staff</span>
                          <span className="text-[11px] text-muted-foreground font-normal">ผู้บันทึก</span>
                        </div>
                      </td>
                      {data?.rows?.map((col, idx) => {
                        const isApi = col.source_name === 'api';
                        const isIpt = col.source_name === 'ipt';
                        return (
                          <td
                            key={col.source_key || idx}
                            className={`py-2.5 px-3.5 ${
                              isApi ? 'bg-purple-50/20' : isIpt ? 'bg-emerald-50/15' : ''
                            }`}
                          >
                            <div className="flex flex-col items-center text-center">
                              <span className="font-mono text-slate-700">
                                {col.staff || '-'}
                              </span>
                              {col.staff_name && col.staff_name !== '-' && (
                                <span className="text-[11px] text-slate-500 mt-0.5 leading-tight max-w-[190px]">
                                  {col.staff_name}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* สรุปด้านล่างตาราง: สิทธิ์ใน ipt_pttype ตรงกับ api ไหม */}
              {data?.comparison && (
                <div className="pt-1">
                  {data.comparison.has_api ? (
                    data.comparison.is_match ? (
                      /* ตรงกัน (Match) */
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 gap-2">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <div>
                            <div className="font-bold text-xs sm:text-sm text-emerald-900 flex items-center gap-1.5">
                              <span>✓ สิทธิ์ใน ipt_pttype ตรงกับ สปสช. (API)</span>
                              <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0 border-0">
                                ตรงกัน (Match)
                              </Badge>
                            </div>
                            <div className="text-xs text-emerald-700 mt-0.5">
                              {data.comparison.matched_row ? (
                                <>
                                  ตรงกับสิทธิ์ลำดับที่ <strong className="font-mono">#{data.comparison.matched_row.number}</strong>:{' '}
                                  <strong className="font-mono">[{data.comparison.matched_row.pttype}]</strong> {data.comparison.matched_row.pttype_name}
                                </>
                              ) : (
                                <>
                                  สิทธิ์ตรงกัน: <strong className="font-mono">[{data.comparison.api_pttype}]</strong> {data.comparison.api_pttype_name}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-[11px] text-emerald-600 self-end sm:self-center font-mono">
                          API Checked ✓
                        </div>
                      </div>
                    ) : (
                      /* ไม่ตรงกัน (Mismatch) */
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 gap-2">
                        <div className="flex items-center gap-2.5">
                          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                          <div>
                            <div className="font-bold text-xs sm:text-sm text-rose-900 flex items-center gap-1.5">
                              <span>✗ สิทธิ์ใน ipt_pttype ไม่ตรงกับ สปสช. (API)</span>
                              <Badge className="bg-rose-600 text-white text-[10px] px-2 py-0 border-0">
                                ไม่ตรงกัน (Mismatch)
                              </Badge>
                            </div>
                            <div className="text-xs text-rose-700 mt-0.5 space-y-1">
                              <div>
                                ipt_pttype ({data.comparison.ipt_pttypes?.length || 0} สิทธิ์):{' '}
                                {data.comparison.ipt_pttypes && data.comparison.ipt_pttypes.length > 0 ? (
                                  data.comparison.ipt_pttypes.map((p, idx) => (
                                    <span key={idx} className="mr-2 inline-block">
                                      <span className="font-mono font-semibold bg-rose-100/90 px-1 py-0.2 rounded text-rose-900">
                                        #{p.number} [{p.pttype}]
                                      </span>{' '}
                                      {p.pttype_name}
                                    </span>
                                  ))
                                ) : (
                                  <strong className="font-mono">[{data.comparison.ipt_pttype}] {data.comparison.ipt_pttype_name}</strong>
                                )}
                              </div>
                              <div>
                                สปสช. API:{' '}
                                <strong className="font-mono text-purple-700">[{data.comparison.api_pttype}]</strong> ({data.comparison.api_pttype_name})
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleCheckNhso}
                          disabled={checkingApi}
                          className="cursor-pointer text-xs font-medium px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 transition-colors self-start sm:self-center"
                        >
                          ตรวจสอบอีกครั้ง
                        </button>
                      </div>
                    )
                  ) : (
                    /* ยังไม่ได้เช็ค API */
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-800 gap-2">
                      <div className="flex items-center gap-2.5">
                        <Info className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                          <div className="font-semibold text-xs sm:text-sm text-amber-900">
                            ยังไม่มีข้อมูลการตรวจสอบสิทธิ์ สปสช. (API)
                          </div>
                          <div className="text-xs text-amber-700 mt-0.5">
                            กรุณากดปุ่มเพื่อส่งคำขอตรวจสอบสิทธิ์และดึงข้อมูลจากระบบ สปสช. อัตโนมัติ
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCheckNhso}
                        disabled={checkingApi}
                        className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm transition-all self-start sm:self-center"
                      >
                        {checkingApi ? 'กำลังเช็ค...' : 'เช็ค สปสช. ทันที'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* กล่องที่ 2: Authen (แสดงรายละเอียดของ authen code) */}
      {/* ======================================================== */}
      <div className="bg-card shadow-sm border border-border rounded-2xl overflow-hidden transition-all duration-200">
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
        <div className="p-5 space-y-4">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base sm:text-lg flex items-center gap-2">
                  <span>2. Authen</span>
                  {data?.authen?.has_authen ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs px-2.5 py-0.5">
                      ✓ ยืนยันแล้ว
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-500 text-xs px-2.5 py-0.5">
                      ยังไม่มี Authen Code
                    </Badge>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  รายละเอียดของ Authen Code และข้อมูลการยืนยันตัวตน สปสช.
                </p>
              </div>
            </div>

            {data?.authen?.has_authen && (
              <button
                type="button"
                onClick={() => handleCopy(data.authen.claim_code)}
                className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-700 text-xs font-semibold transition-colors"
                title="คัดลอกรหัส Authen"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>คัดลอกแล้ว</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>คัดลอก Authen Code</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Authen Content */}
          {loading && !data ? (
            <div className="py-8 flex justify-center text-muted-foreground text-xs">
              กำลังโหลดข้อมูล Authen...
            </div>
          ) : data?.authen?.has_authen ? (
            <div className="space-y-4">
              {/* Highlight Card: Claim Code */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50/70 via-teal-50/50 to-cyan-50/40 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-emerald-700 uppercase tracking-wider">
                    Authen Code (Claim Code)
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-extrabold text-2xl sm:text-3xl text-emerald-800 tracking-wider">
                      {data.authen.claim_code}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(data.authen.claim_code)}
                      className="cursor-pointer p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 rounded-md transition-colors"
                      title="คัดลอก"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:text-right">
                  {data.authen.trans_id && (
                    <div className="text-xs font-mono text-slate-500 bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-100">
                      Trans ID: <strong className="text-slate-700">{data.authen.trans_id}</strong>
                    </div>
                  )}
                  {data.authen.source_channel && (
                    <div className="text-xs font-mono text-slate-500 bg-white/80 px-2.5 py-1 rounded-lg border border-emerald-100">
                      Channel: <strong className="text-slate-700">{data.authen.source_channel}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Grid of Detailed Attributes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* 1. ประเภทบริการเคลม */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-border/70">
                  <div className="text-[11px] font-medium text-muted-foreground">ประเภทบริการเคลม (Claim Type)</div>
                  <div className="text-xs font-semibold text-slate-800 mt-1">
                    {data.authen.claim_type_name || '-'}
                  </div>
                  {data.authen.claim_type && (
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      ({data.authen.claim_type})
                    </div>
                  )}
                </div>

                {/* 2. วิธีการยืนยันตัวตน */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-border/70">
                  <div className="text-[11px] font-medium text-muted-foreground">วิธีการยืนยันตัวตน (Authen Method)</div>
                  <div className="text-xs font-semibold text-slate-800 mt-1">
                    {data.authen.claim_authen === 'SMC'
                      ? 'บัตรสมาร์ทการ์ด (Smart Card)'
                      : data.authen.claim_authen || '-'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                    {data.authen.source_channel || '-'}
                  </div>
                </div>

                {/* 3. วันเวลาที่ขอ Authen */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-border/70">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>วันเวลาที่ขอ Authen</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-800 mt-1 font-mono">
                    {formatThDateTime(data.authen.create_date || data.authen.received_datetime)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Admit: {formatThDate(data.admit_date)} {data.admit_time || ''}
                  </div>
                </div>

                {/* 4. หน่วยบริการที่ขอ Authen */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-border/70">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span>หน่วยบริการที่ทำรายการ Authen</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-800 mt-1 truncate" title={data.authen.authen_hname}>
                    {data.authen.authen_hname || '-'}
                  </div>
                  {data.authen.authen_hcode && (
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      รหัสสถานพยาบาล: {data.authen.authen_hcode}
                    </div>
                  )}
                </div>

                {/* 5. สิทธิหลัก สปสช. & เลขบัตร */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-border/70">
                  <div className="text-[11px] font-medium text-muted-foreground">สิทธิหลัก สปสช. (Main Inscl)</div>
                  <div className="text-xs font-semibold text-slate-800 mt-1">
                    {data.authen.maininscl_name || '-'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                    เลขบัตร: {data.authen.card_id || '-'}
                  </div>
                </div>

                {/* 6. เบอร์โทรศัพท์ & วันตรวจสอบสิทธิ์ */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-border/70">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>เบอร์โทรศัพท์ผู้รับบริการ</span>
                  </div>
                  <div className="text-xs font-semibold font-mono text-slate-800 mt-1">
                    {data.authen.tel || '-'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    ตรวจสิทธิ์: {formatThDateTime(data.authen.right_check_date)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* เมื่อยังไม่มี Authen Code */
            <div className="p-5 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
                <KeyRound className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-slate-700 text-sm">
                  ยังไม่พบข้อมูล Authen Code ของการ Admit นี้
                </div>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  สามารถกดปุ่ม "เช็ค สปสช. (API)" ด้านบน เพื่อดึงข้อมูลการขอ Authen Code ในวันที่ Admit ({formatThDate(data?.admit_date || patient?.regdate)}) จากระบบ สปสช.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCheckNhso}
                disabled={checkingApi}
                className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-semibold shadow-sm transition-all"
              >
                <Sparkles className={`w-3.5 h-3.5 ${checkingApi ? 'animate-spin' : ''}`} />
                <span>{checkingApi ? 'กำลังค้นหา Authen Code...' : 'ค้นหา Authen Code (สปสช.)'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
