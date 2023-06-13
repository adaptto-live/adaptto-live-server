import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from './socket.types'
import { CurrentTalkModel } from '../repository/mongodb.schema'
import log from '../util/log'
import { v4 as uuidv4 } from 'uuid'
import AuthenticationInfo from '../util/AuthenticationInfo'

export async function handleCurrentTalk(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>,
    authenticationInfo : AuthenticationInfo) {

  // emit current talk on login
  const currentTalk = await CurrentTalkModel.findOne().exec()
  if (currentTalk) {
    socket.emit('currentTalk', currentTalk.talkId)
  }

  // allow to change current talk (only admin)
  if (authenticationInfo.admin) {
    socket.on('currentTalk', async (talkId: string) => {
      await CurrentTalkModel.deleteMany().exec()
      log.info(`Set current talk to ${talkId}`)
      await CurrentTalkModel.create({_id: uuidv4(), talkId, created: new Date()})
      socket.broadcast.emit('currentTalk', talkId)
    })
  }

}
