import React, { useState, useEffect } from 'react';
import { Hotel, Eye, CheckCircle2, Clock, X } from 'lucide-react';
import api from '../services/api';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

export default function BenefitCertificateBox({ an, certificate = null, className = '' }) {
  const [benefitCert, setBenefitCert] = useState(certificate);
  const [loading, setLoading] = useState(!certificate);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  useEffect(() => {
    if (certificate) {
      setBenefitCert(certificate);
      setLoading(false);
      return;
    }

    if (!an) {
      setBenefitCert(null);
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
  }, [an, certificate]);

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })} เวลา ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;
    } catch {
      return dateStr;
    }
  };

  if (loading || !benefitCert) return null;

  return (
    <>
      {/* กล่อง หนังสือรับรองสวัสดิการค่าห้องพิเศษ */}
      <div className={`bg-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col h-full ${className}`}>
        <div className="h-1.5 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500" />

        {/* Header */}
        <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-base flex items-center gap-2 text-slate-800">
              <Hotel className="w-5 h-5 text-sky-500 shrink-0" />
              <span className="truncate">หนังสือรับรองสวัสดิการค่าห้องพิเศษ</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              รหัสคำร้อง: {benefitCert.request_code || '-'}
            </p>
          </div>
          <Badge
            className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border shrink-0 ${
              benefitCert.status_text === 'อนุมัติ'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : 'bg-amber-100 text-amber-800 border-amber-200'
            }`}
          >
            {benefitCert.status_text}
          </Badge>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 flex-1 text-sm bg-slate-50/20 flex flex-col justify-between">
          <div className="space-y-3">
            {/* 1. ข้อมูลผู้ป่วย */}
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ข้อมูลผู้ป่วย</span>
              <div className="flex items-center justify-between gap-2">
                <strong className="text-slate-800 dark:text-slate-100 font-semibold truncate">{benefitCert.patient_name || '-'}</strong>
                <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 shrink-0">
                  {benefitCert.relationship || '-'}
                </span>
              </div>
              {benefitCert.ward_room && (
                <div className="text-xs text-slate-500 truncate" title={benefitCert.ward_room}>
                  ห้อง: <span className="font-medium text-slate-700 dark:text-slate-300">{benefitCert.ward_room}</span>
                </div>
              )}
            </div>

            {/* 2. ข้อมูลผู้ยื่นคำร้อง */}
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ผู้ยื่นคำร้อง</span>
              <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{benefitCert.requester_name || '-'}</div>
              <div className="text-xs text-slate-500 truncate">
                {benefitCert.requester_position || '-'} {benefitCert.requester_department ? `• ${benefitCert.requester_department}` : ''}
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>ยื่นเมื่อ: {formatDateTime(benefitCert.request_date)}</span>
              </div>
            </div>

            {/* 3. ข้อมูลการอนุมัติ */}
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ข้อมูลการอนุมัติ</span>
              <div className="flex items-center justify-between gap-2">
                <strong className="text-slate-800 dark:text-slate-100 font-semibold truncate">{benefitCert.approver_name || '-'}</strong>
                <span className="text-emerald-700 dark:text-emerald-400 text-xs font-bold shrink-0">{benefitCert.status_text}</span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>อนุมัติเมื่อ: {formatDateTime(benefitCert.approve_date)}</span>
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsCertModalOpen(true)}
              className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 text-sky-700 dark:text-sky-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95 shadow-2xs"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>ดูรายละเอียดฉบับเต็ม</span>
            </button>
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
                  <p className="text-xs text-sky-100 mt-0.5 font-mono">
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

          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
            {/* Status Banner */}
            <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
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
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100 dark:border-slate-800">
                ข้อมูลผู้ป่วย
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-slate-400 block">ชื่อผู้ป่วย</span>
                  <strong className="text-slate-800 dark:text-slate-100 font-semibold">{benefitCert.patient_name || '-'}</strong>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">เกี่ยวข้องเป็น</span>
                  <span className="inline-block px-2 py-0.5 mt-0.5 text-xs font-semibold rounded bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                    {benefitCert.relationship || '-'}
                  </span>
                </div>
              </div>
              {benefitCert.ward_room && (
                <div className="pt-1 text-xs text-slate-500">
                  หอผู้ป่วย/ห้อง: <span className="font-medium text-slate-700 dark:text-slate-300">{benefitCert.ward_room}</span>
                </div>
              )}
            </div>

            {/* Requester Section */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100 dark:border-slate-800">
                ข้อมูลผู้ยื่นคำร้อง
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-slate-400 shrink-0">ผู้ยื่นคำร้อง:</span>
                  <strong className="text-slate-800 dark:text-slate-100 text-right">{benefitCert.requester_name || '-'}</strong>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-slate-400 shrink-0">ตำแหน่ง:</span>
                  <span className="text-slate-700 dark:text-slate-300 text-right">{benefitCert.requester_position || '-'}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-slate-400 shrink-0">แผนก:</span>
                  <span className="text-slate-700 dark:text-slate-300 text-right">{benefitCert.requester_department || '-'}</span>
                </div>
                <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 shrink-0 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    วันที่ยื่นคำร้อง:
                  </span>
                  <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 text-right">
                    {formatDateTime(benefitCert.request_date)}
                  </span>
                </div>
              </div>
            </div>

            {/* Approver Section */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100 dark:border-slate-800">
                ข้อมูลการอนุมัติ
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-slate-400 shrink-0">อนุมัติโดย:</span>
                  <strong className="text-slate-800 dark:text-slate-100 text-right">{benefitCert.approver_name || '-'}</strong>
                </div>
                <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 shrink-0 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    วันที่อนุมัติ:
                  </span>
                  <span className="text-xs font-mono font-medium text-emerald-700 dark:text-emerald-400 text-right">
                    {formatDateTime(benefitCert.approve_date)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end">
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
