import versionData from '../version.json'

export const APP_VERSION = versionData.version || '1.0.0'

let hasNewVersion = false
let latestServerVersion = null
const listeners = new Set()

export function checkServerVersion(serverVersion) {
  if (!serverVersion) return

  // Compare versions (e.g. "1.0.56" !== "1.0.55")
  if (serverVersion !== APP_VERSION) {
    if (!hasNewVersion) {
      hasNewVersion = true
      latestServerVersion = serverVersion
      console.log(`[VersionCheck] New version detected: ${serverVersion} (current: ${APP_VERSION})`)
      notifyListeners()
    }
  }
}

export function getVersionStatus() {
  return {
    currentVersion: APP_VERSION,
    hasNewVersion,
    latestServerVersion
  }
}

export function subscribeVersion(listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notifyListeners() {
  const status = getVersionStatus()
  listeners.forEach(cb => {
    try {
      cb(status)
    } catch (err) {
      console.error('[VersionCheck] Listener error:', err)
    }
  })
}

export function performReload() {
  console.log('[VersionCheck] Reloading to update app...')
  // Reload without browser cache
  window.location.reload(true)
}
