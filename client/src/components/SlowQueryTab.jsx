import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import {
  Activity,
  Database,
  Clock,
  Search,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sliders,
  Filter,
  Flame,
  Zap,
  Timer
} from 'lucide-react'

export default function SlowQueryTab() {
  // Config state
  const [config, setConfig] = useState({ enabled: true, threshold_ms: 1000 })
  const [thresholdInput, setThresholdInput] = useState('1000')
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [configSuccessMsg, setConfigSuccessMsg] = useState('')

  // Logs state
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState({ total_logs: 0, max_duration: 0, avg_duration: 0, pool_counts: {} })
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [clearingLogs, setClearingLogs] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Filter state
  const [selectedPool, setSelectedPool] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // UI state
  const [copiedId, setCopiedId] = useState(null)
  const [expandedIds, setExpandedIds] = useState(new Set())

  // Fetch Config
  const fetchConfig = useCallback(async () => {
    try {
      setLoadingConfig(true)
      const res = await api.get('/settings/slow-query/config')
      if (res.data) {
        setConfig(res.data)
        setThresholdInput(String(res.data.threshold_ms || 1000))
      }
    } catch (err) {
      console.error('Fetch slow query config error:', err)
    } finally {
      setLoadingConfig(false)
    }
  }, [])

  // Fetch Logs
  const fetchLogs = useCallback(async () => {
    try {
      setLoadingLogs(true)
      const params = {
        page,
        limit: 25,
        pool: selectedPool !== 'all' ? selectedPool : undefined,
        search: searchTerm || undefined
      }
      const res = await api.get('/settings/slow-query/logs', { params })
      if (res.data) {
        setLogs(res.data.logs || [])
        setStats(res.data.stats || { total_logs: 0, max_duration: 0, avg_duration: 0, pool_counts: {} })
        setTotalPages(res.data.pagination?.totalPages || 1)
        setTotalCount(res.data.pagination?.total || 0)
      }
    } catch (err) {
      console.error('Fetch slow query logs error:', err)
    } finally {
      setLoadingLogs(false)
    }
  }, [page, selectedPool, searchTerm])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Handle Save Config
  const handleSaveConfig = async (newEnabled = config.enabled) => {
    const val = parseInt(thresholdInput, 10)
    if (isNaN(val) || val < 10) {
      alert('กรุณากรอกเกณฑ์เวลาขั้นต่ำอย่างน้อย 10 มิลลิวินาที (ms)')
      return
    }

    try {
      setSavingConfig(true)
      const res = await api.put('/settings/slow-query/config', {
        enabled: newEnabled,
        threshold_ms: val
      })
      if (res.data?.config) {
        setConfig(res.data.config)
        setConfigSuccessMsg('บันทึกการตั้งค่าสำเร็จ')
        setTimeout(() => setConfigSuccessMsg(''), 3000)
      }
    } catch (err) {
      console.error('Update slow query config error:', err)
      alert('เกิดข้อผิดพลาดในการบันทึกการตั้งค่า')
    } finally {
      setSavingConfig(false)
    }
  }

  // Toggle Enabled
  const handleToggleEnabled = () => {
    const nextState = !config.enabled
    setConfig(prev => ({ ...prev, enabled: nextState }))
    handleSaveConfig(nextState)
  }

  // Clear Logs
  const handleClearLogs = async () => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการล้างประวัติ Slow Query ทั้งหมดใน Redis?')) return
    try {
      setClearingLogs(true)
      await api.delete('/settings/slow-query/logs')
      setLogs([])
      setStats({ total_logs: 0, max_duration: 0, avg_duration: 0, pool_counts: {} })
      setTotalCount(0)
      setTotalPages(1)
      setPage(1)
    } catch (err) {
      console.error('Clear logs error:', err)
      alert('เกิดข้อผิดพลาดในการล้างประวัติ')
    } finally {
      setClearingLogs(false)
    }
  }

  // Copy SQL to Clipboard
  const handleCopySql = (id, sql) => {
    navigator.clipboard.writeText(sql)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Toggle SQL Expand
  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Helper Badge Color for Duration
  const getDurationBadge = (ms) => {
    if (ms >= 5000) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
          <Flame className="w-3.5 h-3.5 text-rose-600" />
          {(ms / 1000).toFixed(2)} วินาที ({ms.toLocaleString()} ms)
        </span>
      )
    }
    if (ms >= 2000) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          {(ms / 1000).toFixed(2)} วินาที ({ms.toLocaleString()} ms)
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
        <Timer className="w-3.5 h-3.5 text-yellow-600" />
        {ms.toLocaleString()} ms
      </span>
    )
  }

  // Helper Badge Color for Database Pool
  const getPoolBadge = (pool) => {
    switch (pool) {
      case 'his':
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-mono text-[11px]">HIS (HOSxP)</Badge>
      case 'his-write':
        return <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-[11px]">HIS Write</Badge>
      case 'd-flow':
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-[11px]">D-Flow DB</Badge>
      case 'smartor':
        return <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-mono text-[11px]">SmartOR</Badge>
      case 'teamcom3':
        return <Badge className="bg-slate-600 hover:bg-slate-700 text-white font-mono text-[11px]">Teamcom3</Badge>
      default:
        return <Badge variant="outline" className="font-mono text-[11px]">{pool}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Card: Control Panel & Status */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-rose-50 via-slate-50 to-white pb-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl shadow-xs">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2.5">
                  Slow Query Logger
                  <Badge
                    variant={config.enabled ? 'default' : 'secondary'}
                    className={config.enabled ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-slate-400'}
                  >
                    {config.enabled ? 'กำลังบันทึก (Active)' : 'ปิดใช้งาน (Disabled)'}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-slate-500 text-xs mt-0.5">
                  ตรวจจับคำสั่ง SQL ที่ใช้เวลาประมวลผลนานและบันทึกลง Redis อัตโนมัติ (อายุข้อมูล 72 ชั่วโมง)
                </CardDescription>
              </div>
            </div>

            {/* Quick Switch Button */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleEnabled}
                disabled={loadingConfig || savingConfig}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  config.enabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    config.enabled ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-slate-700">
                {config.enabled ? 'เปิดบันทึก' : 'ปิดบันทึก'}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Threshold Input */}
            <div className="md:col-span-5 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                เกณฑ์เวลาที่จะบันทึกเป็น Slow Query (มิลลิวินาที / ms)
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min="10"
                  step="50"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  placeholder="เช่น 1000"
                  className="font-mono text-sm pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                  ms
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                ค่าแนะนำ: 1,000 ms (1 วินาที) หรือ 500 ms สำหรับการตรวจสอบความเร็วอย่างละเอียด
              </p>
            </div>

            {/* Action Buttons */}
            <div className="md:col-span-7 flex flex-wrap items-center gap-2 sm:justify-end">
              {configSuccessMsg && (
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 mr-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {configSuccessMsg}
                </span>
              )}
              <Button
                onClick={() => handleSaveConfig(config.enabled)}
                disabled={savingConfig}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9"
              >
                {savingConfig ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                )}
                บันทึกการตั้งค่า
              </Button>

              <Button
                variant="outline"
                onClick={fetchLogs}
                disabled={loadingLogs}
                className="text-xs h-9 border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                รีเฟรช Log
              </Button>

              <Button
                variant="outline"
                onClick={handleClearLogs}
                disabled={clearingLogs || totalCount === 0}
                className="text-xs h-9 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                ล้างประวัติ (Redis)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Stats Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">รายการทั้งหมด</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800">
            {stats.total_logs.toLocaleString()} <span className="text-xs font-normal text-slate-400">รายการ</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">เกณฑ์ {config.threshold_ms}ms (TTL 72 ชม.)</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">เวลาช้าที่สุด</span>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600">
            {stats.max_duration ? (stats.max_duration >= 1000 ? (stats.max_duration / 1000).toFixed(2) + ' s' : stats.max_duration + ' ms') : '0 s'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {stats.max_duration ? `${stats.max_duration.toLocaleString()} ms` : 'ไม่พบรายการช้า'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">เวลาเฉลี่ย</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {stats.avg_duration ? (stats.avg_duration >= 1000 ? (stats.avg_duration / 1000).toFixed(2) + ' s' : stats.avg_duration + ' ms') : '0 ms'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">เฉลี่ยของ Slow Queries ทั้งหมด</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">แยกตามฐานข้อมูล</span>
            <Database className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xs space-y-1 text-slate-600 font-mono mt-1">
            <div className="flex justify-between">
              <span>HIS:</span>
              <span className="font-semibold text-blue-600">{stats.pool_counts?.his || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>D-Flow:</span>
              <span className="font-semibold text-emerald-600">{stats.pool_counts?.['d-flow'] || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>SmartOR:</span>
              <span className="font-semibold text-purple-600">{stats.pool_counts?.smartor || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        {/* Pool Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => { setSelectedPool('all'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedPool === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            ทั้งหมด ({stats.total_logs || 0})
          </button>
          <button
            onClick={() => { setSelectedPool('his'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedPool === 'his'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            HIS ({stats.pool_counts?.his || 0})
          </button>
          <button
            onClick={() => { setSelectedPool('d-flow'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedPool === 'd-flow'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            D-Flow ({stats.pool_counts?.['d-flow'] || 0})
          </button>
          <button
            onClick={() => { setSelectedPool('smartor'); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedPool === 'smartor'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            SmartOR ({stats.pool_counts?.smartor || 0})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearchTerm(searchInput)
                setPage(1)
              }
            }}
            placeholder="ค้นหาข้อความ SQL... (กด Enter)"
            className="text-xs pl-8 pr-16 h-8"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('')
                setSearchTerm('')
                setPage(1)
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600"
            >
              ล้าง
            </button>
          )}
        </div>
      </div>

      {/* 4. Logs List */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-3.5 px-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">รายการคิวรีที่ช้า</span>
            <span className="text-xs text-slate-400">
              (พบ {totalCount.toLocaleString()} รายการ
              {selectedPool !== 'all' ? ` ในฐานข้อมูล ${selectedPool}` : ''}
              {searchTerm ? ` ค้นหา "${searchTerm}"` : ''})
            </span>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || loadingLogs}
                className="h-7 px-2 text-xs"
              >
                ก่อนหน้า
              </Button>
              <span className="text-slate-500">
                หน้า {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loadingLogs}
                className="h-7 px-2 text-xs"
              >
                ถัดไป
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {loadingLogs ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
              <p className="text-xs">กำลังโหลดข้อมูล Slow Query จาก Redis...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">ไม่พบคำสั่ง Slow Query</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {searchTerm
                  ? `ไม่พบคำสั่งที่ตรงกับคำค้นหา "${searchTerm}"`
                  : `ไม่มีคำสั่ง SQL ที่ใช้เวลาเกิน ${config.threshold_ms}ms บันทึกใน Redis ในช่วง 72 ชั่วโมงที่ผ่านมา`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map((log) => {
                const isExpanded = expandedIds.has(log.id)
                const isCopied = copiedId === log.id
                const dateStr = log.timestamp
                  ? new Date(log.timestamp).toLocaleString('th-TH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })
                  : '-'

                return (
                  <div
                    key={log.id}
                    className="p-4 hover:bg-slate-50/60 transition-colors space-y-2.5"
                  >
                    {/* Header Row: Pool, Duration, Rows, Date */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {getPoolBadge(log.pool)}
                        {getDurationBadge(log.duration_ms)}
                        {log.rows !== null && log.rows !== undefined && (
                          <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            {log.rows.toLocaleString()} แถว
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>{dateStr}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopySql(log.id, log.sql)}
                          className="h-7 px-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 text-xs"
                          title="คัดลอก SQL"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600 mr-1" />
                              <span className="text-emerald-600 font-medium">คัดลอกแล้ว</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 mr-1" />
                              คัดลอก
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* SQL Statement Box */}
                    <div className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-900 text-slate-100">
                      <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all leading-relaxed overflow-x-auto max-h-96">
                        {isExpanded ? log.sql : (log.sql.length > 250 ? log.sql.slice(0, 250) + '...' : log.sql)}
                      </pre>

                      {log.sql.length > 250 && (
                        <button
                          onClick={() => toggleExpand(log.id)}
                          className="w-full py-1.5 px-3 bg-slate-800/90 hover:bg-slate-800 text-[11px] text-blue-400 font-medium flex items-center justify-center gap-1 border-t border-slate-700/60 transition-colors"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              ย่อแสดง
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              ดูคำสั่ง SQL ฉบับเต็ม (ทั้งหมด {log.sql.length} ตัวอักษร)
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Parameters if available */}
                    {log.values && (
                      <div className="text-[11px] text-slate-500 font-mono bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-200/60 break-all">
                        <span className="font-semibold text-slate-600">Parameters:</span>{' '}
                        {JSON.stringify(log.values)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
