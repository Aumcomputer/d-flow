import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../services/api';

export default function LabTab({ an, isFilterActive }) {
  const [labs, setLabs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLabs()
  }, [an])

  const fetchLabs = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/patients/${an}/labs`)
      setLabs(res.data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'
  const formatTime = (t) => t ? String(t).substring(0, 5) : ''
  const formatMoney = (v) => v ? Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'

  const filteredLabs = isFilterActive ? labs.filter(l => !l.receive_date) : labs

  return (
    <div className="py-2">
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
              <tr>
                <th className="px-4 py-3 text-left">วันที่สั่ง</th>
                <th className="px-4 py-3 text-left">ชื่อ Lab / Form</th>
                <th className="px-4 py-3 text-left">แพทย์</th>
                <th className="px-4 py-3 text-left">รับ Specimen</th>
                <th className="px-4 py-3 text-left">รายงานผล</th>
                <th className="px-4 py-3 text-right">ราคา</th>
                <th className="px-4 py-3 text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="text-center py-8 text-muted-foreground">กำลังโหลด...</td></tr>
              ) : filteredLabs.length === 0 ? (
                <tr><td colSpan="7" className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล Lab</td></tr>
              ) : filteredLabs.map((l, idx) => {
                const isNoSpecimen = !l.receive_date
                const isUnconfirmed = l.confirm_report === 'N'
                return (
                  <tr key={idx} className={`border-t border-border transition-colors ${isNoSpecimen ? 'bg-red-50 text-red-800' : 'hover:bg-muted/30'}`}>
                    <td className="px-4 py-3">{formatDate(l.order_date)} {formatTime(l.order_time)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.form_name || '-'}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1" title={l.lab_names}>{l.lab_names}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{l.doctor_name || '-'}</td>
                    <td className="px-4 py-3">{l.receive_date ? `${formatDate(l.receive_date)} ${formatTime(l.receive_time)}` : '-'}</td>
                    <td className="px-4 py-3">{l.report_date ? `${formatDate(l.report_date)} ${formatTime(l.report_time)}` : '-'}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatMoney(l.total_price)}</td>
                    <td className="px-4 py-3 text-center">
                      {isUnconfirmed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                          <AlertCircle className="w-3 h-3" /> รอผล
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" /> ยืนยันแล้ว
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}