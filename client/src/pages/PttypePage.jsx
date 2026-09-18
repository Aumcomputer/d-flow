import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  Bed, 
  Building2, 
  Calendar, 
  User, 
  Stethoscope, 
  FileText, 
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Sparkles
} from 'lucide-react'
import api from '../services/api'
import socket from '../services/socket'
import { useSound } from '../contexts/SoundContext'

const VALID_PTTYPE_TABS = ['approve', 'check']

export default function PttypePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { playAlert } = useSound()

  const [activeTab, setActiveTabState] = useState(() => {
    const urlTab = searchParams.get('tab')
    if (urlTab && VALID_PTTYPE_TABS.includes(urlTab)) return urlTab
    const savedTab = sessionStorage.getItem('pttype_activeTab')
    if (savedTab && VALID_PTTYPE_TABS.includes(savedTab)) return savedTab
    return 'approve'
  })

  const setActiveTab = (tab) => {
    setActiveTabState(tab)
    sessionStorage.setItem('pttype_activeTab', tab)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      return next
    }, { replace: true })
  }

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')
    if (tabFromUrl && VALID_PTTYPE_TABS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl)
      sessionStorage.setItem('pttype_activeTab', tabFromUrl)
    }
  }, [searchParams])
  
  // Tab 1: Unverified patients state
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(false)
  
  // Tab 2: Consulted patients state
  const [consults, setConsults] = useState([])
  const [historyConsults, setHistoryConsults] = useState([])
  const [loadingConsults, setLoadingConsults] = useState(false)
  const [approveSubTab, setApproveSubTab] = useState('pending') // 'pending' | 'history'

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWard, setSelectedWard] = useState('all')

  const fetchPatients = async () => {
    setLoading(true)
    try {
      const res = await api.get('/pttype/unverified')
      setPatients(res.data.patients || [])
    } catch (err) {
      console.error('Fetch pttype unverified error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchConsults = async () => {
    setLoadingConsults(true)
    try {
      const [pendingRes, historyRes] = await Promise.all([
        api.get('/pttype/consults'),
        api.get('/pttype/consults?history=true')
      ])
      setConsults(pendingRes.data.consults || [])
      setHistoryConsults(historyRes.data.consults || [])
    } catch (err) {
      console.error('Fetch pttype consults error:', err)
    } finally {
      setLoadingConsults(false)
    }
  }

  useEffect(() => {
    fetchPatients()
    fetchConsults()

    const onWorkflowUpdate = () => {
      fetchPatients()
    }

    const onConsultUpdate = () => {
      fetchConsults()
      fetchPatients()
      playAlert()
    }

    socket.on('workflow:updated', onWorkflowUpdate)
    socket.on('pttype:consult_updated', onConsultUpdate)

    return () => {
      socket.off('workflow:updated', onWorkflowUpdate)
      socket.off('pttype:consult_updated', onConsultUpdate)
    }
  }, [playAlert])

  // Current list for ward calculation
  const currentConsultList = approveSubTab === 'pending' ? consults : historyConsults
  const currentList = activeTab === 'check' ? patients : currentConsultList

  // Unique wards for filter dropdown (from current active list)
  const wards = useMemo(() => {
    const wardMap = new Map()
    currentList.forEach(p => {
      if (p.ward_name && p.ward_name !== '-') {
        wardMap.set(p.ward_name, p.ward_name)
      }
    })
    return Array.from(wardMap.values()).sort()
  }, [currentList])

  // Filtered patients for Tab ตรวจสอบสิทธิ์
  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const matchesWard = selectedWard === 'all' || p.ward_name === selectedWard
      if (!matchesWard) return false

      const q = searchQuery.trim().toLowerCase()
      if (!q) return true

      return (
        (p.an && p.an.toLowerCase().includes(q)) ||
        (p.hn && p.hn.toLowerCase().includes(q)) ||
        (p.fname && p.fname.toLowerCase().includes(q)) ||
        (p.lname && p.lname.toLowerCase().includes(q)) ||
        (p.pttype_name && p.pttype_name.toLowerCase().includes(q)) ||
        (p.doctor_name && p.doctor_name.toLowerCase().includes(q)) ||
        (p.bedno && String(p.bedno).toLowerCase().includes(q))
      )
    })
  }, [patients, selectedWard, searchQuery])

  // Filtered consults for Tab อนุมัติสิทธิ์
  const filteredConsults = useMemo(() => {
    return currentConsultList.filter(c => {
      const matchesWard = selectedWard === 'all' || c.ward_name === selectedWard
      if (!matchesWard) return false

      const q = searchQuery.trim().toLowerCase()
      if (!q) return true

      return (
        (c.an && c.an.toLowerCase().includes(q)) ||
        (c.hn && c.hn.toLowerCase().includes(q)) ||
        (c.fname && c.fname.toLowerCase().includes(q)) ||
        (c.lname && c.lname.toLowerCase().includes(q)) ||
        (c.pttype_name && c.pttype_name.toLowerCase().includes(q)) ||
        (c.grant_pttype_name && c.grant_pttype_name.toLowerCase().includes(q)) ||
        (c.consult_pttype_doctor_name && c.consult_pttype_doctor_name.toLowerCase().includes(q)) ||
        (c.consult_pttype_reason && c.consult_pttype_reason.toLowerCase().includes(q)) ||
        (c.consult_pttype_by_name && c.consult_pttype_by_name.toLowerCase().includes(q)) ||
        (c.grant_pttype_by_name && c.grant_pttype_by_name.toLowerCase().includes(q)) ||
        (c.bedno && String(c.bedno).toLowerCase().includes(q))
      )
    })
  }, [currentConsultList, selectedWard, searchQuery])

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('th-TH', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(dateStr)
      return `${d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`
    } catch {
      return dateStr
    }
  }

  const handleRowClick = (an) => {
    navigate(`/dcdetail/${an}?tab=documents`)
  }

  const handleRefresh = () => {
    if (activeTab === 'check') {
      fetchPatients()
    } else {
      fetchConsults()
    }
  }

  const emergencyCount = consults.filter(c => c.consult_pttype_urgency === 'ฉุกเฉิน').length

  return (
    <div className="w-full px-4 py-6 space-y-6 animate-in fade-in zoom-in-95 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card rounded-2xl p-5 border border-border shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="bg-sky-500/10 p-3 rounded-2xl border border-sky-500/20 text-sky-600">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">งานสิทธิ์</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700 font-semibold border border-sky-200">
                ข้อมูลสิทธิผู้ป่วย
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              ระบบตรวจสอบและจัดการสิทธิ์การรักษาผู้ป่วยใน (IPD)
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Ward filter */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="px-3 py-2 text-sm border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
            >
              <option value="all">ทุกหอผู้ป่วย ({currentList.length})</option>
              {wards.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา AN, HN, ชื่อ, สิทธิ์..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-sky-500 transition-colors"
            />
          </div>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={loading || loadingConsults}
            className="p-2.5 border border-input rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${(loading || loadingConsults) ? 'animate-spin text-sky-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-border">
        {/* Tab 1: อนุมัติสิทธิ์ */}
        <button
          onClick={() => { setActiveTab('approve'); setSelectedWard('all'); setSearchQuery(''); }}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'approve'
              ? 'border-sky-600 text-sky-600 bg-sky-50/50 rounded-t-xl'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>อนุมัติสิทธิ์</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            emergencyCount > 0 
              ? 'bg-rose-500 text-white animate-pulse' 
              : consults.length > 0
                ? 'bg-amber-500 text-white'
                : activeTab === 'approve' 
                  ? 'bg-sky-600 text-white' 
                  : 'bg-muted text-muted-foreground'
          }`}>
            {consults.length}
          </span>
        </button>

        {/* Tab 2: ตรวจสอบสิทธิ์ */}
        <button
          onClick={() => { setActiveTab('check'); setSelectedWard('all'); setSearchQuery(''); }}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'check'
              ? 'border-sky-600 text-sky-600 bg-sky-50/50 rounded-t-xl'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>ตรวจสอบสิทธิ์</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
            activeTab === 'check' ? 'bg-sky-600 text-white' : 'bg-muted text-muted-foreground'
          }`}>
            {patients.length}
          </span>
        </button>
      </div>

      {/* Tab 1: ตรวจสอบสิทธิ์ Content */}
      {activeTab === 'check' && (
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border uppercase text-xs font-semibold">
                <tr>
                  <th className="px-4 py-3.5 w-32">หอผู้ป่วย</th>
                  <th className="px-4 py-3.5 w-24">เตียง</th>
                  <th className="px-4 py-3.5 w-40">AN / HN</th>
                  <th className="px-4 py-3.5 min-w-[200px]">ชื่อ-สกุล</th>
                  <th className="px-4 py-3.5 min-w-[180px]">สิทธิ์การรักษา</th>
                  <th className="px-4 py-3.5 w-32">วันที่ Admit</th>
                  <th className="px-4 py-3.5 min-w-[180px]">แพทย์เจ้าของไข้</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-sky-600" />
                        <span>กำลังโหลดข้อมูลผู้ป่วย...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
                          <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <div className="text-base font-semibold text-slate-700">
                          {searchQuery || selectedWard !== 'all' 
                            ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา' 
                            : 'ผู้ป่วยทุกคนได้รับการตรวจสอบสิทธิ์เรียบร้อยแล้ว'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {searchQuery || selectedWard !== 'all'
                            ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรองหอผู้ป่วย'
                            : 'ไม่มีผู้ป่วยที่ค้างตรวจสอบสิทธิ์ในขณะนี้'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map(p => (
                    <tr
                      key={p.an}
                      onClick={() => handleRowClick(p.an)}
                      className="hover:bg-sky-50/60 cursor-pointer transition-colors group"
                      title="คลิกเพื่อเปิดหน้าเอกสารสิทธิ์"
                    >
                      {/* หอผู้ป่วย */}
                      <td className="px-4 py-3.5 font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-sky-600 shrink-0 opacity-70 group-hover:opacity-100" />
                          <span className="truncate" title={p.ward_name}>{p.ward_name || '-'}</span>
                        </div>
                      </td>

                      {/* เตียง */}
                      <td className="px-4 py-3.5">
                        <div className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-xs">
                          <Bed className="w-3.5 h-3.5 text-slate-500" />
                          <span>{p.bedno || '-'}</span>
                        </div>
                      </td>

                      {/* AN / HN */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-blue-600 group-hover:underline">{p.an}</div>
                        <div className="text-xs text-muted-foreground">HN: {p.hn}</div>
                      </td>

                      {/* ชื่อ-สกุล */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800">
                          {p.pname}{p.fname} {p.lname}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          อายุ {p.age_y !== null && p.age_y !== undefined ? `${p.age_y} ปี` : '-'}
                        </div>
                      </td>

                      {/* สิทธิ์การรักษา */}
                      <td className="px-4 py-3.5">
                        <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/60 line-clamp-1" title={p.pttype_name}>
                          {p.pttype_name || '-'}
                        </span>
                      </td>

                      {/* วันที่ Admit */}
                      <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDate(p.admit_date)}</span>
                        </div>
                      </td>

                      {/* แพทย์เจ้าของไข้ */}
                      <td className="px-4 py-3.5 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Stethoscope className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[200px]" title={p.doctor_name}>
                            {p.doctor_name || '-'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer stats */}
          {!loading && filteredPatients.length > 0 && (
            <div className="px-5 py-3 border-t border-border bg-muted/20 flex flex-col sm:flex-row justify-between items-center text-xs text-muted-foreground gap-2">
              <div>
                แสดง {filteredPatients.length} รายการ (จากทั้งหมด {patients.length} รายการที่รอตรวจสอบ)
              </div>
              <div className="text-slate-500 font-medium">
                💡 คลิกที่แถวผู้ป่วยเพื่อเข้าสู่หน้า <span className="text-sky-700 underline font-semibold">เอกสารสิทธิ์</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 1: อนุมัติสิทธิ์ Content */}
      {activeTab === 'approve' && (
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          {/* Sub-tabs: รออนุมัติ / ประวัติอนุมัติแล้ว */}
          <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 pt-2.5">
            <div className="flex space-x-2">
              <button
                onClick={() => { setApproveSubTab('pending'); setSearchQuery(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
                  approveSubTab === 'pending'
                    ? 'border-sky-600 text-sky-600 bg-white rounded-t-xl shadow-2xs'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <Clock className="w-4 h-4 text-amber-500" />
                <span>รออนุมัติ</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  emergencyCount > 0
                    ? 'bg-rose-500 text-white animate-pulse'
                    : consults.length > 0
                      ? 'bg-amber-500 text-white'
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {consults.length}
                </span>
              </button>

              <button
                onClick={() => { setApproveSubTab('history'); setSearchQuery(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
                  approveSubTab === 'history'
                    ? 'border-emerald-600 text-emerald-600 bg-white rounded-t-xl shadow-2xs'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>ประวัติอนุมัติแล้ว</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                  {historyConsults.length}
                </span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border uppercase text-xs font-semibold">
                {approveSubTab === 'pending' ? (
                  <tr>
                    <th className="px-4 py-3.5 w-28">ความเร่งด่วน</th>
                    <th className="px-4 py-3.5 w-32">หอผู้ป่วย / เตียง</th>
                    <th className="px-4 py-3.5 w-36">AN / HN</th>
                    <th className="px-4 py-3.5 min-w-[180px]">ชื่อ-สกุล</th>
                    <th className="px-4 py-3.5 min-w-[160px]">สิทธิ์การรักษา</th>
                    <th className="px-4 py-3.5 min-w-[160px]">รศส. แพทย์</th>
                    <th className="px-4 py-3.5 min-w-[200px]">สาเหตุที่ส่งปรึกษา</th>
                    <th className="px-4 py-3.5 min-w-[180px]">ผู้ส่งปรึกษา / เวลา</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-4 py-3.5 w-28">ความเร่งด่วน</th>
                    <th className="px-4 py-3.5 w-32">หอผู้ป่วย / เตียง</th>
                    <th className="px-4 py-3.5 w-36">AN / HN</th>
                    <th className="px-4 py-3.5 min-w-[180px]">ชื่อ-สกุล</th>
                    <th className="px-4 py-3.5 min-w-[150px]">สิทธิ์เดิม (HIS)</th>
                    <th className="px-4 py-3.5 min-w-[180px]">สิทธิ์ที่ได้รับอนุมัติ</th>
                    <th className="px-4 py-3.5 min-w-[160px]">รศส. แพทย์</th>
                    <th className="px-4 py-3.5 min-w-[180px]">ผู้อนุมัติ / วันที่อนุมัติ</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-border">
                {loadingConsults ? (
                  <tr>
                    <td colSpan="8" className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-sky-600" />
                        <span>กำลังโหลดข้อมูลเคสส่งปรึกษา...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredConsults.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-16 text-muted-foreground">
                      {approveSubTab === 'pending' ? (
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
                            <CheckCircle2 className="w-8 h-8" />
                          </div>
                          <div className="text-base font-semibold text-slate-700">
                            {searchQuery || selectedWard !== 'all'
                              ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา' 
                              : 'ไม่มีรายการส่งปรึกษาสิทธิการรักษาที่รออนุมัติ'}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {searchQuery || selectedWard !== 'all'
                              ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรองหอผู้ป่วย'
                              : 'ผู้ป่วยทุกคนที่ส่งปรึกษาได้รับการอนุมัติสิทธิ์เรียบร้อยแล้ว ✓'}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="p-3 bg-slate-100 rounded-full text-slate-500">
                            <FileText className="w-8 h-8 text-slate-400" />
                          </div>
                          <div className="text-base font-semibold text-slate-700">
                            {searchQuery || selectedWard !== 'all'
                              ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา' 
                              : 'ยังไม่มีประวัติการอนุมัติสิทธิ์'}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            เมื่อเจ้าหน้าที่งานสิทธิ์บันทึกให้สิทธิ์แล้ว รายการจะปรากฏที่นี่
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredConsults.map(c => {
                    const isEmergency = c.consult_pttype_urgency === 'ฉุกเฉิน'
                    return (
                      <tr
                        key={c.an}
                        onClick={() => handleRowClick(c.an)}
                        className={`cursor-pointer transition-colors group ${
                          isEmergency 
                            ? 'bg-rose-50/40 hover:bg-rose-100/50' 
                            : 'hover:bg-sky-50/60'
                        }`}
                        title="คลิกเพื่อเปิดหน้าเอกสารสิทธิ์"
                      >
                        {/* ความเร่งด่วน */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                            isEmergency
                              ? 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse'
                              : 'bg-sky-100 text-sky-700 border-sky-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isEmergency ? 'bg-rose-600' : 'bg-sky-600'}`} />
                            {c.consult_pttype_urgency || 'ไม่ฉุกเฉิน'}
                          </span>
                        </td>

                        {/* หอผู้ป่วย / เตียง */}
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-800 truncate" title={c.ward_name}>
                            {c.ward_name || '-'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            เตียง: <span className="font-semibold text-slate-700">{c.bedno || '-'}</span>
                          </div>
                        </td>

                        {/* AN / HN */}
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-blue-600 group-hover:underline">{c.an}</div>
                          <div className="text-xs text-muted-foreground">HN: {c.hn}</div>
                        </td>

                        {/* ชื่อ-สกุล */}
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-800">
                            {c.pname}{c.fname} {c.lname}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            อายุ {c.age_y !== null && c.age_y !== undefined ? `${c.age_y} ปี` : '-'}
                          </div>
                        </td>

                        {/* If pending: show สิทธิ์การรักษา, If history: show สิทธิ์เดิม (HIS) */}
                        <td className="px-4 py-3.5">
                          <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/60 line-clamp-1" title={c.pttype_name}>
                            {c.pttype_name || '-'}
                          </span>
                        </td>

                        {/* Pending view: รศส. แพทย์, สาเหตุ, ผู้ส่งปรึกษา / เวลา */}
                        {approveSubTab === 'pending' ? (
                          <>
                            {/* รศส. แพทย์ */}
                            <td className="px-4 py-3.5 text-slate-700">
                              <div className="flex items-center gap-1.5">
                                <Stethoscope className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[180px] font-medium" title={c.consult_pttype_doctor_name}>
                                  {c.consult_pttype_doctor_name || '-'}
                                </span>
                              </div>
                            </td>

                            {/* สาเหตุที่ส่งปรึกษา */}
                            <td className="px-4 py-3.5">
                              <div className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-slate-200/80 line-clamp-2 max-w-[260px]" title={c.consult_pttype_reason}>
                                {c.consult_pttype_reason || '-'}
                              </div>
                            </td>

                            {/* ผู้ส่งปรึกษา / เวลา */}
                            <td className="px-4 py-3.5 text-xs text-muted-foreground">
                              <div className="font-medium text-slate-800">
                                {c.consult_pttype_by_name || c.consult_pttype_by || '-'}
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{formatDateTime(c.consult_pttype_date)}</span>
                              </div>
                            </td>
                          </>
                        ) : (
                          /* History view: สิทธิ์ที่ได้รับอนุมัติ, รศส. แพทย์, ผู้อนุมัติ / วันที่อนุมัติ */
                          <>
                            {/* สิทธิ์ที่ได้รับอนุมัติ */}
                            <td className="px-4 py-3.5">
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  ให้สิทธิ์แล้ว
                                </span>
                                <div className="text-xs font-semibold text-slate-800 truncate max-w-[180px]" title={c.grant_pttype_name}>
                                  {c.grant_pttype_code ? `[${c.grant_pttype_code}] ` : ''}{c.grant_pttype_name}
                                </div>
                                {c.grant_pttype_asm_type && (
                                  <span className="inline-block text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-100 font-medium">
                                    อสม.
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* รศส. แพทย์ */}
                            <td className="px-4 py-3.5 text-slate-700">
                              <div className="flex items-center gap-1.5">
                                <Stethoscope className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[180px] font-medium" title={c.consult_pttype_doctor_name}>
                                  {c.consult_pttype_doctor_name || '-'}
                                </span>
                              </div>
                            </td>

                            {/* ผู้อนุมัติ / เวลาที่อนุมัติ */}
                            <td className="px-4 py-3.5 text-xs text-muted-foreground">
                              <div className="font-medium text-slate-800">
                                {c.grant_pttype_by_name || c.grant_pttype_by || '-'}
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{formatDateTime(c.grant_pttype_date)}</span>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer stats */}
          {!loadingConsults && filteredConsults.length > 0 && (
            <div className="px-5 py-3 border-t border-border bg-muted/20 flex flex-col sm:flex-row justify-between items-center text-xs text-muted-foreground gap-2">
              <div>
                แสดง {filteredConsults.length} รายการ (จาก{approveSubTab === 'pending' ? 'เคสรออนุมัติทั้งหมด ' + consults.length : 'ประวัติอนุมัติทั้งหมด ' + historyConsults.length} รายการ)
              </div>
              <div className="text-slate-500 font-medium">
                💡 คลิกที่แถวผู้ป่วยเพื่อเข้าสู่หน้า <span className="text-sky-700 underline font-semibold">เอกสารสิทธิ์</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
