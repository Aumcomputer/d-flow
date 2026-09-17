import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bed, User, FileCheck, CheckCircle2, XCircle, Building2, RotateCcw, X, AlertCircle } from 'lucide-react'
import api from '../services/api'
import socket from '../services/socket'
import { useAuth } from '../contexts/AuthContext'

export default function WardPage() {
  const { user } = useAuth()
  const [wards, setWards] = useState([])
  const [selectedWard, setSelectedWard] = useState(localStorage.getItem('lastWardCode') || '')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('admitted')
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  
  // Cancel Discharge Modal States
  const [selectedPatientForCancel, setSelectedPatientForCancel] = useState(null)
  const [cancelPassword, setCancelPassword] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: 'bedno', direction: 'asc' })

  const navigate = useNavigate()

  useEffect(() => {
    fetchWards()
  }, [])

  useEffect(() => {
    if (selectedWard) {
      localStorage.setItem('lastWardCode', selectedWard)
      fetchPatients()
    } else {
      setPatients([])
    }

    const handleWorkflowUpdate = () => {
      if (selectedWard) {
        fetchPatients()
      }
    }
    
    socket.on('workflow:updated', handleWorkflowUpdate)
    return () => {
      socket.off('workflow:updated', handleWorkflowUpdate)
    }
  }, [selectedWard, activeTab, selectedDate])

  const fetchWards = async () => {
    try {
      const res = await api.get('/wards')
      setWards(res.data)
      if (!selectedWard && res.data.length > 0) {
        setSelectedWard(res.data[0].ward)
      }
    } catch (err) {
      console.error('Fetch wards error:', err)
    }
  }

  const fetchPatients = async () => {
    if (!selectedWard) return
    setLoading(true)
    try {
      let endpoint = activeTab === 'admitted' 
        ? `/wards/${selectedWard}/patients` 
        : `/wards/${selectedWard}/discharged`
      if (activeTab === 'discharged') endpoint += `?date=${selectedDate}`
      const res = await api.get(endpoint)
      setPatients(res.data)
    } catch (err) {
      console.error('Fetch patients error:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatMoney = (val) => {
    if (val === null || val === undefined) return '0.00'
    return Number(val).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const sortedPatients = useMemo(() => {
    let sortableItems = [...patients]
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key] || ''
        let bValue = b[sortConfig.key] || ''
        
        // Handle numeric sorting for strings that contain numbers (like bed numbers)
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue, undefined, { numeric: true })
            : bValue.localeCompare(aValue, undefined, { numeric: true })
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      sortableItems = sortableItems.filter(p => 
        (p.an && p.an.toLowerCase().includes(q)) || 
        (p.hn && p.hn.toLowerCase().includes(q)) ||
        (p.fname && p.fname.toLowerCase().includes(q)) ||
        (p.lname && p.lname.toLowerCase().includes(q))
      )
    }
    return sortableItems
  }, [patients, sortConfig, searchQuery])

  const handleDischarge = async (an) => {
    if (!confirm('ยืนยันการทำจำหน่าย (Discharge) ผู้ป่วยรายนี้?')) return
    try {
      await api.post(`/patients/${an}/discharge`)
      navigate(`/dcdetail/${an}`, { state: { fromWard: true } })
    } catch (err) {
      alert('ไม่สามารถทำจำหน่ายได้')
    }
  }

  const openCancelModal = (patient) => {
    setSelectedPatientForCancel(patient)
    setCancelPassword('')
    setCancelError('')
  }

  const handleConfirmCancelDischarge = async (e) => {
    if (e) e.preventDefault()
    if (!cancelPassword.trim() || !selectedPatientForCancel) {
      setCancelError('กรุณากรอกรหัสผ่าน')
      return
    }
    setCancelSubmitting(true)
    setCancelError('')
    try {
      await api.post(`/patients/${selectedPatientForCancel.an}/cancel-discharge`, { password: cancelPassword })
      setSelectedPatientForCancel(null)
      setCancelPassword('')
      fetchPatients()
      alert('ยกเลิก Discharge เรียบร้อยแล้ว')
    } catch (err) {
      console.error('Cancel discharge error:', err)
      setCancelError(err.response?.data?.error || 'เกิดข้อผิดพลาด ไม่สามารถยกเลิกได้')
    } finally {
      setCancelSubmitting(false)
    }
  }

  const handleWardDone = async (an) => {
    if (!confirm('ยืนยันคนไข้กลับบ้านแล้ว?')) return
    try {
      await api.post(`/workflow/${an}/ward-done`)
      fetchPatients()
    } catch (err) {
      alert('ไม่สามารถทำรายการได้: ' + (err.response?.data?.error || err.message))
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('th-TH')
  }

  return (
    <div className="w-full px-4 py-6 space-y-6 animate-in fade-in zoom-in-95 duration-500">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-teal-50 p-2 rounded-xl border border-teal-100">
            <Building2 className="w-8 h-8 text-teal-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-500 to-emerald-600">
              หอผู้ป่วย
            </h1>
            <p className="text-muted-foreground mt-1">จัดการผู้ป่วยในความดูแลและเตรียมความพร้อมก่อนจำหน่าย</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <select 
            value={selectedWard}
            onChange={e => setSelectedWard(e.target.value)}
            className="flex h-10 w-full sm:w-[250px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="" disabled>-- เลือกหอผู้ป่วย --</option>
            {wards.map(w => (
              <option key={w.ward} value={w.ward}>{w.name}</option>
            ))}
          </select>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="ค้นหา AN, HN, ชื่อ"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-10 w-full sm:w-[250px] rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>
          {activeTab === 'discharged' && (
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full md:w-auto px-4 py-2 bg-white border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-border">
        <button
          onClick={() => setActiveTab('admitted')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'admitted' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          ผู้ป่วยทั้งหมด (กำลัง Admit)
        </button>
        <button
          onClick={() => setActiveTab('discharged')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'discharged' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          ผู้ป่วยที่ Discharge
        </button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
              <tr>
                <th className="px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('bedno')}>
                  เตียง {sortConfig.key === 'bedno' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('an')}>
                  AN / HN {sortConfig.key === 'an' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('fname')}>
                  ชื่อ-สกุล {sortConfig.key === 'fname' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('pttype_name')}>
                  สิทธิ์การรักษา {sortConfig.key === 'pttype_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('admit_date')}>
                  วันที่ Admit {sortConfig.key === 'admit_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort('doctor_name')}>
                  แพทย์เจ้าของไข้ {sortConfig.key === 'doctor_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                {activeTab === 'admitted' && (
                  <>
                    <th className="px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors text-right" onClick={() => handleSort('total_income')}>
                      ค่าใช้จ่ายรวม {sortConfig.key === 'total_income' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors text-right" onClick={() => handleSort('rcpt_money')}>
                      ชำระแล้ว {sortConfig.key === 'rcpt_money' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors text-right" onClick={() => handleSort('total_deposit')}>
                      เงินมัดจำ {sortConfig.key === 'total_deposit' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:bg-muted/80 transition-colors text-right" onClick={() => handleSort('paid_money')}>
                      ยอดชำระ {sortConfig.key === 'paid_money' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                  </>
                )}
                {activeTab === 'discharged' && (
                  <>
                    <th className="px-4 py-3 text-center">เวลาที่ Discharge</th>
                    <th className="px-4 py-3 text-center">Discharge ใน HOSxP</th>
                    <th className="px-4 py-3 text-center">เวลาที่เสร็จสิ้น</th>
                    <th className="px-4 py-3 text-center">
                      สถานะ
                    </th>
                    <th className="px-4 py-3 text-center min-w-[200px]">
                      คำอธิบาย
                    </th>
                  </>
                )}
                {activeTab === 'admitted' && (
                  <th className="px-4 py-3 text-center">
                    เอกสารสิทธิ์
                  </th>
                )}
                <th className="px-4 py-3 text-right">
                  การจัดการ
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={activeTab === 'admitted' ? 11 : 12} className="px-4 py-8 text-center text-muted-foreground">
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : sortedPatients.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'admitted' ? 12 : 12} className="px-4 py-8 text-center text-muted-foreground">
                    ไม่พบข้อมูลผู้ป่วย
                  </td>
                </tr>
              ) : (
                sortedPatients.map((p) => {
                  const pendingMoney = Number(p.paid_money || 0) - Number(p.rcpt_money || 0) - Number(p.total_deposit || 0) - Number(p.discount_money || 0)
                  return (
                  <tr 
                    key={p.an} 
                    onClick={() => navigate(`/dcdetail/${p.an}?tab=drugs`, { state: { fromWard: true } })}
                    className={`border-t border-border transition-colors group cursor-pointer ${
                      activeTab === 'discharged' && p.workflow_status === 'completed'
                        ? 'bg-emerald-50/70 hover:bg-emerald-100/70'
                        : activeTab === 'discharged' && p.workflow_status === 'ward_waiting'
                          ? 'bg-teal-50/70 hover:bg-teal-100/70'
                          : 'hover:bg-muted/30'
                    }`}
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <Bed className="w-4 h-4 text-blue-500" />
                        {p.bedno || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-blue-600">{p.an}</div>
                      <div className="text-xs text-muted-foreground">HN: {p.hn}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.pname}{p.fname} {p.lname}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        อายุ {p.age_y ? `${p.age_y} ปี` : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="line-clamp-1" title={p.pttype_name}>{p.pttype_name || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(p.admit_date)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.doctor_name || '-'}
                    </td>
                    {activeTab === 'admitted' && (
                      <>
                        <td className="px-4 py-3 text-right font-medium text-foreground">
                          {formatMoney(p.total_income)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-600">
                          {formatMoney(p.rcpt_money)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-600">
                          {formatMoney(p.total_deposit)}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${pendingMoney > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {pendingMoney > 0 ? formatMoney(pendingMoney) : '-'}
                        </td>
                      </>
                    )}
                    {activeTab === 'discharged' && (
                      <>
                        <td className="px-4 py-3 text-center text-muted-foreground whitespace-nowrap">
                          {p.discharge_date ? new Date(p.discharge_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {p.dchdate ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground whitespace-nowrap">
                          {p.ward_done_date 
                            ? new Date(p.ward_done_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) 
                            : p.pharmacy_done_date && p.workflow_status === 'completed'
                              ? new Date(p.pharmacy_done_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                              : p.finance_done_date 
                                ? new Date(p.finance_done_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) 
                                : p.dc_done_date && p.workflow_status === 'completed'
                                  ? new Date(p.dc_done_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                                  : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          p.workflow_status === 'pharmacy_prepare' ? 'bg-cyan-100 text-cyan-700' :
                          p.workflow_status === 'pharmacy' ? 'bg-blue-100 text-blue-700' :
                          p.workflow_status === 'discharge_center' ? 'bg-purple-100 text-purple-700' :
                          p.workflow_status === 'finance' ? 'bg-amber-100 text-amber-700' :
                          p.workflow_status === 'ward_waiting' ? 'bg-teal-100 text-teal-700' :
                          p.workflow_status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {p.workflow_status === 'pharmacy_prepare' ? 'รอจัดยา' :
                           p.workflow_status === 'pharmacy' ? 'รอจ่ายยา' :
                           p.workflow_status === 'discharge_center' ? 'ศูนย์จำหน่าย' :
                           p.workflow_status === 'finance' ? 'การเงิน' :
                           p.workflow_status === 'ward_waiting' ? 'รอกลับบ้าน' :
                           p.workflow_status === 'completed' ? 'เสร็จสิ้น' :
                           'รอดำเนินการ'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.workflow_status === 'ward_waiting' ? (
                          <div className="flex flex-col items-center gap-1.5 py-0.5">
                            <span className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                              รอคนไข้กลับบ้าน
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWardDone(p.an);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1 active:scale-95 cursor-pointer"
                              title="คลิกเมื่อคนไข้กลับบ้านแล้ว เพื่อเปลี่ยนสถานะเป็นเสร็จสิ้น"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>คนไข้กลับบ้านแล้ว</span>
                            </button>
                          </div>
                        ) : p.workflow_status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>คนไข้กลับบ้านแล้ว</span>
                          </span>
                        ) : p.workflow_status === 'finance' ? (
                          <span className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg inline-block text-left">
                            {p.chk_hm === 1
                              ? 'ให้คนไข้ไปการเงิน แล้วนำใบเสร็จไปรับยาที่ห้องยา เสร็จแล้วกลับบ้านได้'
                              : 'ให้คนไข้ไปการเงิน เสร็จแล้วกลับบ้านได้'}
                          </span>
                        ) : p.workflow_status === 'pharmacy' ? (
                          <span className="text-xs font-medium text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg inline-block text-left">
                            ให้คนไข้ไปห้องยาเพื่อรับยา เสร็จแล้วกลับบ้านได้
                          </span>
                        ) : p.workflow_status === 'pharmacy_prepare' ? (
                          <span className="text-xs font-medium text-cyan-800 bg-cyan-50 border border-cyan-200 px-2.5 py-1 rounded-lg inline-block text-left">
                            รอห้องยาจัดยา
                          </span>
                        ) : p.workflow_status === 'discharge_center' ? (
                          <span className="text-xs text-slate-500">
                            รอศูนย์จำหน่ายดำเนินการ
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">
                            รอดำเนินการ
                          </span>
                        )}
                      </td>
                      </>
                    )}
                    {activeTab === 'admitted' && (
                      <td className="px-4 py-3 text-center">
                        {p.isComplete ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" title="เอกสารครบถ้วน" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-400 mx-auto opacity-50" title="เอกสารไม่ครบ" />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      {activeTab === 'admitted' ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDischarge(p.an); }}
                          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-9 px-4"
                        >
                          Discharge
                        </button>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {p.discharge_date ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); openCancelModal(p); }}
                              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-rose-200 text-rose-600 hover:bg-rose-50 h-9 px-3"
                            >
                              ยกเลิก Discharge
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel Discharge Password Confirmation Modal */}
      {selectedPatientForCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-border animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border bg-rose-50/50 flex justify-between items-center">
              <div className="flex items-center gap-3 text-rose-700">
                <div className="p-2 bg-rose-100 rounded-xl">
                  <RotateCcw className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800">ยืนยันยกเลิก Discharge</h3>
                  <p className="text-xs text-rose-600">ดึงผู้ป่วยกลับมาอยู่ในสถานะแอดมิท</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedPatientForCancel(null)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCancelDischarge} className="p-6 space-y-4">
              <div className="text-sm text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ผู้ขอยกเลิก:</span>
                  <span className="font-semibold text-slate-800">{user?.name || user?.loginname}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Username:</span>
                  <span className="font-mono text-slate-700">{user?.loginname}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ผู้ป่วย:</span>
                  <span className="font-medium text-slate-800">
                    {selectedPatientForCancel.pname}{selectedPatientForCancel.fname} {selectedPatientForCancel.lname}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AN / เตียง:</span>
                  <span className="font-mono text-slate-700">
                    {selectedPatientForCancel.an} (เตียง {selectedPatientForCancel.bedno || '-'})
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  กรุณากรอกรหัสผ่านเพื่อยืนยัน <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={cancelPassword}
                  onChange={(e) => {
                    setCancelPassword(e.target.value)
                    if (cancelError) setCancelError('')
                  }}
                  placeholder="รหัสผ่านเข้าสู่ระบบของคุณ..."
                  autoFocus
                  disabled={cancelSubmitting}
                  className="w-full px-3.5 py-2.5 text-sm border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-background"
                />
                {cancelError && (
                  <div className="flex items-center gap-1.5 text-rose-600 text-xs mt-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{cancelError}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPatientForCancel(null)}
                  disabled={cancelSubmitting}
                  className="flex-1 px-4 py-2.5 border border-input bg-background hover:bg-muted text-foreground text-sm font-medium rounded-xl transition-colors"
                >
                  ปิด
                </button>
                <button
                  type="submit"
                  disabled={cancelSubmitting || !cancelPassword.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelSubmitting ? (
                    <span>กำลังดำเนินการ...</span>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>ยืนยันยกเลิก</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
