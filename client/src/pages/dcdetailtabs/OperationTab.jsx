import React, { useState, useEffect } from 'react';
import { Scissors, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import api from '../../services/api';

export default function OperationTab({ an, hn }) {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (an) {
      fetchOperations();
    }
  }, [an]);

  const fetchOperations = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/patients/${an}/operations`);
      setOperations(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenOpdCardScan = async () => {
    try {
      const res = await api.get(`/patients/${hn}/emrscan-url`);
      if (res.data && res.data.url) {
        window.open(res.data.url, '_blank');
      } else {
        alert('ไม่สามารถสร้างลิงก์สำหรับ OPD Card Scan ได้');
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อกับระบบ OPD Card Scan');
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    const date = d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
  };

  return (
    <div className="py-2">
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead className="bg-muted/50 text-muted-foreground text-sm uppercase font-medium">
              <tr>
                <th className="px-4 py-3 text-left w-40">เวลาผ่าตัด</th>
                <th className="px-4 py-3 text-left">วินิจฉัย</th>
                <th className="px-4 py-3 text-left">หัตถการ</th>
                <th className="px-4 py-3 text-left w-56">ศัลยแพทย์</th>
                <th className="px-4 py-3 text-center w-40">Operative Note</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="text-center py-8 text-muted-foreground">กำลังโหลด...</td></tr>
              ) : operations.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Scissors className="w-10 h-10 mb-3 opacity-20" />
                      <p>ไม่พบประวัติการผ่าตัด</p>
                    </div>
                  </td>
                </tr>
              ) : operations.map((op, idx) => {
                const opName = op.operative_procedure || op.title_opra || '-';
                const hasOpNote = !!op.operative_procedure;
                
                return (
                  <tr key={idx} className="border-t border-border transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-sm text-muted-foreground whitespace-nowrap">
                      <div className="text-slate-800">{formatDateTime(op.start_time)}</div>
                      <div className="mt-0.5">{op.end_time ? formatDateTime(op.end_time) : '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{op.post_diag || '-'}</td>
                    <td className="px-4 py-3 font-medium text-blue-700">{opName}</td>
                    <td className="px-4 py-3">{op.surgeon || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {hasOpNote ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" /> มี
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                          <AlertCircle className="w-3 h-3" /> ไม่พบ
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 px-3 py-3 bg-amber-50/50 border border-amber-200/60 rounded-lg flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 leading-relaxed">
            <strong>หมายเหตุ:</strong> ถ้าไม่มี Operative Note อาจหมายถึง ไม่ได้พิมพ์ Operative Note ผ่านระบบ Smart OR กรุณาตรวจสอบในระบบ OPD Card Scan
          </div>
        </div>
        <button 
          onClick={handleOpenOpdCardScan}
          className="shrink-0 px-4 py-2 bg-white border border-amber-300 rounded-md text-amber-700 font-medium hover:bg-amber-100 transition-colors shadow-sm text-sm"
        >
          เปิด OPD Card Scan
        </button>
      </div>
    </div>
  );
}