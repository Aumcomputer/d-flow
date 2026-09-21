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
  AlertCircle 
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

  const fetchPatientData = useCallback(async (anToFetch) => {
    const an = anToFetch.trim()
    if (!an) return

    setLoading(true)
    setError('')
    setPatient(null)
    setDetails(null)
    setImgError(false)

    try {
      const [pRes, dRes] = await Promise.all([
        api.get(`/patients/${an}`),
        api.get(`/patients/${an}/detail`)
      ])
      setPatient(pRes.data)
      setDetails(dRes.data)
    } catch (err) {
      if (err.response?.status === 404) {
        setError(`ไม่พบข้อมูลผู้ป่วย AN: ${an}`)
      } else {
        setError('เกิดข้อผิดพลาดในการค้นหาข้อมูลผู้ป่วย')
      }
      setPatient(null)
      setDetails(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialAn) {
      fetchPatientData(initialAn)
    }
  }, [initialAn, fetchPatientData])

  const handleSearch = (e) => {
    e?.preventDefault()
    const an = searchAN.trim()
    if (!an) return
    setSearchParams({ an }, { replace: true })
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
              placeholder="ค้นหาด้วย AN..."
              value={searchAN}
              onChange={(e) => setSearchAN(e.target.value)}
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
          <div className="bg-card rounded-2xl p-5 shadow-sm border border-border">
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
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono">CID: {patient.cid.replace(/(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})/, '$1-$2-$3-$4-$5')}</span>
                    </div>
                  )}
                </div>

                {/* Col 3: Admit Date & Doctor */}
                <div className="space-y-1.5 text-sm text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="truncate">Admit: <strong className="text-slate-800">{formatDateTime(patient.regdate, patient.regtime)}</strong></span>
                  </div>
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
          <h3 className="text-lg font-bold text-slate-800 mb-1">กรุณาค้นหา AN เพื่อดูข้อมูลผู้ป่วย</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            ระบุหมายเลข AN ในช่องค้นหาด้านบน เพื่อจัดการเอกสาร สแกนบัตร/A4 และส่งปรึกษาสิทธิการรักษา
          </p>
        </div>
      )}
    </div>
  )
}
