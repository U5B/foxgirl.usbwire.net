import fs from 'fs'
import util from 'util'
import Debug from 'debug'
import chalk from 'chalk'

const logFolderPath = './logs'
if (!fs.existsSync(logFolderPath)) fs.mkdirSync(logFolderPath)
let currentDay = new Date().toLocaleDateString().replace(/\//g, '_')
const errorPath = {
  prefix: `${logFolderPath}/error_`,
  suffix: '.log'
}
const logPath = {
  prefix: `${logFolderPath}/log_`,
  suffix: '.log'
}
const debugPath = {
  prefix: `${logFolderPath}/debug_`,
  suffix: '.log'
}
let file = fs.createWriteStream(`${logPath.prefix}${currentDay}${logPath.suffix}`, { flags: 'a' })
let fileError = fs.createWriteStream(`${errorPath.prefix}${currentDay}${errorPath.suffix}`, { flags: 'a' })
let fileDebug = fs.createWriteStream(`${debugPath.prefix}${currentDay}${debugPath.suffix}`, { flags: 'a' })

const debug = {
  chat: Debug('chat'),
  log: Debug('log'),
  info: Debug('info'),
  debug: Debug('debug'),
  verbose: Debug('verbose'),
  error: Debug('error'),
  warn: Debug('warn')
}
const errors = chalk.bold.red
const warns = chalk.bold.yellow
debug.chat.color = 10
debug.log.color = 4
debug.info.color = 240
debug.verbose.color = 240
debug.debug.color = 240

debug.error.color = 196
debug.warn.color = 226

async function createWritestream (file, string) {
  return new Promise((resolve, reject) => {
    file = fs.createWriteStream(string, { flags: 'a' })
    file.once('ready', () => { resolve(file) })
  })
}
async function removeWritestream (file) {
  return new Promise((resolve, reject) => {
    file.once('close', () => { resolve(null) })
    file.close()
  })
}

async function generateStream (input, path, time) {
  if (input) input = await removeWritestream(input)
  input = await createWritestream(input, `${path.prefix}${time}${path.suffix}`)
  return input
}

async function getContent (input) {
  const date = new Date()
  const time = date.toLocaleString('en-US')
  const logDay = date.toLocaleDateString().replace(/\//g, '_')
  if (currentDay !== logDay) {
    currentDay = logDay
    file = await generateStream(file, logPath, currentDay)
    fileError = await generateStream(fileError, errorPath, currentDay)
    fileDebug = await generateStream(fileDebug, debugPath, currentDay)
  }

  let output
  if (typeof input === 'object') {
    output = `[${time}] ${util.inspect(input, { depth: null })}`
  } else {
    output = `[${time}] ${input}`
  }

  return output
}

async function logToFile (input, type) {
  const fileMessage = `${input}\n`
  // Write to file
  switch (type) {
    case 'error': {
      fileError.write(fileMessage)
      break
    }
    case 'debug': {
      fileDebug.write(fileMessage)
      break
    }
    default: {
      file.write(fileMessage)
      break
    }
  }
}

async function addColor (input, type) {
  // Color Formatting
  switch (type) {
    case 'error': {
      input = errors(input)
      break
    }
    case 'warn': {
      input = warns(input)
      break
    }
  }
  return input
}

const log = {}
log.log = async function (input) {
  const output = await getContent(input)
  debug.log(output)
}
log.log = async function (input) {
  const output = await getContent(input)
  await logToFile(output, 'info')
  debug.info(output)
}
log.verbose = async function (input) {
  const output = await getContent(input)
  debug.verbose(output)
}
log.debug = async function (input) {
  const output = await getContent(input)
  await logToFile(output, 'debug')
  debug.debug(output)
}
log.warn = async function (input) {
  let output = await getContent(input)
  await logToFile(output, 'error')
  output = await addColor(output, 'warn')
  debug.warn(output)
}
log.error = async function (input) {
  let output = await getContent(input)
  await logToFile(output, 'error')
  output = await addColor(output, 'error')
  debug.error(output)
}
export default log
