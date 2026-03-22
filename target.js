const os = require('os')
const path = require('path')
const axios = require('axios')
const { DEFAULT_PORT, resolveHttpBaseUrl } = require('./endpoint')

const IPV4_HOST_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/
const PINOKIO_REF_PROTOCOL = 'pinokio:'

const isHttpUri = (value) => typeof value === 'string' && /^https?:\/\//i.test(value)
const isPinokioRef = (value) => typeof value === 'string' && value.trim().toLowerCase().startsWith('pinokio://')
const isLoopbackHost = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1' || normalized === '[::1]'
}

const parsePinokioRef = (value = '') => {
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: 'Invalid ref'
    }
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return {
      valid: false,
      error: 'Missing ref'
    }
  }
  let parsed
  try {
    parsed = new URL(trimmed)
  } catch (_) {
    return {
      valid: false,
      error: 'Invalid ref'
    }
  }
  if (parsed.protocol !== PINOKIO_REF_PROTOCOL) {
    return {
      valid: false,
      error: 'Invalid ref protocol'
    }
  }
  const host = typeof parsed.hostname === 'string' ? parsed.hostname.trim() : ''
  const port = Number.parseInt(String(parsed.port || ''), 10)
  const pathSegments = String(parsed.pathname || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch (_) {
        return segment
      }
    })
  const scope = pathSegments.length > 0 ? pathSegments[0] : ''
  const id = pathSegments.length > 1 ? pathSegments.slice(1).join('/') : ''
  if (!host || !Number.isFinite(port) || port <= 0 || !scope || !id) {
    return {
      valid: false,
      error: 'Invalid ref'
    }
  }
  return {
    valid: true,
    ref: trimmed,
    host,
    port,
    scope,
    id
  }
}

const buildPinokioRef = ({ host, port, scope, id }) => {
  const normalizedHost = typeof host === 'string' ? host.trim() : ''
  const normalizedScope = typeof scope === 'string' ? scope.trim() : ''
  const normalizedId = typeof id === 'string' ? id.trim() : ''
  const normalizedPort = Number.parseInt(String(port || ''), 10)
  if (!normalizedHost || !normalizedScope || !normalizedId || !Number.isFinite(normalizedPort) || normalizedPort <= 0) {
    return null
  }
  const encodedPath = [normalizedScope, ...normalizedId.split('/').filter(Boolean)]
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `pinokio://${normalizedHost}:${normalizedPort}/${encodedPath}`
}

const parseQualifiedAppId = (value = '') => {
  if (typeof value !== 'string') {
    return {
      appId: '',
      host: null,
      qualified: false
    }
  }
  const trimmed = value.trim()
  const atIndex = trimmed.lastIndexOf('@')
  if (atIndex <= 0 || atIndex >= trimmed.length - 1) {
    return {
      appId: trimmed,
      host: null,
      qualified: false
    }
  }
  const appId = trimmed.slice(0, atIndex).trim()
  const host = trimmed.slice(atIndex + 1).trim()
  if (!appId || !IPV4_HOST_PATTERN.test(host)) {
    return {
      appId: trimmed,
      host: null,
      qualified: false
    }
  }
  return {
    appId,
    host,
    qualified: true
  }
}

const buildControlPlane = (host, port = DEFAULT_PORT) => ({
  protocol: 'http',
  host,
  port
})

const buildPeerControlPlane = (host) => buildControlPlane(host, DEFAULT_PORT)

const isDirectScriptTarget = (value) => {
  if (typeof value !== 'string') {
    return false
  }
  return isHttpUri(value) || value.startsWith('~/') || path.isAbsolute(value)
}

const looksLikeRelativeScriptTarget = (value) => {
  if (typeof value !== 'string') {
    return false
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }
  if (trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return true
  }
  const queryIndex = trimmed.indexOf('?')
  const scriptPath = queryIndex >= 0 ? trimmed.slice(0, queryIndex) : trimmed
  if (!scriptPath) {
    return false
  }
  if (scriptPath.includes('/') || scriptPath.includes('\\')) {
    return true
  }
  const extension = path.extname(scriptPath).toLowerCase()
  return ['.js', '.json', '.mjs', '.cjs'].includes(extension)
}

const appendQuery = (targetPath, queryString) => {
  if (!queryString) {
    return targetPath
  }
  return `${targetPath}?${queryString}`
}

const expandHomeTarget = async (target, controlPlane = null) => {
  if (typeof target !== 'string' || !target.startsWith('~/')) {
    return target
  }
  if (controlPlane) {
    throw new Error("remote ~/ paths are not supported; use a relative script path with --ref or an absolute remote path")
  }
  const queryIndex = target.indexOf('?')
  const scriptPath = queryIndex >= 0 ? target.slice(0, queryIndex) : target
  const queryString = queryIndex >= 0 ? target.slice(queryIndex + 1) : ''
  return appendQuery(path.resolve(os.homedir(), scriptPath.slice(2)), queryString)
}

const fetchApiResourceStatus = async (parsedRef, options = {}) => {
  if (!parsedRef || !parsedRef.valid) {
    throw new Error('Invalid ref')
  }
  if (parsedRef.scope !== 'api') {
    throw new Error(`Unsupported ref scope: ${parsedRef.scope}`)
  }
  const controlPlane = buildControlPlane(parsedRef.host, parsedRef.port)
  const baseUrl = await resolveHttpBaseUrl(controlPlane)
  const params = {}
  if (typeof options.probe !== 'undefined') {
    params.probe = options.probe
  }
  if (typeof options.timeout !== 'undefined' && options.timeout !== null) {
    params.timeout = String(options.timeout)
  }
  const response = await axios.get(`${baseUrl}/pinokio/resource/status`, {
    params: {
      ref: buildPinokioRef(parsedRef),
      ...params
    }
  })
  const status = response && response.data ? response.data : {}
  const appPath = typeof status.path === 'string' ? status.path.trim() : ''
  if (!appPath) {
    throw new Error(`resource path unavailable: ${parsedRef.ref || buildPinokioRef(parsedRef)}`)
  }
  return {
    appPath,
    status,
    controlPlane,
    remote: !isLoopbackHost(parsedRef.host),
    appId: parsedRef.id,
    host: parsedRef.host,
    port: parsedRef.port,
    ref: buildPinokioRef(parsedRef)
  }
}

const resolveAppStatusContext = async (appRef) => {
  if (isPinokioRef(appRef)) {
    const parsedRef = parsePinokioRef(appRef)
    if (!parsedRef.valid) {
      throw new Error(parsedRef.error || 'Invalid ref')
    }
    return fetchApiResourceStatus(parsedRef)
  }
  const parsedAppId = parseQualifiedAppId(appRef)
  const controlPlane = parsedAppId.qualified ? buildPeerControlPlane(parsedAppId.host) : null
  const baseUrl = await resolveHttpBaseUrl(controlPlane)
  const statusAppId = parsedAppId.qualified ? parsedAppId.appId : appRef
  const response = await axios.get(`${baseUrl}/apps/status/${encodeURIComponent(statusAppId)}`)
  const status = response && response.data ? response.data : {}
  const appPath = typeof status.path === 'string' ? status.path.trim() : ''
  if (!appPath) {
    throw new Error(`app path unavailable: ${appRef}`)
  }
  return {
    appPath,
    status,
    controlPlane,
    remote: Boolean(parsedAppId.qualified),
    appId: parsedAppId.qualified ? parsedAppId.appId : appRef,
    host: parsedAppId.qualified ? parsedAppId.host : null
  }
}

const resolveAppControlTarget = async (rawUri) => {
  if (isHttpUri(rawUri)) {
    return {
      uri: rawUri,
      controlPlane: null,
      remote: false
    }
  }
  if (isPinokioRef(rawUri)) {
    const parsedRef = parsePinokioRef(rawUri)
    if (!parsedRef.valid) {
      throw new Error(parsedRef.error || 'Invalid ref')
    }
    const context = await fetchApiResourceStatus(parsedRef)
    return {
      uri: context.appPath,
      controlPlane: context.controlPlane,
      remote: context.remote,
      appId: context.appId,
      host: context.host,
      port: context.port,
      ref: context.ref
    }
  }
  const parsedAppId = parseQualifiedAppId(rawUri)
  if (!parsedAppId.qualified) {
    return {
      uri: path.resolve(process.cwd(), rawUri),
      controlPlane: null,
      remote: false
    }
  }
  const controlPlane = buildPeerControlPlane(parsedAppId.host)
  const baseUrl = await resolveHttpBaseUrl(controlPlane)
  const response = await axios.get(`${baseUrl}/apps/status/${encodeURIComponent(parsedAppId.appId)}`)
  const remotePath = response && response.data && typeof response.data.path === 'string'
    ? response.data.path.trim()
    : ''
  if (!remotePath) {
    throw new Error(`remote app path unavailable: ${parsedAppId.appId}@${parsedAppId.host}`)
  }
  return {
    uri: remotePath,
    controlPlane,
    remote: true,
    appId: parsedAppId.appId,
    host: parsedAppId.host
  }
}

const resolveStartTarget = async (rawUri, appRef = '') => {
  const target = typeof rawUri === 'string' ? rawUri.trim() : ''
  if (!target) {
    return {
      uri: rawUri,
      controlPlane: null,
      remote: false
    }
  }
  if (!appRef || !String(appRef).trim()) {
    return {
      uri: rawUri,
      controlPlane: null,
      remote: false
    }
  }
  const context = await resolveAppStatusContext(String(appRef).trim())
  if (isDirectScriptTarget(target)) {
    const directUri = target.startsWith('~/')
      ? await expandHomeTarget(target, context.controlPlane)
      : rawUri
    return {
      uri: directUri,
      controlPlane: context.controlPlane,
      remote: context.remote,
      appId: context.appId,
      host: context.host
    }
  }
  const queryIndex = target.indexOf('?')
  const scriptPath = queryIndex >= 0 ? target.slice(0, queryIndex) : target
  const queryString = queryIndex >= 0 ? target.slice(queryIndex + 1) : ''
  return {
    uri: appendQuery(path.resolve(context.appPath, scriptPath), queryString),
    controlPlane: context.controlPlane,
    remote: context.remote,
    appId: context.appId,
    host: context.host
  }
}

const resolveStopControlTarget = async (rawUri) => {
  const target = typeof rawUri === 'string' ? rawUri.trim() : ''
  if (isPinokioRef(target)) {
    const parsedRef = parsePinokioRef(target)
    if (!parsedRef.valid) {
      throw new Error(parsedRef.error || 'Invalid ref')
    }
    const context = await fetchApiResourceStatus(parsedRef)
    const runningScripts = Array.isArray(context.status.running_scripts)
      ? context.status.running_scripts.filter((script) => typeof script === 'string' && script.trim())
      : []
    return {
      uris: runningScripts.map((script) => path.resolve(context.appPath, script)),
      controlPlane: context.controlPlane,
      remote: context.remote,
      appId: context.appId,
      host: context.host,
      port: context.port,
      ref: context.ref
    }
  }
  if (isDirectScriptTarget(target) || looksLikeRelativeScriptTarget(target)) {
    if (isHttpUri(rawUri)) {
      return {
        uris: [rawUri],
        controlPlane: null,
        remote: false
      }
    }
    const directUri = target.startsWith('~/')
      ? await expandHomeTarget(target)
      : path.resolve(process.cwd(), target)
    return {
      uris: [directUri],
      controlPlane: null,
      remote: false
    }
  }
  const parsedAppId = parseQualifiedAppId(target)
  const controlPlane = parsedAppId.qualified ? buildPeerControlPlane(parsedAppId.host) : null
  const baseUrl = await resolveHttpBaseUrl(controlPlane)
  const statusAppId = parsedAppId.qualified ? parsedAppId.appId : target
  const response = await axios.get(`${baseUrl}/apps/status/${encodeURIComponent(statusAppId)}`)
  const status = response && response.data ? response.data : {}
  const appPath = typeof status.path === 'string' ? status.path.trim() : ''
  const runningScripts = Array.isArray(status.running_scripts)
    ? status.running_scripts.filter((script) => typeof script === 'string' && script.trim())
    : []
  return {
    uris: appPath
      ? runningScripts.map((script) => path.resolve(appPath, script))
      : [],
    controlPlane,
    remote: Boolean(parsedAppId.qualified),
    appId: parsedAppId.qualified ? parsedAppId.appId : rawUri,
    host: parsedAppId.qualified ? parsedAppId.host : null
  }
}

const resolveStopTarget = async (rawUri, appRef = '') => {
  const target = typeof rawUri === 'string' ? rawUri.trim() : ''
  if (!target || !appRef || !String(appRef).trim()) {
    return resolveStopControlTarget(rawUri)
  }
  const context = await resolveAppStatusContext(String(appRef).trim())
  if (isDirectScriptTarget(target)) {
    const directUri = target.startsWith('~/')
      ? await expandHomeTarget(target, context.controlPlane)
      : target
    return {
      uris: [directUri],
      controlPlane: context.controlPlane,
      remote: context.remote,
      appId: context.appId,
      host: context.host
    }
  }
  const queryIndex = target.indexOf('?')
  const scriptPath = queryIndex >= 0 ? target.slice(0, queryIndex) : target
  const queryString = queryIndex >= 0 ? target.slice(queryIndex + 1) : ''
  return {
    uris: [appendQuery(path.resolve(context.appPath, scriptPath), queryString)],
    controlPlane: context.controlPlane,
    remote: context.remote,
    appId: context.appId,
    host: context.host
  }
}

module.exports = {
  isHttpUri,
  isPinokioRef,
  parsePinokioRef,
  buildPinokioRef,
  parseQualifiedAppId,
  resolveAppControlTarget,
  resolveStartTarget,
  resolveStopTarget,
  resolveStopControlTarget,
}
