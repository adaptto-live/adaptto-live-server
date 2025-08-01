import { Socket } from 'socket.io'
import { ClientToServerEvents, KPIDataset, KPIDatasetDay, ServerToClientEvents } from '../socket.types'
import { InterServerEvents, SocketData } from '../socket.server.types'
import log from '../../util/log'
import { MessageModel, QAEntryModel, TalkRatingModel, UserModel } from '../../repository/mongodb.schema'
import moment, { Moment } from 'moment-timezone'

export async function handleAdminKPI(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const { admin, qaadmin } = socket.data
  const minuteSlots = [0, 30]

  // admin-only operations
  if (!(admin || qaadmin)) {
    return
  }

  socket.on('adminGetKPI', async (dayDates: Date[]) => {
    log.debug('Admin: get KPI')

    const dates = dayDates.map(date => new Date(date))
    await userRegistrationKPI(dates)
    await userActivityKPI(dates)
  })

  /**
   * User registrations per hour of day.
   */
  async function userRegistrationKPI(dates: Date[]) {
    const dataset : KPIDataset = {
      title: 'User Registrations',
      xAxisTitle: 'Hour of day',
      yAxisTitle: '# Registrations',
      days: []
    }

    const users = await UserModel.find().sort({created:1}).exec()
    const debugDateInfo : string[] = []
    debugDateInfo.push(`dates: ${dates.join(' | ')}, dates-ISO: ${dates.map(date => date.toISOString()).join(' | ')}, transformedDates: ${toLocalMoments(dates).join(' | ')}`)
    toLocalMoments(dates).forEach((date, index) => {
      const day : KPIDatasetDay = { day: index+1, values: [] }
      dataset.days.push(day)
      for (let hour = 9; hour <= 18; hour++) {
        for (const minuteSlot of minuteSlots) {
          const upToDate = moment.tz({
            year: date.year(),
            month: date.month(),
            day: date.date(),
            hour,
            minute: minuteSlot,
            second: 0
          }, timezone).toDate()
          const count = users.filter(user => user.created <= upToDate).length
          day.values.push({
            x: hour + (minuteSlot / 60),
            y: count
          })
        }
      }
    })

    dataset.title += ` (${debugDateInfo.join(' | ')})`
    socket.emit('adminKPIDataset', dataset)
  }

  /**
   * User activity per hour of day (# Messages / Q&A Entries / Ratings)
   */
  async function userActivityKPI(dates: Date[]) {
    const dataset : KPIDataset = {
      title: 'User Activity',
      xAxisTitle: 'Hour of day',
      yAxisTitle: '# Messages / Q&A Entries / Ratings',
      days: []
    }

    const talkRatings = await TalkRatingModel.find().sort({created:1}).exec()
    const messages = await MessageModel.find().sort({date:1}).exec()
    const qaEntries = await QAEntryModel.find().sort({date:1}).exec()

    const debugDateInfo : string[] = []
    debugDateInfo.push(`dates: ${dates.join(' | ')}, dates-ISO: ${dates.map(date => date.toISOString()).join(' | ')}, transformedDates: ${toLocalMoments(dates).join(' | ')}`)
    toLocalMoments(dates).forEach((date, index) => {
      const day : KPIDatasetDay = { day: index+1, values: [] }
      dataset.days.push(day)
      for (let hour = 9; hour <= 18; hour++) {
        for (const minuteSlot of minuteSlots) {
          const fromDate = moment.tz({
            year: date.year(),
            month: date.month(),
            day: date.date(),
            hour: hour,
            minute: minuteSlot,
            second: 0
          }, timezone).toDate()

          const toDate = moment.tz({
            year: date.year(),
            month: date.month(),
            day: date.date(),
            hour: minuteSlot == 30 ? hour + 1 : hour,
            minute: minuteSlot == 0 ? 30 : 0,
            second: 0
          }, timezone).toDate()

          const countTalkRatings = talkRatings.filter(item => item.created >= fromDate && item.created < toDate).length
          const countMessages = messages.filter(item => item.date >= fromDate && item.date < toDate).length
          const countQAEntries = qaEntries.filter(item => item.date >= fromDate && item.date < toDate).length

          day.values.push({
            x: hour + (minuteSlot / 60),
            y: countTalkRatings + countMessages + countQAEntries
          })
        }
      }
    })

    dataset.title += ` (${debugDateInfo.join(' | ')})`

    socket.emit('adminKPIDataset', dataset)
  }

}

const timezone = 'Europe/Berlin'

function toLocalMoments(dates : Date[]) : Moment[] {
  return dates.map(date => moment.tz(date.toISOString(), timezone))
} 
