import React, { useState, useEffect } from 'react';
import { Save, Tag, Calculator, User } from 'lucide-react';
import api from '../../services/api';

export default function DiscountTab({ an, patient, details, fetchDetails }) {
  const [discountMoney, setDiscountMoney] = useState('');
  const [discountDetail, setDiscountDetail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (details) {
      setDiscountMoney(details.discount_money || '');
      setDiscountDetail(details.discount_detail || '');
    }
  }, [details]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await api.post(`/patients/${an}/discount`, {
        discount_money: discountMoney || null,
        discount_detail: discountDetail || null,
      });
      alert('บันทึกส่วนลดเรียบร้อยแล้ว');
      fetchDetails();
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถบันทึกส่วนลดได้');
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '0.00';
    return Number(val).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const paidMoney = Number(patient?.paid_money || 0);
  const rcptMoney = Number(patient?.rcpt_money || 0);
  const depositMoney = Number(patient?.total_deposit || 0);
  const discountAmount = Number(details?.discount_money || 0);

  const netPayable = paidMoney - rcptMoney - depositMoney - discountAmount;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4 w-full">
      {/* Left: Discount Form */}
      <div>
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <h3 className="font-bold text-base flex items-center gap-2 text-slate-800">
              <Tag className="w-5 h-5 text-indigo-500" />
              บันทึกส่วนลดพิเศษ
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">ระบุยอดเงินที่ต้องการลดและเหตุผล</p>
          </div>
          <form onSubmit={handleSave} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ส่วนลด จำนวน (บาท)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discountMoney}
                onChange={(e) => setDiscountMoney(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                รายละเอียดส่วนลด
              </label>
              <textarea
                rows="3"
                value={discountDetail}
                onChange={(e) => setDiscountDetail(e.target.value)}
                placeholder="เช่น ส่วนลดค่าเตียง 50% สำหรับสิทธิ์ข้าราชการ"
                className="w-full px-4 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
              />
            </div>
            {details?.discount_by_name && (
              <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <User className="w-4 h-4" />
                <span>บันทึกโดย: {details.discount_by_name}</span>
              </div>
            )}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right: Calculation Box */}
      <div>
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden sticky top-6">
          <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500" />
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <h3 className="font-bold text-base flex items-center gap-2 text-slate-800">
              <Calculator className="w-5 h-5 text-emerald-500" />
              สรุปการคิดค่าใช้จ่าย
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">ยอดสุทธิที่ผู้ป่วยต้องชำระ</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center text-slate-600">
              <span className="text-sm font-medium">ยอดชำระ (ตั้งต้น)</span>
              <span className="font-mono text-base">{formatMoney(paidMoney)}</span>
            </div>
            
            <div className="flex justify-between items-center text-emerald-600">
              <span className="text-sm font-medium">หัก ชำระแล้ว</span>
              <span className="font-mono text-base">- {formatMoney(rcptMoney)}</span>
            </div>

            <div className="flex justify-between items-center text-emerald-600">
              <span className="text-sm font-medium">หัก เงินมัดจำ</span>
              <span className="font-mono text-base">- {formatMoney(depositMoney)}</span>
            </div>

            <div className="flex justify-between items-start text-emerald-600 border-b border-slate-200 pb-4">
              <div className="flex flex-col">
                <span className="text-sm font-medium flex items-center gap-2">
                  หัก ส่วนลด
                  {discountAmount > 0 && <Tag className="w-3.5 h-3.5" />}
                </span>
                {details?.discount_detail && (
                  <span className="text-xs text-emerald-600/70 mt-0.5 max-w-[200px] truncate" title={details.discount_detail}>
                    ({details.discount_detail})
                  </span>
                )}
              </div>
              <span className="font-mono text-base">- {formatMoney(discountAmount)}</span>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-base font-bold text-slate-800">ยอดที่ต้องชำระ</span>
              <span className={`font-mono text-3xl font-bold ${netPayable > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {formatMoney(netPayable)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
