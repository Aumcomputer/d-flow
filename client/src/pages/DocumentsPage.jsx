import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
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
  Check
} from 'lucide-react'

export default function DocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialAn = searchParams.get('an') || ''
  
  const [searchAN, setSearchAN] = useState(initialAn)
  const [patient, setPatient] = useState(null)
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [imgError, setImgError] = useState(false)
  const [copiedCid, setCopiedCid] = useState(false)

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
      setSearchParams({ an: resolvedAn }, { replace: true })

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

  return (
    <div className="container mx-auto p-4 sm:p-6 w-full max-w-7xl animate-fade-in space-y-6">
      {/* Top Bar: Title + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 sm:p-5 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-xl text-white shadow-sm">
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

        <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto sm:min-w-[320px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="ค้นหาด้วย HN หรือ AN..."
              value={searchAN}
              onChange={(e) => {
                setSearchAN(e.target.value)
                if (error) setError('')
              }}
              className="pl-9 rounded-xl shadow-xs border-slate-200 focus:border-blue-500"
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
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl font-medium shadow-xs border border-red-200 flex items-center gap-3 animate-slide-up">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
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

      {/* Patient Information Card & DocumentsTab */}
      {!loading && patient ? (
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

            <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
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
      ) : !loading && !error && (
        /* Empty State */
        <div className="text-center py-16 px-4 bg-card rounded-2xl border border-border shadow-xs flex flex-col items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-4 shadow-inner">
            <Search className="w-10 h-10 opacity-60" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">กรุณาค้นหา HN หรือ AN เพื่อดูข้อมูลผู้ป่วย</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            ระบุหมายเลข HN หรือ AN ในช่องค้นหาด้านบน เพื่อจัดการเอกสาร
          </p>
        </div>
      )}
    </div>
  )
}
