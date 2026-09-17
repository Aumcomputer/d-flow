import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  User, CheckCircle2, Pill, Search, Plus, Minus, Check, 
  AlertCircle, X, ClipboardCheck, Trash2, RotateCcw, AlertTriangle, Building2
} from 'lucide-react'
import api from '../services/api'
import socket from '../services/socket'
import { useSound } from '../contexts/SoundContext'

export default function PharmacyPage() {
  const [patients, setPatients] = useState([])
  const [historyPatients, setHistoryPatients] = useState([])
  const [returnMedPatients, setReturnMedPatients] = useState([])
  const [activeTab, setActiveTab] = useState('prepare') // 'prepare' | 'dispense' | 'return_audit' | 'history' | 'return_history'
  const [loading, setLoading] = useState(false)
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0])
  const [returnHistoryDate, setReturnHistoryDate] = useState(new Date().toISOString().split('T')[0])
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()
  const { playAlert } = useSound()

  // Audit Modal States
  const [selectedAuditPatient, setSelectedAuditPatient] = useState(null)
  const [auditDrugs, setAuditDrugs] = useState([])
  const [loadingAuditDrugs, setLoadingAuditDrugs] = useState(false)
  const [savingAudit, setSavingAudit] = useState(false)

  // Drug Search State for adding new drugs
  const [drugSearchQuery, setDrugSearchQuery] = useState('')
  const [drugSearchResults, setDrugSearchResults] = useState([])
  const [searchingDrugs, setSearchingDrugs] = useState(false)
  const [selectedNewDrug, setSelectedNewDrug] = useState(null)
  const [newDrugQty, setNewDrugQty] = useState(1)
  const [newDrugRemark, setNewDrugRemark] = useState('')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)

  const filterPatients = (list) => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return list
    return list.filter(p => 
      (p.hn && p.hn.toLowerCase().includes(term)) || 
      (p.an && p.an.toLowerCase().includes(term)) ||
      (p.fname && p.fname.toLowerCase().includes(term)) ||
      (p.lname && p.lname.toLowerCase().includes(term))
    )
  }

  // ผู้ป่วยรอเช็คยา (หอผู้ป่วยส่งมา)
  const displayedPrepare = filterPatients(patients).filter(
    p => p.workflow_status === 'pharmacy_prepare' || (p.workflow_status === 'pharmacy' && !p.dc_done_date && !p.pharmacy_pack_date)
  )

  // ผู้ป่วยรอจ่ายยา (ผ่านศูนย์จำหน่ายแล้ว)
  const displayedDispense = filterPatients(patients).filter(
    p => p.workflow_status === 'pharmacy' && (p.dc_done_date || p.pharmacy_pack_date)
  )

  const displayedHistory = filterPatients(historyPatients)

  // Tab 2: ตรวจสอบยาคืน (แสดงเฉพาะคนที่มียาคืน และ "ยังไม่ได้ตรวจสอบ")
  const displayedReturnMeds = filterPatients(returnMedPatients).filter(
    p => Number(p.return_drug_count || 0) > 0 && !p.phar_chk_returnmed
  )

  // Tab 4: ประวัติยาคืน (แสดงเฉพาะคนที่มียาคืน และ "ตรวจสอบแล้ว")
  const displayedReturnHistory = filterPatients(returnMedPatients).filter(p => {
    if (Number(p.return_drug_count || 0) <= 0 || !p.phar_chk_returnmed) return false
    if (!returnHistoryDate) return true
    const dateStr = p.phar_chk_returnmed_date || p.updated_at
    if (!dateStr) return false
    const d = new Date(dateStr)
    const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return localDateStr === returnHistoryDate
  })

  const pendingAuditCount = displayedReturnMeds.length

  const fetchPatients = async () => {
    setLoading(true)
    try {
      const [pendingRes, historyRes, returnMedRes] = await Promise.all([
        api.get('/workflow/pharmacy'),
        api.get(`/workflow/pharmacy/history?date=${historyDate}`),
        api.get('/workflow/pharmacy/return-meds')
      ])
      setPatients(pendingRes.data || [])
      setHistoryPatients(historyRes.data || [])
      setReturnMedPatients(returnMedRes.data || [])
    } catch (err) {
      console.error('Fetch pharmacy patients error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getWaitTime = (start, end) => {
    if (!start || !end) return '-'
    const diffMs = new Date(end) - new Date(start)
    if (diffMs < 0) return '-'
    const diffMins = Math.floor(diffMs / 60000)
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    if (hours > 0) return `${hours} ชม. ${mins} นาที`
    return `${mins} นาที`
  }

  useEffect(() => {
    fetchPatients()
  }, [historyDate])

  useEffect(() => {
    const onUpdate = (data) => {
      fetchPatients()
      if (data && (data.status === 'pharmacy' || data.status === 'pharmacy_prepare' || data.status === 'discharge_center')) {
        playAlert()
      }
    }
    socket.on('workflow:updated', onUpdate)

    return () => {
      socket.off('workflow:updated', onUpdate)
    }
  }, [historyDate, playAlert])

  const handlePackDone = async (an) => {
    if (!confirm('ยืนยันเช็คยาเสร็จแล้วสำหรับ AN นี้? (ส่งต่อไปยังศูนย์จำหน่าย)')) return
    try {
      await api.post(`/workflow/${an}/pharmacy-pack-done`)
      setPatients(prev => prev.filter(p => p.an !== an))
      fetchPatients()
    } catch (err) {
      alert('ไม่สามารถทำรายการได้')
    }
  }

  const handleDone = async (an) => {
    if (!confirm('ยืนยันจ่ายยาแล้วสำหรับ AN นี้?')) return
    try {
      await api.post(`/workflow/${an}/pharmacy-done`)
      setPatients(prev => prev.filter(p => p.an !== an))
      fetchPatients()
    } catch (err) {
      alert('ไม่สามารถทำรายการได้')
    }
  }

  // Open Audit Modal
  const openAuditModal = async (patient) => {
    setSelectedAuditPatient(patient)
    setLoadingAuditDrugs(true)
    setSelectedNewDrug(null)
    setDrugSearchQuery('')
    setDrugSearchResults([])
    setNewDrugQty(1)
    setNewDrugRemark('')
    try {
      const res = await api.get(`/workflow/pharmacy/return-meds/${patient.an}`)
      const items = (res.data || []).map(d => ({
        ...d,
        is_correct: d.is_correct !== undefined && d.is_correct !== null ? d.is_correct : 1,
        actual_qty: d.actual_qty !== null && d.actual_qty !== undefined ? d.actual_qty : d.qty,
        remark: d.remark || ''
      }))
      setAuditDrugs(items)
    } catch (err) {
      console.error('Fetch patient return drugs error:', err)
      alert('ไม่สามารถดึงรายการยาคืนได้')
    } finally {
      setLoadingAuditDrugs(false)
    }
  }

  // Drug Search Debounce
  useEffect(() => {
    const q = drugSearchQuery.trim()
    if (!q || q.length < 2) {
      setDrugSearchResults([])
      setShowSearchDropdown(false)
      return
    }
    const timer = setTimeout(async () => {
      setSearchingDrugs(true)
      try {
        const res = await api.get(`/workflow/drugs/search?q=${encodeURIComponent(q)}`)
        setDrugSearchResults(res.data || [])
        setShowSearchDropdown(true)
      } catch (err) {
        console.error('Search drugs error:', err)
      } finally {
        setSearchingDrugs(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [drugSearchQuery])

  // Select Drug from Search
  const handleSelectDrug = (drug) => {
    setSelectedNewDrug(drug)
    setDrugSearchQuery(drug.drug_name || drug.name)
    setShowSearchDropdown(false)
  }

  // Add Drug to Audit List
  const handleAddDrugToList = () => {
    if (!selectedNewDrug) return
    const qty = Math.max(1, parseInt(newDrugQty, 10) || 1)

    if (auditDrugs.some(d => d.icode === selectedNewDrug.icode)) {
      alert('ยานี้มีอยู่ในรายการแล้ว')
      return
    }

    const newItem = {
      icode: selectedNewDrug.icode,
      drug_name: selectedNewDrug.drug_name || selectedNewDrug.name,
      name: selectedNewDrug.name,
      strength: selectedNewDrug.strength,
      units: selectedNewDrug.units,
      qty: qty,
      is_correct: 1,
      actual_qty: qty,
      remark: newDrugRemark.trim() || '',
      is_manually_added: true
    }

    setAuditDrugs(prev => [...prev, newItem])
    setSelectedNewDrug(null)
    setDrugSearchQuery('')
    setDrugSearchResults([])
    setNewDrugQty(1)
    setNewDrugRemark('')
  }

  // Remove Drug from List
  const handleRemoveDrug = (index) => {
    setAuditDrugs(prev => prev.filter((_, i) => i !== index))
  }

  // Save Audit Results
  const handleSaveAudit = async () => {
    if (!selectedAuditPatient) return
    setSavingAudit(true)
    try {
      const itemsToSave = auditDrugs.map(d => ({
        icode: d.icode,
        qty: d.qty,
        is_correct: d.is_correct === 0 ? 0 : 1,
        actual_qty: d.is_correct === 0 ? (parseInt(d.actual_qty, 10) || 0) : null,
        remark: d.remark || null
      }))

      await api.post(`/workflow/pharmacy/return-meds/${selectedAuditPatient.an}`, {
        items: itemsToSave
      })

      // Immediately mark as audited in local state so row disappears from Tab 2 and moves to Tab 4
      setReturnMedPatients(prev => prev.map(p => 
        p.an === selectedAuditPatient.an 
          ? { 
              ...p, 
              phar_chk_returnmed: 'checked', 
              phar_chk_returnmed_date: new Date().toISOString() 
            } 
          : p
      ))

      alert('บันทึกผลการตรวจสอบยาคืนเรียบร้อยแล้ว')
      setSelectedAuditPatient(null)
      fetchPatients()
    } catch (err) {
      alert('ไม่สามารถบันทึกผลการตรวจสอบได้')
    } finally {
      setSavingAudit(false)
    }
  }

  return (
    <div className="w-full px-4 py-6 space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 p-2.5 rounded-2xl border border-emerald-100 shadow-xs">
            <Pill className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-600">
              ห้องยา
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              รอเช็คยา {displayedPrepare.length} ราย | รอจ่ายยา {displayedDispense.length} ราย | รอตรวจสอบยาคืน {displayedReturnMeds.length} ราย | ประวัติยาคืน {displayedReturnHistory.length} ราย
            </p>
          </div>
        </div>
        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder="ค้นหา HN, AN หรือชื่อคนไข้"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-card"
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-between items-center border-b border-border">
        <div className="flex space-x-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('prepare')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'prepare'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <span>รอเช็คยา</span>
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
              displayedPrepare.length > 0 ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-slate-100 text-slate-600'
            }`}>
              {displayedPrepare.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('dispense')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'dispense'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <span>รอจ่ายยา</span>
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
              displayedDispense.length > 0 ? 'bg-emerald-100 text-emerald-700 font-bold' : 'bg-slate-100 text-slate-600'
            }`}>
              {displayedDispense.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('return_audit')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'return_audit'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <span>ตรวจสอบยาคืน</span>
            {displayedReturnMeds.length > 0 ? (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-white animate-pulse">
                {displayedReturnMeds.length}
              </span>
            ) : (
              <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 font-medium">
                0
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            ประวัติวันนี้ ({historyPatients.length})
          </button>
          <button
            onClick={() => setActiveTab('return_history')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'return_history'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ประวัติยาคืน ({displayedReturnHistory.length})</span>
          </button>
        </div>
        
        {activeTab === 'history' && (
          <div className="px-2">
            <input 
              type="date" 
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        )}

        {activeTab === 'return_history' && (
          <div className="flex items-center gap-2 px-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">วันที่ตรวจ:</span>
            <input 
              type="date" 
              value={returnHistoryDate}
              onChange={(e) => setReturnHistoryDate(e.target.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            {returnHistoryDate ? (
              <button
                type="button"
                onClick={() => setReturnHistoryDate('')}
                className="text-xs text-emerald-600 hover:text-emerald-700 underline whitespace-nowrap"
              >
                ดูทั้งหมด
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setReturnHistoryDate(new Date().toISOString().split('T')[0])}
                className="text-xs text-emerald-600 hover:text-emerald-700 underline whitespace-nowrap"
              >
                วันนี้
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'prepare' ? (
            /* TAB: รอเช็คยา (Waiting for Check) */
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">วันเวลาที่ส่ง</th>
                  <th className="px-4 py-3">AN</th>
                  <th className="px-4 py-3">HN</th>
                  <th className="px-4 py-3">ชื่อ-สกุล</th>
                  <th className="px-4 py-3">อายุ</th>
                  <th className="px-4 py-3">หอผู้ป่วย</th>
                  <th className="px-4 py-3">เบอร์โทรศัพท์</th>
                  <th className="px-4 py-3">สิทธิ์การรักษา</th>
                  <th className="px-4 py-3">แพทย์</th>
                  <th className="px-4 py-3 text-center rounded-tr-lg">เช็คยา</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-muted-foreground">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : displayedPrepare.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-muted-foreground">
                      {searchTerm ? 'ไม่พบผู้ป่วยที่ค้นหา (กรุณาพิมพ์ให้ครบ)' : 'ไม่มีผู้ป่วยรอเช็คยา'}
                    </td>
                  </tr>
                ) : (
                  displayedPrepare.map((p) => (
                    <tr 
                      key={p.an} 
                      onClick={() => navigate(`/dcdetail/${p.an}`)}
                      className="border-t border-border hover:bg-muted/30 transition-colors group cursor-pointer"
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {(p.sent_pharmacy_date || p.discharge_date) ? new Date(p.sent_pharmacy_date || p.discharge_date).toLocaleString('th-TH', { 
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit' 
                        }) : '-'} น.
                      </td>
                      <td className="px-4 py-3 font-medium text-blue-700">{p.an}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.hn}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{p.pname}{p.fname} {p.lname}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.age_y ? p.age_y + ' ปี' : '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.ward_name || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.ward_phone || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="line-clamp-1">{p.pttype_name || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.doctor_name || '-'}</td>
                      <td className="px-4 py-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => handlePackDone(p.an)}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-medium rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 mx-auto"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>เช็คยาเสร็จแล้ว</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : activeTab === 'dispense' ? (
            /* TAB: รอจ่ายยา (Waiting for Dispensing) */
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">วันเวลาที่ส่ง</th>
                  <th className="px-4 py-3">AN</th>
                  <th className="px-4 py-3">HN</th>
                  <th className="px-4 py-3">ชื่อ-สกุล</th>
                  <th className="px-4 py-3">อายุ</th>
                  <th className="px-4 py-3">หอผู้ป่วย</th>
                  <th className="px-4 py-3">เบอร์โทรศัพท์</th>
                  <th className="px-4 py-3">สิทธิ์การรักษา</th>
                  <th className="px-4 py-3">แพทย์</th>
                  <th className="px-4 py-3 text-center rounded-tr-lg">จ่ายยา</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-muted-foreground">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : displayedDispense.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-muted-foreground">
                      {searchTerm ? 'ไม่พบผู้ป่วยที่ค้นหา (กรุณาพิมพ์ให้ครบ)' : 'ไม่มีผู้ป่วยรอจ่ายยา'}
                    </td>
                  </tr>
                ) : (
                  displayedDispense.map((p) => (
                    <tr 
                      key={p.an} 
                      onClick={() => navigate(`/dcdetail/${p.an}`)}
                      className="border-t border-border hover:bg-muted/30 transition-colors group cursor-pointer"
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {(p.sent_pharmacy_date || p.dc_done_date || p.finance_done_date || p.discharge_date) ? new Date(p.sent_pharmacy_date || p.dc_done_date || p.finance_done_date || p.discharge_date).toLocaleString('th-TH', { 
                          year: 'numeric', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit' 
                        }) : '-'} น.
                      </td>
                      <td className="px-4 py-3 font-medium text-emerald-700">{p.an}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.hn}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{p.pname}{p.fname} {p.lname}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.age_y ? p.age_y + ' ปี' : '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.ward_name || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.ward_phone || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="line-clamp-1">{p.pttype_name || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.doctor_name || '-'}</td>
                      <td className="px-4 py-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => handleDone(p.an)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-medium rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 mx-auto"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>จ่ายยาแล้ว</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : activeTab === 'return_audit' ? (
            /* TAB 2: ตรวจสอบยาคืน (Return Med Audit) */
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">วันเวลาที่ส่ง / แจ้งคืน</th>
                  <th className="px-4 py-3">AN</th>
                  <th className="px-4 py-3">HN</th>
                  <th className="px-4 py-3">ชื่อ-สกุล</th>
                  <th className="px-4 py-3">อายุ</th>
                  <th className="px-4 py-3">หอผู้ป่วย</th>
                  <th className="px-4 py-3">เบอร์โทรศัพท์</th>
                  <th className="px-4 py-3 text-center">จำนวนยาคืน</th>
                  <th className="px-4 py-3 text-center">สถานะตรวจสอบ</th>
                  <th className="px-4 py-3 text-center rounded-tr-lg">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-muted-foreground">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : displayedReturnMeds.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-muted-foreground">
                      {searchTerm ? 'ไม่พบผู้ป่วยที่ค้นหา' : 'ไม่มีรายการยาคืนที่รอตรวจสอบ'}
                    </td>
                  </tr>
                ) : (
                  displayedReturnMeds.map((p) => {
                    return (
                      <tr 
                        key={p.an} 
                        onClick={() => openAuditModal(p)}
                        className="border-t border-border hover:bg-muted/30 transition-colors group cursor-pointer"
                      >
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {(p.sent_dc_date || p.sent_pharmacy_date || p.discharge_date || p.return_drug_created_at || p.created_at) ? (
                            new Date(p.sent_dc_date || p.sent_pharmacy_date || p.discharge_date || p.return_drug_created_at || p.created_at).toLocaleString('th-TH', { 
                              year: 'numeric', month: '2-digit', day: '2-digit',
                              hour: '2-digit', minute: '2-digit' 
                            }) + ' น.'
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 font-medium text-emerald-700">{p.an}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.hn}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{p.pname}{p.fname} {p.lname}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.age_y ? p.age_y + ' ปี' : '-'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.ward_name || '-'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.ward_phone || '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            {p.return_drug_count || 0} รายการ
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 animate-pulse">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>รอตรวจสอบ</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => openAuditModal(p)}
                            className="px-3 py-1.5 text-xs font-medium rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 mx-auto bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <ClipboardCheck className="w-4 h-4" />
                            <span>ตรวจสอบยาคืน</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          ) : activeTab === 'history' ? (
            /* TAB 3: ประวัติวันนี้ (History) */
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">เวลาที่ส่ง</th>
                  <th className="px-4 py-3">เวลาเสร็จ</th>
                  <th className="px-4 py-3">ระยะเวลารอคอย</th>
                  <th className="px-4 py-3">AN</th>
                  <th className="px-4 py-3">HN</th>
                  <th className="px-4 py-3">ชื่อ-สกุล</th>
                  <th className="px-4 py-3">อายุ</th>
                  <th className="px-4 py-3">หอผู้ป่วย</th>
                  <th className="px-4 py-3">เบอร์โทรศัพท์</th>
                  <th className="px-4 py-3 text-center">จ่ายยา</th>
                  <th className="px-4 py-3">สถานะปัจจุบัน</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="11" className="px-4 py-8 text-center text-muted-foreground">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : displayedHistory.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="px-4 py-8 text-center text-muted-foreground">
                      {searchTerm ? 'ไม่พบผู้ป่วยที่ค้นหา (กรุณาพิมพ์ให้ครบ)' : 'ไม่มีประวัติผู้ป่วย'}
                    </td>
                  </tr>
                ) : (
                  displayedHistory.map((p) => (
                    <tr 
                      key={p.an} 
                      onClick={() => navigate(`/dcdetail/${p.an}`)}
                      className="border-t border-border hover:bg-muted/30 transition-colors group cursor-pointer"
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {(p.sent_pharmacy_date || p.sent_dc_date || p.discharge_date) ? new Date(p.sent_pharmacy_date || p.sent_dc_date || p.discharge_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'} น.
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {p.pharmacy_done_date ? new Date(p.pharmacy_done_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-'} น.
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {getWaitTime(p.sent_pharmacy_date || p.sent_dc_date || p.discharge_date, p.pharmacy_done_date)}
                      </td>
                      <td className="px-4 py-3 font-medium text-emerald-700">{p.an}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.hn}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{p.pname}{p.fname} {p.lname}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.age_y ? p.age_y + ' ปี' : '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.ward_name || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.ward_phone || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>จ่ายยาแล้ว</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          p.workflow_status === 'pharmacy' ? 'bg-blue-100 text-blue-700' :
                          p.workflow_status === 'discharge_center' ? 'bg-purple-100 text-purple-700' :
                          p.workflow_status === 'finance' ? 'bg-amber-100 text-amber-700' :
                          p.workflow_status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {p.workflow_status === 'pharmacy' ? 'ห้องยา' :
                           p.workflow_status === 'discharge_center' ? 'ศูนย์จำหน่าย' :
                           p.workflow_status === 'finance' ? 'การเงิน' :
                           p.workflow_status === 'completed' ? 'เสร็จสิ้น' :
                           'รอดำเนินการ'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            /* TAB 4: ประวัติยาคืน (Return Med History) */
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">วันเวลาที่ตรวจ</th>
                  <th className="px-4 py-3">AN</th>
                  <th className="px-4 py-3">HN</th>
                  <th className="px-4 py-3">ชื่อ-สกุล</th>
                  <th className="px-4 py-3">อายุ</th>
                  <th className="px-4 py-3">หอผู้ป่วย</th>
                  <th className="px-4 py-3">เบอร์โทรศัพท์</th>
                  <th className="px-4 py-3 text-center">จำนวนยาคืน</th>
                  <th className="px-4 py-3">ผู้ตรวจสอบ</th>
                  <th className="px-4 py-3 text-center rounded-tr-lg">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-muted-foreground">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : displayedReturnHistory.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-4 py-8 text-center text-muted-foreground">
                      {searchTerm ? 'ไม่พบผู้ป่วยที่ค้นหา' : (returnHistoryDate ? `ไม่มีประวัติการตรวจสอบยาคืนวันที่ ${new Date(returnHistoryDate).toLocaleDateString('th-TH')}` : 'ไม่มีประวัติการตรวจสอบยาคืน')}
                    </td>
                  </tr>
                ) : (
                  displayedReturnHistory.map((p) => (
                    <tr 
                      key={p.an} 
                      onClick={() => openAuditModal(p)}
                      className="border-t border-border hover:bg-muted/30 transition-colors group cursor-pointer"
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {p.phar_chk_returnmed_date ? (
                          new Date(p.phar_chk_returnmed_date).toLocaleString('th-TH', { 
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit' 
                          }) + ' น.'
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 font-medium text-emerald-700">{p.an}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.hn}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{p.pname}{p.fname} {p.lname}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.age_y ? p.age_y + ' ปี' : '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.ward_name || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.ward_phone || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {p.return_drug_count || 0} รายการ
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{p.phar_chk_returnmed_name || p.phar_chk_returnmed || '-'}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => openAuditModal(p)}
                          className="px-3 py-1.5 text-xs font-medium rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 mx-auto bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                        >
                          <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                          <span>ดูผลการตรวจ</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Return Drug Audit Modal */}
      {selectedAuditPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-6xl xl:max-w-7xl h-[94vh] max-h-[96vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 rounded-xl shrink-0">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate">
                    <span>ตรวจสอบรายการยาคืน</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      AN: {selectedAuditPatient.an}
                    </span>
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span>ผู้ป่วย: <b className="text-slate-800 dark:text-white">{selectedAuditPatient.pname}{selectedAuditPatient.fname} {selectedAuditPatient.lname}</b></span>
                    <span>HN: <b>{selectedAuditPatient.hn}</b></span>
                    <span>หอผู้ป่วย: <b>{selectedAuditPatient.ward_name || '-'}</b></span>
                    {selectedAuditPatient.age_y && <span>อายุ: <b>{selectedAuditPatient.age_y} ปี</b></span>}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuditPatient(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {loadingAuditDrugs ? (
                <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <span>กำลังโหลดรายการยาคืน...</span>
                </div>
              ) : (
                <>
                  {/* Table of Return Drugs */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Pill className="w-4 h-4 text-emerald-600" />
                        <span>รายการยาคืน ({auditDrugs.length} รายการ)</span>
                      </h3>
                      {selectedAuditPatient.phar_chk_returnmed && (
                        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg font-medium">
                          ตรวจแล้วโดย: <b>{selectedAuditPatient.phar_chk_returnmed_name || selectedAuditPatient.phar_chk_returnmed}</b> ({selectedAuditPatient.phar_chk_returnmed_date ? new Date(selectedAuditPatient.phar_chk_returnmed_date).toLocaleString('th-TH') : ''})
                        </div>
                      )}
                    </div>

                    {auditDrugs.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        ยังไม่มีรายการยาคืนที่บันทึกไว้สำหรับผู้ป่วยรายนี้ (สามารถค้นหาและเพิ่มรายการยาด้านล่างได้)
                      </div>
                    ) : (
                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                            <tr>
                              <th className="px-3 py-2.5 w-10 text-center">#</th>
                              <th className="px-3 py-2.5">ชื่อยา</th>
                              <th className="px-3 py-2.5 w-28 text-center">จำนวนแจ้งคืน</th>
                              <th className="px-3 py-2.5 w-48 text-center">การตรวจสอบ</th>
                              <th className="px-3 py-2.5 w-28 text-center">จำนวนที่ถูก</th>
                              <th className="px-3 py-2.5">หมายเหตุ</th>
                              <th className="px-2 py-2.5 w-10 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {auditDrugs.map((drug, index) => {
                              const isCorrect = drug.is_correct !== 0
                              return (
                                <tr 
                                  key={drug.icode || index}
                                  className={`transition-colors ${!isCorrect ? 'bg-amber-50/50 dark:bg-amber-950/20' : 'hover:bg-slate-50/50'}`}
                                >
                                  <td className="px-3 py-2.5 text-center text-slate-400 font-medium">{index + 1}</td>
                                  <td className="px-3 py-2.5 text-slate-900 dark:text-white">
                                    <div className="flex flex-col">
                                      {/* Drug Name kept large as requested */}
                                      <span className="text-base font-bold text-slate-900 dark:text-white">{drug.drug_name || drug.name}</span>
                                      <span className="text-xs text-slate-500 font-normal">รหัสยา: {drug.icode} {drug.units ? `(${drug.units})` : ''}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{drug.qty}</span>{' '}
                                    <span className="text-xs text-slate-500">{drug.units || ''}</span>
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...auditDrugs]
                                          updated[index].is_correct = 1
                                          updated[index].actual_qty = updated[index].qty
                                          setAuditDrugs(updated)
                                        }}
                                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                                          isCorrect
                                            ? 'bg-emerald-600 text-white shadow-2xs'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>ถูกต้อง</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...auditDrugs]
                                          updated[index].is_correct = 0
                                          setAuditDrugs(updated)
                                        }}
                                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                                          !isCorrect
                                            ? 'bg-rose-600 text-white shadow-2xs'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                        }`}
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        <span>ไม่ถูกต้อง</span>
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    {!isCorrect ? (
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={drug.actual_qty ?? ''}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value, 10)
                                          const updated = [...auditDrugs]
                                          updated[index].actual_qty = isNaN(val) ? 0 : Math.max(0, val)
                                          setAuditDrugs(updated)
                                        }}
                                        placeholder="จำนวนจริง"
                                        className="w-20 px-2 py-1 text-center text-xs font-bold text-rose-600 border border-rose-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 bg-white dark:bg-slate-800"
                                      />
                                    ) : (
                                      <span className="text-slate-400 text-xs">-</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <input
                                      type="text"
                                      value={drug.remark || ''}
                                      onChange={(e) => {
                                        const updated = [...auditDrugs]
                                        updated[index].remark = e.target.value
                                        setAuditDrugs(updated)
                                      }}
                                      placeholder="ระบุหมายเหตุ (ถ้ามี)..."
                                      className="w-full px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                                    />
                                  </td>
                                  <td className="px-2 py-2.5 text-center">
                                    {drug.is_manually_added && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveDrug(index)}
                                        className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors"
                                        title="ลบรายการที่เพิ่มเอง"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Add New Drug Section */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                      <Plus className="w-4 h-4 text-emerald-600" />
                      <span>เพิ่มรายการยาคืน (ค้นหาจากฐานข้อมูลยา HIS)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start relative">
                      {/* Drug Search Input */}
                      <div className="sm:col-span-6 relative">
                        <label className="block text-2xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">
                          ค้นหาชื่อยา หรือ icode
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={drugSearchQuery}
                            onChange={(e) => {
                              setDrugSearchQuery(e.target.value)
                              setSelectedNewDrug(null)
                            }}
                            onFocus={() => {
                              if (drugSearchResults.length > 0) setShowSearchDropdown(true)
                            }}
                            placeholder="พิมพ์ชื่อยาเพื่อค้นหา (อย่างน้อย 2 ตัวอักษร)..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                          {searchingDrugs && (
                            <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin absolute right-2.5 top-2" />
                          )}
                        </div>

                        {/* Search Results Dropdown */}
                        {showSearchDropdown && drugSearchResults.length > 0 && (
                          <div className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg divide-y divide-slate-100 dark:divide-slate-700/50">
                            {drugSearchResults.map((drug) => (
                              <button
                                key={drug.icode}
                                type="button"
                                onClick={() => handleSelectDrug(drug)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors flex items-center justify-between gap-2"
                              >
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{drug.drug_name || drug.name}</span>
                                  <span className="text-2xs text-slate-500">รหัส: {drug.icode} {drug.dosageform ? `(${drug.dosageform})` : ''}</span>
                                </div>
                                {drug.units && (
                                  <span className="text-2xs text-slate-600 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded shrink-0 font-medium">
                                    {drug.units}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Quantity Input */}
                      <div className="sm:col-span-2">
                        <label className="block text-2xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">
                          จำนวน
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={newDrugQty}
                          onChange={(e) => setNewDrugQty(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs text-center font-bold border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-slate-800"
                        />
                      </div>

                      {/* Remark Input */}
                      <div className="sm:col-span-3">
                        <label className="block text-2xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">
                          หมายเหตุ
                        </label>
                        <input
                          type="text"
                          value={newDrugRemark}
                          onChange={(e) => setNewDrugRemark(e.target.value)}
                          placeholder="ระบุหมายเหตุ (ถ้ามี)..."
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-slate-800"
                        />
                      </div>

                      {/* Add Button */}
                      <div className="sm:col-span-1 pt-4.5">
                        <button
                          type="button"
                          disabled={!selectedNewDrug}
                          onClick={handleAddDrugToList}
                          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1 active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>เพิ่ม</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedAuditPatient(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                ปิดหน้าต่าง
              </button>

              <button
                type="button"
                disabled={savingAudit || loadingAuditDrugs}
                onClick={handleSaveAudit}
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 active:scale-95"
              >
                {savingAudit ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>บันทึกผลการตรวจสอบ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
