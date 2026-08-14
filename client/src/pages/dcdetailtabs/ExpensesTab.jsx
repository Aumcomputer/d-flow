import React, { useState, useEffect, Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import api from '../../services/api';

export default function ExpensesTab({ an }) {
  const [categories, setCategories] = useState([])
  const [expandedCode, setExpandedCode] = useState(null)
  const [expenseDetails, setExpenseDetails] = useState([])
  const [loadingCats, setLoadingCats] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [an])

  const fetchCategories = async () => {
    setLoadingCats(true)
    try {
      const res = await api.get(`/patients/${an}/expenses`)
      setCategories(res.data)
    } catch (err) { console.error(err) }
    finally { setLoadingCats(false) }
  }

  const handleToggle = async (code) => {
    if (expandedCode === code) {
      setExpandedCode(null)
      return
    }
    setExpandedCode(code)
    setLoadingDetail(true)
    try {
      const res = await api.get(`/patients/${an}/expenses/${code}`)
      setExpenseDetails(res.data)
    } catch (err) { console.error(err) }
    finally { setLoadingDetail(false) }
  }

  const formatMoney = (v) => v ? Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'
  const formatTime = (t) => t ? String(t).substring(0, 5) : ''

  const grandTotal = categories.reduce((sum, c) => sum + Number(c.total || 0), 0)
  const grandPending = categories.reduce((sum, c) => sum + Number(c.pending || 0), 0)

  return (
    <div className="w-full py-2">
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full text-base">
          <thead className="bg-muted/50 text-muted-foreground text-sm uppercase font-medium">
            <tr>
              <th className="px-4 py-3 text-left w-20">CODE</th>
              <th className="px-4 py-3 text-left">ชื่อรายการ</th>
              <th className="px-4 py-3 text-right">จำนวนเงินรวม</th>
              <th className="px-4 py-3 text-right">ยอดชำระ</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loadingCats ? (
              <tr><td colSpan="5" className="text-center py-8 text-muted-foreground">กำลังโหลด...</td></tr>
            ) : categories.length === 0 ? (
              <tr><td colSpan="5" className="text-center py-8 text-muted-foreground">ไม่พบข้อมูล</td></tr>
            ) : (
              <>
                {categories.map(c => (
                  <Fragment key={c.code}>
                    <tr
                      onClick={() => handleToggle(c.code)}
                      className={`border-t border-border cursor-pointer transition-colors hover:bg-muted/30 ${expandedCode === c.code ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-3 font-mono text-sm">{c.code}</td>
                      <td className="px-4 py-3 font-medium">{c.name || '-'}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatMoney(c.total)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${Number(c.pending) > 0 ? 'text-red-600' : ''}`}>
                        {Number(c.pending) > 0 ? formatMoney(c.pending) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expandedCode === c.code ? 'rotate-90' : ''}`} />
                      </td>
                    </tr>
                    {expandedCode === c.code && (
                      <tr>
                        <td colSpan="5" className="p-0">
                          <div className="bg-slate-50 border-y border-border px-6 py-3">
                            {loadingDetail ? (
                              <div className="text-center text-muted-foreground text-xs py-4">กำลังโหลด...</div>
                            ) : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-muted-foreground">
                                    <th className="px-2 py-1.5 text-left">วันที่</th>
                                    <th className="px-2 py-1.5 text-left">เวลา</th>
                                    <th className="px-2 py-1.5 text-left">รหัส</th>
                                    <th className="px-2 py-1.5 text-left">ชื่อรายการ</th>
                                    <th className="px-2 py-1.5 text-left">ผู้บันทึก</th>
                                    <th className="px-2 py-1.5 text-center">สถานะ</th>
                                    <th className="px-2 py-1.5 text-right">จำนวน</th>
                                    <th className="px-2 py-1.5 text-right">ราคา/หน่วย</th>
                                    <th className="px-2 py-1.5 text-right">รวม</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {expenseDetails.map((d, idx) => (
                                    <tr key={idx} className={`border-t border-slate-200 ${['01', '03'].includes(d.paidst) ? 'bg-red-50 text-red-800' : ''}`}>
                                      <td className="px-2 py-1.5">{formatDate(d.rxdate)}</td>
                                      <td className="px-2 py-1.5">{formatTime(d.rxtime)}</td>
                                      <td className="px-2 py-1.5 font-mono">{d.icode}</td>
                                      <td className="px-2 py-1.5">{d.name || '-'}</td>
                                      <td className="px-2 py-1.5 text-muted-foreground">{d.entry_staff || '-'}</td>
                                      <td className="px-2 py-1.5 text-center font-medium">{d.paidst || '-'}</td>
                                      <td className="px-2 py-1.5 text-right">{d.qty}</td>
                                      <td className="px-2 py-1.5 text-right">{formatMoney(d.unitprice)}</td>
                                      <td className="px-2 py-1.5 text-right font-medium">{formatMoney(d.sum_price)}</td>
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
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3">รวมทั้งหมด</td>
                  <td className="px-4 py-3 text-right">{formatMoney(grandTotal)}</td>
                  <td className={`px-4 py-3 text-right ${grandPending > 0 ? 'text-red-600' : ''}`}>
                    {grandPending > 0 ? formatMoney(grandPending) : '-'}
                  </td>
                  <td></td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}