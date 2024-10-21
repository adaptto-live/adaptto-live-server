import { Socket } from 'socket.io'
import { ClientToServerEvents, KPIDataset, KPIDatasetDay, ServerToClientEvents } from '../socket.types'
import { InterServerEvents, SocketData } from '../socket.server.types'
import log from '../../util/log'
import { MessageModel, QAEntryModel, TalkRatingModel, UserModel } from '../../repository/mongodb.schema'

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
    dates.forEach((date, index) => {
      const day : KPIDatasetDay = { day: index+1, values: [] }
      dataset.days.push(day)
      for (let hour = 9; hour <= 18; hour++) {
        for (const minuteSlot of minuteSlots) {
          const upToDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minuteSlot, 0)
          const count = users.filter(user => user.created <= upToDate).length
          day.values.push({
            x: hour + (minuteSlot / 60),
            y: count
          })
        }
      }
    })

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

    dates.forEach((date, index) => {
      const day : KPIDatasetDay = { day: index+1, values: [] }
      dataset.days.push(day)
      for (let hour = 9; hour <= 18; hour++) {
        minuteSlots.forEach((minuteSlot,index) => {
          const fromDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minuteSlot, 0)
          const toDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minuteSlots[index+1] ?? 60, 0)

          const countTalkRatings = talkRatings.filter(item => item.created >= fromDate && item.created < toDate).length
          const countMessages = messages.filter(item => item.date >= fromDate && item.date < toDate).length
          const countQAEntries = qaEntries.filter(item => item.date >= fromDate && item.date < toDate).length

          day.values.push({
            x: hour + (minuteSlot / 60),
            y: countTalkRatings + countMessages + countQAEntries
          })
        })
      }
    })

    socket.emit('adminKPIDataset', dataset)
  }

}
