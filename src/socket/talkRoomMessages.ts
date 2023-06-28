import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents } from './socket.types'
import { InterServerEvents, SocketData } from './socket.server.types'
import { MessageModel } from '../repository/mongodb.schema'
import log from '../util/log'

export async function handleTalkRoomMessages(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const { userid, username, admin } = socket.data
  if (!userid || !username) {
    return
  }

  // CRUD handling for chat messages
  socket.on('message', async (id: string, talkId: string, text: string) => {
    log.debug(`User ${username} created message in ${talkId}: ${text}`)
    const date = new Date()
    await MessageModel.create({ _id:id, talkId, date, userid, username, text })
    socket.in(talkId).emit('message', id, date, userid, username, text)
  })
  socket.on('messageUpdate', async (id: string, text: string) => {
    log.debug(`User ${username} updated message ${id}: ${text}`)
    const message = await MessageModel.findById(id).exec()
    if (message != null && ((message.userid == userid) || admin)) {
      message.text = text
      await message.save()
      socket.in(message.talkId).emit('messageUpdate', id, message.date, message.userid, message.username, message.text)
    }
  })
  socket.on('messageDelete', async (id: string) => {
    log.debug(`User ${username} deleted message ${id}`)
    const message = await MessageModel.findById(id).exec()
    if (message != null && ((message.userid == userid) || admin)) {
      await message.deleteOne()
      socket.in(message.talkId).emit('messageDelete', id)
    }
  })

}
