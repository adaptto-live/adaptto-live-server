import { default as pino } from 'pino'

const log = pino({
  level: process.env.APPSETTING_LOG_LEVEL ?? 'debug'
})

export default log
