import { Socket } from 'socket.io'
import { ClientToServerEvents, MessageToServer, OperationResult, ServerToClientEvents } from './socket.types'
import { InterServerEvents, SocketData } from './socket.server.types'
import { Message, MessageModel } from '../repository/mongodb.schema'
import log from '../util/log'
import { messageToServerObject, uuidString } from '../repository/validation.schema'
import isInputValid from '../util/isInputValid'

export async function handleTalkRoomMessages(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const { userid, username, admin } = socket.data
  if (!userid || !username) {
    return
  }

  // CRUD handling for chat messages
  socket.on('message', handleNew)
  socket.on('messageUpdate', handleUpdate)
  socket.on('messageDelete', handleDelete)

  async function handleNew(newMessage: MessageToServer, callback: (result: OperationResult) => void) {
    if (!isInputValid(messageToServerObject, newMessage, callback)) {
      return
    }

    const { id, talkId, text, highlight } = newMessage
    log.debug(`User ${username} created message in ${talkId}: ${text}`)
    const date = new Date()
    await MessageModel.create({ _id:id, talkId, date, userid, username, text, highlight })
    callback({success: true})
    socket.in(talkId).emit('messages', [{ id, date, userid, username, text, highlight }])
  }

  async function handleUpdate(updatedMessage: MessageToServer, callback: (result: OperationResult) => void) {
    if (!isInputValid(messageToServerObject, updatedMessage, callback)) {
      return
    }

    const { id, text, highlight } = updatedMessage
    log.debug(`User ${username} updated message ${id}: ${text}`)
    const message = await MessageModel.findById(id).exec()
    if (message != null && isEditAllowed(message)) {
      message.text = text
      message.highlight = highlight
      await message.save()
      callback({success: true})
      socket.in(message.talkId).emit('messageUpdate',
        {id, date: message.date, userid: message.userid, username: message.username, text: message.text, highlight: message.highlight})
    }
    else {
      callback({success: false, error: `Message ${id} not found or not allowed to update.`})
    }
  }

  async function handleDelete(id: string, callback: (result: OperationResult) => void) {
    if (!isInputValid(uuidString, id, callback)) {
      return
    }

    log.debug(`User ${username} deleted message ${id}`)
    const message = await MessageModel.findById(id).exec()
    if (message != null && isEditAllowed(message)) {
      await message.deleteOne()
      callback({success: true})
      socket.in(message.talkId).emit('messageDelete', id)
    }
    else {
      callback({success: false, error: `Message ${id} not found or not allowed to update.`})
    }
  }

  function isEditAllowed(message: Message) : boolean {
    return message != null && ((message.userid == userid) || admin) 
  }

}
