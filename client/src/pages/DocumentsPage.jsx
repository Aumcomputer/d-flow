import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import socket from '../services/socket'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Skeleton } from '../components/ui/skeleton'
import DocumentsTab from '../components/DocumentsTab'
import { 
  FileText, 
  Search, 
  User, 
  Bed, 
  Calendar, 
  Stethoscope, 
  Shield, 
  CreditCard, 
  Building2, 
  AlertCircle,
  AlertTriangle,
  LogOut,
  Copy,
  Check,
  RefreshCw,
  FileX,
  FileClock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'

export default function DocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialAn = searchParams.get('an') || ''
  
  // Patient details view state
  const [searchAN, setSearchAN] = useState(initialAn)
  const [patient, setPatient] = useState(null)
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [imgError, setImgError] = useState(false)
  const [copiedCid, setCopiedCid] = useState(false)

  // Inpatient list tabs state
  const [activeTab, setActiveTabState] = useState(() => {
    const urlTab = searchParams.get('tab')
    if (urlTab === 'no_docs' || urlTab === 'incomplete') return urlTab
    const savedTab = sessionStorage.getItem('doc_activeTab')
    if (savedTab === 'no_docs' || savedTab === 'incomplete') return savedTab
    return 'no_docs'
  })

  const [noDocsPatients, setNoDocsPatients] = useState([])
  const [incompletePatients, setIncompletePatients] = useState([])
  const [loadingInpatients, setLoadingInpatients] = useState(false)

  // Filters & Search for Table
  const [selectedWard, setSelectedWard] = useState(() => {
    return localStorage.getItem('doc_selectedWard') || 'all'
  })

  const handleWardChange = (ward) => {
    setSelectedWard(ward)
    localStorage.setItem('doc_selectedWard', ward)
  }

  // Sorting state for table
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' })

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600 font-bold shrink-0" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600 font-bold shrink-0" />
    )
  }

  const setActiveTab = (tab) => {
    setActiveTabState(tab)
    sessionStorage.setItem('doc_activeTab', tab)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      return next
    }, { replace: true })
  }

  const handleTabClick = (tab) => {
    if (patient) {
      setPatient(null)
      setDetails(null)
      setSearchAN('')
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.delete('an')
        next.set('tab', tab)
        return next
      }, { replace: true })
    }
    setActiveTab(tab)
  }

  const handleClearPatient = () => {
    setPatient(null)
    setDetails(null)
    setSearchAN('')
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('an')
      return next
    }, { replace: true })
  }

  // Fetch list of inpatients categorized by document completeness
  const fetchInpatients = useCallback(async () => {
    setLoadingInpatients(true)
    try {
      const res = await api.get('/documents/inpatients')
      setNoDocsPatients(res.data.no_docs || [])
      setIncompletePatients(res.data.incomplete || [])
    } catch (err) {
      console.error('Fetch inpatients error:', err)
    } finally {
      setLoadingInpatients(false)
    }
  }, [])

  useEffect(() => {
    fetchInpatients()

    const onDocUpdate = () => {
      fetchInpatients()
    }

    socket.on('documents:updated', onDocUpdate)
    socket.on('workflow:updated', onDocUpdate)

    return () => {
      socket.off('documents:updated', onDocUpdate)
      socket.off('workflow:updated', onDocUpdate)
    }
  }, [fetchInpatients])

  const copyToClipboard = async (text) => {
    if (!text) return false

    // 1. Try modern navigator.clipboard if in secure context (HTTPS / localhost)
    if (navigator?.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch (err) {
        console.warn('navigator.clipboard failed, attempting fallback...', err)
      }
    }

    // 2. Reliable fallback for HTTP/intranet LAN using textarea + document.execCommand
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      textArea.style.top = '-9999px'
      textArea.setAttribute('readonly', '')
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      return successful
    } catch (fallbackErr) {
      console.error('Copy fallback failed:', fallbackErr)
      return false
    }
  }

  const handleCopyCid = async (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const cidToCopy = String(patient?.cid || '').trim()
    if (!cidToCopy) return

    const success = await copyToClipboard(cidToCopy)
    if (success) {
      setCopiedCid(true)
      setTimeout(() => setCopiedCid(false), 2000)
    }
  }

  const validateQuery = (rawInput) => {
    const trimmed = String(rawInput || '').trim()
    if (!trimmed) {
      return { isValid: false, error: 'กรุณากรอกหมายเลข HN หรือ AN' }
    }

    const clean = trimmed.replace(/^(hn|an):?\s*/i, '').trim()

    if (!clean) {
      return { isValid: false, error: 'กรุณากรอกหมายเลข HN หรือ AN' }
    }

    if (!/^\d+$/.test(clean)) {
      return { isValid: false, error: 'หมายเลข HN หรือ AN ต้องเป็นตัวเลขเท่านั้น' }
    }

    if (clean.length !== 7 && clean.length !== 9) {
      return { 
        isValid: false, 
        error: `ข้อมูลไม่ถูกต้อง: HN ต้องเป็นตัวเลข 7 หลัก หรือ AN เป็นตัวเลข 9 หลัก (ปัจจุบันคุณระบุ ${clean.length} หลัก)` 
      }
    }

    return { isValid: true, cleanValue: clean }
  }

  const fetchPatientData = useCallback(async (queryToFetch) => {
    const validation = validateQuery(queryToFetch)
    if (!validation.isValid) {
      setError(validation.error)
      setPatient(null)
      setDetails(null)
      return
    }

    const cleanQuery = validation.cleanValue
    setLoading(true)
    setError('')
    setPatient(null)
    setDetails(null)
    setImgError(false)

    try {
      // 1. ตรวจสอบและดึง AN (หากค้นหาด้วย HN จะอนุญาตเฉพาะรายที่ Admit; ค้นหาด้วย AN อนุญาตทั้งหมด)
      const lookupRes = await api.get(`/patients/admitted/lookup?q=${encodeURIComponent(cleanQuery)}`)
      const resolvedAn = lookupRes.data.an
      setSearchAN(resolvedAn)
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.set('an', resolvedAn)
        return next
      }, { replace: true })

      // 2. ดึงข้อมูลผู้ป่วยและรายละเอียดเอกสาร
      const [pRes, dRes] = await Promise.all([
        api.get(`/patients/${resolvedAn}`),
        api.get(`/patients/${resolvedAn}/detail`)
      ])

      setPatient(pRes.data)
      setDetails(dRes.data)
    } catch (err) {
      if (err.response?.data?.error) {
        setError(err.response.data.error)
      } else if (err.response?.status === 404) {
        setError(`ไม่พบข้อมูลผู้ป่วยสำหรับรหัส "${cleanQuery}"`)
      } else {
        setError('เกิดข้อผิดพลาดในการค้นหาข้อมูลผู้ป่วย')
      }
      setPatient(null)
      setDetails(null)
    } finally {
      setLoading(false)
    }
  }, [setSearchParams])

  useEffect(() => {
    if (initialAn) {
      fetchPatientData(initialAn)
    }
  }, [initialAn, fetchPatientData])

  const handleSearch = (e) => {
    e?.preventDefault()
    fetchPatientData(searchAN)
  }

  const handleSelectPatient = (an) => {
    fetchPatientData(an)
  }

  const fetchDetails = async () => {
    if (!patient?.an) return
    try {
      const [pRes, dRes] = await Promise.all([
        api.get(`/patients/${patient.an}`),
        api.get(`/patients/${patient.an}/detail`)
      ])
      setPatient(pRes.data)
      setDetails(dRes.data)
    } catch (err) {
      console.error('Fetch details error:', err)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('th-TH', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    } catch {
      return dateStr
    }
  }

  const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr) return '-'
    const date = formatDate(dateStr)
    return timeStr ? `${date} เวลา ${timeStr.substring(0, 5)} น.` : date
  }

  // Current list for the active tab
  const currentList = activeTab === 'no_docs' ? noDocsPatients : incompletePatients

  // Unique wards for filter dropdown
  const wards = useMemo(() => {
    const wardMap = new Map()
    currentList.forEach(p => {
      if (p.ward_name && p.ward_name !== '-') {
        wardMap.set(p.ward_name, p.ward_name)
      }
    })
    if (selectedWard && selectedWard !== 'all' && !wardMap.has(selectedWard)) {
      wardMap.set(selectedWard, selectedWard)
    }
    return Array.from(wardMap.values()).sort()
  }, [currentList, selectedWard])

  // Filtered & Sorted patients for the active tab
  const filteredPatients = useMemo(() => {
    let items = currentList.filter(p => {
      const matchesWard = selectedWard === 'all' || p.ward_name === selectedWard
      if (!matchesWard) return false

      const q = (searchAN || '').trim().toLowerCase()
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

    if (sortConfig.key) {
      items.sort((a, b) => {
        let aVal = a[sortConfig.key]
        let bVal = b[sortConfig.key]

        // Date sorting
        if (sortConfig.key === 'admit_date') {
          const aTime = aVal ? new Date(aVal).getTime() : 0
          const bTime = bVal ? new Date(bVal).getTime() : 0
          return sortConfig.direction === 'asc' ? aTime - bTime : bTime - aTime
        }

        // Numeric doc_count sorting
        if (sortConfig.key === 'doc_count') {
          const aNum = Number(aVal || 0)
          const bNum = Number(bVal || 0)
          return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum
        }

        // AN / HN / Bed sorting with natural alphanumeric compare (e.g. 1, 2, 10 instead of 1, 10, 2)
        if (sortConfig.key === 'an' || sortConfig.key === 'hn' || sortConfig.key === 'bedno') {
          const aStr = String(aVal || '')
          const bStr = String(bVal || '')
          return sortConfig.direction === 'asc'
            ? aStr.localeCompare(bStr, undefined, { numeric: true })
            : bStr.localeCompare(aStr, undefined, { numeric: true })
        }

        // Thai / String compare
        const aStr = String(aVal || '')
        const bStr = String(bVal || '')
        return sortConfig.direction === 'asc'
          ? aStr.localeCompare(bStr, 'th')
          : bStr.localeCompare(aStr, 'th')
      })
    }

    return items
  }, [currentList, selectedWard, searchAN, sortConfig])

  const handleRefresh = () => {
    fetchInpatients()
    if (patient?.an) {
      fetchDetails()
    }
  }

  return (
    <div className="w-full px-4 sm:px-6 py-6 space-y-6 animate-in fade-in zoom-in-95 duration-500">
      {/* Top Bar: Title + Controls on top right */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-card p-4 sm:p-5 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-xl text-white shadow-sm shrink-0">
            <FileText className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
              เวชระเบียน
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              จัดการเอกสารผู้ป่วย สแกนเอกสาร และส่งปรึกษาสิทธิการรักษา
            </p>
          </div>
        </div>

        {/* Top Right Controls: Ward filter + Search HN/AN + Refresh */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Ward filter (ค้นหาหอผู้ป่วย) */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <select
              value={selectedWard}
              onChange={(e) => {
                handleWardChange(e.target.value)
                if (patient) {
                  handleClearPatient()
                }
              }}
              className="px-3 py-2 text-sm border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              <option value="all">ทุกหอผู้ป่วย ({currentList.length})</option>
              {wards.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          {/* Search by HN or AN */}
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 sm:flex-initial sm:min-w-[260px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="ค้นหาด้วย HN หรือ AN..."
                value={searchAN}
                onChange={(e) => {
                  setSearchAN(e.target.value)
                  if (error) setError('')
                }}
                className="pl-9 rounded-xl shadow-xs border-slate-200 focus:border-blue-500 text-sm"
              />
            </div>
            <Button 
              type="submit" 
              disabled={loading || !searchAN.trim()} 
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-xs"
            >
              {loading ? 'กำลังค้นหา...' : 'ค้นหา'}
            </Button>
          </form>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={loadingInpatients || loading}
            className="p-2.5 border border-input rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${(loadingInpatients || loading) ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl font-medium shadow-xs border border-red-200 flex items-center gap-3 animate-slide-up">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton for Direct Patient Search */}
      {loading && (
        <div className="bg-card rounded-2xl p-6 border border-border shadow-xs space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      )}

      {/* Tabs (แสดงเฉพาะเมื่ออยู่หน้ารายการผู้ป่วย เมื่อไม่ได้เลือกคนไข้) */}
      {!patient && (
        <div className="flex space-x-2 border-b border-border">
          {/* Tab 1: ยังไม่มีเอกสารสิทธิ์ */}
          <button
            onClick={() => handleTabClick('no_docs')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'no_docs'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-xl'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <FileX className="w-4 h-4" />
            <span>ยังไม่มีเอกสารสิทธิ์</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              noDocsPatients.length > 0 
                ? 'bg-rose-500 text-white' 
                : 'bg-muted text-muted-foreground'
            }`}>
              {noDocsPatients.length}
            </span>
          </button>

          {/* Tab 2: เอกสารสิทธิ์ไม่ครบ */}
          <button
            onClick={() => handleTabClick('incomplete')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'incomplete'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-xl'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <FileClock className="w-4 h-4" />
            <span>เอกสารสิทธิ์ไม่ครบ</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              incompletePatients.length > 0 
                ? 'bg-amber-500 text-white' 
                : 'bg-muted text-muted-foreground'
            }`}>
              {incompletePatients.length}
            </span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {!loading && patient ? (
        /* Patient Information Card & DocumentsTab */
        <div className="space-y-6">
          {/* Patient Info Bar */}
          <div className={`bg-card rounded-2xl p-5 shadow-sm border ${
            patient.dchdate ? 'border-amber-300 ring-1 ring-amber-200' : 'border-border'
          }`}>
            {/* Warning Banner if Discharged */}
            {patient.dchdate && (
              <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-sm font-medium animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>
                    ผู้ป่วยรายนี้ <strong className="text-amber-900 font-bold underline underline-offset-2">Discharge (จำหน่าย) แล้ว</strong> เมื่อ {formatDateTime(patient.dchdate, patient.dchtime)}
                  </span>
                </div>
                {patient.dchstts_name && (
                  <span className="text-xs bg-amber-100/90 text-amber-900 px-2.5 py-1 rounded-lg border border-amber-300 font-semibold">
                    สถานะ: {patient.dchstts_name}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              {/* Back Button like in /dcdetail/ */}
              <button 
                onClick={handleClearPatient} 
                className="p-2.5 hover:bg-muted rounded-full transition-colors shrink-0 text-slate-600 hover:text-slate-900 border border-transparent hover:border-border"
                title="ย้อนกลับไปรายการผู้ป่วย"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Photo */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-inner shrink-0">
                {!imgError && patient.hn ? (
                  <img 
                    src={`/api/patients/${patient.hn}/image`} 
                    alt="Patient" 
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <User className="w-10 h-10 text-blue-500" />
                )}
              </div>

              {/* Patient Info Details */}
              <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Col 1: Name, Sex, Age, AN, HN */}
                <div>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                      {patient.fullname}
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium whitespace-nowrap">
                      {patient.sex === '1' ? 'ชาย' : patient.sex === '2' ? 'หญิง' : '-'} • {patient.age != null ? `${patient.age} ปี` : '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                      AN: {patient.an}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-100">
                      HN: {patient.hn}
                    </span>
                    {patient.dchdate && (
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-bold border border-amber-300 flex items-center gap-1">
                        <LogOut className="w-3.5 h-3.5 text-amber-600" />
                        Discharge แล้ว
                      </span>
                    )}
                  </div>
                </div>

                {/* Col 2: Ward & Bed */}
                <div className="space-y-1.5 text-sm text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="truncate">หอผู้ป่วย: <strong className="text-slate-800">{patient.ward_name || '-'}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Bed className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>เตียง: <strong className="text-slate-800">{patient.bedno || '-'}</strong></span>
                  </div>
                  {patient.cid && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <CreditCard className="w-4 h-4 text-blue-500 shrink-0" />
                      <span 
                        onClick={handleCopyCid}
                        title="คลิกเพื่อคัดลอก CID"
                        className="font-mono cursor-pointer hover:text-blue-600 select-all transition-colors"
                      >
                        CID: <strong className="text-slate-800 hover:text-blue-700">{patient.cid}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyCid}
                        title={copiedCid ? "คัดลอกแล้ว" : "คัดลอกเลข CID"}
                        className={`p-1 rounded-md transition-all inline-flex items-center justify-center ${
                          copiedCid 
                            ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-300' 
                            : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        {copiedCid ? (
                          <Check className="w-3.5 h-3.5 animate-in zoom-in-75 duration-150" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {copiedCid && (
                        <span className="text-[11px] text-emerald-600 font-medium animate-in fade-in duration-150">
                          คัดลอกแล้ว
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Col 3: Admit Date & Doctor */}
                <div className="space-y-1.5 text-sm text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="truncate">Admit: <strong className="text-slate-800">{formatDateTime(patient.regdate, patient.regtime)}</strong></span>
                  </div>
                  {patient.dchdate && (
                    <div className="flex items-center gap-1.5 text-amber-700">
                      <LogOut className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="truncate">Discharge: <strong className="text-amber-900">{formatDateTime(patient.dchdate, patient.dchtime)}</strong></span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Stethoscope className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="truncate">แพทย์: <strong className="text-slate-800">{patient.doctor_name || '-'}</strong></span>
                  </div>
                </div>

                {/* Col 4: Pttype */}
                <div className="space-y-1 text-sm text-slate-600">
                  <div className="flex items-start gap-1.5">
                    <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-xs text-muted-foreground block">สิทธิ์การรักษา:</span>
                      <span className="font-semibold text-blue-700 text-xs sm:text-sm line-clamp-2">
                        {patient.pttype_name || '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Documents Tab (Checklist + Upload + Scans + Consult Rights + Grant Rights + Comments) */}
          <DocumentsTab 
            patient={patient} 
            details={details} 
            fetchDetails={fetchDetails} 
          />
        </div>
      ) : !loading && (
        /* Inpatient Lists Table for active tab (คล้าย /pttype?tab=check) */
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border uppercase text-xs font-semibold">
                <tr>
                  <th 
                    onClick={() => handleSort('ward_name')}
                    className="px-4 py-3.5 w-36 cursor-pointer hover:bg-muted/80 select-none transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>หอผู้ป่วย</span>
                      {renderSortIcon('ward_name')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('an')}
                    className="px-4 py-3.5 w-32 cursor-pointer hover:bg-muted/80 select-none transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>AN</span>
                      {renderSortIcon('an')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('hn')}
                    className="px-4 py-3.5 w-28 cursor-pointer hover:bg-muted/80 select-none transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>HN</span>
                      {renderSortIcon('hn')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('fname')}
                    className="px-4 py-3.5 min-w-[200px] cursor-pointer hover:bg-muted/80 select-none transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>ชื่อ-สกุล</span>
                      {renderSortIcon('fname')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('pttype_name')}
                    className="px-4 py-3.5 min-w-[180px] cursor-pointer hover:bg-muted/80 select-none transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>สิทธิ์การรักษา</span>
                      {renderSortIcon('pttype_name')}
                    </div>
                  </th>
                  {activeTab === 'incomplete' && (
                    <th 
                      onClick={() => handleSort('doc_count')}
                      className="px-4 py-3.5 min-w-[260px] cursor-pointer hover:bg-muted/80 select-none transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>สถานะเอกสาร</span>
                        {renderSortIcon('doc_count')}
                      </div>
                    </th>
                  )}
                  <th 
                    onClick={() => handleSort('admit_date')}
                    className="px-4 py-3.5 w-36 cursor-pointer hover:bg-muted/80 select-none transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>วันที่ Admit</span>
                      {renderSortIcon('admit_date')}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('doctor_name')}
                    className="px-4 py-3.5 min-w-[180px] cursor-pointer hover:bg-muted/80 select-none transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>แพทย์เจ้าของไข้</span>
                      {renderSortIcon('doctor_name')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loadingInpatients ? (
                  <tr>
                    <td colSpan={activeTab === 'incomplete' ? 8 : 7} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                        <span>กำลังโหลดข้อมูลผู้ป่วย...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'incomplete' ? 8 : 7} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
                          <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <div className="text-base font-semibold text-slate-700">
                          {searchAN || selectedWard !== 'all' 
                            ? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา' 
                            : activeTab === 'no_docs'
                              ? 'ไม่มีผู้ป่วยที่ยังไม่มีเอกสารสิทธิ์ในขณะนี้'
                              : 'ไม่มีผู้ป่วยที่เอกสารสิทธิ์ไม่ครบในขณะนี้'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {searchAN || selectedWard !== 'all'
                            ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรองหอผู้ป่วย'
                            : 'ผู้ป่วยทุกคนมีเอกสารสิทธิ์ครบถ้วนแล้ว'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map(p => (
                    <tr
                      key={p.an}
                      onClick={() => handleSelectPatient(p.an)}
                      className="hover:bg-blue-50/60 cursor-pointer transition-colors group"
                      title="คลิกเพื่อเปิดหน้าจัดการเอกสารสิทธิ์"
                    >
                      {/* หอผู้ป่วย */}
                      <td className="px-4 py-3.5 font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-blue-600 shrink-0 opacity-70 group-hover:opacity-100" />
                          <span className="truncate" title={p.ward_name}>{p.ward_name || '-'}</span>
                        </div>
                      </td>

                      {/* AN */}
                      <td className="px-4 py-3.5 font-semibold text-blue-600 group-hover:underline whitespace-nowrap">
                        {p.an}
                      </td>

                      {/* HN */}
                      <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap font-medium">
                        {p.hn}
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

                      {/* สถานะเอกสาร (เฉพาะแท็บเอกสารสิทธิ์ไม่ครบ) */}
                      {activeTab === 'incomplete' && (
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                              p.has_id_card 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {p.has_id_card ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-500" />}
                              บัตร ปชช.
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                              p.has_pttype_check 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {p.has_pttype_check ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-500" />}
                              ใบสิทธิ์
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                              p.has_authen_code 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {p.has_authen_code ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-500" />}
                              Authen
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 ml-1">
                              ({p.doc_count}/3)
                            </span>
                          </div>
                        </td>
                      )}

                      {/* วันที่ Admit */}
                      <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDate(p.admit_date)}</span>
                        </div>
                      </td>

                      {/* แพทย์เจ้าของไข้ */}
                      <td className="px-4 py-3.5 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Stethoscope className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate" title={p.doctor_name}>{p.doctor_name || '-'}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
