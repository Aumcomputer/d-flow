import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import api from '../services/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Select } from '../components/ui/select'
import { Skeleton } from '../components/ui/skeleton'
import { Trash2, FileText, UploadCloud, CheckCircle2, Circle, Eye, Search, ChevronLeft, Calendar, User, Phone, MapPin, Activity, Shield, Scan, ArrowLeft, Stethoscope, CreditCard, ShieldCheck, AlertTriangle } from 'lucide-react'
import FileViewerModal from '../components/FileViewerModal'

const DOC_TYPES = [
  { id: 1, name: 'บัตรประชาชน', required: true },
  { id: 2, name: 'ใบตรวจสอบสิทธิ์', required: true },
  { id: 3, name: 'Authen Code', required: true },
  { id: 4, name: 'ใบส่งตัว (Refer)', required: false },
  { id: 5, name: 'อื่นๆ', required: false },
]

export default function DocumentsPage() {
  const navigate = useNavigate()
  const [searchAN, setSearchAN] = useState('')
  const [patient, setPatient] = useState(null)
  const [documents, setDocuments] = useState([])
  const [completeness, setCompleteness] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [viewingDoc, setViewingDoc] = useState(null)

  // Classification dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [unclassifiedDocId, setUnclassifiedDocId] = useState(null)
  const [unclassifiedFilename, setUnclassifiedFilename] = useState('')
  const [selectedDocTypeId, setSelectedDocTypeId] = useState(1)

  const fetchDocuments = async (an) => {
    try {
      const [docRes, compRes] = await Promise.all([
        api.get(`/documents/${an}`),
        api.get(`/documents/${an}/completeness`)
      ])
      setDocuments(docRes.data)
      setCompleteness(compRes.data)
    } catch (err) {
      console.error('Error fetching documents:', err)
    }
  }

  const handleSearch = async (e) => {
    e?.preventDefault()
    const an = searchAN.trim()
    if (!an) return
    setLoading(true)
    setError('')
    setPatient(null)
    setDocuments([])
    setCompleteness(null)
    setImgError(false)
    try {
      const res = await api.get(`/patients/${an}`)
      setPatient(res.data)
      await fetchDocuments(an)
    } catch (err) {
      if (err.response?.status === 404) {
        setError('ไม่พบข้อมูลผู้ป่วย AN: ' + an)
      } else {
        setError('เกิดข้อผิดพลาดในการค้นหา')
      }
      setPatient(null)
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (file, docTypeId = null) => {
    if (!patient) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('an', patient.an)
    formData.append('hn', patient.hn)
    if (docTypeId) {
      formData.append('doc_type_id', docTypeId)
    }

    try {
      setUploadProgress(true)
      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (res.data.needsClassification) {
        setUnclassifiedDocId(res.data.tempId)
        setUnclassifiedFilename(file.name)
        setDialogOpen(true)
      }
      // Always refresh to show the new file
      await fetchDocuments(patient.an)
    } catch (err) {
      console.error('Upload error:', err)
      alert('อัปโหลดล้มเหลว: ' + (err.response?.data?.error || err.message))
    } finally {
      setUploadProgress(false)
    }
  }

  const handleScan = async (docTypeId = null, forceApi = null) => {
    if (!patient) return
    const scannerPort = import.meta.env.VITE_LOCAL_SCANNER_PORT || 3478
    
    // กำหนด API endpoint ตามที่ส่งมา หรือตามประเภทเอกสาร (1 = บัตรประชาชน)
    const scanApiEndpoint = forceApi ? forceApi : (docTypeId === 1 ? '/api/scan-idcard' : '/api/scan-a4')
    
    try {
      setIsScanning(true)
      const scanRes = await fetch(`http://localhost:${scannerPort}${scanApiEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const responseText = await scanRes.text()
      let scanData
      try {
        scanData = JSON.parse(responseText)
      } catch (parseErr) {
        console.error('Invalid JSON from Local Agent:', responseText.substring(0, 500))
        throw new Error('Local Agent ตอบกลับมาเป็นรูปแบบที่ไม่ถูกต้อง (อาจเกิด Error ที่ตัว Agent หรือพอร์ตชนกัน)')
      }
      
      if (!scanData.success) {
        throw new Error(scanData.error || 'สแกนไม่สำเร็จ')
      }
      
      const base64Content = scanData.imageData || scanData.pdfData || scanData.image || scanData.data
      
      if (typeof base64Content !== 'string' || !base64Content) {
        throw new Error('ไม่พบข้อมูลภาพจากการสแกน (Local Agent ส่งข้อมูลมา: ' + JSON.stringify(Object.keys(scanData)) + ')')
      }
      
      const b64Data = base64Content.split(',')[1] || ''
      const isActuallyPdf = b64Data.startsWith('JVBERi')
      
      const base64Response = await fetch(base64Content)
      const blob = await base64Response.blob()
      
      const ext = isActuallyPdf ? 'pdf' : (blob.type.includes('image') ? 'jpg' : 'pdf')
      const mime = isActuallyPdf ? 'application/pdf' : (blob.type || 'application/pdf')
      
      const file = new File([blob], `scan_${Date.now()}.${ext}`, { type: mime })
      
      await handleUpload(file, docTypeId)
      
    } catch (err) {
      console.error('Scan failed:', err)
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        alert("ไม่สามารถเชื่อมต่อ Local Scanner Agent ได้ (Can't connect local agent)")
      } else {
        alert('สแกนล้มเหลว: ' + err.message)
      }
    } finally {
      setIsScanning(false)
    }
  }

  const handleClassify = async () => {
    if (!unclassifiedDocId || !selectedDocTypeId) return
    try {
      await api.patch(`/documents/${unclassifiedDocId}/classify`, {
        doc_type_id: selectedDocTypeId
      })
      setDialogOpen(false)
      setUnclassifiedDocId(null)
      setUnclassifiedFilename('')
      await fetchDocuments(patient.an)
    } catch (err) {
      alert('ไม่สามารถบันทึกประเภทเอกสารได้')
    }
  }

  const onDrop = useCallback((acceptedFiles) => {
    if (!patient) return
    acceptedFiles.forEach(file => handleUpload(file))
  }, [patient])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    disabled: !patient
  })

  const handleDelete = async (docId) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบเอกสารนี้?')) return
    try {
      await api.delete(`/documents/${docId}`)
      await fetchDocuments(patient.an)
    } catch (err) {
      alert('ไม่สามารถลบเอกสารได้')
    }
  }

  const getPatientImageUrl = (hn) => {
    return `/api/patients/${hn}/image`
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr) return '-'
    const date = formatDate(dateStr)
    return timeStr ? `${date} ${timeStr}` : date
  }

  return (
    <div className="container mx-auto p-6 w-full animate-fade-in">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 p-2 rounded-xl border border-blue-100">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600">
              เวชระเบียน
            </h1>
            <p className="text-muted-foreground mt-1">จัดการเอกสารผู้ป่วยและจัดเก็บไฟล์แนบ</p>
          </div>
        </div>
        <div className="flex-1" />
        <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto sm:max-w-sm relative">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input
              placeholder="ค้นหาด้วย AN..."
              value={searchAN}
              onChange={(e) => setSearchAN(e.target.value)}
              className="pl-9 rounded-xl shadow-sm border-slate-200 focus:border-blue-400"
            />
          </div>
          <Button type="submit" disabled={loading} className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-sm">
            {loading ? 'กำลังค้นหา...' : 'ค้นหา'}
          </Button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 font-medium shadow-sm border border-red-100 animate-slide-up">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ==================== Left Panel - Patient Info ==================== */}
        <div className="lg:col-span-1">
          <Card className="shadow-md border-none overflow-hidden rounded-2xl">
            <div className="h-2 bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500" />
            <CardHeader className="bg-gradient-to-b from-slate-50/80 to-white pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
                <User className="w-5 h-5" /> ข้อมูลผู้ป่วย
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              ) : patient ? (
                <div className="space-y-0">
                  {/* AN Header */}
                  <div className="text-center mb-5 pb-4 border-b border-slate-100">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mx-auto mb-3 overflow-hidden shadow-inner border-2 border-white">
                      {!imgError && patient.hn ? (
                        <img 
                          src={getPatientImageUrl(patient.hn)} 
                          alt="Patient" 
                          className="w-full h-full object-cover"
                          onError={() => setImgError(true)}
                        />
                      ) : (
                        <User className="w-12 h-12 text-blue-500" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-medium tracking-wide">AN</p>
                    <p className="text-2xl font-bold text-slate-800 tracking-wide">{patient.an}</p>
                  </div>

                  <InfoRow label="HN" value={patient.hn} />
                  <InfoRow label="CID" value={patient.cid || '-'} icon={<CreditCard className="w-3.5 h-3.5 text-indigo-400" />} mono />
                  <InfoRow label="ชื่อ-สกุล" value={patient.fullname} />
                  <InfoRow label="เพศ" value={patient.sex === '1' ? 'ชาย' : patient.sex === '2' ? 'หญิง' : '-'} />
                  <InfoRow label="อายุ" value={patient.age != null ? `${patient.age} ปี` : '-'} />
                  <InfoRow label="วันที่ Admit" value={formatDateTime(patient.regdate, patient.regtime)} />
                  <InfoRow label="สิทธิ์การรักษา" value={patient.pttype_name || '-'} highlight />
                  <InfoRow label="หอผู้ป่วย" value={patient.ward_name || '-'} />
                  <InfoRow label="แพทย์เจ้าของไข้" value={patient.doctor_name || '-'} icon={<Stethoscope className="w-3.5 h-3.5 text-blue-400" />} last />
                </div>
              ) : (
                <div className="text-center text-slate-400 py-10 flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                    <Search className="w-10 h-10 opacity-20" />
                  </div>
                  <p className="text-sm">กรุณาค้นหา AN เพื่อดูข้อมูลผู้ป่วย</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ==================== Right Panel - Documents ==================== */}
        <div className="lg:col-span-2 space-y-5">
          {/* Completeness Bar */}
          {patient && completeness && (
            <div className={`flex items-center justify-between p-4 rounded-2xl shadow-sm border ${completeness.complete ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
              <div className="flex items-center gap-3">
                {completeness.complete ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-amber-400 flex items-center justify-center">
                    <span className="text-xs font-bold text-amber-500">{completeness.uploaded}</span>
                  </div>
                )}
                <span className={`font-semibold ${completeness.complete ? 'text-green-700' : 'text-amber-700'}`}>
                  {completeness.complete ? 'เอกสารหลักครบถ้วน' : `เอกสารหลักไม่ครบ (${completeness.uploaded}/${completeness.total})`}
                </span>
              </div>
              <Badge variant={completeness.complete ? 'success' : 'warning'} className="px-3 py-1 rounded-full">
                {completeness.complete ? 'Complete ✓' : 'Incomplete'}
              </Badge>
            </div>
          )}

          {/* Document Checklist */}
          <Card className="shadow-md border-none rounded-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-indigo-400 via-purple-400 to-blue-400" />
            <CardContent className="p-5">
              <h3 className="font-bold text-slate-800 text-lg mb-5 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                รายการเอกสาร
              </h3>

              <div className="space-y-3">
                {DOC_TYPES.map(docType => {
                  const typeDocs = documents.filter(d => d.doc_type_id === docType.id)
                  const hasDoc = typeDocs.length > 0

                  return (
                    <div key={docType.id} className={`border rounded-xl p-4 transition-all duration-200 hover:shadow-md ${hasDoc ? 'bg-white border-green-100' : 'bg-white border-slate-100'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {hasDoc ? (
                            <CheckCircle2 className="text-green-500 w-5 h-5 flex-shrink-0" />
                          ) : (
                            <Circle className="text-slate-200 w-5 h-5 flex-shrink-0" />
                          )}
                          <span className={`font-medium ${hasDoc ? 'text-slate-800' : 'text-slate-500'}`}>
                            {docType.name}
                          </span>
                          {docType.required && (
                            <span className="text-red-400 text-xs font-bold">*จำเป็น</span>
                          )}
                          {hasDoc && (
                            <Badge variant="secondary" className="text-xs rounded-full">{typeDocs.length} ไฟล์</Badge>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {docType.id === 1 ? (
                            <>
                              <button
                                onClick={() => handleScan(docType.id, '/api/scan-idcard')}
                                className="cursor-pointer text-xs font-medium bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors inline-flex items-center gap-1 border border-emerald-200/60"
                              >
                                <Scan className="w-3.5 h-3.5" />
                                สแกนบัตร
                              </button>
                              <button
                                onClick={() => handleScan(docType.id, '/api/scan-a4')}
                                className="cursor-pointer text-xs font-medium bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors inline-flex items-center gap-1 border border-emerald-200/60"
                              >
                                <Scan className="w-3.5 h-3.5" />
                                สแกน A4
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleScan(docType.id)}
                              className="cursor-pointer text-xs font-medium bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors inline-flex items-center gap-1 border border-emerald-200/60"
                            >
                              <Scan className="w-3.5 h-3.5" />
                              สแกน
                            </button>
                          )}
                          <label className="cursor-pointer text-xs font-medium bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors inline-flex items-center gap-1 border border-blue-200/60">
                            <UploadCloud className="w-3.5 h-3.5" />
                            อัปโหลด
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png,.webp"
                              onChange={(e) => {
                                if (e.target.files?.[0]) handleUpload(e.target.files[0], docType.id)
                                e.target.value = ''
                              }}
                              disabled={!patient}
                            />
                          </label>
                        </div>
                      </div>

                      {/* List of uploaded files for this type */}
                      {typeDocs.length > 0 && (
                        <div className="mt-3 space-y-2 pl-8">
                          {typeDocs.map(doc => (
                            <div key={doc.id} className="bg-slate-50 p-3 rounded-lg text-sm group hover:bg-slate-100 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                  <span className="truncate text-slate-600 font-medium">{doc.stored_filename}</span>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                  <span className="text-slate-400 text-xs">{formatDate(doc.uploaded_at)}</span>
                                  <button
                                    onClick={() => setViewingDoc(doc)}
                                    className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-md transition-colors"
                                    title="ดูเอกสาร"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(doc.id)}
                                    className="p-1.5 text-red-500 hover:bg-red-100 rounded-md transition-colors"
                                    title="ลบเอกสาร"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Show extracted CID from PDF */}
                              {doc.extracted_cid && (
                                <CidBadge extractedCid={doc.extracted_cid} patientCid={patient?.cid} />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Drag & Drop Upload Zone */}
              {patient && (
                <div
                  {...getRootProps()}
                  className={`mt-6 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                    isDragActive
                      ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                      : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <UploadCloud className={`w-12 h-12 mx-auto mb-3 transition-colors ${isDragActive ? 'text-blue-500' : 'text-slate-300'}`} />
                  <p className="text-slate-600 font-medium">ลากไฟล์มาวาง หรือ คลิกเพื่ออัปโหลด</p>
                  <p className="text-slate-400 text-sm mt-1">ระบบจะแยกประเภท PDF อัตโนมัติ • รองรับ PDF, JPG, PNG</p>
                  {uploadProgress && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-blue-500 text-sm font-medium">กำลังอัปโหลด...</span>
                    </div>
                  )}
                </div>
              )}

              {!patient && (
                <div className="mt-6 text-center py-8 text-slate-400">
                  <p className="text-sm">ค้นหา AN ก่อนเพื่อเริ่มอัปโหลดเอกสาร</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Classification Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เลือกประเภทเอกสาร</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-500">
              ระบบไม่สามารถแยกประเภทไฟล์นี้ได้อัตโนมัติ กรุณาเลือกประเภท:
            </p>
            <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700 truncate">{unclassifiedFilename}</span>
            </div>
            <Select value={selectedDocTypeId} onChange={(e) => setSelectedDocTypeId(Number(e.target.value))}>
              {DOC_TYPES.map(doc => (
                <option key={doc.id} value={doc.id}>{doc.name}</option>
              ))}
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleClassify} className="bg-gradient-to-r from-blue-500 to-indigo-500">ยืนยัน</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scanning Dialog */}
      <Dialog open={isScanning} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-xs [&>button]:hidden">
          <div className="flex flex-col items-center justify-center py-6 gap-4">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-lg font-medium text-slate-700">กำลังสแกน...</p>
            <p className="text-sm text-slate-500">กรุณารอสักครู่ เครื่องสแกนกำลังทำงาน</p>
          </div>
        </DialogContent>
      </Dialog>
      <FileViewerModal 
        doc={viewingDoc} 
        isOpen={!!viewingDoc} 
        onClose={() => setViewingDoc(null)} 
      />
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

/** CID badge: shows extracted CID with match/mismatch indicator */
function CidBadge({ extractedCid, patientCid }) {
  const isMatch = patientCid && extractedCid === patientCid
  const isMismatch = patientCid && extractedCid !== patientCid

  return (
    <div className={`mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
      isMatch
        ? 'bg-green-50 text-green-700 border border-green-200'
        : isMismatch
          ? 'bg-red-50 text-red-700 border border-red-200'
          : 'bg-slate-100 text-slate-600'
    }`}>
      {isMatch ? (
        <ShieldCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
      ) : isMismatch ? (
        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
      ) : (
        <CreditCard className="w-4 h-4 text-slate-400 flex-shrink-0" />
      )}
      <span className="font-mono tracking-wider">{extractedCid.replace(/(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})/, '$1-$2-$3-$4-$5')}</span>
      {isMatch && <span className="ml-1">✓ ตรงกับผู้ป่วย</span>}
      {isMismatch && <span className="ml-1">✗ ไม่ตรงกับผู้ป่วย</span>}
    </div>
  )
}

/** Patient info row */
function InfoRow({ label, value, highlight, icon, last, mono }) {
  return (
    <div className={`flex items-start gap-2 py-2.5 ${!last ? 'border-b border-slate-50' : ''}`}>
      <span className="text-slate-400 text-sm min-w-[100px] flex items-center gap-1">
        {icon}
        {label}:
      </span>
      <span className={`font-medium text-sm flex-1 ${highlight ? 'text-blue-600' : 'text-slate-700'} ${mono ? 'font-mono tracking-wider' : ''}`}>
        {value || '-'}
      </span>
    </div>
  )
}
