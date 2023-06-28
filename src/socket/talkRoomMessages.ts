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
  socket.on('message', async (newMessage, callback) => {
    // TODO: validate

    const { id, talkId, text } = newMessage
    log.debug(`User ${username} created message in ${talkId}: ${text}`)
    const date = new Date()
    await MessageModel.create({ _id:id, talkId, date, userid, username, text })
    callback({success: true})
    socket.in(talkId).emit('messages', [{ id, date, userid, username, text }])
  })

  socket.on('messageUpdate', async (updatedMessage, callback) => {
    // TODO: validate

    const { id, text } = updatedMessage
    log.debug(`User ${username} updated message ${id}: ${text}`)
    const message = await MessageModel.findById(id).exec()
    if (message != null && ((message.userid == userid) || admin)) {
      message.text = text
      await message.save()
      callback({success: true})
      socket.in(message.talkId).emit('messageUpdate',
        {id, date: message.date, userid: message.userid, username: message.username, text: message.text})
    }
    else {
      callback({success: false, error: `Message ${id} not found or not allowed to update.`})
    }
  })

  socket.on('messageDelete', async (id, callback) => {
    // TODO: validate

    log.debug(`User ${username} deleted message ${id}`)
    const message = await MessageModel.findById(id).exec()
    if (message != null && ((message.userid == userid) || admin)) {
      await message.deleteOne()
      callback({success: true})
      socket.in(message.talkId).emit('messageDelete', id)
    }
    else {
      callback({success: false, error: `Message ${id} not found or not allowed to update.`})
    }
  })

}
