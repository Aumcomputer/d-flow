const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let cachedVersion = null;
let lastCheckTime = 0;
const CACHE_TTL_MS = 5000; // 5 seconds cache

function resolveVersion() {
  const rootDir = path.resolve(__dirname, '..', '..');
  
  // 1. Try reading root version.json
  const versionFile = path.join(rootDir, 'version.json');
  try {
    if (fs.existsSync(versionFile)) {
      const data = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
      if (data && data.version) {
        return data.version;
      }
    }
  } catch (err) {
    // Ignore and fallback
  }

  // 2. Try git rev-list
  try {
    const count = execSync('git rev-list --count HEAD', { cwd: rootDir }).toString().trim();
    if (count) {
      return `1.0.${count}`;
    }
  } catch (err) {
    // Ignore and fallback
  }

  // 3. Fallback to package.json
  try {
    const pkg = require('../package.json');
    if (pkg && pkg.version) {
      return pkg.version;
    }
  } catch (err) {
    // Ignore
  }

  return '1.0.0';
}

function getAppVersion() {
  const now = Date.now();
  if (!cachedVersion || (now - lastCheckTime > CACHE_TTL_MS)) {
    cachedVersion = resolveVersion();
    lastCheckTime = now;
  }
  return cachedVersion;
}

module.exports = { getAppVersion };
