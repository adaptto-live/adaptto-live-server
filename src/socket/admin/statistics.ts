import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents } from '../socket.types'
import { InterServerEvents, SocketData } from '../socket.server.types'
import log from '../../util/log'
import { LoginCodeModel, MessageModel, QAEntryModel, TalkRatingModel, UserModel } from '../../repository/mongodb.schema'

export async function handleAdminStatistics(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const { admin } = socket.data

  // admin-only operations
  if (!admin) {
    return
  }

  socket.on('adminGetStatistics', async () => {
    log.debug('Admin: get statistics')
    
    const numLoginCodes = await LoginCodeModel.count().exec()
    const numUsers = await UserModel.count().exec()
    const numTalkRatings = await TalkRatingModel.count().exec()
    const numMessages = await MessageModel.count().exec()
    const numQAEntries = await QAEntryModel.count().exec()

    socket.emit('adminStatistics', { numLoginCodes, numUsers, numTalkRatings, numMessages, numQAEntries })
  })

}
