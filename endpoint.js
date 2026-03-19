const fs = require('fs')
const os = require('os')
const path = require('path')
const axios = require('axios')

const DEFAULT_PROTOCOL = 'http'
const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 42000
const DEFAULT_BASE_URL = `${DEFAULT_PROTOCOL}://${DEFAULT_HOST}:${DEFAULT_PORT}`
const CONFIG_PATH = path.resolve(os.homedir(), '.pinokio', 'config.json')

let resolvedHttpBaseUrlPromise = null

function formatHostForUrl(host) {
  if (!host) {
    return ''
  }
  const normalized = String(host).trim().replace(/^\[|\]$/g, '')
  if (!normalized) {
    return ''
  }
  return normalized.includes(':') ? `[${normalized}]` : normalized
}

function normalizeBaseUrl(value) {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return `${url.protocol}//${url.host}`
  } catch (error) {
    return null
  }
}

function readStoredAccessBaseUrl() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    const access = parsed && parsed.access
    if (!access) {
      return null
    }
    if (typeof access === 'string') {
      const value = access.trim()
      if (!value) {
        return null
      }
      if (/^https?:\/\//i.test(value)) {
        return normalizeBaseUrl(value)
      }
      if (/^\[.*\](?::\d+)?$/.test(value) || /:\d+$/.test(value)) {
        return normalizeBaseUrl(`${DEFAULT_PROTOCOL}://${value}`)
      }
      return normalizeBaseUrl(`${DEFAULT_PROTOCOL}://${formatHostForUrl(value)}:${DEFAULT_PORT}`)
    }
    if (typeof access !== 'object') {
      return null
    }
    const protocol = access.protocol === 'https' ? 'https' : DEFAULT_PROTOCOL
    const host = formatHostForUrl(access.host)
    if (!host) {
      return null
    }
    const rawPort = Number.parseInt(String(access.port), 10)
    const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : DEFAULT_PORT
    return normalizeBaseUrl(`${protocol}://${host}:${port}`)
  } catch (error) {
    return null
  }
}

async function canReachControlPlane(baseUrl) {
  try {
    await axios.get(`${baseUrl}/pinokio/version`, {
      timeout: 1000,
      headers: {
        'x-pinokio-client': 'pterm'
      },
      validateStatus: () => true
    })
    return true
  } catch (error) {
    return false
  }
}

async function resolveHttpBaseUrl() {
  if (!resolvedHttpBaseUrlPromise) {
    resolvedHttpBaseUrlPromise = (async () => {
      if (await canReachControlPlane(DEFAULT_BASE_URL)) {
        return DEFAULT_BASE_URL
      }
      return readStoredAccessBaseUrl() || DEFAULT_BASE_URL
    })()
  }
  try {
    return await resolvedHttpBaseUrlPromise
  } catch (error) {
    resolvedHttpBaseUrlPromise = null
    throw error
  }
}

async function resolveWsBaseUrl() {
  const httpBaseUrl = await resolveHttpBaseUrl()
  const normalized = normalizeBaseUrl(httpBaseUrl)
  if (!normalized) {
    return `ws://${DEFAULT_HOST}:${DEFAULT_PORT}`
  }
  const url = new URL(normalized)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${url.protocol}//${url.host}`
}

module.exports = {
  DEFAULT_BASE_URL,
  readStoredAccessBaseUrl,
  resolveHttpBaseUrl,
  resolveWsBaseUrl,
}
