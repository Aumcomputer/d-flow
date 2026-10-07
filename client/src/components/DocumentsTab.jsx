import React, { useState, useEffect, useCallback } from 'react'
import { 
  FileText, 
  CheckCircle2, 
  Circle, 
  UploadCloud, 
  Trash2, 
  Eye, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  AlertCircle,
  CreditCard, 
  Scan,
  Send,
  Search,
  Check,
  ChevronDown,
  Stethoscope,
  Pencil,
  RotateCcw,
  Lock,
  X,
  Award,
  UserCheck,
  BookmarkCheck,
  MessageSquare,
  Hotel,
  Clock,
  HeartHandshake
} from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import api from '../services/api'
import socket from '../services/socket'
import { useAuth } from '../contexts/AuthContext'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Select } from './ui/select'
import { Button } from './ui/button'
import FileViewerModal from './FileViewerModal'

const DOC_TYPES = [
  { id: 1, name: 'บัตรประชาชน', required: true },
  { id: 2, name: 'ใบตรวจสอบสิทธิ์', required: true },
  { id: 3, name: 'Authen Code', required: true },
  { id: 4, name: 'ใบส่งตัว (Refer)', required: false },
  { id: 5, name: 'อื่นๆ', required: false },
]

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

export default function DocumentsTab({ patient, details, fetchDetails }) {
  const { user } = useAuth()
  const [documents, setDocuments] = useState([])
  const [completeness, setCompleteness] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [viewingDoc, setViewingDoc] = useState(null)

  // Classification dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [unclassifiedDocId, setUnclassifiedDocId] = useState(null)
  const [unclassifiedFilename, setUnclassifiedFilename] = useState('')
  const [selectedDocTypeId, setSelectedDocTypeId] = useState(1)

  // Consult rights state (ส่วนส่งปรึกษาสิทธิการรักษา)
  const [isConsultModalOpen, setIsConsultModalOpen] = useState(false)
  const [consultUrgency, setConsultUrgency] = useState('ไม่ฉุกเฉิน') // 'ไม่ฉุกเฉิน' | 'ฉุกเฉิน'
  const [consultReason, setConsultReason] = useState('')
  const [doctors, setDoctors] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [doctorSearch, setDoctorSearch] = useState('')
  const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] = useState(false)
  const [submittingConsult, setSubmittingConsult] = useState(false)
  const [consultError, setConsultError] = useState('')

  // Cancel consult modal state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [cancelPassword, setCancelPassword] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [submittingCancel, setSubmittingCancel] = useState(false)

  // Grant rights state (ส่วนสำหรับเจ้าหน้าที่งานสิทธิ์มากรอกให้สิทธิ์)
  const [pttypes, setPttypes] = useState([])
  const [selectedPttype, setSelectedPttype] = useState(null)
  const [pttypeSearch, setPttypeSearch] = useState('')
  const [isPttypeDropdownOpen, setIsPttypeDropdownOpen] = useState(false)
  const [isOtherPttype, setIsOtherPttype] = useState(false)
  const [otherPttypeText, setOtherPttypeText] = useState('')
  const [asmType, setAsmType] = useState(null) // 'asm_self' | 'asm_family' | null
  const [submittingGrant, setSubmittingGrant] = useState(false)
  const [grantError, setGrantError] = useState('')
  const [isEditingGrant, setIsEditingGrant] = useState(false)

  // Cancel grant modal state
  const [isCancelGrantModalOpen, setIsCancelGrantModalOpen] = useState(false)
  const [cancelGrantPassword, setCancelGrantPassword] = useState('')
  const [cancelGrantError, setCancelGrantError] = useState('')
  const [submittingCancelGrant, setSubmittingCancelGrant] = useState(false)

  // Pttype comments state (ความเห็นเจ้าหน้าที่งานสิทธิ์)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [grantComment, setGrantComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [commentError, setCommentError] = useState('')

  // Special Room Welfare Certificate state (หนังสือรับรองสวัสดิการค่าห้องพิเศษ)
  const [benefitCert, setBenefitCert] = useState(null)
  const [isCertModalOpen, setIsCertModalOpen] = useState(false)

  // Social work consult state (ส่วนส่งปรึกษานักสังคมสงเคราะห์)
  const [socialWorkReasons, setSocialWorkReasons] = useState([])
  const [socialWorkRequest, setSocialWorkRequest] = useState(null)
  const [isSocialWorkModalOpen, setIsSocialWorkModalOpen] = useState(false)
  const [isEditSocialWork, setIsEditSocialWork] = useState(false)
  const [selectedSocialWorkReasonId, setSelectedSocialWorkReasonId] = useState(null)
  const [selectedSocialWorkReasonName, setSelectedSocialWorkReasonName] = useState('')
  const [socialWorkReasonOther, setSocialWorkReasonOther] = useState('')
  const [nurseSocialWorkComment, setNurseSocialWorkComment] = useState('')
  const [submittingSocialWork, setSubmittingSocialWork] = useState(false)
  const [socialWorkError, setSocialWorkError] = useState('')

  // Cancel social work modal state
  const [isCancelSocialWorkModalOpen, setIsCancelSocialWorkModalOpen] = useState(false)
  const [cancelSocialWorkReason, setCancelSocialWorkReason] = useState('')
  const [submittingCancelSocialWork, setSubmittingCancelSocialWork] = useState(false)

  const fetchDocuments = useCallback(async () => {
    if (!patient?.an) return
    try {
      const [docRes, compRes] = await Promise.all([
        api.get(`/documents/${patient.an}`),
        api.get(`/documents/${patient.an}/completeness`)
      ])
      setDocuments(docRes.data)
      setCompleteness(compRes.data)
    } catch (err) {
      console.error('Error fetching documents:', err)
    }
  }, [patient])

  const fetchBenefitCertificate = useCallback(async () => {
    if (!patient?.an) {
      setBenefitCert(null)
      return
    }
    try {
      const res = await api.get(`/documents/${patient.an}/benefit-certificate`)
      if (res.data?.hasCertificate && res.data?.certificate) {
        setBenefitCert(res.data.certificate)
      } else {
        setBenefitCert(null)
      }
    } catch (err) {
      console.error('Fetch benefit certificate error:', err)
      setBenefitCert(null)
    }
  }, [patient?.an])

  const fetchComments = useCallback(async () => {
    if (!patient?.an) return
    try {
      const res = await api.get(`/pttype/comments/${patient.an}`)
      setComments(Array.isArray(res.data) ? res.data : (res.data?.data || []))
    } catch (err) {
      console.error('Fetch pttype comments error:', err)
    }
  }, [patient?.an])

  const fetchDoctors = async () => {
    try {
      const res = await api.get('/pttype/doctors')
      setDoctors(res.data || [])
    } catch (err) {
      console.error('Fetch doctors error:', err)
    }
  }

  const fetchPttypes = async () => {
    try {
      const res = await api.get('/pttype/pttypes')
      setPttypes(res.data || [])
    } catch (err) {
      console.error('Fetch pttypes error:', err)
    }
  }

  const fetchSocialWorkReasons = async () => {
    try {
      const res = await api.get('/social-work/reasons')
      setSocialWorkReasons(res.data?.reasons || [])
    } catch (err) {
      console.error('Fetch social work reasons error:', err)
    }
  }

  const fetchSocialWorkRequest = useCallback(async () => {
    if (!patient?.an) {
      setSocialWorkRequest(null)
      return
    }
    try {
      const res = await api.get(`/social-work/requests/patient/${patient.an}`)
      setSocialWorkRequest(res.data?.request || null)
    } catch (err) {
      console.error('Fetch social work request error:', err)
      setSocialWorkRequest(null)
    }
  }, [patient?.an])

  useEffect(() => {
    fetchDocuments()
    fetchBenefitCertificate()
    fetchComments()
    fetchSocialWorkReasons()
    fetchSocialWorkRequest()
  }, [fetchDocuments, fetchBenefitCertificate, fetchComments, fetchSocialWorkRequest])

  useEffect(() => {
    const handleCommentAdded = (data) => {
      if (data?.an === patient?.an) {
        fetchComments()
      }
    }
    const handleSocialWorkUpdated = (data) => {
      if (data?.an === patient?.an || !data?.an) {
        fetchSocialWorkRequest()
      }
    }
    socket.on('pttype:comment_added', handleCommentAdded)
    socket.on('social_work:updated', handleSocialWorkUpdated)
    return () => {
      socket.off('pttype:comment_added', handleCommentAdded)
      socket.off('social_work:updated', handleSocialWorkUpdated)
    }
  }, [patient?.an, fetchComments, fetchSocialWorkRequest])

  useEffect(() => {
    if (details?.consult_pttype_date) {
      fetchPttypes()
    }
    if (details?.grant_pttype_date) {
      setIsOtherPttype(Boolean(details.grant_pttype_is_other))
      setOtherPttypeText(details.grant_pttype_other_text || '')
      setAsmType(details.grant_pttype_asm_type || null)
      if (details.grant_pttype_code || details.grant_pttype_name) {
        setSelectedPttype({
          pttype: details.grant_pttype_code || '',
          name: details.grant_pttype_name || ''
        })
        setPttypeSearch(details.grant_pttype_name || '')
      }
    } else {
      setIsOtherPttype(false)
      setOtherPttypeText('')
      setAsmType(null)
      setSelectedPttype(null)
      setPttypeSearch('')
      setIsEditingGrant(false)
    }
  }, [details])

  const handleOpenConsultModal = () => {
    setIsConsultModalOpen(true)
    setConsultUrgency('ไม่ฉุกเฉิน')
    setConsultReason('')
    setConsultError('')
    fetchDoctors()

    // Default to patient's incharge doctor
    if (patient?.doctor_name) {
      setSelectedDoctor({
        code: patient.doctor_code || '',
        name: patient.doctor_name
      })
      setDoctorSearch(patient.doctor_name)
    } else {
      setSelectedDoctor(null)
      setDoctorSearch('')
    }
  }

  const handleOpenEditModal = () => {
    setIsConsultModalOpen(true)
    setConsultUrgency(details?.consult_pttype_urgency || 'ไม่ฉุกเฉิน')
    setConsultReason(details?.consult_pttype_reason || '')
    setConsultError('')
    fetchDoctors()

    if (details?.consult_pttype_doctor_name) {
      setSelectedDoctor({
        code: details.consult_pttype_doctor_code || '',
        name: details.consult_pttype_doctor_name
      })
      setDoctorSearch(details.consult_pttype_doctor_name)
    } else if (patient?.doctor_name) {
      setSelectedDoctor({
        code: patient.doctor_code || '',
        name: patient.doctor_name
      })
      setDoctorSearch(patient.doctor_name)
    } else {
      setSelectedDoctor(null)
      setDoctorSearch('')
    }
  }

  const handleOpenCancelModal = () => {
    setIsCancelModalOpen(true)
    setCancelPassword('')
    setCancelError('')
  }

  const handleConfirmCancelConsult = async (e) => {
    if (e) e.preventDefault()
    if (!cancelPassword.trim()) {
      setCancelError('กรุณากรอกรหัสผ่านเพื่อยืนยัน')
      return
    }

    setSubmittingCancel(true)
    setCancelError('')
    try {
      await api.post(`/pttype/cancel-consult/${patient.an}`, {
        password: cancelPassword
      })
      setIsCancelModalOpen(false)
      setCancelPassword('')
      if (fetchDetails) await fetchDetails()
      alert('ยกเลิกการส่งปรึกษาสิทธิการรักษาเรียบร้อยแล้ว')
    } catch (err) {
      console.error('Cancel consult error:', err)
      setCancelError(err.response?.data?.error || 'เกิดข้อผิดพลาด ไม่สามารถยกเลิกได้')
    } finally {
      setSubmittingCancel(false)
    }
  }

  const filteredDoctors = doctors.filter(d => {
    const q = doctorSearch.trim().toLowerCase()
    if (!q) return true
    return (
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.code && String(d.code).toLowerCase().includes(q))
    )
  })

  const filteredPttypes = pttypes.filter(p => {
    const q = pttypeSearch.trim().toLowerCase()
    if (!q) return true
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.pttype && String(p.pttype).toLowerCase().includes(q))
    )
  })

  const handleSubmitConsult = async (e) => {
    if (e) e.preventDefault()
    if (!consultReason.trim()) {
      setConsultError('กรุณากรอกสาเหตุที่ส่งปรึกษา')
      return
    }
    if (!selectedDoctor?.name) {
      setConsultError('กรุณาเลือกแพทย์')
      return
    }

    setSubmittingConsult(true)
    setConsultError('')
    try {
      await api.post(`/pttype/consult/${patient.an}`, {
        urgency: consultUrgency,
        reason: consultReason.trim(),
        doctor_code: selectedDoctor.code || '',
        doctor_name: selectedDoctor.name || ''
      })
      setIsConsultModalOpen(false)
      if (fetchDetails) await fetchDetails()
    } catch (err) {
      console.error('Submit consult error:', err)
      setConsultError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการส่งปรึกษา')
    } finally {
      setSubmittingConsult(false)
    }
  }

  const handleSaveGrant = async (e) => {
    if (e) e.preventDefault()
    if (isOtherPttype) {
      if (!otherPttypeText.trim()) {
        setGrantError('กรุณากรอกรายละเอียดสิทธิ์อื่นๆ')
        return
      }
    } else {
      if (!selectedPttype?.name) {
        setGrantError('กรุณาเลือกสิทธิ์การรักษา')
        return
      }
    }

    setSubmittingGrant(true)
    setGrantError('')
    try {
      await api.post(`/pttype/grant/${patient.an}`, {
        pttype_code: isOtherPttype ? null : (selectedPttype?.pttype || null),
        pttype_name: isOtherPttype ? otherPttypeText.trim() : (selectedPttype?.name || null),
        is_other: isOtherPttype,
        other_text: isOtherPttype ? otherPttypeText.trim() : null,
        asm_type: asmType || null,
        comment: grantComment.trim() || null
      })
      setIsEditingGrant(false)
      setGrantComment('')
      if (fetchDetails) await fetchDetails()
      await fetchComments()
    } catch (err) {
      console.error('Grant pttype error:', err)
      setGrantError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์')
    } finally {
      setSubmittingGrant(false)
    }
  }

  const handleAddComment = async (e) => {
    if (e) e.preventDefault()
    if (!newComment.trim()) return
    setSubmittingComment(true)
    setCommentError('')
    try {
      await api.post(`/pttype/comments/${patient.an}`, {
        comment: newComment.trim()
      })
      setNewComment('')
      await fetchComments()
    } catch (err) {
      console.error('Add comment error:', err)
      setCommentError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกความเห็น')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleConfirmCancelGrant = async (e) => {
    if (e) e.preventDefault()
    if (!cancelGrantPassword.trim()) {
      setCancelGrantError('กรุณากรอกรหัสผ่านเพื่อยืนยัน')
      return
    }

    setSubmittingCancelGrant(true)
    setCancelGrantError('')
    try {
      await api.post(`/pttype/cancel-grant/${patient.an}`, {
        password: cancelGrantPassword
      })
      setIsCancelGrantModalOpen(false)
      setCancelGrantPassword('')
      setIsEditingGrant(false)
      if (fetchDetails) await fetchDetails()
      alert('ยกเลิกข้อมูลการให้สิทธิ์เรียบร้อยแล้ว')
    } catch (err) {
      console.error('Cancel grant error:', err)
      setCancelGrantError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการยกเลิก')
    } finally {
      setSubmittingCancelGrant(false)
    }
  }

  const handleOpenSocialWorkModal = () => {
    setIsEditSocialWork(false)
    fetchSocialWorkReasons()
    setSelectedSocialWorkReasonId(socialWorkReasons[0]?.id || null)
    setSelectedSocialWorkReasonName(socialWorkReasons[0]?.name || '')
    setSocialWorkReasonOther('')
    setNurseSocialWorkComment('')
    setSocialWorkError('')
    setIsSocialWorkModalOpen(true)
  }

  const handleOpenEditSocialWorkModal = () => {
    if (!socialWorkRequest) return
    setIsEditSocialWork(true)
    fetchSocialWorkReasons()
    setSelectedSocialWorkReasonId(socialWorkRequest.reason_id)
    setSelectedSocialWorkReasonName(socialWorkRequest.reason_name)
    setSocialWorkReasonOther(socialWorkRequest.reason_other || '')
    setNurseSocialWorkComment(socialWorkRequest.nurse_comment || '')
    setSocialWorkError('')
    setIsSocialWorkModalOpen(true)
  }

  const handleSubmitSocialWork = async (e) => {
    if (e) e.preventDefault()
    if (!selectedSocialWorkReasonId) {
      setSocialWorkError('กรุณาเลือกสาเหตุที่ส่งปรึกษา')
      return
    }
    const reasonObj = socialWorkReasons.find(r => Number(r.id) === Number(selectedSocialWorkReasonId))
    const reasonName = reasonObj?.name || selectedSocialWorkReasonName
    if (reasonObj?.is_other && !socialWorkReasonOther.trim()) {
      setSocialWorkError('กรุณาระบุสาเหตุอื่นๆ')
      return
    }
    if (!nurseSocialWorkComment || !nurseSocialWorkComment.trim()) {
      setSocialWorkError('กรุณากรอกความเห็นของพยาบาลหัวหน้าตึกหรือหัวหน้าเวร')
      return
    }

    setSubmittingSocialWork(true)
    setSocialWorkError('')
    try {
      if (isEditSocialWork && socialWorkRequest?.id) {
        await api.put(`/social-work/requests/${socialWorkRequest.id}`, {
          reason_id: selectedSocialWorkReasonId,
          reason_name: reasonName,
          reason_other: reasonObj?.is_other ? socialWorkReasonOther.trim() : null,
          nurse_comment: nurseSocialWorkComment.trim()
        })
      } else {
        await api.post('/social-work/requests', {
          an: patient.an,
          reason_id: selectedSocialWorkReasonId,
          reason_name: reasonName,
          reason_other: reasonObj?.is_other ? socialWorkReasonOther.trim() : null,
          nurse_comment: nurseSocialWorkComment.trim()
        })
      }
      setIsSocialWorkModalOpen(false)
      await fetchSocialWorkRequest()
    } catch (err) {
      console.error('Submit social work error:', err)
      setSocialWorkError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSubmittingSocialWork(false)
    }
  }

  const handleConfirmCancelSocialWork = async () => {
    if (!socialWorkRequest?.id) return
    setSubmittingCancelSocialWork(true)
    try {
      await api.post(`/social-work/requests/${socialWorkRequest.id}/cancel`, {
        cancel_reason: cancelSocialWorkReason.trim()
      })
      setIsCancelSocialWorkModalOpen(false)
      setCancelSocialWorkReason('')
      await fetchSocialWorkRequest()
    } catch (err) {
      console.error('Cancel social work error:', err)
    } finally {
      setSubmittingCancelSocialWork(false)
    }
  }

  const handleUpload = async (file, docTypeId = null) => {
    if (!patient) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('an', patient.an)
    formData.append('hn', patient.hn)
    formData.append('patient_name', patient.fullname || `${patient.pname}${patient.fname} ${patient.lname}`)
    if (docTypeId) {
      formData.append('doc_type_id', docTypeId)
    }

    setUploadProgress(true)
    try {
      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (res.data.needsClassification) {
        setUnclassifiedDocId(res.data.document.id)
        setUnclassifiedFilename(res.data.document.original_filename)
        setDialogOpen(true)
      } else {
        await fetchDocuments()
      }
    } catch (err) {
      console.error('Upload failed:', err)
      alert('เกิดข้อผิดพลาดในการอัปโหลดไฟล์: ' + (err.response?.data?.error || err.message))
    } finally {
      setUploadProgress(false)
    }
  }

  const handleScan = async (docTypeId = null, endpoint = '/api/scan') => {
    if (!patient) return

    setIsScanning(true)
    try {
      const res = await api.post(endpoint, {
        an: patient.an,
        hn: patient.hn,
        patient_name: patient.fullname || `${patient.pname}${patient.fname} ${patient.lname}`,
        doc_type_id: docTypeId
      })

      if (res.data.success) {
        if (res.data.needsClassification) {
          setUnclassifiedDocId(res.data.document.id)
          setUnclassifiedFilename(res.data.document.original_filename)
          setDialogOpen(true)
        } else {
          await fetchDocuments()
        }
      }
    } catch (err) {
      console.error('Scan error:', err)
      alert('การสแกนล้มเหลว: ' + (err.response?.data?.error || err.message))
    } finally {
      setIsScanning(false)
    }
  }

  const handleClassify = async () => {
    if (!unclassifiedDocId) return

    try {
      await api.put(`/documents/${unclassifiedDocId}/classify`, {
        doc_type_id: selectedDocTypeId
      })
      setDialogOpen(false)
      setUnclassifiedDocId(null)
      await fetchDocuments()
    } catch (err) {
      console.error('Classification error:', err)
      alert('เกิดข้อผิดพลาดในการระบุประเภทเอกสาร')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบเอกสารนี้?')) return

    try {
      await api.delete(`/documents/${id}`)
      await fetchDocuments()
    } catch (err) {
      console.error('Delete error:', err)
      alert('เกิดข้อผิดพลาดในการลบเอกสาร')
    }
  }

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      handleUpload(acceptedFiles[0])
    }
  }, [patient])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true
  })

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(dateStr)
      return `${d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })} เวลา ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`
    } catch {
      return dateStr
    }
  }

  if (!patient) return null

  return (
    <div className="py-2 w-full space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Document Checklist & Uploads */}
        <div className="lg:col-span-6 xl:col-span-6 space-y-5">
          {/* Completeness Bar */}
          {completeness && (
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
          <div className="bg-card shadow-sm border border-border rounded-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-indigo-400 via-purple-400 to-blue-400" />
            <div className="p-5">
              <h3 className="font-bold text-slate-800 text-lg mb-5 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                รายการเอกสาร
              </h3>

              <div className="space-y-3">
                {DOC_TYPES.map(docType => {
                  const typeDocs = documents.filter(d => d.doc_type_id === docType.id)
                  const hasDoc = typeDocs.length > 0

                  return (
                    <div key={docType.id} className={`border rounded-xl p-4 transition-all duration-200 hover:shadow-sm ${hasDoc ? 'bg-white border-green-100' : 'bg-white border-slate-100'}`}>
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

                {/* หนังสือรับรองสวัสดิการค่าห้องพิเศษ (PIS) - ถ้าไม่มีไม่ต้องแสดง */}
                {benefitCert && (
                  <div 
                    onClick={() => setIsCertModalOpen(true)}
                    className="border border-sky-200 bg-gradient-to-r from-sky-50/60 via-blue-50/40 to-indigo-50/30 rounded-xl p-4 transition-all duration-200 hover:shadow-sm hover:border-sky-300 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-600 shrink-0 group-hover:scale-105 transition-transform">
                          <Hotel className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-800 text-sm group-hover:text-sky-700 transition-colors">
                              หนังสือรับรองสวัสดิการค่าห้องพิเศษ
                            </span>
                            <Badge className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                              benefitCert.status_text === 'อนุมัติ' 
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            }`}>
                              {benefitCert.status_text}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            ผู้ยื่น: <strong className="text-slate-700">{benefitCert.requester_name || '-'}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setIsCertModalOpen(true)
                          }}
                          className="cursor-pointer text-xs font-medium bg-sky-100 hover:bg-sky-200 text-sky-700 px-3 py-1.5 rounded-full transition-colors inline-flex items-center gap-1.5 border border-sky-200"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          ดูรายละเอียด
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Drag & Drop Upload Zone */}
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
            </div>
          </div>
        </div>

        {/* Right Column: Consult Rights & Social Work Panels, and Grant Rights Panel */}
        <div className="lg:col-span-6 xl:col-span-6 space-y-5">
          {/* Side-by-side Consult Boxes: ส่งปรึกษาสิทธิการรักษา & ส่งสังคมสงเคราะห์ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {/* Box 1: ส่งปรึกษาสิทธิการรักษา */}
            {!details?.consult_pttype_date ? (
              <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-3.5 text-center flex flex-col justify-between h-full">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto border border-sky-100 shadow-sm">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-800 text-base">ส่งปรึกษาสิทธิการรักษา</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    หากพบข้อสงสัย หรือต้องการให้งานสิทธิ์ตรวจสอบสิทธิการรักษาของผู้ป่วยรายนี้
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenConsultModal}
                  className="w-full inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold py-2.5 px-4 text-sm rounded-xl shadow-sm transition-all duration-200 hover:shadow"
                >
                  <Send className="w-4 h-4" />
                  <span>ส่งปรึกษาสิทธิการรักษา</span>
                </button>
              </div>
            ) : (
              <div className="bg-card rounded-2xl p-4 sm:p-5 border border-sky-200 bg-sky-50/20 shadow-sm space-y-3.5">
                {/* Header of the Box with Action Buttons */}
                <div className="flex items-center justify-between border-b border-sky-100 pb-2.5 gap-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm sm:text-base">
                    <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
                    <span className="truncate">ส่งปรึกษาสิทธิการรักษา</span>
                  </div>

                  {/* Top Right Buttons: แก้ไข & ยกเลิก */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={handleOpenEditModal}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-colors"
                      title="แก้ไขข้อมูลส่งปรึกษา"
                    >
                      <Pencil className="w-3 h-3 text-slate-500" />
                      <span>แก้ไข</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenCancelModal}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs transition-colors"
                      title="ยกเลิกการส่งปรึกษา"
                    >
                      <RotateCcw className="w-3 h-3 text-rose-500" />
                      <span>ยกเลิก</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs font-medium block mb-1">ความเห็นแพทย์เจ้าของไข้</span>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs sm:text-sm font-bold border ${
                        details.consult_pttype_urgency === 'ฉุกเฉิน'
                          ? 'bg-rose-100 text-rose-700 border-rose-200'
                          : 'bg-sky-100 text-sky-700 border-sky-200'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${details.consult_pttype_urgency === 'ฉุกเฉิน' ? 'bg-rose-600 animate-pulse' : 'bg-sky-600'}`} />
                        {details.consult_pttype_urgency || 'ไม่ฉุกเฉิน'}
                      </span>
                    </div>
                  </div>

                  {details.consult_pttype_reason && (
                    <div>
                      <span className="text-muted-foreground text-xs font-medium block mb-1">สาเหตุที่ส่งปรึกษา</span>
                      <div className="text-slate-800 bg-white p-3 rounded-xl border border-sky-100 text-xs sm:text-sm whitespace-pre-line leading-relaxed shadow-2xs font-normal">
                        {details.consult_pttype_reason}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-sky-100 pt-2.5 space-y-1.5 text-xs text-slate-700">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground shrink-0">รศส. แพทย์:</span>
                      <span className="font-semibold text-slate-900 text-right truncate">
                        {details.consult_pttype_doctor_name || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground shrink-0">ผู้บันทึก:</span>
                      <span className="font-semibold text-slate-900 truncate">
                        {details.consult_pttype_by_name || details.consult_pttype_by || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground shrink-0">วันที่ เวลา:</span>
                      <span className="font-semibold text-slate-900">
                        {formatDateTime(details.consult_pttype_date)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Box 2: ส่งสังคมสงเคราะห์ (ด้านข้างกล่องส่งปรึกษาสิทธิการรักษา) */}
            {!socialWorkRequest ? (
              <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-3.5 text-center flex flex-col justify-between h-full">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100 shadow-sm">
                  <HeartHandshake className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-800 text-base">ส่งสังคมสงเคราะห์</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    ส่งปรึกษานักสังคมสงเคราะห์ กรณีผู้ป่วยมีปัญหาด้านค่าใช้จ่ายหรือครอบครัว
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenSocialWorkModal}
                  className="w-full inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-semibold py-2.5 px-4 text-sm rounded-xl shadow-sm transition-all duration-200 hover:shadow"
                >
                  <Send className="w-4 h-4" />
                  <span>ส่งสังคมสงเคราะห์</span>
                </button>
              </div>
            ) : (
              <div className="bg-card rounded-2xl p-4 sm:p-5 border border-rose-200 bg-rose-50/20 shadow-sm space-y-3.5">
                {/* Header of the Box with Action Buttons */}
                <div className="flex items-center justify-between border-b border-rose-100 pb-2.5 gap-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm sm:text-base">
                    <HeartHandshake className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="truncate">ส่งสังคมสงเคราะห์</span>
                  </div>

                  {socialWorkRequest.status === 'pending' ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={handleOpenEditSocialWorkModal}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-colors"
                        title="แก้ไขข้อมูลส่งปรึกษา"
                      >
                        <Pencil className="w-3 h-3 text-slate-500" />
                        <span>แก้ไข</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCancelSocialWorkModalOpen(true)
                          setCancelSocialWorkReason('')
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs transition-colors"
                        title="ยกเลิกการส่งปรึกษา"
                      >
                        <RotateCcw className="w-3 h-3 text-rose-500" />
                        <span>ยกเลิก</span>
                      </button>
                    </div>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-semibold px-2 py-0.5">
                      ตอบแล้ว
                    </Badge>
                  )}
                </div>

                <div className="space-y-3 text-sm">
                  {socialWorkRequest.status === 'pending' && (
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        รอนักสังคมสงเคราะห์ตอบ
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="text-muted-foreground text-xs font-medium block mb-1">สาเหตุที่ส่งปรึกษา</span>
                    <div className="text-slate-800 bg-white p-3 rounded-xl border border-rose-100 text-xs sm:text-sm leading-relaxed shadow-2xs font-medium">
                      {socialWorkRequest.reason_name}
                      {socialWorkRequest.reason_other ? (
                        <span className="block text-slate-600 text-xs mt-1 bg-rose-50/50 p-1.5 rounded border border-rose-100 font-normal">
                          ระบุ: {socialWorkRequest.reason_other}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {socialWorkRequest.nurse_comment && (
                    <div>
                      <span className="text-muted-foreground text-xs font-medium block mb-1">ความเห็นพยาบาล</span>
                      <div className="text-slate-700 bg-white p-3 rounded-xl border border-rose-100 text-xs sm:text-sm leading-relaxed shadow-2xs whitespace-pre-wrap">
                        {socialWorkRequest.nurse_comment}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-rose-100 pt-2.5 space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground shrink-0">ผู้ส่ง:</span>
                      <span className="font-semibold text-slate-800 truncate">
                        {socialWorkRequest.sent_by_name || socialWorkRequest.sent_by || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground shrink-0">วันที่ เวลา:</span>
                      <span className="font-semibold text-slate-800">
                        {formatDateTime(socialWorkRequest.sent_at)}
                      </span>
                    </div>
                  </div>

                  {socialWorkRequest.status === 'answered' && (
                    <div className="mt-3 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>ความคิดเห็นของนักสังคมสงเคราะห์</span>
                      </div>
                      <div className="text-slate-800 text-xs sm:text-sm bg-white p-2.5 rounded-lg border border-emerald-100 whitespace-pre-wrap leading-relaxed shadow-2xs">
                        {socialWorkRequest.social_worker_comment}
                      </div>
                      <div className="border-t border-emerald-100 pt-2.5 space-y-1.5 text-xs text-slate-600">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-muted-foreground shrink-0">ผู้ตอบ:</span>
                          <span className="font-semibold text-slate-800 truncate">
                            {socialWorkRequest.social_worker_by_name || socialWorkRequest.social_worker_by || '-'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-muted-foreground shrink-0">วันที่ เวลา:</span>
                          <span className="font-semibold text-slate-800">
                            {formatDateTime(socialWorkRequest.social_worker_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Card 2: สำหรับเจ้าหน้าที่งานสิทธิ์มากรอกให้สิทธิ์ (แสดงเมื่อมีการส่งปรึกษาสิทธิ์แล้ว) */}
          {details?.consult_pttype_date && (
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
              {/* If granted and not editing: show summary */}
              {details?.grant_pttype_date && !isEditingGrant ? (
                <div className="p-5 bg-emerald-50/30 border-t-4 border-t-emerald-500 space-y-4">
                  {/* Header with Edit & Cancel buttons */}
                  <div className="flex items-center justify-between border-b border-emerald-100 pb-3 gap-2">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-base sm:text-lg">
                      <BookmarkCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>สำหรับเจ้าหน้าที่งานสิทธิ์</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingGrant(true)
                          setIsOtherPttype(Boolean(details.grant_pttype_is_other))
                          setOtherPttypeText(details.grant_pttype_other_text || '')
                          setAsmType(details.grant_pttype_asm_type || null)
                          if (details.grant_pttype_code || details.grant_pttype_name) {
                            setSelectedPttype({
                              pttype: details.grant_pttype_code || '',
                              name: details.grant_pttype_name || ''
                            })
                            setPttypeSearch(details.grant_pttype_name || '')
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-colors"
                        title="แก้ไขข้อมูลให้สิทธิ์"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-500" />
                        <span>แก้ไข</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCancelGrantModalOpen(true)
                          setCancelGrantPassword('')
                          setCancelGrantError('')
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs transition-colors"
                        title="ยกเลิกข้อมูลให้สิทธิ์"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                        <span>ยกเลิก</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 text-base">
                    {/* สิทธิ์ */}
                    <div>
                      <span className="text-muted-foreground text-sm font-medium block mb-1">สิทธิ์</span>
                      <div className="font-semibold text-slate-900 bg-white p-3.5 rounded-xl border border-emerald-200 text-base sm:text-lg shadow-2xs flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span>
                          {details.grant_pttype_code ? `[${details.grant_pttype_code}] ` : ''}
                          {details.grant_pttype_name}
                        </span>
                      </div>
                    </div>

                    {/* อสม. ถ้ามี */}
                    {details.grant_pttype_asm_type && (
                      <div>
                        <span className="text-muted-foreground text-sm font-medium block mb-1">
                          กรณีใช้สิทธิ อสม. ลดหย่อนส่วนเกินค่าห้อง
                        </span>
                        <div className="text-slate-800 bg-white p-3 rounded-xl border border-emerald-100 text-xs sm:text-sm leading-relaxed shadow-2xs">
                          {details.grant_pttype_asm_type === 'asm_self' ? (
                            <span>
                              <strong>กรณีผู้ป่วยเป็น อสม.</strong> ถ่ายสำเนาบัตร อสม. แนบเพื่อใช้สิทธิตามระเบียบกระทรวงสาธารณสุข ว่าด้วยการช่วยเหลือในการรักษาพยาบาล (ฉบับ 8) พ.ศ. 2562 ลงวันที่ 25 ธันวาคม 2562
                            </span>
                          ) : (
                            <span>
                              <strong>กรณีผู้ป่วยเป็น ครอบครัว อสม.</strong> ทำหนังสือรับรองสิทธิจากหน่วยงาน ใช้สิทธิลดหย่อนส่วนเกินสิทธิ ตามระเบียบกระทรวงสาธารณสุขข้างต้น
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="border-t border-emerald-100 pt-3.5 space-y-2.5 text-sm sm:text-base text-slate-700">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-muted-foreground text-sm font-medium shrink-0">ผู้บันทึก:</span>
                        <span className="font-semibold text-slate-900">
                          {details.grant_pttype_by_name || details.grant_pttype_by || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-muted-foreground text-sm font-medium shrink-0">วันที่ เวลา:</span>
                        <span className="font-semibold text-slate-900">
                          {formatDateTime(details.grant_pttype_date)}
                        </span>
                      </div>
                    </div>

                    {/* ความคิดเห็น / ข้อความเพิ่มเติม */}
                    <div className="border-t border-emerald-100 pt-3.5 space-y-3">
                      <div className="flex items-center gap-2 font-bold text-slate-900 text-sm sm:text-base">
                        <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>ความเห็นเจ้าหน้าที่ ({comments.length})</span>
                      </div>

                      {comments.length > 0 && (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {comments.map((c) => (
                            <div key={c.id} className="bg-white p-3 rounded-xl border border-emerald-100 text-xs sm:text-sm shadow-2xs space-y-1.5">
                              <p className="text-slate-800 whitespace-pre-wrap font-normal leading-relaxed">{c.comment}</p>
                              <div className="flex justify-between items-center text-[11px] sm:text-xs text-muted-foreground pt-1.5 border-t border-slate-100">
                                <span className="font-semibold text-slate-700">{c.created_by_name || c.created_by}</span>
                                <span>{formatDateTime(c.created_at)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* เพิ่มความเห็นในภายหลัง */}
                      <div className="space-y-2 pt-2">
                        <textarea
                          rows={2}
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="พิมพ์ความเห็นเพิ่มเติม..."
                          className="w-full px-3.5 py-2 text-xs sm:text-sm border border-input rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none shadow-2xs"
                        />
                        {commentError && (
                          <div className="text-xs text-rose-500 font-medium">{commentError}</div>
                        )}
                        <button
                          type="button"
                          onClick={handleAddComment}
                          disabled={submittingComment || !newComment.trim()}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors disabled:opacity-50"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>{submittingComment ? 'กำลังบันทึก...' : 'เพิ่มความเห็น'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Form to grant rights */
                <form onSubmit={handleSaveGrant} className="p-5 border-t-4 border-t-sky-500 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-base sm:text-lg">
                      <BookmarkCheck className="w-5 h-5 text-sky-600" />
                      <span>สำหรับเจ้าหน้าที่งานสิทธิ์</span>
                    </div>
                    {isEditingGrant && (
                      <button
                        type="button"
                        onClick={() => setIsEditingGrant(false)}
                        className="text-xs text-muted-foreground hover:text-slate-800 underline"
                      >
                        ยกเลิกแก้ไข
                      </button>
                    )}
                  </div>

                  {/* 1. ช่อง Select ให้เลือกสิทธิ์ (ค้นหาชื่อสิทธิ์ หรือ code ได้) */}
                  <div className="relative">
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                      เลือกสิทธิ์การรักษา {!isOtherPttype && <span className="text-red-500">*</span>}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        disabled={isOtherPttype}
                        value={pttypeSearch}
                        onChange={(e) => {
                          setPttypeSearch(e.target.value)
                          setIsPttypeDropdownOpen(true)
                        }}
                        onFocus={() => {
                          if (!isOtherPttype) setIsPttypeDropdownOpen(true)
                        }}
                        placeholder={isOtherPttype ? "ปิดการเลือกเนื่องจากเลือกสิทธิ์อื่นๆ" : "พิมพ์ค้นหาชื่อสิทธิ์ หรือ รหัสสิทธิ์..."}
                        className={`w-full pl-10 pr-9 py-2.5 text-base border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                          isOtherPttype ? 'bg-slate-100 opacity-60 cursor-not-allowed text-slate-400' : 'bg-background'
                        }`}
                      />
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      {!isOtherPttype && (
                        <button
                          type="button"
                          onClick={() => setIsPttypeDropdownOpen(!isPttypeDropdownOpen)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground p-1"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Pttype Dropdown Menu */}
                    {!isOtherPttype && isPttypeDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-60 overflow-y-auto divide-y divide-slate-100">
                        {filteredPttypes.length === 0 ? (
                          <div className="p-4 text-sm text-center text-muted-foreground">
                            ไม่พบสิทธิ์การรักษาที่ค้นหา
                          </div>
                        ) : (
                          filteredPttypes.map(p => {
                            const isSelected = selectedPttype?.pttype === p.pttype
                            return (
                              <button
                                key={p.pttype}
                                type="button"
                                onClick={() => {
                                  setSelectedPttype(p)
                                  setPttypeSearch(p.name)
                                  setIsPttypeDropdownOpen(false)
                                }}
                                className={`w-full text-left px-4 py-2.5 text-sm sm:text-base flex items-center justify-between hover:bg-sky-50 transition-colors ${
                                  isSelected ? 'bg-sky-50 font-semibold text-sky-700' : 'text-slate-700'
                                }`}
                              >
                                <span className="truncate pr-2">{p.name}</span>
                                <span className="text-xs text-muted-foreground font-mono shrink-0">[{p.pttype}]</span>
                              </button>
                            )
                          })
                        )}
                      </div>
                    )}

                    {!isOtherPttype && selectedPttype?.name && (
                      <div className="mt-2 flex items-center gap-2 text-xs sm:text-sm text-sky-700 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-100">
                        <Check className="w-4 h-4 text-sky-600" />
                        <span>สิทธิ์ที่เลือก: <strong>[{selectedPttype.pttype}] {selectedPttype.name}</strong></span>
                      </div>
                    )}
                  </div>

                  {/* 2. Checkbox สิทธิ์อื่นๆ */}
                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isOtherPttype}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setIsOtherPttype(checked)
                          if (checked) {
                            setIsPttypeDropdownOpen(false)
                          }
                        }}
                        className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                      />
                      <span className="text-sm font-semibold text-slate-800">เลือกสิทธิ์อื่นๆ</span>
                    </label>

                    {/* แสดง Text box ด้านล่างเมื่อเลือกสิทธิ์อื่นๆ */}
                    {isOtherPttype && (
                      <div className="animate-in fade-in duration-200">
                        <input
                          type="text"
                          value={otherPttypeText}
                          onChange={(e) => setOtherPttypeText(e.target.value)}
                          placeholder="พิมพ์ระบุสิทธิ์อื่นๆ..."
                          autoFocus
                          className="w-full px-3.5 py-2.5 text-base border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* 3. กรณีใช้สิทธิ อสม. ลดหย่อนส่วนเกินค่าห้อง (เลือกอย่างใดอย่างหนึ่ง หรือไม่เลือก) */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-semibold text-slate-800">
                        กรณีใช้สิทธิ อสม. ลดหย่อนส่วนเกินค่าห้อง
                      </label>
                      {asmType && (
                        <button
                          type="button"
                          onClick={() => setAsmType(null)}
                          className="text-xs text-rose-600 hover:underline font-normal"
                        >
                          ล้างตัวเลือก
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div
                        onClick={() => setAsmType(prev => prev === 'asm_self' ? null : 'asm_self')}
                        className={`p-3 rounded-xl border text-xs sm:text-sm cursor-pointer transition-all flex items-start gap-2.5 ${
                          asmType === 'asm_self'
                            ? 'bg-sky-50 border-sky-500 text-sky-900 shadow-2xs ring-1 ring-sky-500'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="asm_type_choice"
                          checked={asmType === 'asm_self'}
                          onChange={() => {}}
                          className="mt-0.5 text-sky-600 focus:ring-sky-500"
                        />
                        <span className="leading-relaxed">
                          <strong>กรณีผู้ป่วยเป็น อสม.</strong> ถ่ายสำเนาบัตร อสม. แนบเพื่อใช้สิทธิตามระเบียบกระทรวงสาธารณสุข ว่าด้วยการช่วยเหลือในการรักษาพยาบาล (ฉบับ 8) พ.ศ. 2562 ลงวันที่ 25 ธันวาคม 2562
                        </span>
                      </div>

                      <div
                        onClick={() => setAsmType(prev => prev === 'asm_family' ? null : 'asm_family')}
                        className={`p-3 rounded-xl border text-xs sm:text-sm cursor-pointer transition-all flex items-start gap-2.5 ${
                          asmType === 'asm_family'
                            ? 'bg-sky-50 border-sky-500 text-sky-900 shadow-2xs ring-1 ring-sky-500'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="asm_type_choice"
                          checked={asmType === 'asm_family'}
                          onChange={() => {}}
                          className="mt-0.5 text-sky-600 focus:ring-sky-500"
                        />
                        <span className="leading-relaxed">
                          <strong>กรณีผู้ป่วยเป็น ครอบครัว อสม.</strong> ทำหนังสือรับรองสิทธิจากหน่วยงาน ใช้สิทธิลดหย่อนส่วนเกินสิทธิ ตามระเบียบกระทรวงสาธารณสุขข้างต้น
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Textbox ความเห็น */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <label className="block text-sm font-semibold text-slate-800">
                      ความเห็น
                    </label>
                    <textarea
                      rows={2}
                      value={grantComment}
                      onChange={(e) => setGrantComment(e.target.value)}
                      placeholder="พิมพ์ความเห็น..."
                      className="w-full px-3.5 py-2.5 text-sm sm:text-base border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                    />
                  </div>

                  {/* แสดงรายการความเห็นที่มีอยู่แล้ว (ถ้ามี) */}
                  {comments.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
                        <span>ความเห็นที่บันทึกไว้ก่อนหน้า ({comments.length})</span>
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {comments.map((c) => (
                          <div key={c.id} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs shadow-2xs space-y-1">
                            <p className="text-slate-800 whitespace-pre-wrap">{c.comment}</p>
                            <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1 border-t border-slate-200">
                              <span className="font-medium text-slate-700">{c.created_by_name || c.created_by}</span>
                              <span>{formatDateTime(c.created_at)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {grantError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span>{grantError}</span>
                    </div>
                  )}

                  {/* ปุ่มบันทึก */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submittingGrant}
                      className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-3 px-5 text-base rounded-xl shadow-sm transition-all duration-200 hover:shadow disabled:opacity-50"
                    >
                      <Check className="w-5 h-5" />
                      <span>{submittingGrant ? 'กำลังบันทึก...' : 'บันทึกให้สิทธิ์'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Consult Rights Dialog (Pop up ส่งปรึกษา / แก้ไข) */}
      <Dialog open={isConsultModalOpen} onOpenChange={setIsConsultModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-xl font-bold text-slate-900">
              <ShieldAlert className="w-6 h-6 text-sky-600" />
              <span>{details?.consult_pttype_date ? 'แก้ไขการส่งปรึกษาสิทธิการรักษา' : 'ส่งปรึกษาสิทธิการรักษา'}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitConsult} className="space-y-4 py-2">
            {/* 1. ความเร่งด่วน: ฉุกเฉิน หรือ ไม่ฉุกเฉิน */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                ความเห็นแพทย์เจ้าของไข้ <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConsultUrgency('ไม่ฉุกเฉิน')}
                  className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border text-base font-semibold transition-all ${
                    consultUrgency === 'ไม่ฉุกเฉิน'
                      ? 'bg-sky-50 border-sky-500 text-sky-700 shadow-sm ring-2 ring-sky-500/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2 className={`w-5 h-5 ${consultUrgency === 'ไม่ฉุกเฉิน' ? 'text-sky-600' : 'text-slate-400'}`} />
                  ไม่ฉุกเฉิน
                </button>
                <button
                  type="button"
                  onClick={() => setConsultUrgency('ฉุกเฉิน')}
                  className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border text-base font-semibold transition-all ${
                    consultUrgency === 'ฉุกเฉิน'
                      ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm ring-2 ring-rose-500/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <AlertCircle className={`w-5 h-5 ${consultUrgency === 'ฉุกเฉิน' ? 'text-rose-600' : 'text-slate-400'}`} />
                  ฉุกเฉิน
                </button>
              </div>
            </div>

            {/* 2. สาเหตุที่ส่งปรึกษา */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                สาเหตุที่ส่งปรึกษา <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={consultReason}
                onChange={(e) => setConsultReason(e.target.value)}
                placeholder="ระบุสาเหตุหรือข้อสงสัยเกี่ยวกับสิทธิการรักษา..."
                className="w-full px-3.5 py-3 text-base border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-sky-500 leading-relaxed"
              />
            </div>

            {/* 3. รศส. แพทย์ (Searchable dropdown) */}
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                รศส. แพทย์ <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={doctorSearch}
                  onChange={(e) => {
                    setDoctorSearch(e.target.value)
                    setIsDoctorDropdownOpen(true)
                  }}
                  onFocus={() => setIsDoctorDropdownOpen(true)}
                  placeholder="พิมพ์ค้นหาชื่อแพทย์ หรือ รหัสแพทย์..."
                  className="w-full pl-10 pr-9 py-2.5 text-base border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => setIsDoctorDropdownOpen(!isDoctorDropdownOpen)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground p-1"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Doctor Dropdown Menu */}
              {isDoctorDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {filteredDoctors.length === 0 ? (
                    <div className="p-4 text-sm text-center text-muted-foreground">
                      ไม่พบชื่อแพทย์ที่ค้นหา
                    </div>
                  ) : (
                    filteredDoctors.map(doc => {
                      const isSelected = selectedDoctor?.code === doc.code || selectedDoctor?.name === doc.name
                      return (
                        <button
                          key={doc.code || doc.name}
                          type="button"
                          onClick={() => {
                            setSelectedDoctor(doc)
                            setDoctorSearch(doc.name)
                            setIsDoctorDropdownOpen(false)
                          }}
                          className={`w-full text-left px-4 py-3 text-sm sm:text-base flex items-center justify-between hover:bg-sky-50 transition-colors ${
                            isSelected ? 'bg-sky-50/90 font-semibold text-sky-700' : 'text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Stethoscope className="w-4 h-4 text-slate-400" />
                            <span>{doc.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">[{doc.code}]</span>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
              {selectedDoctor?.name && (
                <div className="mt-2 flex items-center gap-2 text-sm text-sky-700 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-100">
                  <Check className="w-4 h-4 text-sky-600" />
                  <span>แพทย์ที่เลือก: <strong>{selectedDoctor.name}</strong></span>
                </div>
              )}
            </div>

            {consultError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{consultError}</span>
              </div>
            )}

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConsultModalOpen(false)}
                disabled={submittingConsult}
                className="text-base px-5 py-2.5"
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                disabled={submittingConsult || !consultReason.trim()}
                className="bg-gradient-to-r from-sky-500 to-blue-600 text-white text-base px-6 py-2.5 font-semibold"
              >
                {submittingConsult ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel Consult Confirmation Modal (ยืนยันยกเลิกการส่งปรึกษา) */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-slate-800">
              <div className="p-2 bg-rose-100 rounded-xl text-rose-600">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">ยืนยันยกเลิกการส่งปรึกษา</h3>
                <p className="text-xs text-rose-600 font-normal">ยกเลิกรายการส่งปรึกษาสิทธิการรักษาของผู้ป่วยรายนี้</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleConfirmCancelConsult} className="space-y-4 py-2">
            <div className="text-sm text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ผู้ขอยกเลิก:</span>
                <span className="font-semibold text-slate-800">{user?.name || user?.loginname}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ผู้ป่วย:</span>
                <span className="font-medium text-slate-800">{patient?.fullname || `${patient?.pname}${patient?.fname} ${patient?.lname}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">AN:</span>
                <span className="font-mono text-slate-700">{patient?.an}</span>
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
                disabled={submittingCancel}
                className="w-full px-3.5 py-2.5 text-base border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 bg-background"
              />
              {cancelError && (
                <div className="flex items-center gap-1.5 text-rose-600 text-sm mt-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cancelError}</span>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCancelModalOpen(false)}
                disabled={submittingCancel}
                className="text-sm px-4 py-2"
              >
                ปิด
              </Button>
              <button
                type="submit"
                disabled={submittingCancel || !cancelPassword.trim()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingCancel ? 'กำลังดำเนินการ...' : 'ยืนยันยกเลิก'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel Grant Confirmation Modal (ยืนยันยกเลิกการให้สิทธิ์) */}
      <Dialog open={isCancelGrantModalOpen} onOpenChange={setIsCancelGrantModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-slate-800">
              <div className="p-2 bg-rose-100 rounded-xl text-rose-600">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">ยืนยันยกเลิกการให้สิทธิ์</h3>
                <p className="text-xs text-rose-600 font-normal">ยกเลิกข้อมูลการให้สิทธิ์ของผู้ป่วยรายนี้</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleConfirmCancelGrant} className="space-y-4 py-2">
            <div className="text-sm text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ผู้ขอยกเลิก:</span>
                <span className="font-semibold text-slate-800">{user?.name || user?.loginname}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ผู้ป่วย:</span>
                <span className="font-medium text-slate-800">{patient?.fullname || `${patient?.pname}${patient?.fname} ${patient?.lname}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">AN:</span>
                <span className="font-mono text-slate-700">{patient?.an}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                กรุณากรอกรหัสผ่านเพื่อยืนยัน <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={cancelGrantPassword}
                onChange={(e) => {
                  setCancelGrantPassword(e.target.value)
                  if (cancelGrantError) setCancelGrantError('')
                }}
                placeholder="รหัสผ่านเข้าสู่ระบบของคุณ..."
                autoFocus
                disabled={submittingCancelGrant}
                className="w-full px-3.5 py-2.5 text-base border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 bg-background"
              />
              {cancelGrantError && (
                <div className="flex items-center gap-1.5 text-rose-600 text-sm mt-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cancelGrantError}</span>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCancelGrantModalOpen(false)}
                disabled={submittingCancelGrant}
                className="text-sm px-4 py-2"
              >
                ปิด
              </Button>
              <button
                type="submit"
                disabled={submittingCancelGrant || !cancelGrantPassword.trim()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingCancelGrant ? 'กำลังดำเนินการ...' : 'ยืนยันยกเลิก'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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

      {/* Benefit Certificate Details Dialog (หนังสือรับรองสวัสดิการค่าห้องพิเศษ) */}
      <Dialog open={isCertModalOpen} onOpenChange={setIsCertModalOpen}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-2xl border-border">
          <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 p-5 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <Hotel className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-white tracking-wide">
                    หนังสือรับรองสวัสดิการค่าห้องพิเศษ
                  </DialogTitle>
                  <p className="text-xs text-sky-100 mt-0.5">
                    รหัสคำร้อง: {benefitCert?.request_code || '-'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCertModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {benefitCert && (
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto bg-slate-50/50">
              {/* Status Banner */}
              <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs font-semibold text-slate-500">สถานะคำร้อง</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                  benefitCert.status_text === 'อนุมัติ'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{benefitCert.status_text}</span>
                </span>
              </div>

              {/* Patient and Relationship Section */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
                  ข้อมูลผู้ป่วย
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-400 block">ชื่อผู้ป่วย</span>
                    <strong className="text-slate-800 font-semibold">{benefitCert.patient_name || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">เกี่ยวข้องเป็น</span>
                    <span className="inline-block px-2 py-0.5 mt-0.5 text-xs font-semibold rounded bg-sky-50 text-sky-700 border border-sky-200">
                      {benefitCert.relationship || '-'}
                    </span>
                  </div>
                </div>
                {benefitCert.ward_room && (
                  <div className="pt-1 text-xs text-slate-500">
                    หอผู้ป่วย/ห้อง: <span className="font-medium text-slate-700">{benefitCert.ward_room}</span>
                  </div>
                )}
              </div>

              {/* Requester Section */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
                  ข้อมูลผู้ยื่นคำร้อง
                </div>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-slate-400 shrink-0">ผู้ยื่นคำร้อง:</span>
                    <strong className="text-slate-800 text-right">{benefitCert.requester_name || '-'}</strong>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-slate-400 shrink-0">ตำแหน่ง:</span>
                    <span className="text-slate-700 text-right">{benefitCert.requester_position || '-'}</span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-slate-400 shrink-0">แผนก:</span>
                    <span className="text-slate-700 text-right">{benefitCert.requester_department || '-'}</span>
                  </div>
                  <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-100">
                    <span className="text-xs text-slate-400 shrink-0 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      วันที่ยื่นคำร้อง:
                    </span>
                    <span className="text-xs font-mono font-medium text-slate-700 text-right">
                      {formatDateTime(benefitCert.request_date)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Approver Section */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
                  ข้อมูลการอนุมัติ
                </div>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-slate-400 shrink-0">อนุมัติโดย:</span>
                    <strong className="text-slate-800 text-right">{benefitCert.approver_name || '-'}</strong>
                  </div>
                  <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-100">
                    <span className="text-xs text-slate-400 shrink-0 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      วันที่อนุมัติ:
                    </span>
                    <span className="text-xs font-mono font-medium text-emerald-700 text-right">
                      {formatDateTime(benefitCert.approve_date)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCertModalOpen(false)}
              className="text-xs px-4 py-2"
            >
              ปิดหน้าต่าง
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Social Work Consult Dialog (Pop up ส่งปรึกษา / แก้ไข) */}
      <Dialog open={isSocialWorkModalOpen} onOpenChange={setIsSocialWorkModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-xl font-bold text-slate-900">
              <HeartHandshake className="w-6 h-6 text-rose-600" />
              <span>{isEditSocialWork ? 'แก้ไขการส่งปรึกษานักสังคมสงเคราะห์' : 'ส่งปรึกษานักสังคมสงเคราะห์'}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitSocialWork} className="space-y-4 py-2">
            {/* Patient Header Banner */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs sm:text-sm text-slate-700 flex flex-wrap gap-x-4 gap-y-1.5">
              <div>AN: <strong className="text-slate-900 font-mono">{patient?.an}</strong></div>
              <div>HN: <strong className="text-slate-900 font-mono">{patient?.hn}</strong></div>
              <div>ชื่อ-สกุล: <strong className="text-slate-900">{patient?.patient_name || patient?.fullname || `${patient?.pname || ''}${patient?.fname || ''} ${patient?.lname || ''}`}</strong></div>
              {patient?.age_y && <div>อายุ: <strong className="text-slate-900">{patient?.age_y} ปี</strong></div>}
            </div>

            {/* 1. สาเหตุที่ส่งปรึกษานักสังคมสงเคราะห์ */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-800">
                สาเหตุที่ส่งปรึกษานักสังคมสงเคราะห์ <span className="text-red-500">*</span>
              </label>

              <div className="space-y-2">
                {socialWorkReasons.map((reason) => {
                  const isSelected = Number(selectedSocialWorkReasonId) === Number(reason.id)
                  return (
                    <div key={reason.id} className="space-y-2">
                      <label
                        onClick={() => {
                          setSelectedSocialWorkReasonId(reason.id)
                          setSelectedSocialWorkReasonName(reason.name)
                        }}
                        className={`p-3 rounded-xl border text-sm cursor-pointer transition-all flex items-start gap-3 select-none ${
                          isSelected
                            ? 'bg-rose-50/70 border-rose-500 text-rose-950 shadow-2xs ring-1 ring-rose-400 font-medium'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="social_work_reason_choice"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedSocialWorkReasonId(reason.id)
                            setSelectedSocialWorkReasonName(reason.name)
                          }}
                          className="mt-0.5 text-rose-600 focus:ring-rose-500 shrink-0"
                        />
                        <span className="leading-snug">{reason.name}</span>
                      </label>

                      {/* Textbox เมื่อเลือกอื่นๆระบุ */}
                      {Boolean(reason.is_other) && isSelected && (
                        <div className="pl-6 animate-in fade-in duration-200">
                          <input
                            type="text"
                            value={socialWorkReasonOther}
                            onChange={(e) => setSocialWorkReasonOther(e.target.value)}
                            placeholder="ระบุสาเหตุอื่นๆ..."
                            autoFocus
                            className="w-full px-3.5 py-2 text-sm border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-2xs"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 2. ความเห็นของพยาบาลหัวหน้าตึกหรือหัวหน้าเวร */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-sm font-semibold text-slate-800">
                ความเห็นของพยาบาลหัวหน้าตึกหรือหัวหน้าเวร <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={nurseSocialWorkComment}
                onChange={(e) => setNurseSocialWorkComment(e.target.value)}
                placeholder="ระบุความคิดเห็นของพยาบาล..."
                className="w-full px-3.5 py-2.5 text-sm border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none shadow-2xs leading-relaxed"
              />
            </div>

            {socialWorkError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{socialWorkError}</span>
              </div>
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSocialWorkModalOpen(false)}
                className="rounded-xl"
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                disabled={submittingSocialWork || !selectedSocialWorkReasonId || !nurseSocialWorkComment.trim()}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white gap-1.5 shadow-2xs disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{submittingSocialWork ? 'กำลังบันทึก...' : (isEditSocialWork ? 'บันทึกการแก้ไข' : 'บันทึกส่งปรึกษา')}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel Social Work Dialog */}
      <Dialog open={isCancelSocialWorkModalOpen} onOpenChange={setIsCancelSocialWorkModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <RotateCcw className="w-5 h-5" />
              <span>ยืนยันยกเลิกการส่งปรึกษานักสังคมสงเคราะห์</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-600">
              คุณต้องการยกเลิกคำขอส่งปรึกษานักสังคมสงเคราะห์สำหรับผู้ป่วย AN: <strong>{patient?.an}</strong> ใช่หรือไม่?
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                เหตุผลในการยกเลิก (ถ้ามี)
              </label>
              <input
                type="text"
                value={cancelSocialWorkReason}
                onChange={(e) => setCancelSocialWorkReason(e.target.value)}
                placeholder="ระบุเหตุผลในการยกเลิก..."
                className="w-full px-3 py-2 text-sm border rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCancelSocialWorkModalOpen(false)}
              className="rounded-xl"
            >
              ย้อนกลับ
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmCancelSocialWork}
              disabled={submittingCancelSocialWork}
              className="rounded-xl bg-rose-600 hover:bg-rose-700"
            >
              {submittingCancelSocialWork ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
            </Button>
          </DialogFooter>
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
