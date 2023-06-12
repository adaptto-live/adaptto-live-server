import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from '../socket.types'
import log from '../../util/log'
import AuthenticationInfo from '../../util/AuthenticationInfo'
import { MessageModel, QAEntryModel, TalkRatingModel, UserModel } from '../../repository/mongodb.schema'

export async function handleAdminStatistics(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>,
    authenticationInfo : AuthenticationInfo) : Promise<void> {

  // admin-only operations
  if (!authenticationInfo.admin) {
    return
  }

  socket.on('adminGetStatistics', async () => {
    log.debug('Admin: get statistics')
    
    const numUsers = await UserModel.count()
    const numTalkRatings = await TalkRatingModel.count()
    const numMessages = await MessageModel.count()
    const numQAEntries = await QAEntryModel.count()

    socket.emit('adminStatistics', numUsers, numTalkRatings, numMessages, numQAEntries)
  })

}
