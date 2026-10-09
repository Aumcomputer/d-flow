import React, { useState, useEffect } from 'react';
import { Hotel, Eye, CheckCircle2, Clock, X } from 'lucide-react';
import api from '../services/api';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

export default function BenefitCertificateBox({ an, initialCert = null, className = '' }) {
  const [benefitCert, setBenefitCert] = useState(initialCert);
  const [loading, setLoading] = useState(!initialCert);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  useEffect(() => {
    if (!an) {
      setBenefitCert(null);
      setLoading(false);
      return;
    }

    if (initialCert) {
      setBenefitCert(initialCert);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    api.get(`/documents/${an}/benefit-certificate`)
      .then((res) => {
        if (!isMounted) return;
        if (res.data?.hasCertificate && res.data?.certificate) {
          setBenefitCert(res.data.certificate);
        } else {
          setBenefitCert(null);
        }
      })
      .catch((err) => {
        console.error('Fetch benefit certificate error:', err);
        if (isMounted) setBenefitCert(null);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [an, initialCert]);

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })} เวลา ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;
    } catch {
      return dateStr;
    }
  };

  // If loading or no certificate found, do not render box (same behavior as tab=documents)
  if (loading || !benefitCert) return null;

  return (
    <>
      {/* กล่อง หนังสือรับรองสวัสดิการค่าห้องพิเศษ */}
      <div
        onClick={() => setIsCertModalOpen(true)}
        className={`border border-sky-200 bg-gradient-to-r from-sky-50/70 via-blue-50/50 to-indigo-50/40 rounded-2xl p-4 sm:p-5 transition-all duration-200 hover:shadow-sm hover:border-sky-300 cursor-pointer group shadow-2xs ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-600 shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
              <Hotel className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-800 text-sm sm:text-base group-hover:text-sky-700 transition-colors">
                  หนังสือรับรองสวัสดิการค่าห้องพิเศษ
                </span>
                <Badge
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${
                    benefitCert.status_text === 'อนุมัติ'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border-amber-200'
                  }`}
                >
                  {benefitCert.status_text}
                </Badge>
                {benefitCert.request_code && (
                  <span className="text-xs font-mono text-slate-500 bg-white/70 px-2 py-0.5 rounded border border-slate-200">
                    {benefitCert.request_code}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                ผู้ยื่น: <strong className="text-slate-800">{benefitCert.requester_name || '-'}</strong>
                {benefitCert.relationship && (
                  <span className="ml-2 text-slate-500">
                    (เกี่ยวข้องเป็น: <strong className="text-sky-700">{benefitCert.relationship}</strong>)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCertModalOpen(true);
              }}
              className="cursor-pointer text-xs font-semibold bg-white hover:bg-sky-50 text-sky-700 px-3.5 py-1.5 rounded-xl transition-all inline-flex items-center gap-1.5 border border-sky-200 shadow-2xs hover:shadow-xs active:scale-95"
            >
              <Eye className="w-3.5 h-3.5" />
              ดูรายละเอียด
            </button>
          </div>
        </div>

        {/* Quick details section inside box */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 mt-3 border-t border-sky-100/90 text-xs">
          <div>
            <span className="text-slate-400 block text-2xs uppercase tracking-wider font-semibold">ผู้ยื่นคำร้อง</span>
            <div className="text-slate-800 font-medium truncate mt-0.5">{benefitCert.requester_name || '-'}</div>
            <div className="text-slate-500 text-2xs truncate">
              {benefitCert.requester_position || '-'} {benefitCert.requester_department ? `• ${benefitCert.requester_department}` : ''}
            </div>
          </div>
          <div>
            <span className="text-slate-400 block text-2xs uppercase tracking-wider font-semibold">ผู้ป่วย / ห้อง</span>
            <div className="text-slate-800 font-medium truncate mt-0.5">{benefitCert.patient_name || '-'}</div>
            <div className="text-slate-500 text-2xs truncate">
              {benefitCert.ward_room || '-'}
            </div>
          </div>
          <div>
            <span className="text-slate-400 block text-2xs uppercase tracking-wider font-semibold">การอนุมัติ</span>
            <div className="text-slate-800 font-medium truncate mt-0.5">{benefitCert.approver_name || '-'}</div>
            <div className="text-emerald-700 text-2xs font-medium">
              {formatDateTime(benefitCert.approve_date)}
            </div>
          </div>
        </div>
      </div>

      {/* Benefit Certificate Details Dialog (เหมือนใน tab=documents) */}
      <Dialog open={isCertModalOpen} onOpenChange={setIsCertModalOpen}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-2xl border-border">
          <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 p-5 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <Hotel className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-white tracking-wide">
                    หนังสือรับรองสวัสดิการค่าห้องพิเศษ
                  </DialogTitle>
                  <p className="text-xs text-sky-100 mt-0.5">
                    รหัสคำร้อง: {benefitCert?.request_code || '-'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCertModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto bg-slate-50/50">
            {/* Status Banner */}
            <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500">สถานะคำร้อง</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                  benefitCert.status_text === 'อนุมัติ'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{benefitCert.status_text}</span>
              </span>
            </div>

            {/* Patient and Relationship Section */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
                ข้อมูลผู้ป่วย
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-slate-400 block">ชื่อผู้ป่วย</span>
                  <strong className="text-slate-800 font-semibold">{benefitCert.patient_name || '-'}</strong>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">เกี่ยวข้องเป็น</span>
                  <span className="inline-block px-2 py-0.5 mt-0.5 text-xs font-semibold rounded bg-sky-50 text-sky-700 border border-sky-200">
                    {benefitCert.relationship || '-'}
                  </span>
                </div>
              </div>
              {benefitCert.ward_room && (
                <div className="pt-1 text-xs text-slate-500">
                  หอผู้ป่วย/ห้อง: <span className="font-medium text-slate-700">{benefitCert.ward_room}</span>
                </div>
              )}
            </div>

            {/* Requester Section */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
                ข้อมูลผู้ยื่นคำร้อง
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-slate-400 shrink-0">ผู้ยื่นคำร้อง:</span>
                  <strong className="text-slate-800 text-right">{benefitCert.requester_name || '-'}</strong>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-slate-400 shrink-0">ตำแหน่ง:</span>
                  <span className="text-slate-700 text-right">{benefitCert.requester_position || '-'}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-slate-400 shrink-0">แผนก:</span>
                  <span className="text-slate-700 text-right">{benefitCert.requester_department || '-'}</span>
                </div>
                <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-100">
                  <span className="text-xs text-slate-400 shrink-0 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    วันที่ยื่นคำร้อง:
                  </span>
                  <span className="text-xs font-mono font-medium text-slate-700 text-right">
                    {formatDateTime(benefitCert.request_date)}
                  </span>
                </div>
              </div>
            </div>

            {/* Approver Section */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
                ข้อมูลการอนุมัติ
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-slate-400 shrink-0">อนุมัติโดย:</span>
                  <strong className="text-slate-800 text-right">{benefitCert.approver_name || '-'}</strong>
                </div>
                <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-100">
                  <span className="text-xs text-slate-400 shrink-0 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    วันที่อนุมัติ:
                  </span>
                  <span className="text-xs font-mono font-medium text-emerald-700 text-right">
                    {formatDateTime(benefitCert.approve_date)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCertModalOpen(false)}
              className="text-xs px-4 py-2 cursor-pointer"
            >
              ปิดหน้าต่าง
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
