import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, User, FileText, CheckCircle2, Shield, AlertCircle, FlaskConical, DollarSign, Bed, Scissors, Pill, Building2, History, X, Calendar, RotateCcw, Lock, Plus, Minus } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import socket from '../../services/socket';
import { useAuth } from '../../contexts/AuthContext';

export default function ChecklistTab({ an, details, setDetails, fetchData, patient, setActiveTab, setIsFilterActive }) {
  const { user } = useAuth()
  const isUserModifiedDrugs = useRef(false)
  const [audit, setAudit] = useState(null)
  const [loadingAudit, setLoadingAudit] = useState(true)
  const [workflowStatus, setWorkflowStatus] = useState(details?.workflow_status || null)
  const [wardPhone, setWardPhone] = useState(details?.ward_phone || '')
  const [chkHm, setChkHm] = useState(details?.chk_hm ?? null)
  const [chkReturnMed, setChkReturnMed] = useState(details?.chk_returnmed ?? null)
  const [chkPayment, setChkPayment] = useState(details?.chk_payment ?? null)
  const [todayReturnDrugs, setTodayReturnDrugs] = useState([])
  const [returnDrugQtys, setReturnDrugQtys] = useState({})
  const [loadingReturnDrugs, setLoadingReturnDrugs] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const location = useLocation()
  const fromWard = location.state?.fromWard === true
  const fromDischargeCenter = location.state?.fromDischargeCenter === true
  const isWard = fromWard || !fromDischargeCenter
  const isWorkflowLocked = ['pharmacy_prepare', 'pharmacy', 'discharge_center', 'finance', 'completed', 'ward_waiting'].includes(workflowStatus)

  // Cancel Forward Modal States
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelPassword, setCancelPassword] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  const handleConfirmCancelForward = async (e) => {
    if (e) e.preventDefault()
    if (!cancelPassword.trim()) {
      setCancelError('กรุณากรอกรหัสผ่าน')
      return
    }
    setCancelSubmitting(true)
    setCancelError('')
    try {
      await api.post(`/workflow/${an}/cancel-dc-forward`, { password: cancelPassword })
      setShowCancelModal(false)
      setCancelPassword('')
      setWorkflowStatus('discharge_center')
      if (fetchData) fetchData()
      fetchDetail()
      alert('ยกเลิกการส่งต่อเรียบร้อยแล้ว ดึงเคสกลับมาศูนย์จำหน่ายสำเร็จ')
    } catch (err) {
      console.error('Cancel DC forward error:', err)
      setCancelError(err.response?.data?.error || 'เกิดข้อผิดพลาด ไม่สามารถยกเลิกได้')
    } finally {
      setCancelSubmitting(false)
    }
  }

  const fetchLogs = async () => {
    setLoadingLogs(true)
    try {
      const res = await api.get(`/patients/${an}/activity-logs`)
      setLogs(res.data)
    } catch (err) { console.error(err) }
    finally { setLoadingLogs(false) }
  }

  useEffect(() => {
    // initialize from details if available, although we might want to fetch it explicitly
    if (details?.workflow_status !== undefined) {
      setWorkflowStatus(details.workflow_status)
    }
    if (details?.chk_hm !== undefined && details.chk_hm !== null) setChkHm(details.chk_hm)
    if (details?.chk_returnmed !== undefined && details.chk_returnmed !== null) setChkReturnMed(details.chk_returnmed)
    if (details?.chk_payment !== undefined && details.chk_payment !== null) setChkPayment(details.chk_payment)
  }, [details])

  useEffect(() => {
    fetchAudit()
    fetchDetail()

    socket.on('workflow:updated', (data) => {
      if (data.an === an) {
        if (data.status !== undefined) {
          setWorkflowStatus(data.status)
        }
      }
    })

    return () => {
      socket.off('workflow:updated')
    }
  }, [an])

  const handleSendFinance = async () => {
    if (!confirm('ยืนยันส่งการเงิน?')) return
    try {
      await api.post(`/workflow/${an}/send-finance`)
      setWorkflowStatus('finance')
      fetchData()
    } catch (err) {
      alert('ไม่สามารถทำรายการได้')
    }
  }

  const fetchDetail = async () => {
    try {
      const res = await api.get(`/patients/${an}/detail`)
      if (res.data.workflow_status !== undefined) {
        setWorkflowStatus(res.data.workflow_status)
      }
      if (res.data.ward_phone) setWardPhone(res.data.ward_phone)
      if (res.data.chk_payment !== undefined && res.data.chk_payment !== null) setChkPayment(res.data.chk_payment)
    } catch (err) { console.error(err) }
  }

  const fetchTodayReturnDrugs = useCallback(async () => {
    if (!an) return
    setLoadingReturnDrugs(true)
    try {
      const res = await api.get(`/patients/${an}/today-return-drugs`)
      const drugs = res.data || []
      setTodayReturnDrugs(drugs)
      const qtys = {}
      drugs.forEach(d => {
        qtys[d.icode] = d.return_qty || 0
      })
      setReturnDrugQtys(qtys)
    } catch (err) {
      console.error('Fetch today return drugs error:', err)
    } finally {
      setLoadingReturnDrugs(false)
    }
  }, [an])

  const handleQtyChange = (icode, newQty) => {
    isUserModifiedDrugs.current = true
    const qty = Math.max(0, parseInt(newQty, 10) || 0)
    setReturnDrugQtys(prev => ({
      ...prev,
      [icode]: qty
    }))
  }

  // Auto-save return drugs with debounce when in ward mode and modified by user
  useEffect(() => {
    if (!an || chkReturnMed !== 1 || !isUserModifiedDrugs.current || Object.keys(returnDrugQtys).length === 0) return
    if (isWorkflowLocked) return

    const timer = setTimeout(() => {
      const itemsToSave = Object.entries(returnDrugQtys).map(([icode, qty]) => ({ icode, qty }))
      api.post(`/patients/${an}/return-drugs`, { items: itemsToSave }).then(() => {
        isUserModifiedDrugs.current = false
      }).catch(e => {
        console.error('Auto-save return drugs error:', e)
      })
    }, 800)

    return () => clearTimeout(timer)
  }, [an, chkReturnMed, returnDrugQtys, isWorkflowLocked])

  useEffect(() => {
    if (chkReturnMed === 1) {
      fetchTodayReturnDrugs()
    } else {
      setTodayReturnDrugs([])
      setReturnDrugQtys({})
    }
  }, [chkReturnMed, fetchTodayReturnDrugs])

  const fetchAudit = async () => {
    setLoadingAudit(true)
    try {
      const res = await api.get(`/patients/${an}/audit`)
      setAudit(res.data)
    } catch (err) { console.error(err) }
    finally { setLoadingAudit(false) }
  }

  const checklistItems = [
    { id: 'chk_right', label: 'ตรวจสอบสิทธิ์การรักษาเรียบร้อย*', icon: Shield, required: true },
    { id: 'chk_nurse', label: 'บันทึกการพยาบาลครบถ้วน*', icon: User, required: true },
    { id: 'chk_bed', label: 'ลงค่าเตียงเรียบร้อย*', icon: Bed, required: true },
    { id: 'chk_lab_dup', label: 'ตรวจสอบรายการ Lab ซ้ำซ้อนเรียบร้อย*', icon: FlaskConical, required: true },
    { id: 'chk_cost_dup', label: 'ตรวจสอบค่าใช้จ่ายซ้ำซ้อนเรียบร้อย*', icon: DollarSign, required: true },
    { id: 'chk_opnote', label: 'ตรวจสอบ operative note เรียบร้อย', icon: FileText, required: false },
  ]

  const isChecklistComplete = checklistItems
    .filter(item => item.required)
    .every(item => details && details[item.id] && details[item.id] !== 'updating...')

  const handleToggle = async (field, currentValue) => {
    if (isWorkflowLocked) return
    try {
      const newValue = !currentValue
      setDetails(prev => ({ ...prev, [field]: newValue ? 'updating...' : null }))
      await api.post(`/patients/${an}/checklist`, { field, checked: newValue })
      const dRes = await api.get(`/patients/${an}/detail`)
      setDetails(dRes.data)
    } catch (err) {
      alert(err.response?.data?.error || 'ไม่สามารถบันทึกข้อมูลได้')
      fetchData()
    }
  }

  const formatDate = (d) => {
    try {
      return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })
    } catch { return d }
  }

  const auditItems = audit ? [
    {
      pass: audit.docComplete,
      passLabel: 'เอกสารสิทธิ์ครบถ้วน',
      failLabel: `เอกสารสิทธิ์ไม่ครบถ้วน (ขาด ${audit.docMissing} รายการ)`,
      icon: FileText,
      tabId: 'documents',
    },
    {
      pass: audit.labNoSpecimen === 0,
      passLabel: 'ไม่พบรายการ Lab ซ้ำซ้อน',
      failLabel: `พบรายการ Lab ซ้ำซ้อน ${audit.labNoSpecimen} รายการ`,
      icon: FlaskConical,
      tabId: 'lab',
    },
    {
      pass: audit.duplicateCharges === 0,
      passLabel: 'ไม่พบค่าใช้จ่ายซ้ำซ้อน',
      failLabel: `พบค่าใช้จ่ายซ้ำซ้อน ${audit.duplicateCharges} รายการ`,
      icon: DollarSign,
      tabId: 'drugs',
    },
    {
      pass: audit.bedMissingDays === 0,
      passLabel: 'ลงค่าเตียงครบถ้วน',
      failLabel: `ลงค่าเตียงไม่ครบถ้วน ขาด ${audit.bedMissingDays} วัน`,
      failDetail: audit.bedMissingDates?.map(d => formatDate(d)).join(', '),
      icon: Bed,
      tabId: 'expenses',
    },
    ...(audit.totalOps > 0 ? [{
      pass: audit.totalOps === audit.opnotesCompleted,
      passLabel: `มี Operation ${audit.totalOps} รายการ และบันทึก Operative Note ครบถ้วน`,
      failLabel: `มี Operation ${audit.totalOps} รายการ แต่บันทึก Operative Note ไม่ครบ (ขาด ${audit.totalOps - audit.opnotesCompleted} รายการ)`,
      icon: Scissors,
      tabId: 'operation',
    }] : []),
  ] : []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-4 w-full">
      {/* Left: Automated Audit */}
      <div>
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
          <div className="px-5 py-4 border-b border-border bg-muted/30">
            <h3 className="font-bold text-base flex items-center gap-2 text-slate-800">
              <Shield className="w-5 h-5 text-indigo-500" />
              ระบบตรวจสอบอัตโนมัติ
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">ตรวจสอบความถูกต้องของข้อมูลโดยระบบ</p>
          </div>
          <div className="p-4 space-y-3">
            {loadingAudit ? (
              <div className="text-center py-8 text-muted-foreground text-sm">กำลังตรวจสอบ...</div>
            ) : auditItems.map((item, idx) => {
              const Icon = item.icon
              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (item.tabId && setActiveTab) {
                      setActiveTab(item.tabId)
                      if ((item.tabId === 'lab' || item.tabId === 'drugs') && setIsFilterActive) {
                        setIsFilterActive(true)
                      }
                    }
                  }}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${
                    item.pass
                      ? 'border-emerald-200 bg-emerald-50/60 hover:border-emerald-300'
                      : 'border-red-200 bg-red-50/60 hover:border-red-300'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    item.pass ? 'bg-emerald-500' : 'bg-red-500'
                  }`}>
                    {item.pass ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${item.pass ? 'text-emerald-800' : 'text-red-800'}`}>
                      {item.pass ? item.passLabel : item.failLabel}
                    </p>
                    {!item.pass && item.failDetail && (
                      <p className="text-xs text-red-600/70 mt-1">วันที่ขาด: {item.failDetail}</p>
                    )}
                  </div>
                  <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${item.pass ? 'text-emerald-400' : 'text-red-400'}`} />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right: Manual Checklist */}
      <div>
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500" />
          <div className="px-5 py-4 border-b border-border bg-muted/30 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2 text-slate-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                รายการตรวจสอบ (Manual)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">ผู้ใช้งานตรวจสอบและติ๊กเองด้วยตนเอง</p>
            </div>
            <button 
              onClick={() => { setShowLogs(true); fetchLogs(); }}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg flex items-center gap-2 transition-colors text-xs font-medium"
            >
              <History className="w-4 h-4" />
              Logs
            </button>
          </div>
          <div className="p-4 space-y-2.5">
            {checklistItems.map(item => {
              const isChecked = !!(details && details[item.id])
              const checkedBy = isChecked && details[item.id] !== 'updating...' ? (details[item.id + '_name'] || details[item.id]) : null
              const Icon = item.icon
              return (
                <div
                  key={item.id}
                  onClick={() => !isWorkflowLocked && handleToggle(item.id, isChecked)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all select-none group
                    ${isWorkflowLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}
                    ${isChecked 
                      ? (isWorkflowLocked ? 'border-emerald-400 bg-emerald-50/40' : 'border-emerald-500 bg-emerald-50/50')
                      : (isWorkflowLocked ? 'border-border bg-slate-50/60' : 'border-border bg-card hover:border-blue-300 hover:bg-slate-50')
                    }`}
                  title={isWorkflowLocked ? 'ส่งต่อแผนกแล้ว ไม่สามารถแก้ไขได้' : undefined}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0
                    ${isChecked 
                      ? (isWorkflowLocked ? 'bg-emerald-500 border-emerald-500 opacity-90' : 'bg-emerald-500 border-emerald-500') 
                      : (isWorkflowLocked ? 'border-slate-300 bg-slate-100' : 'border-slate-300 group-hover:border-blue-400')}`}>
                    {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug ${isChecked ? 'text-emerald-900' : 'text-foreground'}`}>{item.label}</p>
                  </div>
                  {checkedBy && (
                    <div className="text-xs text-muted-foreground text-right flex-shrink-0">
                      <span>ตรวจสอบโดย</span>
                      <span className="font-semibold text-slate-500 ml-1">{checkedBy}</span>
                    </div>
                  )}
                  {!isChecked && <Icon className="w-4 h-4 text-muted-foreground/30 group-hover:text-blue-300 transition-colors flex-shrink-0" />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right/Bottom: Workflow Actions */}
      {(isWard || fromDischargeCenter) && (
      <div>
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden h-full flex flex-col">
          <div className="px-5 py-4 border-b border-border bg-muted/30 flex justify-between items-center">
            <h3 className="font-bold text-base text-slate-800">ส่งต่อแผนก</h3>
            <div className="flex items-center gap-3">
              {fromDischargeCenter ? (
                patient?.dchdate ? (
                  <div className="font-semibold text-blue-800 flex items-center gap-2 text-sm bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    สถานะ: Discharge ใน HOSxP
                  </div>
                ) : (
                  <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                    สถานะ : ยังไม่ได้ Discharge ใน Hosxp
                  </span>
                )
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-slate-500">สถานะปัจจุบัน:</span>
                  {workflowStatus ? (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      workflowStatus === 'pharmacy_prepare' ? 'bg-cyan-100 text-cyan-700' :
                      workflowStatus === 'pharmacy' ? 'bg-blue-100 text-blue-700' :
                      workflowStatus === 'discharge_center' ? 'bg-purple-100 text-purple-700' :
                      workflowStatus === 'finance' ? 'bg-amber-100 text-amber-700' :
                      workflowStatus === 'ward_waiting' ? 'bg-teal-100 text-teal-700' :
                      workflowStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {workflowStatus === 'pharmacy_prepare' ? 'รอเช็คยา (ห้องยา)' :
                       workflowStatus === 'pharmacy' ? 'รอจ่ายยา (ห้องยา)' :
                       workflowStatus === 'discharge_center' ? 'ศูนย์จำหน่าย' :
                       workflowStatus === 'finance' ? 'การเงิน' :
                       workflowStatus === 'ward_waiting' ? 'รอกลับบ้าน' :
                       workflowStatus === 'completed' ? 'เสร็จสิ้น' :
                       workflowStatus === 'discharged' ? 'รอดำเนินการ' : workflowStatus}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">ไม่ทราบสถานะ</span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="p-4 flex flex-col gap-4 bg-muted/10 flex-1">
            {fromDischargeCenter && patient?.dchdate && (
              <div className="flex flex-col p-4 bg-white border border-slate-200 rounded-xl text-sm w-full shadow-sm">
                <div className="font-semibold text-slate-800 mb-3 pb-2 border-b border-slate-100">รายละเอียดการจำหน่าย</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> วันที่จำหน่าย</span>
                    <span className="font-medium text-slate-800">{new Date(patient.dchdate).toLocaleDateString('th-TH')} {patient.dchtime ? patient.dchtime.substring(0, 5) + ' น.' : ''}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Status</span>
                    <span className="font-medium text-emerald-600">{patient.dchstts_name || '-'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-500 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Type</span>
                    <span className="font-medium text-purple-600">{patient.dchtype_name || '-'}</span>
                  </div>
                </div>
              </div>
            )}
            {fromDischargeCenter && (
              <div className="flex flex-col gap-3 w-full bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">
                    ยอดต้องชำระ <span className="text-red-500">*</span>
                  </span>
                  <div className="flex items-center gap-5">
                    <label className={`flex items-center gap-2 ${['finance', 'pharmacy', 'completed', 'ward_waiting'].includes(workflowStatus) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                      <input 
                        type="radio" 
                        name="chk_payment" 
                        disabled={['finance', 'pharmacy', 'completed', 'ward_waiting'].includes(workflowStatus)} 
                        checked={chkPayment === 1} 
                        onChange={() => setChkPayment(1)} 
                        className="text-blue-600 focus:ring-blue-500 w-4 h-4 disabled:cursor-not-allowed" 
                      />
                      <span className="text-sm font-medium text-slate-800">มี</span>
                    </label>
                    <label className={`flex items-center gap-2 ${['finance', 'pharmacy', 'completed', 'ward_waiting'].includes(workflowStatus) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                      <input 
                        type="radio" 
                        name="chk_payment" 
                        disabled={['finance', 'pharmacy', 'completed', 'ward_waiting'].includes(workflowStatus)} 
                        checked={chkPayment === 0} 
                        onChange={() => setChkPayment(0)} 
                        className="text-blue-600 focus:ring-blue-500 w-4 h-4 disabled:cursor-not-allowed" 
                      />
                      <span className="text-sm font-medium text-slate-800">ไม่มี</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
            {isWard && (
              <>
                <div className="flex items-center gap-3 w-full shrink-0">
                  <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                    เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={wardPhone}
                    onChange={(e) => setWardPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="ระบุเบอร์โทรศัพท์..."
                    disabled={isWorkflowLocked}
                    className="flex-1 min-w-0 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed"
                  />
                </div>
                
                <div className="flex flex-col gap-3 w-full bg-white p-3 rounded-xl border border-slate-200 shadow-sm mt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">Homemed <span className="text-red-500">*</span></span>
                    <div className="flex items-center gap-4">
                      <label className={`flex items-center gap-2 ${isWorkflowLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                        <input type="radio" name="chk_hm" disabled={isWorkflowLocked} checked={chkHm === 1} onChange={() => setChkHm(1)} className="text-blue-600 focus:ring-blue-500 w-4 h-4 disabled:cursor-not-allowed" />
                        <span className="text-sm">มี</span>
                      </label>
                      <label className={`flex items-center gap-2 ${isWorkflowLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                        <input type="radio" name="chk_hm" disabled={isWorkflowLocked} checked={chkHm === 0} onChange={() => setChkHm(0)} className="text-blue-600 focus:ring-blue-500 w-4 h-4 disabled:cursor-not-allowed" />
                        <span className="text-sm">ไม่มี</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">ยาคืน <span className="text-red-500">*</span></span>
                    <div className="flex items-center gap-4">
                      <label className={`flex items-center gap-2 ${isWorkflowLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                        <input 
                          type="radio" 
                          name="chk_returnmed" 
                          disabled={isWorkflowLocked} 
                          checked={chkReturnMed === 1} 
                          onChange={async () => {
                            setChkReturnMed(1);
                            try {
                              await api.post(`/patients/${an}/return-med-status`, { chk_returnmed: 1 });
                            } catch (e) {
                              console.error('Update return med status error:', e);
                            }
                          }} 
                          className="text-blue-600 focus:ring-blue-500 w-4 h-4 disabled:cursor-not-allowed" 
                        />
                        <span className="text-sm">มี</span>
                      </label>
                      <label className={`flex items-center gap-2 ${isWorkflowLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                        <input 
                          type="radio" 
                          name="chk_returnmed" 
                          disabled={isWorkflowLocked} 
                          checked={chkReturnMed === 0} 
                          onChange={async () => {
                            setChkReturnMed(0);
                            try {
                              await api.post(`/patients/${an}/return-med-status`, { chk_returnmed: 0 });
                            } catch (e) {
                              console.error('Update return med status error:', e);
                            }
                          }} 
                          className="text-blue-600 focus:ring-blue-500 w-4 h-4 disabled:cursor-not-allowed" 
                        />
                        <span className="text-sm">ไม่มี</span>
                      </label>
                    </div>
                  </div>

                  {/* แสดงรายการยาคืนทั้งหมดของ AN นี้เมื่อเลือกมียาคืน */}
                  {chkReturnMed === 1 && (
                    <div className="mt-2 pt-3 border-t border-slate-100 space-y-2.5 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 font-semibold text-blue-900 text-xs sm:text-sm">
                          <Pill className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>รายการยาคืน ({todayReturnDrugs.length})</span>
                        </div>
                        <span className="text-[10px] sm:text-[11px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium shrink-0">
                          มียาคืน
                        </span>
                      </div>

                      {loadingReturnDrugs ? (
                        <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                          <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          <span>กำลังโหลดรายการยา...</span>
                        </div>
                      ) : todayReturnDrugs.length === 0 ? (
                        <div className="py-3 px-3 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          ไม่พบรายการยาคืนที่เข้าเงื่อนไขสำหรับ AN นี้
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {todayReturnDrugs.map((drug, index) => {
                            const qty = returnDrugQtys[drug.icode] ?? 0;
                            const isQtyActive = qty > 0;
                            const isLocked = isWorkflowLocked;

                            return (
                              <div
                                key={drug.icode || index}
                                className={`p-2.5 rounded-xl border text-xs transition-colors flex items-center justify-between gap-2 ${
                                  isQtyActive
                                    ? 'bg-blue-50/60 border-blue-300 ring-1 ring-blue-200'
                                    : 'bg-slate-50 hover:bg-slate-100/70 border-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isQtyActive ? 'bg-blue-600 ring-2 ring-blue-300' : 'bg-slate-400'}`} />
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-medium text-slate-800 break-words leading-tight">{drug.drug_name}</span>
                                    {drug.units && (
                                      <span className="text-[10px] text-slate-500 font-normal">หน่วย: {drug.units}</span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    disabled={isLocked}
                                    onClick={() => handleQtyChange(drug.icode, qty - 1)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-xs"
                                    title="ลดจำนวน"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    disabled={isLocked}
                                    value={qty}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10);
                                      handleQtyChange(drug.icode, isNaN(val) ? 0 : Math.max(0, val));
                                    }}
                                    className="w-12 h-7 text-center font-semibold text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                  />
                                  <button
                                    type="button"
                                    disabled={isLocked}
                                    onClick={() => handleQtyChange(drug.icode, qty + 1)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold border border-blue-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-xs"
                                    title="เพิ่มจำนวน"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
            
            <div className="flex flex-col gap-3 w-full mt-2">
              {fromDischargeCenter ? (
                <>
                  <div className="flex items-center gap-3 w-full">
                    <button
                      onClick={async () => {
                        if (chkPayment === null) {
                          alert('กรุณาเลือกว่ามียอดต้องชำระหรือไม่');
                          return;
                        }
                        if (!confirm('ยืนยันเสร็จสิ้นศูนย์จำหน่าย?')) return;
                        try {
                          await api.post(`/workflow/${an}/dc-done`, { chk_payment: chkPayment });
                          if (fetchData) fetchData();
                          fetchDetail();
                        } catch (err) {
                          alert('ไม่สามารถทำรายการได้: ' + (err.response?.data?.error || err.message));
                        }
                      }}
                      disabled={chkPayment === null || ['finance', 'pharmacy', 'completed', 'ward_waiting'].includes(workflowStatus)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm font-medium"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>เสร็จสิ้น</span>
                    </button>
                  </div>

                  {['finance', 'pharmacy', 'completed', 'ward_waiting'].includes(workflowStatus) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCancelPassword('');
                        setCancelError('');
                        setShowCancelModal(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 hover:border-rose-300 rounded-xl transition-all font-medium text-sm shadow-sm"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>ยกเลิกการส่งต่อ</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  {(chkHm !== null && chkReturnMed !== null) && (
                    <button
                      onClick={async () => {
                        if(!wardPhone.trim()) { alert('กรุณาระบุหมายเลขโทรศัพท์หอผู้ป่วย'); return; }
                        if(chkHm === null || chkReturnMed === null) { alert('กรุณาระบุ Homemed และ ยาคืน'); return; }
                        const confirmMsg = chkHm === 1 ? 'ยืนยันส่งห้องยา (เพื่อเช็คยา)?' : 'ยืนยันส่งศูนย์จำหน่าย?';
                        if(!confirm(confirmMsg)) return;
                        try {
                          const returnDrugList = Object.entries(returnDrugQtys).map(([icode, qty]) => ({ icode, qty }));
                          const endpoint = chkHm === 1 ? `/workflow/${an}/send-pharmacy` : `/workflow/${an}/send-dc`;
                          await api.post(endpoint, {
                            phone: wardPhone,
                            hm: chkHm,
                            returnmed: chkReturnMed,
                            return_drugs: chkReturnMed === 1 ? returnDrugList : []
                          });
                          isUserModifiedDrugs.current = false;
                          setWorkflowStatus(chkHm === 1 ? 'pharmacy_prepare' : 'discharge_center');
                          if (fetchData) fetchData();
                          fetchDetail();
                        } catch(err) { 
                          alert(chkHm === 1 ? 'ไม่สามารถส่งห้องยาได้' : 'ไม่สามารถส่งศูนย์จำหน่ายได้'); 
                        }
                      }}
                      disabled={!isChecklistComplete || !wardPhone.trim() || isWorkflowLocked}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm font-medium ${
                        chkHm === 1 ? 'bg-teal-600 hover:bg-teal-700' : 'bg-purple-600 hover:bg-purple-700'
                      }`}
                    >
                      {chkHm === 1 ? (
                        <>
                          <Pill className="w-5 h-5" />
                          <span>ส่งห้องยา</span>
                        </>
                      ) : (
                        <>
                          <Building2 className="w-5 h-5" />
                          <span>ส่งศูนย์จำหน่าย</span>
                        </>
                      )}
                    </button>
                  )}
                  
                  {(chkHm === null || chkReturnMed === null) && (
                    <div className="text-center py-3 px-3 bg-slate-100 rounded-xl border border-slate-200 text-sm text-slate-500 font-medium">
                      กรุณาระบุ Homemed และ ยาคืน ก่อนส่งต่อ
                    </div>
                  )}
                  
                  {(!isChecklistComplete || !wardPhone.trim()) && chkHm !== null && chkReturnMed !== null && (
                    <div className="text-center py-2 px-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 font-medium">
                      กรุณากรอก "เบอร์โทรศัพท์" และติ๊ก "รายการตรวจสอบ" ให้ครบถ้วน
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Logs Modal */}
      {showLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="font-bold text-base flex items-center gap-2 text-slate-800">
                <History className="w-5 h-5 text-slate-500" />
                ประวัติการทำรายการ (Logs)
              </h3>
              <button 
                onClick={() => setShowLogs(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              {loadingLogs ? (
                <div className="text-center text-sm text-muted-foreground py-4">กำลังโหลดข้อมูล...</div>
              ) : logs.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-4">ไม่มีประวัติการทำรายการ</div>
              ) : (
                <div className="space-y-4">
                  {logs.map(log => {
                    let actionText = ''
                    let dotColor = 'bg-slate-400'

                    if (log.action_type === 'CANCEL_FORWARD_DC') {
                      actionText = 'ยกเลิกการส่งต่อ (ดึงกลับมาศูนย์จำหน่าย)'
                      dotColor = 'bg-rose-600'
                    } else if (log.action_type === 'CANCEL_DISCHARGE') {
                      actionText = 'ยกเลิกจำหน่าย (Discharge)'
                      dotColor = 'bg-rose-600'
                    } else if (log.action_type === 'DISCHARGE') {
                      actionText = 'ทำรายการ Discharge'
                      dotColor = 'bg-blue-600'
                    } else if (log.action_type === 'SEND_PHARMACY') {
                      actionText = 'ส่งห้องยา'
                      dotColor = 'bg-blue-600'
                    } else if (log.action_type === 'SEND_DC') {
                      actionText = 'ส่งศูนย์จำหน่าย'
                      dotColor = 'bg-purple-600'
                    } else if (log.action_type === 'PHARMACY_DONE') {
                      actionText = 'ห้องยาเสร็จสิ้น'
                      dotColor = 'bg-purple-600'
                    } else if (log.action_type === 'SEND_FINANCE') {
                      actionText = 'ส่งการเงิน'
                      dotColor = 'bg-amber-600'
                    } else if (log.action_type === 'DC_DONE') {
                      actionText = 'เสร็จสิ้นศูนย์จำหน่าย'
                      dotColor = 'bg-emerald-600'
                    } else if (log.action_type === 'FINANCE_DONE') {
                      actionText = 'เสร็จสิ้นการเงิน'
                      dotColor = 'bg-emerald-600'
                    } else if (log.action_type === 'UPDATE_DISCOUNT') {
                      actionText = 'บันทึกส่วนลด'
                      dotColor = 'bg-indigo-600'
                    } else if (log.action_type.startsWith('CHECK_')) {
                      const fieldId = log.action_type.replace('CHECK_', '').toLowerCase()
                      const item = checklistItems.find(c => c.id === fieldId)
                      actionText = `เลือก ${item ? item.label.replace('*', '') : fieldId}`
                      dotColor = 'bg-emerald-500'
                    } else if (log.action_type.startsWith('UNCHECK_')) {
                      const fieldId = log.action_type.replace('UNCHECK_', '').toLowerCase()
                      const item = checklistItems.find(c => c.id === fieldId)
                      actionText = `ยกเลิก ${item ? item.label.replace('*', '') : fieldId}`
                      dotColor = 'bg-red-500'
                    } else {
                      actionText = log.action_type
                    }

                    return (
                      <div key={log.id} className="flex gap-3 text-sm">
                        <div className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">
                            {actionText}
                          </div>
                          <div className="flex justify-between items-center mt-1 text-xs text-slate-500">
                            <div>
                              โดย <span className="font-semibold text-slate-700">{log.fullname}</span>
                            </div>
                            <div className="text-slate-400">
                              {new Date(log.created_at).toLocaleString('th-TH', { 
                                year: 'numeric', month: '2-digit', day: '2-digit', 
                                hour: '2-digit', minute: '2-digit' 
                              })} น.
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Forward Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-border animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border bg-rose-50/50 flex justify-between items-center">
              <div className="flex items-center gap-3 text-rose-700">
                <div className="p-2 bg-rose-100 rounded-xl">
                  <RotateCcw className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800">ยืนยันยกเลิกการส่งต่อ</h3>
                  <p className="text-xs text-rose-600">ดึงเคสกลับมายังศูนย์จำหน่าย</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCancelForward} className="p-6 space-y-4">
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
                  <span className="text-muted-foreground">AN:</span>
                  <span className="font-mono font-semibold text-slate-800">{an}</span>
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
                    setCancelPassword(e.target.value);
                    if (cancelError) setCancelError('');
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
                  onClick={() => setShowCancelModal(false)}
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