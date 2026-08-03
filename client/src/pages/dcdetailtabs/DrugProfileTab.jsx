import React, { useState, useEffect } from 'react';
import { Pill } from 'lucide-react';
import api from '../../services/api';

export default function DrugProfileTab({ an, isFilterActive }) {
  const [orders, setOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [drugItems, setDrugItems] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [an])

  const fetchOrders = async () => {
    setLoadingOrders(true)
    try {
      const res = await api.get(`/patients/${an}/drugs`)
      setOrders(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingOrders(false)
    }
  }

  const handleSelectOrder = async (order) => {
    setSelectedOrder(order.order_no)
    setLoadingItems(true)
    try {
      const res = await api.get(`/patients/${an}/drugs/${order.order_no}`)
      setDrugItems(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingItems(false)
    }
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'
  const formatTime = (t) => t ? String(t).substring(0, 5) : ''
  const formatMoney = (v) => v ? Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'

  const filteredOrders = isFilterActive ? orders.filter(o => o.has_duplicate) : orders
  const filteredDrugItems = isFilterActive ? drugItems.filter(d => d.is_duplicate) : drugItems

  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Order List */}
        <div className="lg:col-span-2 bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="px-4 py-3 bg-muted/50 border-b border-border">
          <h3 className="font-semibold text-sm">รายการใบสั่งยา ({filteredOrders.length})</h3>
        </div>
        <div className="overflow-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 sticky top-0">
              <tr className="text-muted-foreground">
                <th className="px-3 py-2 text-left">ชนิด</th>
                <th className="px-3 py-2 text-left">วันที่</th>
                <th className="px-3 py-2 text-right">จำนวน</th>
                <th className="px-3 py-2 text-right">มูลค่า</th>
                <th className="px-3 py-2 text-left">เจ้าหน้าที่</th>
              </tr>
            </thead>
            <tbody>
              {loadingOrders ? (
                <tr><td colSpan="5" className="text-center py-6 text-muted-foreground">กำลังโหลด...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-6 text-muted-foreground">ไม่พบข้อมูล</td></tr>
              ) : filteredOrders.map((o, idx) => (
                <tr
                  key={`${o.order_no}-${idx}`}
                  onClick={() => handleSelectOrder(o)}
                  className={`cursor-pointer border-t border-border transition-colors
                    ${selectedOrder === o.order_no ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-muted/30'}
                    ${o.has_duplicate ? 'bg-red-50 hover:bg-red-100' : ''}`}
                >
                  <td className="px-3 py-2 font-medium">{o.order_type}</td>
                  <td className="px-3 py-2">{formatDate(o.rxdate)} {formatTime(o.rxtime)}</td>
                  <td className="px-3 py-2 text-right">{o.item_count}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatMoney(o.amount)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{o.entry_staff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Drug Details */}
      <div className="lg:col-span-3 bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="px-4 py-3 bg-muted/50 border-b border-border">
          <h3 className="font-semibold text-base">
            รายละเอียดยา {selectedOrder ? `(${selectedOrder})` : ''}
          </h3>
        </div>
        <div className="overflow-auto max-h-[600px]">
          {!selectedOrder ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
              <Pill className="w-5 h-5 mr-2 opacity-30" /> คลิกรายการด้านซ้ายเพื่อดูรายละเอียด
            </div>
          ) : loadingItems ? (
            <div className="text-center py-10 text-muted-foreground text-sm">กำลังโหลด...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 sticky top-0">
                <tr className="text-muted-foreground">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-center">หมวด</th>
                  <th className="px-3 py-2 text-left">ชื่อเวชภัณฑ์</th>
                  <th className="px-3 py-2 text-right">จำนวน</th>
                  <th className="px-3 py-2 text-left">วิธีใช้</th>
                  <th className="px-3 py-2 text-right">ราคา</th>
                  <th className="px-3 py-2 text-right">รวม</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrugItems.map((d, idx) => (
                  <tr key={idx} className={`border-t border-border ${d.is_duplicate ? 'bg-red-50 text-red-800' : ''}`}>
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2 text-center font-mono text-muted-foreground">{d.income || '-'}</td>
                    <td className="px-3 py-2 font-medium max-w-[250px]">
                      <div className="truncate" title={d.drug_name}>{d.drug_name || '-'}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{d.qty}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[150px]">
                      <div className="truncate" title={d.usage_note}>{d.usage_note || '-'}</div>
                    </td>

                    <td className="px-3 py-2 text-right">{formatMoney(d.unitprice)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatMoney(d.sum_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}