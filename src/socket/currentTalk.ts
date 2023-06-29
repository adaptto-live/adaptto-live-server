import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents } from './socket.types'
import { InterServerEvents, SocketData } from './socket.server.types'
import { CurrentTalkModel } from '../repository/mongodb.schema'
import log from '../util/log'
import { v4 as uuidv4 } from 'uuid'
import { talkIdString } from '../repository/validation.schema'
import isInputValid from '../util/isInputValid'

export async function handleCurrentTalk(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const { admin } = socket.data

  // emit current talk on login
  const currentTalk = await CurrentTalkModel.findOne().exec()
  if (currentTalk) {
    socket.emit('currentTalk', currentTalk.talkId)
  }

  // allow to change current talk (only admin)
  if (admin) {
    socket.on('currentTalk', async (talkId, callback) => {
      if (!isInputValid(talkIdString, talkId, callback)) {
        return
      }
  
      await CurrentTalkModel.deleteMany().exec()
      log.info(`Set current talk to ${talkId}`)
      await CurrentTalkModel.create({_id: uuidv4(), talkId, created: new Date()})
      socket.broadcast.emit('currentTalk', talkId)
      callback({success: true})
    })
  }

}
