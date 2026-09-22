import { useState, useEffect, Fragment, useCallback } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowLeft, User, Activity, FileText, CheckCircle2, Bed, Calendar, Stethoscope, Shield, DollarSign, FlaskConical, Scissors, Pill, ChevronRight, AlertCircle, UploadCloud, Circle, Trash2, Eye, ShieldCheck, AlertTriangle, CreditCard, Phone, Receipt, Tag } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { Badge } from '../components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Select } from '../components/ui/select'
import { Button } from '../components/ui/button'
import api from '../services/api'
import socket from '../services/socket'
import { useAuth } from '../contexts/AuthContext'
import DocumentsTab from '../components/DocumentsTab'
import ChecklistTab from './dcdetailtabs/ChecklistTab'
import DrugProfileTab from './dcdetailtabs/DrugProfileTab'
import ExpensesTab from './dcdetailtabs/ExpensesTab'
import LabTab from './dcdetailtabs/LabTab'
import OperationTab from './dcdetailtabs/OperationTab'
import ReceiptsTab from './dcdetailtabs/ReceiptsTab'
import TimelineTab from './dcdetailtabs/TimelineTab'
import DiscountTab from './dcdetailtabs/DiscountTab'

const TABS = [
  { id: 'checklist', label: 'รายการตรวจสอบ', icon: CheckCircle2 },
  { id: 'documents', label: 'เอกสารสิทธิ์', icon: FileText },
  { id: 'drugs', label: 'Drug Profile', icon: Pill },
  { id: 'expenses', label: 'ค่าใช้จ่ายตามหมวด', icon: DollarSign },
  { id: 'lab', label: 'Lab', icon: FlaskConical },
  { id: 'operation', label: 'Operation', icon: Scissors },
  { id: 'receipts', label: 'ใบเสร็จรับเงิน', icon: Receipt },
  { id: 'discount', label: 'ส่วนลด', icon: Tag },
  { id: 'timeline', label: 'Timeline', icon: Activity },
]

const DOC_TYPES = [
  { id: 1, name: 'บัตรประชาชน', required: true },
  { id: 2, name: 'ใบตรวจสอบสิทธิ์', required: true },
  { id: 3, name: 'Authen Code', required: true },
  { id: 4, name: 'ใบส่งตัว (Refer)', required: false },
  { id: 5, name: 'อื่นๆ', required: false },
]

export default function DischargeDetailPage() {
  const { an } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [searchParams, setSearchParams] = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'checklist'

  const [patient, setPatient] = useState(null)
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTabState] = useState(defaultTab)

  const setActiveTab = (tab) => {
    setActiveTabState(tab)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      return next
    }, { replace: true })
  }

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl)
    }
  }, [searchParams])
  const [imgError, setImgError] = useState(false)
  const [isFilterActive, setIsFilterActive] = useState(false)

  const { user } = useAuth()

  // Removed useEffect for isFilterActive reset

  useEffect(() => {
    fetchData(true)
  }, [an])

  useEffect(() => {
    if (an && user?.name) {
      socket.emit('case:join', { an, userName: user.name })
      return () => {
        socket.emit('case:leave', { an })
      }
    }
  }, [an, user])

  const fetchData = async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const [pRes, dRes] = await Promise.all([
        api.get(`/patients/${an}`),
        api.get(`/patients/${an}/detail`)
      ])
      setPatient(pRes.data)
      setDetails(dRes.data)
    } catch (err) {
      console.error('Fetch data error:', err)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('th-TH')
  }

  const formatMoney = (val) => {
    if (val === null || val === undefined) return '0.00'
    return Number(val).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (loading) {
    return <div className="h-screen flex items-center justify-center text-muted-foreground">กำลังโหลดข้อมูล...</div>
  }

  if (!patient) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-muted-foreground gap-4">
        <p>ไม่พบข้อมูลผู้ป่วย AN: {an}</p>
        <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline">กลับไปหน้าก่อนหน้า</button>
      </div>
    )
  }

  const paidMoney = Number(patient?.paid_money || 0)
  const totalDeposit = Number(patient?.total_deposit || 0)
  const rcptMoney = Number(patient?.rcpt_money || 0)
  const discountMoney = Number(details?.discount_money || 0)
  const pendingMoney = paidMoney - rcptMoney - totalDeposit - discountMoney

  return (
    <div className="w-full px-4 py-6 space-y-4 animate-in fade-in zoom-in-95 duration-500">
      {/* Back + Patient Info Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card rounded-2xl p-4 shadow-sm border border-border">
        <div className="flex items-center gap-3 w-full">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Patient Photo */}
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-background shadow-sm shrink-0">
            {!imgError ? (
              <img
                src={`/api/patients/${patient.hn}/image`}
                alt="Patient"
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <User className="w-6 h-6 text-muted-foreground" />
            )}
          </div>

          {/* Patient Details */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 flex-1 min-w-0">
            <div>
              <div className="flex items-baseline gap-2">
                <h2 className="text-lg font-bold leading-tight">{patient.fullname}</h2>
                <span className="text-sm text-muted-foreground">อายุ {patient.age ? `${patient.age} ปี` : '-'}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">AN: {patient.an}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">HN: {patient.hn}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Bed className="w-4 h-4 text-blue-500" />
                <span>เตียง <strong className="text-foreground">{patient.bedno || '-'}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-blue-500" />
                <span>{patient.ward_name || '-'}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span>วันที่ Admit: {formatDate(patient.regdate)}</span>
              </div>
              {details?.ward_phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-blue-500" />
                  <span>โทร. {details.ward_phone}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-blue-500" />
                <span>{patient.doctor_name || '-'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-500 shrink-0" />
                <span>{patient.pttype_name || '-'}</span>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="ml-auto flex items-center justify-end gap-6 text-sm w-full md:w-auto mt-4 md:mt-0">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">ค่าใช้จ่ายรวม</div>
                <div className="font-semibold">{formatMoney(patient.total_income)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">ชำระแล้ว</div>
                <div className="font-semibold text-emerald-600">{formatMoney(patient.rcpt_money)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">เงินมัดจำ</div>
                <div className="font-semibold text-emerald-600">{formatMoney(patient.total_deposit)}</div>
              </div>
              {pendingMoney > 0 && (
                <div className="text-right px-3 py-1 rounded-lg bg-red-50 border border-red-200">
                  <div className="text-xs text-red-600">ยอดชำระ</div>
                  <div className="font-bold text-red-600">{formatMoney(pendingMoney)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex flex-wrap items-center justify-between border-b border-border gap-2">
        <div className="flex space-x-1 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setIsFilterActive(false)
                }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
        
        {/* Dynamic Filter Toggle */}
        {(activeTab === 'drugs' || activeTab === 'lab') && (
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer px-3 py-1.5 mr-2 mb-1 bg-muted/40 hover:bg-muted/80 rounded-md transition-colors border border-border">
            <input 
              type="checkbox" 
              checked={isFilterActive}
              onChange={e => setIsFilterActive(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
            />
            {activeTab === 'drugs' ? 'แสดงเฉพาะรายการที่ซ้ำ' : 'แสดงเฉพาะรายการที่ยังไม่ได้รับ Specimen'}
          </label>
        )}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'checklist' && <ChecklistTab an={an} details={details} setDetails={setDetails} fetchData={fetchData} patient={patient} setActiveTab={setActiveTab} setIsFilterActive={setIsFilterActive} />}
        {activeTab === 'timeline' && <TimelineTab details={details} />}
        {activeTab === 'documents' && <DocumentsTab patient={patient} details={details} fetchDetails={fetchData} />}
        {activeTab === 'drugs' && <DrugProfileTab an={an} isFilterActive={isFilterActive} />}
        {activeTab === 'expenses' && <ExpensesTab an={an} />}
        {activeTab === 'discount' && <DiscountTab an={an} patient={patient} details={details} fetchDetails={fetchData} />}
        {activeTab === 'lab' && <LabTab an={an} isFilterActive={isFilterActive} />}
        {activeTab === 'operation' && <OperationTab an={an} hn={patient.hn} />}
        {activeTab === 'receipts' && <ReceiptsTab an={an} />}
      </div>
    </div>
  )
}
