import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import {
  Shield,
  ShieldCheck,
  Users,
  UserPlus,
  Trash2,
  Search,
  Plus,
  Check,
  X,
  Lock,
  Save,
  FileText,
  Building2,
  Pill,
  ClipboardList,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Sliders,
  ChevronRight,
  Info,
  RotateCcw,
  Code,
  Tag,
  CheckSquare,
  HeartHandshake,
  Radiation,
  KeyRound,
  Activity
} from 'lucide-react'
import SlowQueryTab from '../components/SlowQueryTab'

const MODULE_META = {
  documents: {
    name: 'เวชระเบียน',
    desc: 'จัดการเอกสารผู้ป่วยในและใบสรุปชาร์จ',
    icon: FileText,
    color: 'from-blue-500 to-indigo-500',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200'
  },
  pttype: {
    name: 'งานสิทธิ์',
    desc: 'ตรวจสอบและยืนยันข้อมูลสิทธิการรักษา (UC/เบิกตรง/ประกันสังคม)',
    icon: ShieldCheck,
    color: 'from-sky-400 to-cyan-500',
    bg: 'bg-sky-50',
    text: 'text-sky-600',
    border: 'border-sky-200'
  },
  ward: {
    name: 'หอผู้ป่วย',
    desc: 'ติดตามสถานะผู้ป่วยในหอผู้ป่วยและส่งต่อ Discharge',
    icon: Building2,
    color: 'from-teal-400 to-emerald-500',
    bg: 'bg-teal-50',
    text: 'text-teal-600',
    border: 'border-teal-200'
  },
  pharmacy: {
    name: 'ห้องยา',
    desc: 'จัดยา รับใบสั่งยา ตรวจสอบยาคืน และส่งต่อการเงิน',
    icon: Pill,
    color: 'from-green-400 to-emerald-600',
    bg: 'bg-green-50',
    text: 'text-green-600',
    border: 'border-green-200'
  },
  discharge: {
    name: 'ศูนย์จำหน่าย',
    desc: 'จัดการกระบวนการจำหน่ายผู้ป่วย และส่งต่อเอกสาร/การเงิน',
    icon: ClipboardList,
    color: 'from-amber-400 to-orange-500',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    border: 'border-amber-200'
  },
  finance: {
    name: 'การเงิน',
    desc: 'คิดค่ารักษาพยาบาล รับชำระเงิน และปิดยอดค่าใช้จ่าย',
    icon: Wallet,
    color: 'from-purple-500 to-fuchsia-500',
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    border: 'border-purple-200'
  },
  social_work: {
    name: 'สังคมสงเคราะห์',
    desc: 'งานสังคมสงเคราะห์และให้คำปรึกษาผู้ป่วยและญาติ',
    icon: HeartHandshake,
    color: 'from-rose-500 to-pink-500',
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    border: 'border-rose-200'
  }
}

const DEFAULT_DRUG_FILTER_FALLBACK = {
  RETURN_MED_DOSAGEFORMS: 'INJECTIONS,INJECTION',
  RETURN_MED_EXCLUDE_CATEGORIES: 'FLUIDS AND ELECTROLYTES,INTRAVENOUS SOLOTION,INTRAVENOUS SOLUTION,INTRAVENOUS ANAESTHETICS,LOCAL ANAESTHETICS',
  RETURN_MED_EXCLUDE_CATEGORIES_LIKE: 'ANAESTHETICS',
  RETURN_MED_INCLUDE_CATEGORIES_LIKE: 'ANXIOLYTICS,OPIOID,SEDATIVES',
  RETURN_MED_INCLUDE_ICODES: '1500513,1460536,1590016,1490407,1490100,1000244,1000245,1490114,1650084',
  RETURN_MED_EXCLUDE_NAME_LIKE: 'วิสัญญี'
}

export default function SettingsPage() {
  const { user, refreshUser } = useAuth()
  const [activeTab, setActiveTab] = useState('admins') // 'admins' | 'roles' | 'drugs'

  // Admin Setting State
  const [admins, setAdmins] = useState([])
  const [loadingAdmins, setLoadingAdmins] = useState(false)
  const [adminSearchQuery, setAdminSearchQuery] = useState('')
  const [userSearchResults, setUserSearchResults] = useState([])
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [deletingAdmin, setDeletingAdmin] = useState(null)
  const [adminMessage, setAdminMessage] = useState(null)

  // Role Setting State
  const [roles, setRoles] = useState({})
  const [initialRoles, setInitialRoles] = useState({})
  const [availableGroups, setAvailableGroups] = useState([])
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [savingModule, setSavingModule] = useState(null)
  const [isSavingAllRoles, setIsSavingAllRoles] = useState(false)
  const [roleMessage, setRoleMessage] = useState(null)
  const [groupFilterPerModule, setGroupFilterPerModule] = useState({})

  // Drug Setting State
  const [drugSettings, setDrugSettings] = useState(DEFAULT_DRUG_FILTER_FALLBACK)
  const [initialDrugSettings, setInitialDrugSettings] = useState(DEFAULT_DRUG_FILTER_FALLBACK)
  const [defaultDrugSettings, setDefaultDrugSettings] = useState(DEFAULT_DRUG_FILTER_FALLBACK)
  const [resolvedDrugs, setResolvedDrugs] = useState([])
  const [loadingDrugs, setLoadingDrugs] = useState(false)
  const [savingDrugs, setSavingDrugs] = useState(false)
  const [drugMessage, setDrugMessage] = useState(null)
  const [drugSearchQuery, setDrugSearchQuery] = useState('')
  const [drugSearchResults, setDrugSearchResults] = useState([])
  const [isSearchingDrugs, setIsSearchingDrugs] = useState(false)
  const [rawViewMode, setRawViewMode] = useState(false)
  const [tagInputs, setTagInputs] = useState({})

  // X-ray Setting State
  const [xraySettings, setXraySettings] = useState({ XRAY_EXCLUDE_GROUPS: '7', XRAY_EXCLUDE_ICODES: '3011687' })
  const [initialXraySettings, setInitialXraySettings] = useState({ XRAY_EXCLUDE_GROUPS: '7', XRAY_EXCLUDE_ICODES: '3011687' })
  const [defaultXraySettings, setDefaultXraySettings] = useState({ XRAY_EXCLUDE_GROUPS: '7', XRAY_EXCLUDE_ICODES: '3011687' })
  const [allXrayGroups, setAllXrayGroups] = useState([])
  const [resolvedXrayIcodes, setResolvedXrayIcodes] = useState([])
  const [loadingXray, setLoadingXray] = useState(false)
  const [savingXray, setSavingXray] = useState(false)
  const [xrayMessage, setXrayMessage] = useState(null)
  const [xrayTagInputs, setXrayTagInputs] = useState({ XRAY_EXCLUDE_GROUPS: '', XRAY_EXCLUDE_ICODES: '' })
  const [selectedGroupToAdd, setSelectedGroupToAdd] = useState('')
  const [xraySearchQuery, setXraySearchQuery] = useState('')
  const [xraySearchResults, setXraySearchResults] = useState([])
  const [isSearchingXray, setIsSearchingXray] = useState(false)

  // No Authen Code Setting State
  const [noAuthenPttypes, setNoAuthenPttypes] = useState([])
  const [loadingNoAuthen, setLoadingNoAuthen] = useState(false)
  const [savingNoAuthen, setSavingNoAuthen] = useState(false)
  const [noAuthenMessage, setNoAuthenMessage] = useState(null)
  const [noAuthenSearchQuery, setNoAuthenSearchQuery] = useState('')
  const [noAuthenSearchResults, setNoAuthenSearchResults] = useState([])
  const [isSearchingNoAuthen, setIsSearchingNoAuthen] = useState(false)
  const [manualNoAuthenPttype, setManualNoAuthenPttype] = useState('')
  const [manualNoAuthenName, setManualNoAuthenName] = useState('')

  // Fetch Admins
  const fetchAdmins = async () => {
    setLoadingAdmins(true)
    try {
      const res = await api.get('/settings/admins')
      setAdmins(res.data.admins || [])
    } catch (err) {
      console.error('Failed to fetch admins:', err)
      setAdminMessage({ type: 'error', text: err.response?.data?.error || 'เกิดข้อผิดพลาดในการโหลดข้อมูล Admin' })
    } finally {
      setLoadingAdmins(false)
    }
  }

  // Fetch Roles and Groups
  const fetchRolesData = async () => {
    setLoadingRoles(true)
    try {
      const [rolesRes, groupsRes] = await Promise.all([
        api.get('/settings/roles'),
        api.get('/settings/groups')
      ])
      const fetchedRoles = rolesRes.data.permissions || {}
      setRoles(fetchedRoles)
      setInitialRoles(JSON.parse(JSON.stringify(fetchedRoles)))
      setAvailableGroups(groupsRes.data.groups || [])
    } catch (err) {
      console.error('Failed to fetch roles:', err)
      setRoleMessage({ type: 'error', text: err.response?.data?.error || 'เกิดข้อผิดพลาดในการโหลดข้อมูล Role' })
    } finally {
      setLoadingRoles(false)
    }
  }

  // Fetch Drug Settings
  const fetchDrugSettings = async () => {
    setLoadingDrugs(true)
    try {
      const res = await api.get('/settings/drugs')
      if (res.data?.settings) {
        setDrugSettings(res.data.settings)
        setInitialDrugSettings(JSON.parse(JSON.stringify(res.data.settings)))
      }
      if (res.data?.defaults) {
        const flatDefaults = {}
        for (const [k, v] of Object.entries(res.data.defaults)) {
          flatDefaults[k] = v.value
        }
        setDefaultDrugSettings(flatDefaults)
      }
      if (res.data?.resolvedDrugs) {
        setResolvedDrugs(res.data.resolvedDrugs)
      }
    } catch (err) {
      console.error('Failed to fetch drug settings:', err)
      setDrugMessage({ type: 'error', text: err.response?.data?.error || 'เกิดข้อผิดพลาดในการโหลดการตั้งค่ายา' })
    } finally {
      setLoadingDrugs(false)
    }
  }

  // Fetch Xray Settings
  const fetchXraySettings = async () => {
    setLoadingXray(true)
    try {
      const res = await api.get('/settings/xray')
      if (res.data?.settings) {
        setXraySettings(res.data.settings)
        setInitialXraySettings(JSON.parse(JSON.stringify(res.data.settings)))
      }
      if (res.data?.defaults) {
        setDefaultXraySettings(res.data.defaults)
      }
      if (res.data?.allGroups) {
        setAllXrayGroups(res.data.allGroups)
      }
      if (res.data?.resolvedIcodes) {
        setResolvedXrayIcodes(res.data.resolvedIcodes)
      }
    } catch (err) {
      console.error('Failed to fetch xray settings:', err)
      setXrayMessage({ type: 'error', text: err.response?.data?.error || 'เกิดข้อผิดพลาดในการโหลดการตั้งค่า X-ray' })
    } finally {
      setLoadingXray(false)
    }
  }

  // Fetch No Authen Settings
  const fetchNoAuthenSettings = async () => {
    setLoadingNoAuthen(true)
    try {
      const res = await api.get('/settings/no-authen-pttypes')
      setNoAuthenPttypes(res.data.pttypes || [])
    } catch (err) {
      console.error('Failed to fetch no-authen pttypes:', err)
      setNoAuthenMessage({ type: 'error', text: err.response?.data?.error || 'เกิดข้อผิดพลาดในการโหลดรายการสิทธิยกเว้น Authen' })
    } finally {
      setLoadingNoAuthen(false)
    }
  }

  useEffect(() => {
    fetchAdmins()
    fetchRolesData()
    fetchDrugSettings()
    fetchXraySettings()
    fetchNoAuthenSettings()
  }, [])

  // Live search users in HOSxP opduser
  useEffect(() => {
    if (!adminSearchQuery.trim() || adminSearchQuery.trim().length < 2) {
      setUserSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingUsers(true)
      try {
        const res = await api.get(`/settings/users/search?q=${encodeURIComponent(adminSearchQuery.trim())}`)
        setUserSearchResults(res.data.users || [])
      } catch (err) {
        console.error('Search users error:', err)
      } finally {
        setIsSearchingUsers(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [adminSearchQuery])

  // Live search drugs from HOSxP drugitems
  useEffect(() => {
    if (!drugSearchQuery.trim() || drugSearchQuery.trim().length < 2) {
      setDrugSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingDrugs(true)
      try {
        const res = await api.get(`/settings/drugs/search?q=${encodeURIComponent(drugSearchQuery.trim())}`)
        setDrugSearchResults(res.data.drugs || [])
      } catch (err) {
        console.error('Search drugs error:', err)
      } finally {
        setIsSearchingDrugs(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [drugSearchQuery])

  // Live search X-ray items from HOSxP
  useEffect(() => {
    if (!xraySearchQuery.trim() || xraySearchQuery.trim().length < 2) {
      setXraySearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingXray(true)
      try {
        const res = await api.get(`/settings/xray/search?q=${encodeURIComponent(xraySearchQuery.trim())}`)
        setXraySearchResults(res.data.items || [])
      } catch (err) {
        console.error('Search xray error:', err)
      } finally {
        setIsSearchingXray(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [xraySearchQuery])

  // Live search pttype for No Authen Code
  useEffect(() => {
    if (!noAuthenSearchQuery.trim() || noAuthenSearchQuery.trim().length < 1) {
      setNoAuthenSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingNoAuthen(true)
      try {
        const res = await api.get(`/settings/no-authen-pttypes/search?q=${encodeURIComponent(noAuthenSearchQuery.trim())}`)
        setNoAuthenSearchResults(res.data.pttypes || [])
      } catch (err) {
        console.error('Search no-authen pttypes error:', err)
      } finally {
        setIsSearchingNoAuthen(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [noAuthenSearchQuery])

  // Add No Authen Pttype Handler
  const handleAddNoAuthenPttype = async (item) => {
    setSavingNoAuthen(true)
    setNoAuthenMessage(null)
    try {
      const res = await api.post('/settings/no-authen-pttypes', {
        pttype: item.pttype,
        name: item.name
      })
      setNoAuthenMessage({ type: 'success', text: res.data.message })
      setNoAuthenSearchQuery('')
      setNoAuthenSearchResults([])
      setManualNoAuthenPttype('')
      setManualNoAuthenName('')
      await fetchNoAuthenSettings()
    } catch (err) {
      console.error('Add no-authen pttype error:', err)
      setNoAuthenMessage({ type: 'error', text: err.response?.data?.error || 'ไม่สามารถเพิ่มรหัสสิทธิได้' })
    } finally {
      setSavingNoAuthen(false)
    }
  }

  // Delete No Authen Pttype Handler
  const handleDeleteNoAuthenPttype = async (id, pttype, name) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสิทธิ "${pttype} - ${name || ''}" ออกจากรายการยกเว้น Authen Code?`)) {
      return
    }

    setSavingNoAuthen(true)
    setNoAuthenMessage(null)
    try {
      const res = await api.delete(`/settings/no-authen-pttypes/${id}`)
      setNoAuthenMessage({ type: 'success', text: res.data.message })
      await fetchNoAuthenSettings()
    } catch (err) {
      console.error('Delete no-authen pttype error:', err)
      setNoAuthenMessage({ type: 'error', text: err.response?.data?.error || 'ไม่สามารถลบรายการได้' })
    } finally {
      setSavingNoAuthen(false)
    }
  }

  // Add Admin Handler
  const handleAddAdmin = async (targetUser) => {
    setAddingAdmin(true)
    setAdminMessage(null)
    try {
      const res = await api.post('/settings/admins', { loginname: targetUser.loginname })
      setAdminMessage({ type: 'success', text: res.data.message })
      setAdminSearchQuery('')
      setUserSearchResults([])
      await fetchAdmins()
      refreshUser()
    } catch (err) {
      console.error('Add admin error:', err)
      setAdminMessage({ type: 'error', text: err.response?.data?.error || 'ไม่สามารถเพิ่ม Admin ได้' })
    } finally {
      setAddingAdmin(false)
    }
  }

  // Delete Admin Handler
  const handleDeleteAdmin = async (loginname) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการถอดสิทธิ์ Admin ของผู้ใช้ "${loginname}"?`)) {
      return
    }

    setDeletingAdmin(loginname)
    setAdminMessage(null)
    try {
      const res = await api.delete(`/settings/admins/${loginname}`)
      setAdminMessage({ type: 'success', text: res.data.message })
      await fetchAdmins()
      refreshUser()
    } catch (err) {
      console.error('Delete admin error:', err)
      setAdminMessage({ type: 'error', text: err.response?.data?.error || 'ไม่สามารถลบ Admin ได้' })
    } finally {
      setDeletingAdmin(null)
    }
  }

  // Role Group Management Helpers
  const handleAddGroupToModule = (moduleKey, groupname) => {
    if (!groupname) return
    setRoles(prev => {
      const current = prev[moduleKey] || []
      if (current.includes(groupname)) return prev
      return {
        ...prev,
        [moduleKey]: [...current, groupname]
      }
    })
    setGroupFilterPerModule(prev => ({ ...prev, [moduleKey]: '' }))
  }

  const handleRemoveGroupFromModule = (moduleKey, groupname) => {
    setRoles(prev => {
      const current = prev[moduleKey] || []
      return {
        ...prev,
        [moduleKey]: current.filter(g => g !== groupname)
      }
    })
  }

  // Save Single Module Roles
  const handleSaveModuleRoles = async (moduleKey) => {
    setSavingModule(moduleKey)
    setRoleMessage(null)
    try {
      await api.post('/settings/roles', {
        module_key: moduleKey,
        groupnames: roles[moduleKey] || []
      })
      setRoleMessage({ type: 'success', text: `บันทึกสิทธิ์โมดูล "${MODULE_META[moduleKey]?.name}" เรียบร้อยแล้ว` })
      setInitialRoles(prev => ({
        ...prev,
        [moduleKey]: [...(roles[moduleKey] || [])]
      }))
      refreshUser()
    } catch (err) {
      console.error('Save module roles error:', err)
      setRoleMessage({ type: 'error', text: err.response?.data?.error || 'ไม่สามารถบันทึกสิทธิ์ได้' })
    } finally {
      setSavingModule(null)
    }
  }

  // Save All Roles Batch
  const handleSaveAllRoles = async () => {
    setIsSavingAllRoles(true)
    setRoleMessage(null)
    try {
      await api.post('/settings/roles', { permissions: roles })
      setRoleMessage({ type: 'success', text: 'บันทึกสิทธิ์ทุกโมดูลเรียบร้อยแล้ว' })
      setInitialRoles(JSON.parse(JSON.stringify(roles)))
      refreshUser()
    } catch (err) {
      console.error('Save all roles error:', err)
      setRoleMessage({ type: 'error', text: err.response?.data?.error || 'ไม่สามารถบันทึกสิทธิ์ได้' })
    } finally {
      setIsSavingAllRoles(false)
    }
  }

  // Drug Filter Helpers
  const parseCommaTags = (str) => {
    if (!str) return []
    return str.split(',').map(s => s.trim()).filter(Boolean)
  }

  const handleAddDrugTag = (fieldKey, valueToAdd) => {
    if (!valueToAdd || !valueToAdd.trim()) return
    const currentTags = parseCommaTags(drugSettings[fieldKey])
    const cleanVal = valueToAdd.trim()
    if (!currentTags.includes(cleanVal)) {
      const newTags = [...currentTags, cleanVal]
      setDrugSettings(prev => ({ ...prev, [fieldKey]: newTags.join(',') }))
    }
    setTagInputs(prev => ({ ...prev, [fieldKey]: '' }))
  }

  const handleRemoveDrugTag = (fieldKey, tagToRemove) => {
    const currentTags = parseCommaTags(drugSettings[fieldKey])
    const newTags = currentTags.filter(t => t !== tagToRemove)
    setDrugSettings(prev => ({ ...prev, [fieldKey]: newTags.join(',') }))

    // If removing from icodes, also update resolvedDrugs
    if (fieldKey === 'RETURN_MED_INCLUDE_ICODES') {
      setResolvedDrugs(prev => prev.filter(d => d.icode !== tagToRemove))
    }
  }

  const handleAddDrugItemIcode = (drug) => {
    if (!drug || !drug.icode) return
    handleAddDrugTag('RETURN_MED_INCLUDE_ICODES', drug.icode)
    if (!resolvedDrugs.some(d => d.icode === drug.icode)) {
      setResolvedDrugs(prev => [...prev, drug])
    }
    setDrugSearchQuery('')
    setDrugSearchResults([])
  }

  // Save Drug Settings
  const handleSaveDrugSettings = async () => {
    setSavingDrugs(true)
    setDrugMessage(null)
    try {
      const res = await api.post('/settings/drugs', { settings: drugSettings })
      setDrugMessage({ type: 'success', text: res.data.message || 'บันทึกการตั้งค่าตัวกรองยาคืนเรียบร้อยแล้ว' })
      setInitialDrugSettings(JSON.parse(JSON.stringify(res.data.settings)))
      if (res.data.resolvedDrugs) {
        setResolvedDrugs(res.data.resolvedDrugs)
      }
    } catch (err) {
      console.error('Save drug settings error:', err)
      setDrugMessage({ type: 'error', text: err.response?.data?.error || 'ไม่สามารถบันทึกการตั้งค่ายาได้' })
    } finally {
      setSavingDrugs(false)
    }
  }

  // Reset to Defaults
  const handleResetDrugDefaults = () => {
    if (window.confirm('คุณต้องการรีเซ็ตค่าตัวกรองยาคืนกลับเป็นค่าเริ่มต้นมาตรฐานใช่หรือไม่?')) {
      setDrugSettings(JSON.parse(JSON.stringify(defaultDrugSettings)))
      setDrugMessage({ type: 'success', text: 'รีเซ็ตเป็นค่าเริ่มต้นเรียบร้อยแล้ว (อย่าลืมกดปุ่ม "บันทึกการตั้งค่า" เพื่อบันทึกผล)' })
    }
  }

  // X-ray Filter Helpers
  const handleAddXrayTag = (fieldKey, valueToAdd) => {
    if (!valueToAdd || !valueToAdd.trim()) return
    const currentTags = parseCommaTags(xraySettings[fieldKey])
    const cleanVal = valueToAdd.trim()
    if (!currentTags.includes(cleanVal)) {
      const newTags = [...currentTags, cleanVal]
      setXraySettings(prev => ({ ...prev, [fieldKey]: newTags.join(',') }))
    }
    setXrayTagInputs(prev => ({ ...prev, [fieldKey]: '' }))
  }

  const handleRemoveXrayTag = (fieldKey, tagToRemove) => {
    const currentTags = parseCommaTags(xraySettings[fieldKey])
    const newTags = currentTags.filter(t => t !== tagToRemove)
    setXraySettings(prev => ({ ...prev, [fieldKey]: newTags.join(',') }))

    if (fieldKey === 'XRAY_EXCLUDE_ICODES') {
      setResolvedXrayIcodes(prev => prev.filter(d => String(d.icode) !== String(tagToRemove)))
    }
  }

  const handleAddXrayItemFromSearch = (item) => {
    if (!item || !item.icode) return
    handleAddXrayTag('XRAY_EXCLUDE_ICODES', item.icode)
    if (!resolvedXrayIcodes.some(d => String(d.icode) === String(item.icode))) {
      setResolvedXrayIcodes(prev => [...prev, item])
    }
    setXraySearchQuery('')
    setXraySearchResults([])
  }

  // Save X-ray Settings
  const handleSaveXraySettings = async () => {
    setSavingXray(true)
    setXrayMessage(null)
    try {
      const res = await api.post('/settings/xray', { settings: xraySettings })
      setXrayMessage({ type: 'success', text: res.data.message || 'บันทึกการตั้งค่ายกเว้นรายการ X-ray เรียบร้อยแล้ว' })
      setInitialXraySettings(JSON.parse(JSON.stringify(res.data.settings)))
      if (res.data.resolvedIcodes) {
        setResolvedXrayIcodes(res.data.resolvedIcodes)
      }
      if (res.data.allGroups) {
        setAllXrayGroups(res.data.allGroups)
      }
    } catch (err) {
      console.error('Save xray settings error:', err)
      setXrayMessage({ type: 'error', text: err.response?.data?.error || 'ไม่สามารถบันทึกการตั้งค่า X-ray ได้' })
    } finally {
      setSavingXray(false)
    }
  }

  // Reset X-ray Defaults
  const handleResetXrayDefaults = () => {
    if (window.confirm('คุณต้องการรีเซ็ตค่ายกเว้นรายการ X-ray กลับเป็นค่าเริ่มต้นมาตรฐานใช่หรือไม่? (กลุ่ม 7 และ icode 3011687)')) {
      setXraySettings(JSON.parse(JSON.stringify(defaultXraySettings)))
      setXrayMessage({ type: 'success', text: 'รีเซ็ตเป็นค่าเริ่มต้นเรียบร้อยแล้ว (อย่าลืมกดปุ่ม "บันทึกการตั้งค่า" เพื่อบันทึกผล)' })
    }
  }

  // Dirty Checks
  const hasRoleChanges = useMemo(() => {
    return JSON.stringify(roles) !== JSON.stringify(initialRoles)
  }, [roles, initialRoles])

  const hasDrugChanges = useMemo(() => {
    return JSON.stringify(drugSettings) !== JSON.stringify(initialDrugSettings)
  }, [drugSettings, initialDrugSettings])

  const hasXrayChanges = useMemo(() => {
    return JSON.stringify(xraySettings) !== JSON.stringify(initialXraySettings)
  }, [xraySettings, initialXraySettings])

  return (
    <div className="container mx-auto p-6 max-w-7xl animate-fade-in relative z-10 pb-16">
      {/* Top Header */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-5 border-slate-200">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-slate-900 text-white shadow-sm">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">ตั้งค่าระบบ (System Settings)</h1>
              <p className="text-slate-500 text-sm">จัดการสิทธิ์ผู้ดูแลระบบ กลุ่มงานที่เข้าถึงโมดูล และตัวกรองระบบยาคืน</p>
            </div>
          </div>
        </div>

        <div className="mt-4 md:mt-0 flex items-center gap-2">
          <Link to="/">
            <Button variant="outline" size="sm" className="rounded-xl border-slate-200 text-slate-600 hover:text-slate-900">
              กลับหน้าหลัก
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 mb-8 pb-1">
        <button
          onClick={() => setActiveTab('admins')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-t-xl font-medium text-sm transition-all border-b-2 ${
            activeTab === 'admins'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 shadow-xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>1. Admin Setting</span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-t-xl font-medium text-sm transition-all border-b-2 ${
            activeTab === 'roles'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 shadow-xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>2. Role Setting</span>
          {hasRoleChanges && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="มีการเปลี่ยนแปลงที่ยังไม่บันทึก" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('drugs')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-t-xl font-medium text-sm transition-all border-b-2 ${
            activeTab === 'drugs'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 shadow-xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Pill className="w-4 h-4" />
          <span>3. Drug Setting</span>
          {hasDrugChanges && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="มีการเปลี่ยนแปลงที่ยังไม่บันทึก" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('xray')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-t-xl font-medium text-sm transition-all border-b-2 ${
            activeTab === 'xray'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 shadow-xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Radiation className="w-4 h-4 text-purple-600" />
          <span>4. Xray-setting</span>
          {hasXrayChanges && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="มีการเปลี่ยนแปลงที่ยังไม่บันทึก" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('no_authen')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-t-xl font-medium text-sm transition-all border-b-2 ${
            activeTab === 'no_authen'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 shadow-xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <KeyRound className="w-4 h-4 text-emerald-600" />
          <span>5. No Authen Code</span>
        </button>

        <button
          onClick={() => setActiveTab('slow_query')}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-t-xl font-medium text-sm transition-all border-b-2 ${
            activeTab === 'slow_query'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 shadow-xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Activity className="w-4 h-4 text-rose-500" />
          <span>6. Slow Query Log</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: ADMIN SETTING */}
      {/* ========================================================= */}
      {activeTab === 'admins' && (
        <div className="space-y-6">
          {/* Info Card */}
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 flex items-start gap-3.5 text-blue-900 text-sm">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-950 mb-0.5">สิทธิ์ผู้ดูแลระบบ (System Admin)</p>
              <p className="text-blue-800/90 leading-relaxed">
                ผู้ใช้งานที่เป็น Admin จะสามารถเข้าถึงได้<strong>ทุกโมดูล (ทั้ง 6 โมดูล)</strong> โดยอัตโนมัติ 
                และมีสิทธิ์เข้าถึงหน้าตั้งค่าระบบ (Settings) นี้เพื่อกำหนดผู้ดูแลและจัดสรรสิทธิ์ตามกลุ่ม
              </p>
            </div>
          </div>

          {/* Feedback Message */}
          {adminMessage && (
            <div
              className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm animate-fade-in ${
                adminMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {adminMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <span>{adminMessage.text}</span>
              </div>
              <button
                onClick={() => setAdminMessage(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Search & Add Admin Card */}
            <Card className="border-slate-200 shadow-xs lg:col-span-1 h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                  เพิ่มผู้ดูแลระบบ (Admin)
                </CardTitle>
                <CardDescription>
                  ค้นหาผู้ใช้งานจากฐานข้อมูล HOSxP (opduser) ด้วย Username หรือ ชื่อ-สกุล
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <Input
                    placeholder="พิมพ์ username หรือ ชื่อ-สกุล..."
                    value={adminSearchQuery}
                    onChange={(e) => setAdminSearchQuery(e.target.value)}
                    className="pl-9 rounded-xl border-slate-200 focus-visible:ring-blue-500"
                  />
                  {isSearchingUsers && (
                    <RefreshCw className="w-4 h-4 absolute right-3 top-3 text-slate-400 animate-spin" />
                  )}
                </div>

                {/* Search Results Dropdown/List */}
                {adminSearchQuery.trim().length >= 2 && (
                  <div className="space-y-2 border border-slate-200 rounded-xl p-2 max-h-72 overflow-y-auto bg-slate-50/50">
                    {userSearchResults.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-4">
                        {isSearchingUsers ? 'กำลังค้นหา...' : 'ไม่พบผู้ใช้งานที่ตรงกับคำค้นหา'}
                      </p>
                    ) : (
                      userSearchResults.map((u) => {
                        const isAlreadyAdmin = admins.some((a) => a.loginname === u.loginname)
                        return (
                          <div
                            key={u.loginname}
                            className="p-2.5 rounded-lg bg-white border border-slate-100 flex items-center justify-between gap-2 hover:border-blue-200 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{u.name}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-[11px]">
                                  {u.loginname}
                                </span>
                                <span className="truncate max-w-[120px]" title={u.groupname}>
                                  {u.groupname || '-'}
                                </span>
                              </div>
                            </div>
                            <div>
                              {isAlreadyAdmin ? (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                  เป็น Admin แล้ว
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleAddAdmin(u)}
                                  disabled={addingAdmin}
                                  className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2.5 whitespace-nowrap"
                                >
                                  <Plus className="w-3.5 h-3.5 mr-1" />
                                  เพิ่ม
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}

                <div className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                  💡 คำแนะนำ: พิมพ์อย่างน้อย 2 ตัวอักษร เช่น <code>admin</code> หรือชื่อภาษาไทย เพื่อเริ่มค้นหา
                </div>
              </CardContent>
            </Card>

            {/* Current Admins List Card */}
            <Card className="border-slate-200 shadow-xs lg:col-span-2">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    รายชื่อผู้ดูแลระบบปัจจุบัน ({admins.length} ท่าน)
                  </CardTitle>
                  <CardDescription>
                    ผู้มีสิทธิ์ดูแลระบบและเข้าถึงได้ทุกโมดูลในระบบ D-Flow
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchAdmins}
                  disabled={loadingAdmins}
                  className="rounded-xl border-slate-200 text-xs text-slate-600"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingAdmins ? 'animate-spin' : ''}`} />
                  รีเฟรช
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase border-y border-slate-200">
                      <tr>
                        <th className="px-5 py-3.5">ผู้ใช้งาน</th>
                        <th className="px-4 py-3.5">Username</th>
                        <th className="px-4 py-3.5">กลุ่มงาน HOSxP</th>
                        <th className="px-4 py-3.5">เพิ่มโดย</th>
                        <th className="px-4 py-3.5 text-right">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingAdmins ? (
                        <tr>
                          <td colSpan="5" className="text-center py-10 text-slate-400">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                            กำลังโหลดรายชื่อผู้ดูแลระบบ...
                          </td>
                        </tr>
                      ) : admins.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-10 text-slate-400">
                            ยังไม่มีผู้ดูแลระบบในตาราง
                          </td>
                        </tr>
                      ) : (
                        admins.map((admin) => {
                          const isCurrentUser = admin.loginname === user?.loginname
                          const isLastAdmin = admins.length <= 1
                          return (
                            <tr key={admin.loginname} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                                    {admin.name ? admin.name.charAt(0) : admin.loginname.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                      <span>{admin.name || admin.loginname}</span>
                                      {isCurrentUser && (
                                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 px-1.5 py-0">
                                          (คุณ)
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                      {admin.created_at ? new Date(admin.created_at).toLocaleDateString('th-TH') : '-'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 font-mono text-xs text-slate-600">
                                {admin.loginname}
                              </td>
                              <td className="px-4 py-3.5 text-xs text-slate-600">
                                <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                                  {admin.groupname || '-'}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-xs text-slate-500">
                                {admin.created_by || '-'}
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteAdmin(admin.loginname)}
                                  disabled={deletingAdmin === admin.loginname || isLastAdmin}
                                  title={isLastAdmin ? 'ไม่สามารถลบ Admin คนสุดท้ายได้' : 'ถอดสิทธิ์ Admin'}
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
                                >
                                  {deletingAdmin === admin.loginname ? (
                                    <RefreshCw className="w-4 h-4 animate-spin text-red-500" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: ROLE SETTING */}
      {/* ========================================================= */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          {/* Info Card & Action Bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex items-start gap-3.5 text-sm text-slate-700">
              <Users className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 mb-0.5">การกำหนดสิทธิ์ตามกลุ่มงาน (Role-based Module Access)</p>
                <p className="text-slate-500 text-xs md:text-sm">
                  เลือกกลุ่มผู้ใช้งาน (Group Name จาก HOSxP) ที่อนุญาตให้เข้าใช้งานแต่ละโมดูลได้ 
                  (Admin จะเข้าได้ทุกโมดูลอยู่แล้วโดยไม่ต้องกำหนดเพิ่ม)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchRolesData}
                disabled={loadingRoles}
                className="rounded-xl border-slate-200 text-xs text-slate-600"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingRoles ? 'animate-spin' : ''}`} />
                รีเฟรช
              </Button>
              <Button
                onClick={handleSaveAllRoles}
                disabled={isSavingAllRoles || !hasRoleChanges}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs px-4 shadow-sm"
              >
                {isSavingAllRoles ? (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                )}
                บันทึกการตั้งค่าทั้งหมด
              </Button>
            </div>
          </div>

          {/* Feedback Message */}
          {roleMessage && (
            <div
              className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm animate-fade-in ${
                roleMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {roleMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <span>{roleMessage.text}</span>
              </div>
              <button
                onClick={() => setRoleMessage(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 6 Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.keys(MODULE_META).map((moduleKey) => {
              const meta = MODULE_META[moduleKey]
              const assignedGroups = roles[moduleKey] || []
              const unassignedGroups = availableGroups.filter(g => !assignedGroups.includes(g))
              const isModuleSaving = savingModule === moduleKey
              const isModuleChanged = JSON.stringify(assignedGroups) !== JSON.stringify(initialRoles[moduleKey] || [])
              const filterText = groupFilterPerModule[moduleKey] || ''

              return (
                <Card
                  key={moduleKey}
                  className={`border-slate-200 shadow-xs flex flex-col justify-between transition-all hover:shadow-md ${
                    isModuleChanged ? 'ring-2 ring-blue-400/50' : ''
                  }`}
                >
                  <CardHeader className="pb-3 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${meta.bg} ${meta.text}`}>
                          <meta.icon className="w-6 h-6" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-bold text-slate-800">
                            {meta.name}
                          </CardTitle>
                          <span className="text-xs text-slate-400 font-mono">
                            key: {moduleKey}
                          </span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="font-mono text-xs px-2 py-0.5">
                        {assignedGroups.length} กลุ่ม
                      </Badge>
                    </div>
                    <CardDescription className="text-xs mt-2 text-slate-500 leading-relaxed">
                      {meta.desc}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-4 flex-1 flex flex-col justify-between space-y-4">
                    {/* Assigned Groups Tag List */}
                    <div>
                      <div className="text-xs font-semibold text-slate-600 uppercase mb-2 flex items-center justify-between">
                        <span>กลุ่มงานที่ได้รับสิทธิ์</span>
                        {assignedGroups.length > 0 && (
                          <button
                            onClick={() => setRoles(prev => ({ ...prev, [moduleKey]: [] }))}
                            className="text-[11px] text-red-500 hover:text-red-700 hover:underline normal-case font-normal"
                          >
                            ล้างทั้งหมด
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 min-h-[70px] max-h-[160px] overflow-y-auto p-2 rounded-xl bg-slate-50 border border-slate-100">
                        {assignedGroups.length === 0 ? (
                          <div className="w-full text-center py-4 text-xs text-slate-400">
                            ยังไม่มีกลุ่มงานที่ได้รับสิทธิ์ (เฉพาะ Admin เท่านั้น)
                          </div>
                        ) : (
                          assignedGroups.map((group) => (
                            <span
                              key={group}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white text-slate-700 border border-slate-200 shadow-2xs group"
                            >
                              <span className="truncate max-w-[170px]" title={group}>{group}</span>
                              <button
                                onClick={() => handleRemoveGroupFromModule(moduleKey, group)}
                                className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Add Group Combobox/Selector */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="text-xs font-medium text-slate-600">
                        + เพิ่มกลุ่มงานที่อนุญาต:
                      </div>

                      <div className="relative">
                        <select
                          className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-700"
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddGroupToModule(moduleKey, e.target.value)
                            }
                          }}
                        >
                          <option value="">-- เลือกกลุ่มงานใน HOSxP เพื่อเพิ่ม --</option>
                          {unassignedGroups.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quick presets */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {moduleKey === 'ward' && unassignedGroups.includes('RBH_OPD_IPD_NURSE') && (
                          <button
                            onClick={() => handleAddGroupToModule(moduleKey, 'RBH_OPD_IPD_NURSE')}
                            className="text-[11px] text-teal-600 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded-md border border-teal-200"
                          >
                            + พยาบาล (RBH_OPD_IPD_NURSE)
                          </button>
                        )}
                        {moduleKey === 'pharmacy' && unassignedGroups.includes('Rx-ห้องยาผู้ป่วยใน') && (
                          <button
                            onClick={() => handleAddGroupToModule(moduleKey, 'Rx-ห้องยาผู้ป่วยใน')}
                            className="text-[11px] text-green-600 bg-green-50 hover:bg-green-100 px-2 py-0.5 rounded-md border border-green-200"
                          >
                            + ห้องยาผู้ป่วยใน
                          </button>
                        )}
                        {moduleKey === 'finance' && unassignedGroups.includes('F-ศูนย์เรียกเก็บ') && (
                          <button
                            onClick={() => handleAddGroupToModule(moduleKey, 'F-ศูนย์เรียกเก็บ')}
                            className="text-[11px] text-purple-600 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-md border border-purple-200"
                          >
                            + ศูนย์เรียกเก็บ
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Footer Save Button per module */}
                    <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                      <span className="text-[11px] text-slate-400">
                        {isModuleChanged ? '⚠️ มีการแก้ไข' : 'บันทึกล่าสุดแล้ว'}
                      </span>
                      <Button
                        size="sm"
                        variant={isModuleChanged ? 'default' : 'outline'}
                        onClick={() => handleSaveModuleRoles(moduleKey)}
                        disabled={isModuleSaving}
                        className={`h-8 text-xs rounded-xl ${
                          isModuleChanged
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {isModuleSaving ? (
                          <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5 mr-1" />
                        )}
                        บันทึกโมดูลนี้
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: DRUG SETTING (RETURN MED FILTER SETTINGS) */}
      {/* ========================================================= */}
      {activeTab === 'drugs' && (
        <div className="space-y-6">
          {/* Header Action & Info Bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex items-start gap-3.5 text-sm text-slate-700">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0 mt-0.5">
                <Pill className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900">ตั้งค่าตัวกรองระบบยาคืน (Return Med Filter Settings)</p>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]">
                    Active
                  </Badge>
                </div>
                <p className="text-slate-500 text-xs md:text-sm mt-0.5">
                  กำหนดเงื่อนไขรูปแบบยา หมวดหมู่ และรหัสยาเฉพาะที่ต้องนำมาตรวจสอบการคืนยาก่อน Discharge และในระบบห้องยา
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRawViewMode(!rawViewMode)}
                className="rounded-xl text-xs text-slate-600 hover:text-slate-900 border border-slate-200"
              >
                <Code className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                {rawViewMode ? 'โหมด Tags ปกติ' : 'ดูรูปแบบ Text (.env)'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetDrugDefaults}
                className="rounded-xl border-slate-200 text-xs text-slate-600 hover:text-amber-700 hover:bg-amber-50"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                คืนค่าเริ่มต้น
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchDrugSettings}
                disabled={loadingDrugs}
                className="rounded-xl border-slate-200 text-xs text-slate-600"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingDrugs ? 'animate-spin' : ''}`} />
                รีเฟรช
              </Button>
              <Button
                onClick={handleSaveDrugSettings}
                disabled={savingDrugs || !hasDrugChanges}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs px-4 shadow-sm"
              >
                {savingDrugs ? (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                )}
                บันทึกการตั้งค่า
              </Button>
            </div>
          </div>

          {/* Feedback Message */}
          {drugMessage && (
            <div
              className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm animate-fade-in ${
                drugMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {drugMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <span>{drugMessage.text}</span>
              </div>
              <button
                onClick={() => setDrugMessage(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Raw Text (.env format) View Mode */}
          {rawViewMode ? (
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800">
                  <Code className="w-5 h-5 text-slate-600" />
                  รูปแบบ Raw Configuration (.env / String Format)
                </CardTitle>
                <CardDescription>
                  สามารถแก้ไขข้อความคั่นด้วยเครื่องหมายจุลภาค (Comma `,`) ได้โดยตรง
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5 space-y-4 font-mono text-xs">
                {[
                  { key: 'RETURN_MED_DOSAGEFORMS', label: 'RETURN_MED_DOSAGEFORMS', desc: 'รูปแบบยาที่ต้องส่งคืน' },
                  { key: 'RETURN_MED_INCLUDE_CATEGORIES_LIKE', label: 'RETURN_MED_INCLUDE_CATEGORIES_LIKE', desc: 'หมวดหมู่ยาที่บังคับรวม (LIKE)' },
                  { key: 'RETURN_MED_EXCLUDE_CATEGORIES', label: 'RETURN_MED_EXCLUDE_CATEGORIES', desc: 'หมวดหมู่ยาที่ยกเว้นแบบตรงตัว' },
                  { key: 'RETURN_MED_EXCLUDE_CATEGORIES_LIKE', label: 'RETURN_MED_EXCLUDE_CATEGORIES_LIKE', desc: 'หมวดหมู่ยาที่ยกเว้น (LIKE)' },
                  { key: 'RETURN_MED_EXCLUDE_NAME_LIKE', label: 'RETURN_MED_EXCLUDE_NAME_LIKE', desc: 'คำในชื่อยาที่ยกเว้น (LIKE)' },
                  { key: 'RETURN_MED_INCLUDE_ICODES', label: 'RETURN_MED_INCLUDE_ICODES', desc: 'รหัสยาเฉพาะที่บังคับรวม (icodes)' }
                ].map((item) => (
                  <div key={item.key} className="space-y-1">
                    <div className="flex justify-between items-center text-slate-600 font-sans text-xs">
                      <span className="font-mono font-bold text-slate-900">{item.label}</span>
                      <span className="text-slate-400">{item.desc}</span>
                    </div>
                    <Input
                      value={drugSettings[item.key] || ''}
                      onChange={(e) => setDrugSettings(prev => ({ ...prev, [item.key]: e.target.value }))}
                      className="font-mono text-xs rounded-xl bg-slate-50 border-slate-200"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Card 1: รูปแบบยา & หมวดหมู่ที่ต้องรวม */}
              <Card className="border-slate-200 shadow-xs flex flex-col justify-between">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                      <CheckSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-800">
                        1. เงื่อนไขที่นำมารวมเป็นยาคืน (Include Rules)
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        ยาที่ตรงกับรูปแบบหรือหมวดหมู่เหล่านี้จะถูกนำมาตรวจสอบ
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-6">
                  {/* RETURN_MED_DOSAGEFORMS */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-teal-600" />
                        รูปแบบยาหลักที่ต้องคืน (RETURN_MED_DOSAGEFORMS)
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {parseCommaTags(drugSettings.RETURN_MED_DOSAGEFORMS).length} รายการ
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      รูปแบบยาหลักที่นำมาตรวจ เช่น ยาฉีด (INJECTIONS, INJECTION)
                    </p>
                    <div className="flex flex-wrap gap-1.5 min-h-[48px] p-2 rounded-xl bg-slate-50 border border-slate-100">
                      {parseCommaTags(drugSettings.RETURN_MED_DOSAGEFORMS).map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-white text-teal-800 border border-teal-200 shadow-2xs">
                          {tag}
                          <button onClick={() => handleRemoveDrugTag('RETURN_MED_DOSAGEFORMS', tag)} className="text-slate-400 hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="พิมพ์ชื่อรูปแบบยา เช่น INJECTIONS..."
                        value={tagInputs.RETURN_MED_DOSAGEFORMS || ''}
                        onChange={(e) => setTagInputs(prev => ({ ...prev, RETURN_MED_DOSAGEFORMS: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddDrugTag('RETURN_MED_DOSAGEFORMS', tagInputs.RETURN_MED_DOSAGEFORMS)
                          }
                        }}
                        className="h-8 text-xs rounded-xl"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddDrugTag('RETURN_MED_DOSAGEFORMS', tagInputs.RETURN_MED_DOSAGEFORMS)}
                        className="h-8 text-xs rounded-xl px-3"
                      >
                        + เพิ่ม
                      </Button>
                    </div>
                  </div>

                  {/* RETURN_MED_INCLUDE_CATEGORIES_LIKE */}
                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-blue-600" />
                        หมวดหมู่ยาที่บังคับรวม (RETURN_MED_INCLUDE_CATEGORIES_LIKE)
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {parseCommaTags(drugSettings.RETURN_MED_INCLUDE_CATEGORIES_LIKE).length} รายการ
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      คำในหมวดหมู่ยาที่ต้องการให้รวมเสมอ แม้ไม่ได้อยู่ในรูปแบบยาข้างต้น เช่น ANXIOLYTICS, OPIOID, SEDATIVES
                    </p>
                    <div className="flex flex-wrap gap-1.5 min-h-[48px] p-2 rounded-xl bg-slate-50 border border-slate-100">
                      {parseCommaTags(drugSettings.RETURN_MED_INCLUDE_CATEGORIES_LIKE).map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-white text-blue-800 border border-blue-200 shadow-2xs">
                          {tag}
                          <button onClick={() => handleRemoveDrugTag('RETURN_MED_INCLUDE_CATEGORIES_LIKE', tag)} className="text-slate-400 hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="พิมพ์คำในหมวดหมู่ เช่น OPIOID..."
                        value={tagInputs.RETURN_MED_INCLUDE_CATEGORIES_LIKE || ''}
                        onChange={(e) => setTagInputs(prev => ({ ...prev, RETURN_MED_INCLUDE_CATEGORIES_LIKE: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddDrugTag('RETURN_MED_INCLUDE_CATEGORIES_LIKE', tagInputs.RETURN_MED_INCLUDE_CATEGORIES_LIKE)
                          }
                        }}
                        className="h-8 text-xs rounded-xl"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddDrugTag('RETURN_MED_INCLUDE_CATEGORIES_LIKE', tagInputs.RETURN_MED_INCLUDE_CATEGORIES_LIKE)}
                        className="h-8 text-xs rounded-xl px-3"
                      >
                        + เพิ่ม
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: หมวดหมู่ & ชื่อยาที่ยกเว้น */}
              <Card className="border-slate-200 shadow-xs flex flex-col justify-between">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-red-50 text-red-600">
                      <X className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-800">
                        2. เงื่อนไขที่ยกเว้น (Exclude Rules)
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        ยาที่ตรงกับเงื่อนไขด้านล่างนี้ จะไม่ถูกนำมาแสดงในรายการยาคืน
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-5">
                  {/* RETURN_MED_EXCLUDE_CATEGORIES */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-600" />
                        หมวดหมู่ยาที่ยกเว้นแบบตรงตัว (RETURN_MED_EXCLUDE_CATEGORIES)
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {parseCommaTags(drugSettings.RETURN_MED_EXCLUDE_CATEGORIES).length} รายการ
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      ยกเว้นหมวดหมู่แบบตรงตัว (Exact Match) เช่น สารน้ำ น้ำเกลือ ยาดมสลบ
                    </p>
                    <div className="flex flex-wrap gap-1.5 min-h-[48px] max-h-[120px] overflow-y-auto p-2 rounded-xl bg-slate-50 border border-slate-100">
                      {parseCommaTags(drugSettings.RETURN_MED_EXCLUDE_CATEGORIES).map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-white text-slate-700 border border-slate-200 shadow-2xs">
                          <span className="truncate max-w-[200px]" title={tag}>{tag}</span>
                          <button onClick={() => handleRemoveDrugTag('RETURN_MED_EXCLUDE_CATEGORIES', tag)} className="text-slate-400 hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="พิมพ์ชื่อหมวดหมู่ที่ต้องการยกเว้น..."
                        value={tagInputs.RETURN_MED_EXCLUDE_CATEGORIES || ''}
                        onChange={(e) => setTagInputs(prev => ({ ...prev, RETURN_MED_EXCLUDE_CATEGORIES: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddDrugTag('RETURN_MED_EXCLUDE_CATEGORIES', tagInputs.RETURN_MED_EXCLUDE_CATEGORIES)
                          }
                        }}
                        className="h-8 text-xs rounded-xl"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddDrugTag('RETURN_MED_EXCLUDE_CATEGORIES', tagInputs.RETURN_MED_EXCLUDE_CATEGORIES)}
                        className="h-8 text-xs rounded-xl px-3"
                      >
                        + เพิ่ม
                      </Button>
                    </div>
                  </div>

                  {/* RETURN_MED_EXCLUDE_CATEGORIES_LIKE */}
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-600" />
                        คำในหมวดหมู่ที่ยกเว้น (RETURN_MED_EXCLUDE_CATEGORIES_LIKE)
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {parseCommaTags(drugSettings.RETURN_MED_EXCLUDE_CATEGORIES_LIKE).length} รายการ
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 rounded-xl bg-slate-50 border border-slate-100">
                      {parseCommaTags(drugSettings.RETURN_MED_EXCLUDE_CATEGORIES_LIKE).map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-white text-slate-700 border border-slate-200 shadow-2xs">
                          {tag}
                          <button onClick={() => handleRemoveDrugTag('RETURN_MED_EXCLUDE_CATEGORIES_LIKE', tag)} className="text-slate-400 hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="พิมพ์คำที่ต้องการยกเว้น เช่น ANAESTHETICS..."
                        value={tagInputs.RETURN_MED_EXCLUDE_CATEGORIES_LIKE || ''}
                        onChange={(e) => setTagInputs(prev => ({ ...prev, RETURN_MED_EXCLUDE_CATEGORIES_LIKE: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddDrugTag('RETURN_MED_EXCLUDE_CATEGORIES_LIKE', tagInputs.RETURN_MED_EXCLUDE_CATEGORIES_LIKE)
                          }
                        }}
                        className="h-8 text-xs rounded-xl"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddDrugTag('RETURN_MED_EXCLUDE_CATEGORIES_LIKE', tagInputs.RETURN_MED_EXCLUDE_CATEGORIES_LIKE)}
                        className="h-8 text-xs rounded-xl px-3"
                      >
                        + เพิ่ม
                      </Button>
                    </div>
                  </div>

                  {/* RETURN_MED_EXCLUDE_NAME_LIKE */}
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-red-600" />
                        คำในชื่อยาที่ยกเว้น (RETURN_MED_EXCLUDE_NAME_LIKE)
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {parseCommaTags(drugSettings.RETURN_MED_EXCLUDE_NAME_LIKE).length} รายการ
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      หากชื่อยามีคำนี้จะไม่นำมาแสดงเป็นยาคืน เช่น คำว่า "วิสัญญี"
                    </p>
                    <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 rounded-xl bg-slate-50 border border-slate-100">
                      {parseCommaTags(drugSettings.RETURN_MED_EXCLUDE_NAME_LIKE).map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white text-red-700 border border-red-200 shadow-2xs">
                          {tag}
                          <button onClick={() => handleRemoveDrugTag('RETURN_MED_EXCLUDE_NAME_LIKE', tag)} className="text-slate-400 hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="พิมพ์คำในชื่อยา เช่น วิสัญญี..."
                        value={tagInputs.RETURN_MED_EXCLUDE_NAME_LIKE || ''}
                        onChange={(e) => setTagInputs(prev => ({ ...prev, RETURN_MED_EXCLUDE_NAME_LIKE: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddDrugTag('RETURN_MED_EXCLUDE_NAME_LIKE', tagInputs.RETURN_MED_EXCLUDE_NAME_LIKE)
                          }
                        }}
                        className="h-8 text-xs rounded-xl"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddDrugTag('RETURN_MED_EXCLUDE_NAME_LIKE', tagInputs.RETURN_MED_EXCLUDE_NAME_LIKE)}
                        className="h-8 text-xs rounded-xl px-3"
                      >
                        + เพิ่ม
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: รหัสยาเฉพาะที่บังคับรวม (RETURN_MED_INCLUDE_ICODES) */}
              <Card className="border-slate-200 shadow-xs lg:col-span-2">
                <CardHeader className="pb-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Pill className="w-5 h-5 text-indigo-600" />
                        3. รหัสยาที่บังคับรวมเป็นพิเศษ (RETURN_MED_INCLUDE_ICODES)
                      </CardTitle>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {parseCommaTags(drugSettings.RETURN_MED_INCLUDE_ICODES).length} รหัสยา
                      </Badge>
                    </div>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      รายการยาเฉพาะตัวที่ต้องบังคับให้ตรวจสอบการคืนยาเสมอ (เช่น Potassium, Pseudoephedrine, Ritalin, Cytotec)
                    </CardDescription>
                  </div>

                  {/* Drug Search Input */}
                  <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <Input
                      placeholder="ค้นหายาใน HOSxP ด้วยชื่อ หรือ icode..."
                      value={drugSearchQuery}
                      onChange={(e) => setDrugSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-xs rounded-xl border-slate-200 focus-visible:ring-indigo-500"
                    />
                    {isSearchingDrugs && (
                      <RefreshCw className="w-3.5 h-3.5 absolute right-3 top-3 text-slate-400 animate-spin" />
                    )}

                    {/* Autocomplete Search Dropdown */}
                    {drugSearchQuery.trim().length >= 2 && (
                      <div className="absolute left-0 right-0 top-10 bg-white border border-slate-200 rounded-xl shadow-lg z-30 max-h-64 overflow-y-auto p-1.5 space-y-1">
                        {drugSearchResults.length === 0 ? (
                          <div className="text-center py-4 text-xs text-slate-400">
                            {isSearchingDrugs ? 'กำลังค้นหา...' : 'ไม่พบรายการยาที่ตรงกับคำค้น'}
                          </div>
                        ) : (
                          drugSearchResults.map((drug) => {
                            const isIncluded = parseCommaTags(drugSettings.RETURN_MED_INCLUDE_ICODES).includes(drug.icode)
                            return (
                              <div
                                key={drug.icode}
                                className="p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-slate-800 truncate">
                                    {drug.name} {drug.strength ? `(${drug.strength})` : ''}
                                  </p>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 font-mono">
                                    <span className="bg-slate-100 px-1 rounded text-slate-700">{drug.icode}</span>
                                    <span>{drug.dosageform || '-'}</span>
                                    <span>• {drug.units || '-'}</span>
                                  </div>
                                </div>
                                <div>
                                  {isIncluded ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                      รวมอยู่แล้ว
                                    </span>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() => handleAddDrugItemIcode(drug)}
                                      className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-2"
                                    >
                                      <Plus className="w-3 h-3 mr-1" />
                                      เพิ่ม
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold uppercase border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">icode</th>
                          <th className="px-4 py-3">ชื่อยา (Drug Name & Strength)</th>
                          <th className="px-4 py-3">รูปแบบ (Dosage Form)</th>
                          <th className="px-4 py-3">หมวดหมู่ (Drug Category)</th>
                          <th className="px-4 py-3">หน่วย (Units)</th>
                          <th className="px-4 py-3 text-right">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parseCommaTags(drugSettings.RETURN_MED_INCLUDE_ICODES).length === 0 ? (
                          <tr>
                            <td colSpan="6" className="text-center py-8 text-slate-400">
                              ไม่มีรหัสยาที่ระบุเป็นพิเศษ
                            </td>
                          </tr>
                        ) : (
                          parseCommaTags(drugSettings.RETURN_MED_INCLUDE_ICODES).map((icode) => {
                            const drugInfo = resolvedDrugs.find(d => String(d.icode) === String(icode))
                            return (
                              <tr key={icode} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-4 py-3 font-mono font-bold text-slate-900">
                                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {icode}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-semibold text-slate-800">
                                  {drugInfo ? (
                                    <span>
                                      {drugInfo.name} {drugInfo.strength ? <span className="font-normal text-slate-500">({drugInfo.strength})</span> : ''}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">กำลังตรวจสอบชื่อยาจาก HOSxP...</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-slate-600 font-mono">
                                  {drugInfo?.dosageform || '-'}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  <span className="truncate max-w-[200px] inline-block" title={drugInfo?.drugcategory}>
                                    {drugInfo?.drugcategory || '-'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  {drugInfo?.units || '-'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveDrugTag('RETURN_MED_INCLUDE_ICODES', icode)}
                                    className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                    title="ลบยานี้ออกจากรายการยาคืน"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Direct icode typing input */}
                  <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-500 text-[11px]">
                      หรือพิมพ์รหัส icode เพื่อเพิ่มโดยตรง:
                    </span>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="พิมพ์ icode เช่น 1500513..."
                        value={tagInputs.RETURN_MED_INCLUDE_ICODES || ''}
                        onChange={(e) => setTagInputs(prev => ({ ...prev, RETURN_MED_INCLUDE_ICODES: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddDrugTag('RETURN_MED_INCLUDE_ICODES', tagInputs.RETURN_MED_INCLUDE_ICODES)
                          }
                        }}
                        className="h-8 text-xs font-mono rounded-xl w-44"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddDrugTag('RETURN_MED_INCLUDE_ICODES', tagInputs.RETURN_MED_INCLUDE_ICODES)}
                        className="h-8 text-xs rounded-xl px-3"
                      >
                        + เพิ่ม icode
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: XRAY-SETTING */}
      {/* ========================================================= */}
      {activeTab === 'xray' && (
        <div className="space-y-6">
          {/* Header Info Card */}
          <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 text-purple-900 text-sm">
              <Radiation className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-purple-950 mb-0.5">การตั้งค่ารายการยกเว้นการตรวจสอบ X-ray ซ้ำซ้อน</p>
                <p className="text-purple-800/90 leading-relaxed text-xs">
                  ระบบตรวจสอบอัตโนมัติจะตรวจสอบรายการค่าใช้จ่าย X-ray ที่ยังไม่ confirm (<code className="font-mono bg-purple-100 px-1 py-0.5 rounded text-purple-900">xr.confirm = 'N'</code>) 
                  โดยจะ<strong>ยกเว้นกลุ่มและรหัส X-ray ที่ระบุด้านล่างนี้</strong> ไม่นำมาแจ้งเตือนเป็นรายการซ้ำซ้อน
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetXrayDefaults}
                className="rounded-xl border-purple-200 text-purple-700 hover:bg-purple-100 hover:text-purple-900 text-xs"
                title="รีเซ็ตกลับเป็นค่าเริ่มต้นมาตรฐาน (กลุ่ม 7 และ icode 3011687)"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                คืนค่าเริ่มต้น
              </Button>
              <Button
                size="sm"
                onClick={handleSaveXraySettings}
                disabled={savingXray}
                className={`rounded-xl text-xs font-medium shadow-xs transition-all ${
                  hasXrayChanges
                    ? 'bg-purple-600 hover:bg-purple-700 text-white animate-pulse'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {savingXray ? (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                )}
                บันทึกการตั้งค่า
              </Button>
            </div>
          </div>

          {/* Feedback Message */}
          {xrayMessage && (
            <div
              className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm animate-fade-in ${
                xrayMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {xrayMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <span>{xrayMessage.text}</span>
              </div>
              <button
                onClick={() => setXrayMessage(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Settings Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Groups Exclusion */}
            <Card className="border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                      <Radiation className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-800">
                        1. กลุ่ม X-ray ที่ยกเว้น (xray_items_group)
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        SQL: <code className="font-mono text-purple-700 bg-purple-50 px-1 py-0.5 rounded">xi.xray_items_group &lt;&gt; '...'</code> (ค่าเริ่มต้น: กลุ่ม 7)
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Select from master groups */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">
                      เลือกกลุ่ม X-ray จากฐานข้อมูลเพื่อเพิ่ม:
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedGroupToAdd}
                        onChange={(e) => setSelectedGroupToAdd(e.target.value)}
                        className="flex-1 h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">-- เลือกกลุ่ม X-ray --</option>
                        {allXrayGroups.map((grp) => (
                          <option key={grp.xray_items_group} value={grp.xray_items_group}>
                            กลุ่ม {grp.xray_items_group} : {grp.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!selectedGroupToAdd}
                        onClick={() => {
                          if (selectedGroupToAdd) {
                            handleAddXrayTag('XRAY_EXCLUDE_GROUPS', selectedGroupToAdd)
                            setSelectedGroupToAdd('')
                          }
                        }}
                        className="h-9 px-3.5 text-xs rounded-xl bg-purple-100 text-purple-700 hover:bg-purple-200"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        เพิ่มกลุ่ม
                      </Button>
                    </div>
                  </div>

                  {/* List of currently excluded groups */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700">
                        รายการกลุ่มที่ถูกยกเว้นในปัจจุบัน:
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {parseCommaTags(xraySettings.XRAY_EXCLUDE_GROUPS).length} กลุ่ม
                      </span>
                    </div>

                    <div className="min-h-[100px] p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap gap-2 items-start content-start">
                      {parseCommaTags(xraySettings.XRAY_EXCLUDE_GROUPS).length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">ยังไม่มีกลุ่มที่ถูกยกเว้น (ตรวจสอบทุกกลุ่ม)</p>
                      ) : (
                        parseCommaTags(xraySettings.XRAY_EXCLUDE_GROUPS).map((groupCode) => {
                          const groupInfo = allXrayGroups.find(g => String(g.xray_items_group) === String(groupCode))
                          return (
                            <Badge
                              key={groupCode}
                              variant="secondary"
                              className="px-3 py-1.5 text-xs bg-purple-50 text-purple-800 border border-purple-200 rounded-xl flex items-center gap-2 shadow-2xs"
                            >
                              <span className="font-mono font-bold">กลุ่ม {groupCode}</span>
                              {groupInfo ? (
                                <span className="font-normal text-slate-700">({groupInfo.name})</span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleRemoveXrayTag('XRAY_EXCLUDE_GROUPS', groupCode)}
                                className="text-purple-400 hover:text-red-600 transition-colors ml-1"
                                title="ลบกลุ่มนี้"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </Badge>
                          )
                        })
                      )}
                    </div>
                  </div>
                </CardContent>
              </div>

              {/* Direct group code input footer */}
              <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 text-[11px]">
                  หรือพิมพ์รหัสกลุ่มโดยตรง:
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="เช่น 7"
                    value={xrayTagInputs.XRAY_EXCLUDE_GROUPS || ''}
                    onChange={(e) => setXrayTagInputs(prev => ({ ...prev, XRAY_EXCLUDE_GROUPS: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddXrayTag('XRAY_EXCLUDE_GROUPS', xrayTagInputs.XRAY_EXCLUDE_GROUPS)
                      }
                    }}
                    className="h-8 text-xs font-mono rounded-xl w-28"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddXrayTag('XRAY_EXCLUDE_GROUPS', xrayTagInputs.XRAY_EXCLUDE_GROUPS)}
                    className="h-8 text-xs rounded-xl px-3"
                  >
                    + เพิ่ม
                  </Button>
                </div>
              </div>
            </Card>

            {/* Card 2: Icodes Exclusion */}
            <Card className="border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                      <Code className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-800">
                        2. รหัส X-ray ที่ยกเว้น (icode)
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        SQL: <code className="font-mono text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded">o.icode &lt;&gt; '...'</code> (ค่าเริ่มต้น: 3011687 Additional Multiphase)
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Live Search input */}
                  <div className="space-y-1.5 relative">
                    <label className="text-xs font-semibold text-slate-700">
                      ค้นหาและเพิ่มรหัสรายการ X-ray:
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <Input
                        placeholder="ค้นหาด้วยชื่อรายการ X-ray หรือรหัส icode (อย่างน้อย 2 ตัวอักษร)..."
                        value={xraySearchQuery}
                        onChange={(e) => setXraySearchQuery(e.target.value)}
                        className="pl-9 h-9 text-xs rounded-xl border-slate-200 focus:ring-purple-500"
                      />
                      {isSearchingXray && (
                        <div className="absolute right-3 top-2.5">
                          <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
                        </div>
                      )}
                    </div>

                    {/* Search results dropdown */}
                    {xraySearchResults.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {xraySearchResults.map((item) => {
                          const isAlreadyAdded = parseCommaTags(xraySettings.XRAY_EXCLUDE_ICODES).includes(String(item.icode))
                          return (
                            <div
                              key={item.icode}
                              onClick={() => {
                                if (!isAlreadyAdded) handleAddXrayItemFromSearch(item)
                              }}
                              className={`p-2.5 flex items-center justify-between text-xs transition-colors ${
                                isAlreadyAdded
                                  ? 'bg-slate-50 opacity-60 cursor-not-allowed'
                                  : 'hover:bg-purple-50/60 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                  {item.icode}
                                </span>
                                <div>
                                  <div className="font-medium text-slate-800">{item.name}</div>
                                  {item.group_name && (
                                    <div className="text-[10px] text-slate-400">
                                      กลุ่ม: {item.group_name} ({item.xray_items_group})
                                    </div>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs">
                                {isAlreadyAdded ? (
                                  <span className="text-slate-400 font-medium">เพิ่มแล้ว</span>
                                ) : (
                                  <span className="text-purple-600 font-medium hover:underline">+ เพิ่ม</span>
                                )}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Table of excluded icodes */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700">
                        รายการรหัสที่ถูกยกเว้นในปัจจุบัน:
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {parseCommaTags(xraySettings.XRAY_EXCLUDE_ICODES).length} รายการ
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                          <tr>
                            <th className="px-3 py-2">icode</th>
                            <th className="px-3 py-2">ชื่อรายการ X-ray</th>
                            <th className="px-3 py-2">กลุ่ม</th>
                            <th className="px-3 py-2 text-right">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parseCommaTags(xraySettings.XRAY_EXCLUDE_ICODES).length === 0 ? (
                            <tr>
                              <td colSpan="4" className="text-center py-6 text-slate-400 italic">
                                ยังไม่มีรหัสที่ถูกยกเว้น
                              </td>
                            </tr>
                          ) : (
                            parseCommaTags(xraySettings.XRAY_EXCLUDE_ICODES).map((icode) => {
                              const itemInfo = resolvedXrayIcodes.find(d => String(d.icode) === String(icode))
                              return (
                                <tr key={icode} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-3 py-2 font-mono font-bold text-indigo-700">
                                    {icode}
                                  </td>
                                  <td className="px-3 py-2 font-medium text-slate-800">
                                    {itemInfo ? (
                                      <span>{itemInfo.name}</span>
                                    ) : (
                                      <span className="text-slate-400 italic">กำลังตรวจสอบชื่อจาก HOSxP...</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-slate-500">
                                    {itemInfo?.group_name ? (
                                      <span>{itemInfo.group_name}</span>
                                    ) : (
                                      '-'
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveXrayTag('XRAY_EXCLUDE_ICODES', icode)}
                                      className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                      title="ลบออกจากรายการยกเว้น"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </div>

              {/* Direct icode typing footer */}
              <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-500 text-[11px]">
                  หรือพิมพ์รหัส icode เพื่อเพิ่มโดยตรง:
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="พิมพ์ icode เช่น 3011687..."
                    value={xrayTagInputs.XRAY_EXCLUDE_ICODES || ''}
                    onChange={(e) => setXrayTagInputs(prev => ({ ...prev, XRAY_EXCLUDE_ICODES: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddXrayTag('XRAY_EXCLUDE_ICODES', xrayTagInputs.XRAY_EXCLUDE_ICODES)
                      }
                    }}
                    className="h-8 text-xs font-mono rounded-xl w-40"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddXrayTag('XRAY_EXCLUDE_ICODES', xrayTagInputs.XRAY_EXCLUDE_ICODES)}
                    className="h-8 text-xs rounded-xl px-3"
                  >
                    + เพิ่ม icode
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: NO AUTHEN CODE SETTING */}
      {/* ========================================================= */}
      {activeTab === 'no_authen' && (
        <div className="space-y-6">
          {/* Info Card */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3.5 text-emerald-900 text-sm">
            <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-950 mb-0.5">การยกเว้น Authen Code (No Authen Code)</p>
              <p className="text-emerald-800/90 leading-relaxed">
                รหัสสิทธิการรักษา (pttype) ที่อยู่ในรายการนี้ จะได้รับการ<strong>ยกเว้นไม่ต้องมี Authen Code</strong> โดยอัตโนมัติ 
                ระบบจะถือว่ามีเอกสารสิทธิ์ครบถ้วน ทั้งในหน้า<strong>อัปโหลดเอกสาร (Documents)</strong> และหน้า<strong>ตรวจสอบความครบถ้วน (Checklist & Audit)</strong> โดยไม่จำเป็นต้องอัปโหลดไฟล์
              </p>
            </div>
          </div>

          {/* Feedback Message */}
          {noAuthenMessage && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
                noAuthenMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {noAuthenMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{noAuthenMessage.text}</span>
              </div>
              <button
                onClick={() => setNoAuthenMessage(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold px-2 py-1"
              >
                ปิด
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Search & Add Pttype Card */}
            <div className="space-y-6 lg:col-span-1">
              <Card className="border-slate-200 shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-emerald-600" />
                    ค้นหาสิทธิการรักษา
                  </CardTitle>
                  <CardDescription>
                    ค้นหารหัสสิทธิจากตาราง pttype ในระบบ HOSxP ด้วยรหัสหรือชื่อสิทธิ
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <Input
                      placeholder="พิมพ์รหัสสิทธิ หรือชื่อ เช่น 78, จ่ายตรง..."
                      value={noAuthenSearchQuery}
                      onChange={(e) => setNoAuthenSearchQuery(e.target.value)}
                      className="pl-9 rounded-xl border-slate-200 focus-visible:ring-emerald-500"
                    />
                    {isSearchingNoAuthen && (
                      <RefreshCw className="w-4 h-4 absolute right-3 top-3 text-slate-400 animate-spin" />
                    )}
                  </div>

                  {/* Search Results Dropdown/List */}
                  {noAuthenSearchQuery.trim().length >= 1 && (
                    <div className="space-y-2 border border-slate-200 rounded-xl p-2 max-h-72 overflow-y-auto bg-slate-50/50">
                      {noAuthenSearchResults.length === 0 ? (
                        <p className="text-center text-xs text-slate-400 py-4">
                          {isSearchingNoAuthen ? 'กำลังค้นหา...' : 'ไม่พบสิทธิการรักษาที่ตรงกับคำค้นหา'}
                        </p>
                      ) : (
                        noAuthenSearchResults.map((pt) => {
                          const isAlreadyExempt = noAuthenPttypes.some((e) => String(e.pttype).trim() === String(pt.pttype).trim())
                          return (
                            <div
                              key={pt.pttype}
                              className="p-2.5 rounded-lg bg-white border border-slate-100 flex items-center justify-between gap-2 hover:border-emerald-200 transition-colors"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded text-xs font-semibold">
                                    {pt.pttype}
                                  </span>
                                  <p className="text-xs font-semibold text-slate-800 truncate" title={pt.name}>
                                    {pt.name}
                                  </p>
                                </div>
                                {pt.pcode && (
                                  <p className="text-[11px] text-slate-400 mt-0.5">หมวดสิทธิ (pcode): {pt.pcode}</p>
                                )}
                              </div>
                              <div>
                                {isAlreadyExempt ? (
                                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
                                    ยกเว้นแล้ว
                                  </span>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddNoAuthenPttype(pt)}
                                    disabled={savingNoAuthen}
                                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2.5 whitespace-nowrap"
                                  >
                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                    เพิ่ม
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}

                  <div className="text-xs text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                    💡 คำแนะนำ: พิมพ์รหัส เช่น <code>78</code> หรือพิมพ์ชื่อสิทธิการรักษา เช่น <code>ข้าราชการ</code>
                  </div>
                </CardContent>
              </Card>

              {/* Manual Add Card */}
              <Card className="border-slate-200 shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800">
                    <Plus className="w-4 h-4 text-slate-600" />
                    หรือระบุรหัสสิทธิโดยตรง
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">รหัสสิทธิ (pttype)</label>
                    <Input
                      placeholder="เช่น 78, 88..."
                      value={manualNoAuthenPttype}
                      onChange={(e) => setManualNoAuthenPttype(e.target.value)}
                      className="rounded-xl border-slate-200 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">ชื่อสิทธิการรักษา (ระบุหรือไม่ก็ได้)</label>
                    <Input
                      placeholder="ชื่อสิทธิ..."
                      value={manualNoAuthenName}
                      onChange={(e) => setManualNoAuthenName(e.target.value)}
                      className="rounded-xl border-slate-200 text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!manualNoAuthenPttype.trim()) return
                      handleAddNoAuthenPttype({
                        pttype: manualNoAuthenPttype.trim(),
                        name: manualNoAuthenName.trim() || undefined
                      })
                    }}
                    disabled={savingNoAuthen || !manualNoAuthenPttype.trim()}
                    className="w-full text-xs rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    + เพิ่มรหัสสิทธิที่ระบุ
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* List Table Card */}
            <Card className="border-slate-200 shadow-xs lg:col-span-2">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-emerald-600" />
                    รายการสิทธิที่ได้รับการยกเว้น Authen Code ({noAuthenPttypes.length} รายการ)
                  </CardTitle>
                  <CardDescription>
                    ผู้ป่วยที่มีสิทธิ์การรักษาตรงกับรายการนี้ จะถือว่าเอกสารสิทธิ์ครบถ้วนเสมอ
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchNoAuthenSettings}
                  disabled={loadingNoAuthen}
                  className="rounded-xl border-slate-200 text-xs text-slate-600"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingNoAuthen ? 'animate-spin' : ''}`} />
                  รีเฟรช
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase border-y border-slate-200">
                      <tr>
                        <th className="px-5 py-3.5 w-28">รหัส (pttype)</th>
                        <th className="px-4 py-3.5">ชื่อสิทธิการรักษา</th>
                        <th className="px-4 py-3.5">หมายเหตุ</th>
                        <th className="px-4 py-3.5">เพิ่มเมื่อ</th>
                        <th className="px-4 py-3.5 text-right w-20">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingNoAuthen ? (
                        <tr>
                          <td colSpan="5" className="text-center py-10 text-slate-400">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                            กำลังโหลดรายการสิทธิ...
                          </td>
                        </tr>
                      ) : noAuthenPttypes.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-10 text-slate-400">
                            ยังไม่มีรายการสิทธิที่ได้รับการยกเว้น
                          </td>
                        </tr>
                      ) : (
                        noAuthenPttypes.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-5 py-3.5">
                              <span className="font-mono font-bold text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded">
                                {item.pttype}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="font-medium text-slate-800">{item.name || '-'}</span>
                            </td>
                            <td className="px-4 py-3.5 text-xs text-slate-500">
                              {item.note || 'ยกเว้นการบังคับมี Authen Code'}
                            </td>
                            <td className="px-4 py-3.5 text-xs text-slate-500">
                              {item.created_at ? new Date(item.created_at).toLocaleDateString('th-TH', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              }) : '-'}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteNoAuthenPttype(item.id, item.pttype, item.name)}
                                disabled={savingNoAuthen}
                                className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                title="ลบออกจากรายการยกเว้น"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 6: SLOW QUERY LOG */}
      {/* ========================================================= */}
      {activeTab === 'slow_query' && (
        <SlowQueryTab />
      )}
    </div>
  )
}
