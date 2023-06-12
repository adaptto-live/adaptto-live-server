import { default as pino } from 'pino'

const log = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
})

export default log
