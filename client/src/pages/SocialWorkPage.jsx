import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  HeartHandshake, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  User, 
  Building2, 
  ShieldCheck, 
  Calendar, 
  MessageSquare, 
  Check, 
  ChevronRight,
  Eye,
  FileText,
  RotateCcw
} from 'lucide-react'
import api from '../services/api'
import socket from '../services/socket'
import { useAuth } from '../contexts/AuthContext'
import { useSound } from '../contexts/SoundContext'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'

export default function SocialWorkPage() {
  const { user } = useAuth()
  const isAdmin = !!user?.isAdmin
  const { playAlert } = useSound()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('pending') // 'pending' | 'history'
  const [pendingRequests, setPendingRequests] = useState([])
  const [historyRequests, setHistoryRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Answer Modal States
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [isAnswerModalOpen, setIsAnswerModalOpen] = useState(false)
  const [socialWorkerComment, setSocialWorkerComment] = useState('')
  const [submittingAnswer, setSubmittingAnswer] = useState(false)
  const [answerError, setAnswerError] = useState('')

  // Detail Modal States (for viewing history)
  const [viewingRequest, setViewingRequest] = useState(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const [pendingRes, historyRes] = await Promise.all([
        api.get('/social-work/requests/pending'),
        api.get('/social-work/requests/history')
      ])
      setPendingRequests(pendingRes.data?.requests || [])
      setHistoryRequests(historyRes.data?.requests || [])
    } catch (err) {
      console.error('Error fetching social work requests:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  // Socket listener for real-time updates
  useEffect(() => {
    const handleUpdated = (data) => {
      fetchRequests()
      if (data?.status === 'pending') {
        playAlert()
      }
    }

    socket.on('social_work:updated', handleUpdated)
    return () => {
      socket.off('social_work:updated', handleUpdated)
    }
  }, [fetchRequests, playAlert])

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(dateStr)
      return `${d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`
    } catch {
      return dateStr
    }
  }

  // Filter requests by search query
  const filterList = (list) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter(r => 
      (r.an && r.an.toLowerCase().includes(q)) ||
      (r.hn && r.hn.toLowerCase().includes(q)) ||
      (r.patient_name && r.patient_name.toLowerCase().includes(q)) ||
      (r.ward_name && r.ward_name.toLowerCase().includes(q)) ||
      (r.reason_name && r.reason_name.toLowerCase().includes(q)) ||
      (r.reason_other && r.reason_other.toLowerCase().includes(q)) ||
      (r.sent_by_name && r.sent_by_name.toLowerCase().includes(q))
    )
  }

  const filteredPending = useMemo(() => filterList(pendingRequests), [pendingRequests, searchQuery])
  const filteredHistory = useMemo(() => filterList(historyRequests), [historyRequests, searchQuery])

  // Open modal to answer
  const handleOpenAnswerModal = (req, e) => {
    if (e) e.stopPropagation()
    setSelectedRequest(req)
    setSocialWorkerComment(req.social_worker_comment || '')
    setAnswerError('')
    setIsAnswerModalOpen(true)
  }

  // Open modal to view history detail
  const handleOpenDetailModal = (req, e) => {
    if (e) e.stopPropagation()
    setViewingRequest(req)
    setIsDetailModalOpen(true)
  }

  // Submit Social Worker Comment
  const handleSaveAnswer = async (e) => {
    e.preventDefault()
    if (!socialWorkerComment.trim()) {
      setAnswerError('กรุณากรอกความคิดเห็นของนักสังคมสงเคราะห์')
      return
    }

    setSubmittingAnswer(true)
    setAnswerError('')
    try {
      await api.post(`/social-work/requests/${selectedRequest.id}/answer`, {
        social_worker_comment: socialWorkerComment.trim()
      })
      setIsAnswerModalOpen(false)
      fetchRequests()
    } catch (err) {
      console.error('Error saving social work answer:', err)
      setAnswerError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกความคิดเห็น')
    } finally {
      setSubmittingAnswer(false)
    }
  }

  const handleAdminCancel = async (req) => {
    if (!req?.id) return
    const reason = window.prompt(`ยืนยันยกเลิกคำขอส่งปรึกษานักสังคมสงเคราะห์ AN: ${req.an} หรือไม่?\nกรุณาระบุเหตุผลในการยกเลิก (ถ้ามี):`, '')
    if (reason === null) return
    try {
      await api.post(`/social-work/requests/${req.id}/cancel`, {
        cancel_reason: reason.trim()
      })
      alert('ยกเลิกรายการส่งปรึกษาเรียบร้อยแล้ว')
      setIsDetailModalOpen(false)
      fetchRequests()
    } catch (err) {
      console.error('Cancel social work error:', err)
      alert(err.response?.data?.error || 'เกิดข้อผิดพลาดในการยกเลิก')
    }
  }

  return (
    <div className="w-full px-4 sm:px-6 py-6 space-y-6 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 shadow-2xs">
            <HeartHandshake className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">งานสังคมสงเคราะห์</h1>
              <Badge className="bg-rose-100 text-rose-800 border-rose-200 font-semibold px-2.5 py-0.5 text-xs">
                Social Work
              </Badge>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">
              ระบบรับเรื่องปรึกษา ให้ความช่วยเหลือ และประเมินผู้ป่วยโดยนักสังคมสงเคราะห์
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา AN, HN, ชื่อ, ตึก..."
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchRequests}
            disabled={loading}
            className="rounded-xl border-slate-200 text-slate-600 hover:text-slate-900 gap-1.5 shrink-0"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-600' : ''}`} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </Button>
        </div>
      </div>

      {/* Tabs Selection */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`px-5 py-3 text-sm sm:text-base font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'border-rose-600 text-rose-600 bg-rose-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>รายการที่ยังไม่ได้ตอบ</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'pending'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {pendingRequests.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-5 py-3 text-sm sm:text-base font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-rose-600 text-rose-600 bg-rose-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>ประวัติรายการที่ตอบแล้ว</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'history'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {historyRequests.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab 1: รายการที่ยังไม่ได้ตอบ (Pending Table) */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-xs tracking-wider">
                  <th className="py-4 px-4 whitespace-nowrap">วันที่ส่ง</th>
                  <th className="py-4 px-4 whitespace-nowrap">AN / HN</th>
                  <th className="py-4 px-4">ชื่อ-สกุล ผู้ป่วย</th>
                  <th className="py-4 px-4 whitespace-nowrap">อายุ</th>
                  <th className="py-4 px-4 whitespace-nowrap">หอผู้ป่วย</th>
                  <th className="py-4 px-4">สิทธิการรักษา</th>
                  <th className="py-4 px-4">สาเหตุที่ส่งปรึกษา</th>
                  <th className="py-4 px-4">ความเห็นของพยาบาล</th>
                  <th className="py-4 px-4 text-center whitespace-nowrap">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && pendingRequests.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
                        <span>กำลังโหลดข้อมูล...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredPending.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="p-3 bg-slate-50 text-slate-400 rounded-full">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        </div>
                        <span className="font-semibold text-slate-600">ไม่มีรายการค้างตอบในขณะนี้</span>
                        <span className="text-xs text-slate-400">เมื่อมีหอผู้ป่วยส่งปรึกษา รายการจะแสดงขึ้นที่นี่โดยอัตโนมัติ</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPending.map((req) => (
                    <tr
                      key={req.id}
                      onClick={(e) => handleOpenAnswerModal(req, e)}
                      className="hover:bg-rose-50/30 transition-colors cursor-pointer group"
                    >
                      <td className="py-4 px-4 text-xs text-slate-600 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{formatDateTime(req.sent_at)}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">โดย: {req.sent_by_name || req.sent_by}</div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900 block font-mono text-sm">{req.an}</span>
                        <span className="text-xs text-slate-500 font-mono">HN: {req.hn || '-'}</span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900 text-sm group-hover:text-rose-600 transition-colors">
                          {req.patient_name || '-'}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
                        {req.age_y ? `${req.age_y} ปี` : '-'}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 text-xs font-semibold border border-teal-200">
                          <Building2 className="w-3 h-3 shrink-0" />
                          {req.ward_name || '-'}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-xs text-slate-600 max-w-xs truncate">
                        {req.pttype_name || '-'}
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-medium text-slate-900 text-sm">
                          {req.reason_name}
                        </div>
                        {req.reason_other && (
                          <div className="text-xs text-slate-500 mt-0.5 bg-rose-50/60 p-1 rounded border border-rose-100">
                            ระบุ: {req.reason_other}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 max-w-xs">
                        <div className="text-xs text-slate-600 line-clamp-2" title={req.nurse_comment}>
                          {req.nurse_comment || '-'}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <Button
                          size="sm"
                          onClick={(e) => handleOpenAnswerModal(req, e)}
                          className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white gap-1.5 shadow-2xs text-xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>ตอบความคิดเห็น</span>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: ประวัติรายการที่ตอบแล้ว (History Table) */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold text-xs tracking-wider">
                  <th className="py-4 px-4 whitespace-nowrap">วันที่ส่ง</th>
                  <th className="py-4 px-4 whitespace-nowrap">วันที่ตอบ</th>
                  <th className="py-4 px-4 whitespace-nowrap">AN / HN</th>
                  <th className="py-4 px-4">ชื่อ-สกุล ผู้ป่วย</th>
                  <th className="py-4 px-4 whitespace-nowrap">หอผู้ป่วย</th>
                  <th className="py-4 px-4">สาเหตุที่ส่งปรึกษา</th>
                  <th className="py-4 px-4">ความคิดเห็นของนักสังคมสงเคราะห์</th>
                  <th className="py-4 px-4 whitespace-nowrap">ผู้ตอบ</th>
                  <th className="py-4 px-4 text-center whitespace-nowrap">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && historyRequests.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
                        <span>กำลังโหลดข้อมูล...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="w-8 h-8 text-slate-300" />
                        <span className="font-semibold text-slate-600">ยังไม่มีประวัติรายการที่ตอบแล้ว</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((req) => (
                    <tr
                      key={req.id}
                      onClick={(e) => handleOpenDetailModal(req, e)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-4 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {formatDateTime(req.sent_at)}
                      </td>

                      <td className="py-4 px-4 text-xs text-emerald-700 whitespace-nowrap font-medium">
                        {formatDateTime(req.social_worker_at)}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900 block font-mono text-sm">{req.an}</span>
                        <span className="text-xs text-slate-500 font-mono">HN: {req.hn || '-'}</span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900 text-sm group-hover:text-rose-600 transition-colors">
                          {req.patient_name || '-'}
                        </div>
                        {req.age_y && <div className="text-xs text-slate-400">อายุ {req.age_y} ปี</div>}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 text-xs font-semibold border border-teal-200">
                          {req.ward_name || '-'}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-medium text-slate-900 text-sm">
                          {req.reason_name}
                        </div>
                        {req.reason_other && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            ระบุ: {req.reason_other}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 max-w-sm">
                        <div className="text-xs text-slate-700 bg-emerald-50/50 p-2 rounded-xl border border-emerald-100 line-clamp-3 leading-relaxed">
                          {req.social_worker_comment}
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap text-xs">
                        <span className="font-semibold text-slate-800 block">
                          {req.social_worker_by_name || req.social_worker_by || '-'}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleOpenDetailModal(req, e)}
                          className="rounded-xl border-slate-200 text-slate-600 hover:text-slate-900 gap-1 text-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>ดูรายละเอียด</span>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: กรอกความคิดเห็นของนักสังคมสงเคราะห์ */}
      <Dialog open={isAnswerModalOpen} onOpenChange={setIsAnswerModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-xl font-bold text-slate-900">
              <HeartHandshake className="w-6 h-6 text-rose-600" />
              <span>ความคิดเห็นของนักสังคมสงเคราะห์</span>
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <form onSubmit={handleSaveAnswer} className="space-y-4 py-2">
              {/* Patient Banner */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs sm:text-sm text-slate-700">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div>AN: <strong className="text-slate-900 font-mono text-sm">{selectedRequest.an}</strong></div>
                  <div>HN: <strong className="text-slate-900 font-mono text-sm">{selectedRequest.hn || '-'}</strong></div>
                  <div>อายุ: <strong className="text-slate-900">{selectedRequest.age_y ? `${selectedRequest.age_y} ปี` : '-'}</strong></div>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                  <div>ชื่อ-สกุล: <strong className="text-slate-900 font-medium">{selectedRequest.patient_name || '-'}</strong></div>
                  <div>หอผู้ป่วย: <strong className="text-teal-700">{selectedRequest.ward_name || '-'}</strong></div>
                </div>
                {selectedRequest.pttype_name && (
                  <div className="pt-1 text-xs text-slate-500">
                    สิทธิการรักษา: <span className="text-slate-700 font-medium">{selectedRequest.pttype_name}</span>
                  </div>
                )}
              </div>

              {/* Consult Request Detail Box */}
              <div className="p-4 bg-rose-50/40 rounded-2xl border border-rose-100 space-y-2.5 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground font-semibold block mb-0.5">สาเหตุที่ส่งปรึกษา</span>
                  <div className="font-semibold text-rose-950 text-base">
                    {selectedRequest.reason_name}
                  </div>
                  {selectedRequest.reason_other && (
                    <div className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-rose-100 mt-1">
                      ระบุเพิ่มเติม: {selectedRequest.reason_other}
                    </div>
                  )}
                </div>

                {selectedRequest.nurse_comment && (
                  <div>
                    <span className="text-xs text-muted-foreground font-semibold block mb-0.5">ความเห็นของพยาบาลหัวหน้าตึก/เวร</span>
                    <div className="text-xs sm:text-sm text-slate-800 bg-white p-3 rounded-xl border border-rose-100 whitespace-pre-wrap leading-relaxed shadow-2xs">
                      {selectedRequest.nurse_comment}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center text-xs text-slate-500 pt-1 border-t border-rose-100">
                  <span>ผู้ส่ง: <strong className="text-slate-700">{selectedRequest.sent_by_name || selectedRequest.sent_by}</strong></span>
                  <span>{formatDateTime(selectedRequest.sent_at)}</span>
                </div>
              </div>

              {/* Form Input: ความคิดเห็นของนักสังคมสงเคราะห์ */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-sm font-semibold text-slate-800">
                  ความคิดเห็นของนักสังคมสงเคราะห์ <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={socialWorkerComment}
                  onChange={(e) => setSocialWorkerComment(e.target.value)}
                  placeholder="กรอกความคิดเห็น ผลการประเมิน หรือแนวทางการสงเคราะห์ช่วยเหลือ..."
                  autoFocus
                  className="w-full px-3.5 py-3 text-sm border border-input rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none shadow-2xs leading-relaxed"
                />
              </div>

              {answerError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{answerError}</span>
                </div>
              )}

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAnswerModalOpen(false)}
                  className="rounded-xl"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  disabled={submittingAnswer || !socialWorkerComment.trim()}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{submittingAnswer ? 'กำลังบันทึก...' : 'บันทึกความคิดเห็น'}</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: ดูรายละเอียดประวัติ (History Detail Modal) */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-xl font-bold text-slate-900">
              <HeartHandshake className="w-6 h-6 text-rose-600" />
              <span>รายละเอียดการให้คำปรึกษา</span>
            </DialogTitle>
          </DialogHeader>

          {viewingRequest && (
            <div className="space-y-4 py-2">
              {/* Patient Banner */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs sm:text-sm text-slate-700">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div>AN: <strong className="text-slate-900 font-mono text-sm">{viewingRequest.an}</strong></div>
                  <div>HN: <strong className="text-slate-900 font-mono text-sm">{viewingRequest.hn || '-'}</strong></div>
                  <div>อายุ: <strong className="text-slate-900">{viewingRequest.age_y ? `${viewingRequest.age_y} ปี` : '-'}</strong></div>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                  <div>ชื่อ-สกุล: <strong className="text-slate-900 font-medium">{viewingRequest.patient_name || '-'}</strong></div>
                  <div>หอผู้ป่วย: <strong className="text-teal-700">{viewingRequest.ward_name || '-'}</strong></div>
                </div>
              </div>

              {/* Consult Request Detail */}
              <div className="p-4 bg-rose-50/40 rounded-2xl border border-rose-100 space-y-2 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground font-semibold block mb-0.5">สาเหตุที่ส่งปรึกษา</span>
                  <div className="font-semibold text-rose-950 text-base">
                    {viewingRequest.reason_name}
                  </div>
                  {viewingRequest.reason_other && (
                    <div className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-rose-100 mt-1">
                      ระบุเพิ่มเติม: {viewingRequest.reason_other}
                    </div>
                  )}
                </div>

                {viewingRequest.nurse_comment && (
                  <div>
                    <span className="text-xs text-muted-foreground font-semibold block mb-0.5">ความเห็นของพยาบาล</span>
                    <div className="text-xs sm:text-sm text-slate-800 bg-white p-3 rounded-xl border border-rose-100 whitespace-pre-wrap leading-relaxed">
                      {viewingRequest.nurse_comment}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center text-xs text-slate-500 pt-1 border-t border-rose-100">
                  <span>ผู้ส่ง: <strong className="text-slate-700">{viewingRequest.sent_by_name || viewingRequest.sent_by}</strong></span>
                  <span>{formatDateTime(viewingRequest.sent_at)}</span>
                </div>
              </div>

              {/* Social Worker Answer Box */}
              <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2 text-sm">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>ความคิดเห็นของนักสังคมสงเคราะห์</span>
                </div>
                <div className="text-xs sm:text-sm text-slate-800 bg-white p-3.5 rounded-xl border border-emerald-100 whitespace-pre-wrap leading-relaxed shadow-2xs font-normal">
                  {viewingRequest.social_worker_comment}
                </div>
                <div className="flex justify-between items-center text-xs text-slate-600 pt-1 border-t border-emerald-100">
                  <span>ผู้ตอบ: <strong className="text-slate-800">{viewingRequest.social_worker_by_name || viewingRequest.social_worker_by}</strong></span>
                  <span>{formatDateTime(viewingRequest.social_worker_at)}</span>
                </div>
              </div>

              <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2 gap-2">
                {isAdmin ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleAdminCancel(viewingRequest)}
                    className="rounded-xl gap-1.5 bg-rose-600 hover:bg-rose-700"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>ยกเลิกรายการนี้ (Admin)</span>
                  </Button>
                ) : <div />}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="rounded-xl"
                >
                  ปิด
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
