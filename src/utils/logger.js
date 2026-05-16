const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
}

const DEFAULT_MODULE = 'APP'

const normalizeModuleName = (moduleName = DEFAULT_MODULE) =>
  String(moduleName).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')

const getLogLevelValue = (value) => LOG_LEVELS[String(value || '').toUpperCase()]

const resolveLogLevel = (moduleName = DEFAULT_MODULE) => {
  const moduleEnvKey = `VITE_LOG_LEVEL_${normalizeModuleName(moduleName)}`
  const moduleLevel = getLogLevelValue(import.meta.env[moduleEnvKey])
  if (moduleLevel !== undefined) {
    return moduleLevel
  }

  return getLogLevelValue(import.meta.env.VITE_LOG_LEVEL) ?? LOG_LEVELS.INFO
}

const serializeArg = (arg) => {
  if (arg instanceof Error) {
    return `${arg.message}${arg.stack ? '\n' + arg.stack : ''}`
  }
  if (typeof arg === 'object' && arg !== null) {
    try {
      return JSON.stringify(arg, null, 2)
    } catch {
      return String(arg)
    }
  }
  return String(arg)
}

const formatMessage = (level, message, ...args) => {
  const timestamp = new Date().toISOString()
  const argsStr = args.length ? args.map(serializeArg).join(' ') : ''
  return `[${timestamp}] [${level}] ${message}${argsStr ? ' ' + argsStr : ''}`
}

const buildLogger = (moduleName = DEFAULT_MODULE) => {
  const currentLogLevel = resolveLogLevel(moduleName)
  const moduleTag = moduleName || DEFAULT_MODULE

  return {
    error: (message, ...args) => {
      if (currentLogLevel >= LOG_LEVELS.ERROR) {
        console.error(formatMessage('ERROR', `[${moduleTag}] ${message}`, ...args))
      }
    },
    warn: (message, ...args) => {
      if (currentLogLevel >= LOG_LEVELS.WARN) {
        console.warn(formatMessage('WARN', `[${moduleTag}] ${message}`, ...args))
      }
    },
    info: (message, ...args) => {
      if (currentLogLevel >= LOG_LEVELS.INFO) {
        console.log(formatMessage('INFO', `[${moduleTag}] ${message}`, ...args))
      }
    },
    debug: (message, ...args) => {
      if (currentLogLevel >= LOG_LEVELS.DEBUG) {
        console.log(formatMessage('DEBUG', `[${moduleTag}] ${message}`, ...args))
      }
    }
  }
}

export const createLogger = (moduleName) => buildLogger(moduleName)
export const logger = buildLogger(DEFAULT_MODULE)
