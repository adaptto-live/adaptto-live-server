import { Socket } from 'socket.io'
import { ClientToServerEvents, KPIDataset, KPIDatasetDay, ServerToClientEvents } from '../socket.types'
import { InterServerEvents, SocketData } from '../socket.server.types'
import log from '../../util/log'
import { UserModel } from '../../repository/mongodb.schema'

export async function handleAdminKPI(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const { admin } = socket.data

  // admin-only operations
  if (!admin) {
    return
  }

  socket.on('adminGetKPI', async (dayDates: Date[]) => {
    log.debug('Admin: get KPI')

    await userRegistrationKPI(dayDates)
    await talkRatingKPI()
    await talkMessagesKPI()
    await talkQAEntriesKPI()
  })

  async function userRegistrationKPI(dayDates: Date[]) {
    const dataset : KPIDataset = {
      title: 'User Registrations',
      xAxisTitle: 'Hour of day',
      yAxisTitle: '# Registrations',
      days: []
    }

    const users = await UserModel.find().sort({created:1}).exec()
    dayDates.forEach((dayDate, index) => {
      const date = new Date(dayDate)
      const day : KPIDatasetDay = { day: index+1, values: {} }
      dataset.days.push(day)
      for (let hour = 9; hour <= 18; hour++) {
        const upToDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0)
        const count = users.filter(user => user.created <= upToDate).length
        day.values[hour] = count
      }
    })

    socket.emit('adminKPIDataset', dataset)
  }

  async function talkRatingKPI() {
    const datasetNumber : KPIDataset = {
      title: 'Talk Ratings',
      xAxisTitle: 'Talk Index',
      yAxisTitle: '# Talk Ratings',
      days: []
    }

    // TODO: calc KPI

    socket.emit('adminKPIDataset', datasetNumber)

    const datasetAverage : KPIDataset = {
      title: 'Average Rating',
      xAxisTitle: 'Talk Index',
      yAxisTitle: 'Average Rating',
      days: []
    }

    // TODO: calc KPI

    socket.emit('adminKPIDataset', datasetAverage)
  }

  async function talkMessagesKPI() {
    const dataset : KPIDataset = {
      title: 'Talk Messages',
      xAxisTitle: 'Talk Index',
      yAxisTitle: '# Messages',
      days: []
    }

    // TODO: calc KPI

    socket.emit('adminKPIDataset', dataset)
  }

  async function talkQAEntriesKPI() {
    const dataset : KPIDataset = {
      title: 'Talk Q&A Entries',
      xAxisTitle: 'Talk Index',
      yAxisTitle: '# Q&A Entries',
      days: []
    }

    // TODO: calc KPI

    socket.emit('adminKPIDataset', dataset)
  }

}
