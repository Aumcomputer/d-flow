import React, { useState, useEffect } from 'react';
import { Activity, User, FileText, CheckCircle2, Shield, AlertCircle, FlaskConical, DollarSign, Bed, Scissors, Pill, Building2, History, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import socket from '../../services/socket';

export default function ChecklistTab({ an, details, setDetails, fetchData, patient }) {
  const [audit, setAudit] = useState(null)
  const [loadingAudit, setLoadingAudit] = useState(true)
  const [workflowStatus, setWorkflowStatus] = useState(details?.workflow_status || null)
  const [wardPhone, setWardPhone] = useState(details?.ward_phone || '')
  const [showLogs, setShowLogs] = useState(false)
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const location = useLocation()
  const fromWard = location.state?.fromWard === true
  const fromDischargeCenter = location.state?.fromDischargeCenter === true

  const POLL_INTERVAL = Number(import.meta.env.VITE_POLL_INTERVAL || 6)
  const [isWaitingHOSxP, setIsWaitingHOSxP] = useState(false)
  const [countdown, setCountdown] = useState(POLL_INTERVAL)

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
    if (details?.workflow_status) {
      setWorkflowStatus(details.workflow_status)
    }
  }, [details])

  useEffect(() => {
    fetchAudit()
    fetchDetail()

    socket.on('workflow:updated', (data) => {
      if (data.an === an) {
        setWorkflowStatus(data.status)
      }
    })

    return () => {
      socket.off('workflow:updated')
    }
  }, [an])

  useEffect(() => {
    let timer;
    if (isWaitingHOSxP) {
      if (countdown > 0) {
        timer = setTimeout(() => setCountdown(c => c - 1), 1000)
      } else {
        // Poll API
        api.get(`/patients/${an}`).then(res => {
          if (res.data && res.data.dchdate) {
            setIsWaitingHOSxP(false)
            api.post(`/workflow/${an}/send-finance`).then(() => {
              setWorkflowStatus('finance')
              fetchData()
            }).catch(err => alert('ไม่สามารถทำรายการได้'))
          } else {
            setCountdown(POLL_INTERVAL)
          }
        }).catch(err => {
          console.error(err)
          setCountdown(POLL_INTERVAL)
        })
      }
    }
    return () => clearTimeout(timer)
  }, [isWaitingHOSxP, countdown, an])

  const handleSendFinance = async () => {
    if (!patient?.dchdate) {
      setIsWaitingHOSxP(true)
      setCountdown(POLL_INTERVAL)
      return
    }

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
      setWorkflowStatus(res.data.workflow_status)
      if (res.data.ward_phone) setWardPhone(res.data.ward_phone)
    } catch (err) { console.error(err) }
  }

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
    try {
      const newValue = !currentValue
      setDetails(prev => ({ ...prev, [field]: newValue ? 'updating...' : null }))
      await api.post(`/patients/${an}/checklist`, { field, checked: newValue })
      const dRes = await api.get(`/patients/${an}/detail`)
      setDetails(dRes.data)
    } catch {
      alert('ไม่สามารถบันทึกข้อมูลได้')
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
    },
    {
      pass: audit.labNoSpecimen === 0,
      passLabel: 'ไม่พบรายการ Lab ซ้ำซ้อน',
      failLabel: `พบรายการ Lab ซ้ำซ้อน ${audit.labNoSpecimen} รายการ`,
      icon: FlaskConical,
    },
    {
      pass: audit.duplicateCharges === 0,
      passLabel: 'ไม่พบค่าใช้จ่ายซ้ำซ้อน',
      failLabel: `พบค่าใช้จ่ายซ้ำซ้อน ${audit.duplicateCharges} รายการ`,
      icon: DollarSign,
    },
    {
      pass: audit.bedMissingDays === 0,
      passLabel: 'ลงค่าเตียงครบถ้วน',
      failLabel: `ลงค่าเตียงไม่ครบถ้วน ขาด ${audit.bedMissingDays} วัน`,
      failDetail: audit.bedMissingDates?.map(d => formatDate(d)).join(', '),
      icon: Bed,
    },
    ...(audit.totalOps > 0 ? [{
      pass: audit.totalOps === audit.opnotesCompleted,
      passLabel: `มี Operation ${audit.totalOps} รายการ และบันทึก Operative Note ครบถ้วน`,
      failLabel: `มี Operation ${audit.totalOps} รายการ แต่บันทึก Operative Note ไม่ครบ (ขาด ${audit.totalOps - audit.opnotesCompleted} รายการ)`,
      icon: Scissors,
    }] : []),
  ] : []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4 max-w-6xl mx-auto">
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
                  className={`flex items-start gap-3 p-3.5 rounded-xl border-2 transition-all ${
                    item.pass
                      ? 'border-emerald-200 bg-emerald-50/60'
                      : 'border-red-200 bg-red-50/60'
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
          <div className="p-4 space-y-3">
            {checklistItems.map(item => {
              const isChecked = !!(details && details[item.id])
              const checkedBy = isChecked && details[item.id] !== 'updating...' ? (details[item.id + '_name'] || details[item.id]) : null
              const Icon = item.icon
              return (
                <div
                  key={item.id}
                  onClick={() => handleToggle(item.id, isChecked)}
                  className={`flex items-center gap-4 p-3.5 rounded-xl border-2 transition-all cursor-pointer select-none group
                    ${isChecked ? 'border-emerald-500 bg-emerald-50/50' : 'border-border bg-card hover:border-blue-300 hover:bg-slate-50'}`}
                >
                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors
                    ${isChecked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 group-hover:border-blue-400'}`}>
                    {isChecked && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${isChecked ? 'text-emerald-900' : 'text-foreground'}`}>{item.label}</p>
                  </div>
                  {checkedBy && (
                    <div className="text-xs text-muted-foreground text-right">
                      <span>ตรวจสอบโดย</span>
                      <span className="font-semibold text-slate-500 ml-1">{checkedBy}</span>
                    </div>
                  )}
                  {!isChecked && <Icon className="w-5 h-5 text-muted-foreground/30 group-hover:text-blue-300 transition-colors" />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Bottom: Workflow Actions */}
      {(fromWard || fromDischargeCenter) && (
      <div className="lg:col-span-2 mt-4">
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/30 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base text-slate-800">ส่งต่อแผนก</h3>
            </div>
            <div className="flex items-center gap-3">
              {fromDischargeCenter ? (
                patient?.dchdate ? (
                  <span className="text-sm text-slate-700">
                    <span className="font-medium text-slate-500 mr-1">สถานะ:</span>
                    Discharge วันที่ <span className="font-medium">{new Date(patient.dchdate).toLocaleDateString('th-TH')}</span> 
                    {' '}เวลา <span className="font-medium">{patient.dchtime ? patient.dchtime + ' น.' : '-'}</span>
                    {' '}Status: <span className="font-medium text-blue-600">{patient.dchstts_name || '-'}</span> 
                    {' '}Type: <span className="font-medium text-purple-600">{patient.dchtype_name || '-'}</span>
                  </span>
                ) : (
                  <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                    สถานะ : ยังไม่ได้ Discharge ใน Hosxp
                  </span>
                )
              ) : (
                <>
                  <span className="text-sm font-medium text-slate-500">สถานะปัจจุบัน:</span>
                  {workflowStatus ? (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      workflowStatus === 'pharmacy' ? 'bg-blue-100 text-blue-700' :
                      workflowStatus === 'discharge_center' ? 'bg-purple-100 text-purple-700' :
                      workflowStatus === 'finance' ? 'bg-amber-100 text-amber-700' :
                      workflowStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {workflowStatus === 'pharmacy' ? 'ห้องยา' :
                       workflowStatus === 'discharge_center' ? 'ศูนย์จำหน่าย' :
                       workflowStatus === 'finance' ? 'การเงิน' :
                       workflowStatus === 'completed' ? 'เสร็จสิ้น' :
                       workflowStatus === 'discharged' ? 'รอดำเนินการ' : workflowStatus}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">ไม่ทราบสถานะ</span>
                  )}
                </>
              )}
            </div>
          </div>
          
          <div className="p-4 flex flex-col xl:flex-row items-center gap-4 bg-muted/10">
            {fromWard && (
              <div className="flex items-center gap-3 w-full xl:w-auto shrink-0">
                <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                  หมายเลขโทรศัพท์หอผู้ป่วย <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={wardPhone}
                  onChange={(e) => setWardPhone(e.target.value)}
                  placeholder="ระบุเบอร์โทรศัพท์..."
                  className="flex-1 sm:w-48 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
            
            <div className="flex gap-4 w-full xl:flex-1">
              {fromDischargeCenter ? (
                <>
                  <button
                    onClick={handleSendFinance}
                    disabled={['finance', 'completed'].includes(workflowStatus)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    <DollarSign className="w-5 h-5" />
                    <span className="font-medium">ส่งการเงิน</span>
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('ยืนยันเสร็จสิ้น?')) return;
                      try {
                        await api.post(`/workflow/${an}/dc-done`);
                        setWorkflowStatus('completed');
                        fetchData();
                      } catch (err) { alert('ไม่สามารถทำรายการได้'); }
                    }}
                    disabled={['completed'].includes(workflowStatus)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">เสร็จสิ้น</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={async () => {
                      if(!wardPhone.trim()) {
                        alert('กรุณาระบุหมายเลขโทรศัพท์หอผู้ป่วย');
                        return;
                      }
                      if(!confirm('ยืนยันส่งห้องยา?')) return;
                      try {
                        await api.post(`/workflow/${an}/send-pharmacy`, { phone: wardPhone })
                        setWorkflowStatus('pharmacy')
                      } catch(err) { alert('ไม่สามารถส่งห้องยาได้') }
                    }}
                    disabled={!isChecklistComplete || ['pharmacy', 'discharge_center', 'finance', 'completed'].includes(workflowStatus)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Pill className="w-5 h-5" />
                    <span className="font-medium">ส่งห้องยา</span>
                  </button>
                  <button
                    onClick={async () => {
                      if(!wardPhone.trim()) {
                        alert('กรุณาระบุหมายเลขโทรศัพท์หอผู้ป่วย');
                        return;
                      }
                      if(!confirm('ยืนยันส่งศูนย์จำหน่าย?')) return;
                      try {
                        await api.post(`/workflow/${an}/send-dc`, { phone: wardPhone })
                        setWorkflowStatus('discharge_center')
                      } catch(err) { alert('ไม่สามารถส่งศูนย์จำหน่ายได้') }
                    }}
                    disabled={!isChecklistComplete || ['discharge_center', 'finance', 'completed'].includes(workflowStatus)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Building2 className="w-5 h-5" />
                    <span className="font-medium">ส่งศูนย์จำหน่าย</span>
                  </button>
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
                    const isCheck = log.action_type.startsWith('CHECK_')
                    const fieldId = log.action_type.replace(/^(UN)?CHECK_/, '').toLowerCase()
                    const item = checklistItems.find(c => c.id === fieldId)
                    const label = item ? item.label.replace('*', '') : fieldId
                    
                    return (
                      <div key={log.id} className="flex gap-3 text-sm">
                        <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${isCheck ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">
                            {isCheck ? 'เลือก' : 'ยกเลิก'}{' '}
                            <span className="text-muted-foreground font-normal">
                              {label}
                            </span>
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

      {/* Waiting Popup */}
      {isWaitingHOSxP && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 relative">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-blue-500 transition-all duration-1000 ease-linear"
                    strokeWidth="3"
                    strokeDasharray={`${(countdown / POLL_INTERVAL) * 100}, 100`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-blue-600">{countdown}</span>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800">กำลังตรวจสอบข้อมูล</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  รอหอผู้ป่วย discharge ใน Hosxp
                </p>
                {patient && (
                  <p className="text-sm font-medium text-slate-700 mt-2">
                    ผู้ป่วย: {patient.fullname}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsWaitingHOSxP(false)}
                className="mt-2 w-full py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}