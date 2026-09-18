import React, { useState, useEffect, Fragment } from 'react';
import { ChevronRight, Receipt } from 'lucide-react';
import api from '../../services/api';

export default function ReceiptsTab({ an }) {
  const [receipts, setReceipts] = useState([])
  const [expandedCode, setExpandedCode] = useState(null)
  const [receiptDetails, setReceiptDetails] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    fetchReceipts()
  }, [an])

  const fetchReceipts = async () => {
    setLoadingList(true)
    try {
      const res = await api.get(`/patients/${an}/receipts`)
      setReceipts(res.data)
    } catch (err) { console.error(err) }
    finally { setLoadingList(false) }
  }

  const handleToggle = async (finance_number) => {
    if (expandedCode === finance_number) {
      setExpandedCode(null)
      return
    }
    setExpandedCode(finance_number)
    setLoadingDetail(true)
    try {
      const res = await api.get(`/patients/${an}/receipts/${finance_number}`)
      setReceiptDetails(res.data)
    } catch (err) { console.error(err) }
    finally { setLoadingDetail(false) }
  }

  const formatMoney = (v) => v ? Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'
  const formatTime = (t) => {
    if (!t) return ''
    const d = new Date(t)
    return isNaN(d) ? String(t).substring(0, 5) : d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  }

  const grandTotalAmount = receipts.reduce((sum, r) => sum + Number(r.total_amount || 0), 0)
  const grandDiscount = receipts.reduce((sum, r) => sum + Number(r.discount || 0), 0)
  const grandBillAmount = receipts.reduce((sum, r) => sum + Number(r.bill_amount || 0), 0)

  return (
    <div className="w-full py-2">
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full text-base text-left">
          <thead className="bg-muted/50 text-muted-foreground text-sm uppercase font-medium">
            <tr>
              <th className="px-4 py-3">วันที่/เวลา</th>
              <th className="px-4 py-3">Finance No.</th>
              <th className="px-4 py-3">เลขที่ใบเสร็จ</th>
              <th className="px-4 py-3 text-right">ยอดทั้งหมด</th>
              <th className="px-4 py-3 text-right">ส่วนลด</th>
              <th className="px-4 py-3 text-right">ยอดชำระ</th>
              <th className="px-4 py-3">สิทธิ์การรักษา</th>
              <th className="px-4 py-3">ผู้ออกใบเสร็จ</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loadingList ? (
              <tr><td colSpan="9" className="text-center py-8 text-muted-foreground">กำลังโหลด...</td></tr>
            ) : receipts.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center py-8 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Receipt className="w-8 h-8 text-slate-300" />
                    <p>ไม่พบประวัติใบเสร็จรับเงิน</p>
                  </div>
                </td>
              </tr>
            ) : (
              <>
                {receipts.map(r => (
                  <Fragment key={r.finance_number}>
                    <tr
                      onClick={() => handleToggle(r.finance_number)}
                      className={`border-t border-border cursor-pointer transition-colors hover:bg-muted/30 ${expandedCode === r.finance_number ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(r.bill_date_time)} {formatTime(r.bill_date_time)} น.
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-500">{r.finance_number}</td>
                      <td className="px-4 py-3 font-mono text-sm font-medium text-blue-600">{r.rcpno || '-'}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(r.bill_amount)}</td>
                      <td className={`px-4 py-3 text-right ${Number(r.discount) > 0 ? 'text-green-600' : ''}`}>
                        {formatMoney(r.discount)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatMoney(r.total_amount)}</td>
                      <td className="px-4 py-3 text-sm">{r.pttype_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{r.staff_name || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expandedCode === r.finance_number ? 'rotate-90' : ''}`} />
                      </td>
                    </tr>
                    {expandedCode === r.finance_number && (
                      <tr>
                        <td colSpan="9" className="p-0">
                          <div className="bg-slate-50 border-y border-border px-6 py-3">
                            {loadingDetail ? (
                              <div className="text-center text-muted-foreground text-xs py-4">กำลังโหลด...</div>
                            ) : receiptDetails.length === 0 ? (
                              <div className="text-center text-muted-foreground text-xs py-4">ไม่พบรายการย่อย</div>
                            ) : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-muted-foreground border-b border-slate-200">
                                    <th className="px-2 py-1.5 text-left">รหัสหมวด</th>
                                    <th className="px-2 py-1.5 text-left">ชื่อรายการ</th>
                                    <th className="px-2 py-1.5 text-center">สถานะ</th>
                                    <th className="px-2 py-1.5 text-right">จำนวนเงิน</th>
                                    <th className="px-2 py-1.5 text-right">ส่วนลด</th>
                                    <th className="px-2 py-1.5 text-right">รวมเงิน</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {receiptDetails.map((d, idx) => (
                                    <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-100/50">
                                      <td className="px-2 py-2 font-mono text-slate-500">{d.incomecode}</td>
                                      <td className="px-2 py-2 font-medium">{d.income_name || '-'}</td>
                                      <td className="px-2 py-2 text-center text-slate-500">{d.paidst || '-'}</td>
                                      <td className="px-2 py-2 text-right">{formatMoney(d.amount)}</td>
                                      <td className="px-2 py-2 text-right text-green-600">{formatMoney(d.discount)}</td>
                                      <td className="px-2 py-2 text-right font-medium">{formatMoney(d.total_amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {/* Grand Total */}
                <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                  <td colSpan="6" className="px-4 py-3 text-right text-blue-600">
                    ชำระแล้ว {formatMoney(grandTotalAmount)} บาท
                  </td>
                  <td colSpan="3"></td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
