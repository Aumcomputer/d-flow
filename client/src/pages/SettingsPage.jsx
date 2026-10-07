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
  Info
} from 'lucide-react'

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
  }
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
  const [adminMessage, setAdminMessage] = useState(null) // { type: 'success' | 'error', text: '' }

  // Role Setting State
  const [roles, setRoles] = useState({}) // { [moduleKey]: string[] }
  const [initialRoles, setInitialRoles] = useState({})
  const [availableGroups, setAvailableGroups] = useState([])
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [savingModule, setSavingModule] = useState(null)
  const [isSavingAllRoles, setIsSavingAllRoles] = useState(false)
  const [roleMessage, setRoleMessage] = useState(null)
  const [groupFilterPerModule, setGroupFilterPerModule] = useState({})

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

  useEffect(() => {
    fetchAdmins()
    fetchRolesData()
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
    // Reset selector filter for that module
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

  // Check if roles have uncommitted changes
  const hasRoleChanges = useMemo(() => {
    return JSON.stringify(roles) !== JSON.stringify(initialRoles)
  }, [roles, initialRoles])

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
              <p className="text-slate-500 text-sm">จัดการสิทธิ์ผู้ดูแลระบบ กลุ่มงานที่เข้าถึงโมดูล และการตั้งค่ายา</p>
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
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 font-mono text-slate-600">
            {admins.length}
          </span>
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
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 font-mono text-slate-600">
            6 โมดูล
          </span>
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
          <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
            Phase ถัดไป
          </span>
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
              const filteredUnassigned = unassignedGroups.filter(g => 
                g.toLowerCase().includes(filterText.toLowerCase())
              )

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

                      {/* Quick nurse / doctor presets if applicable */}
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
      {/* TAB 3: DRUG SETTING (PHASE 2 PLACEHOLDER) */}
      {/* ========================================================= */}
      {activeTab === 'drugs' && (
        <div className="max-w-3xl mx-auto py-8">
          <Card className="border-slate-200 shadow-sm overflow-hidden text-center p-8 bg-gradient-to-b from-white to-slate-50/50">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-6 shadow-sm">
              <Pill className="w-10 h-10" />
            </div>

            <Badge variant="outline" className="bg-amber-100/80 text-amber-900 border-amber-300 font-medium px-3 py-1 mb-4 text-xs">
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
              อยู่ระหว่างการพัฒนา (Phase 2)
            </Badge>

            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              ระบบตั้งค่ายา (Drug Settings)
            </h2>
            <p className="text-slate-500 text-sm max-w-lg mx-auto mb-8 leading-relaxed">
              ฟังก์ชันนี้จะเปิดให้ใช้งานใน Phase ถัดไป สำหรับตั้งค่ากติกาการคืนยา รายการยาตรวจสอบพิเศษ 
              และนโยบายการกระจายยาของผู้ป่วยใน
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-xl mx-auto">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-start gap-3">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
                  <Pill className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">ตั้งค่าประเภทและรายการยาคืน</h4>
                  <p className="text-xs text-slate-500 mt-0.5">ระบุรายการยาที่ต้องส่งคืนห้องยาก่อน Discharge</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-start gap-3">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">กำหนดรอบเวลาการคืนยา</h4>
                  <p className="text-xs text-slate-500 mt-0.5">ตั้งรอบเวลาการตรวจสอบยาคืนของห้องยาในแต่ละวัน</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-start gap-3">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600 shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">นโยบายตรวจสอบยาเสพติด/ยาพิเศษ</h4>
                  <p className="text-xs text-slate-500 mt-0.5">กำหนดเงื่อนไขการตรวจสอบและลายมือชื่อเภสัชกร</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">เชื่อมโยงค่าใช้จ่ายยากับ HIS</h4>
                  <p className="text-xs text-slate-500 mt-0.5">ปรับยอดค่ายาอัตโนมัติเมื่อมีการรับคืนยาสำเร็จ</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
