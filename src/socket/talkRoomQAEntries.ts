import { Socket } from 'socket.io'
import { ClientToServerEvents, OperationResult, QAEntryToServer, ServerToClientEvents } from './socket.types'
import { InterServerEvents, SocketData } from './socket.server.types'
import { QAEntry, QAEntryModel, UserModel } from '../repository/mongodb.schema'
import log from '../util/log'
import { qaEntryToServerObject, uuidString } from '../repository/validation.schema'
import isInputValid from '../util/isInputValid'

export async function handleTalkRoomQAEntries(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const { userid, username, admin } = socket.data
  if (!userid || !username) {
    return
  }

  // CRUD handling for Q&A entries
  socket.on('qaEntry', handleNew)
  socket.on('qaEntryUpdate', handleUpdate)
  socket.on('qaEntryDelete', handleDelete)

  async function handleNew(newQaEntry: QAEntryToServer, callback: (result: OperationResult) => void) {
    if (!isInputValid(qaEntryToServerObject, newQaEntry, callback)) {
      return
    }

    const { id, talkId, text, anonymous, replyTo } = newQaEntry
    log.debug(`User ${username} created Q&A entry in ${talkId}: ${text}`)
    const date = new Date()
    const qaEntryUsername = anonymous ? undefined : username
    await QAEntryModel.create({ _id:id, talkId, date, userid, username: qaEntryUsername, text, replyTo })
    callback({success: true})
    socket.in(talkId).emit('qaEntries', [{id, date, userid, username: qaEntryUsername, text, replyTo}])
  }

  async function handleUpdate(updatedQaEntry: QAEntryToServer, callback: (result: OperationResult) => void) {
    if (!isInputValid(qaEntryToServerObject, updatedQaEntry, callback)) {
      return
    }

    const { id, text, anonymous } = updatedQaEntry
    log.debug(`User ${username} updated Q&A entry ${id}: ${text}`)
    const message = await QAEntryModel.findById(id).exec()
    if (message != null && isEditAllowed(message)) {
      message.username = await getUsernameForUpdate(message.userid, anonymous)
      message.text = text
      await message.save()
      callback({success: true})
      socket.in(message.talkId).emit('qaEntryUpdate', 
        {id, date: message.date, userid: message.userid, username: message.username, text: message.text})
    }
    else {
      callback({success: false, error: `QA entry ${id} not found or not allowed to update.`})
    }
  }

  async function handleDelete(id: string, callback: (result: OperationResult) => void) {
    if (!isInputValid(uuidString, id, callback)) {
      return
    }

    log.debug(`User ${username} deleted Q&A entry ${id}`)
    const message = await QAEntryModel.findById(id).exec()
    if (message != null && isEditAllowed(message)) {
      await QAEntryModel.deleteMany({replyTo:id}).exec()
      await message.deleteOne()
      callback({success: true})
      socket.in(message.talkId).emit('qaEntryDelete', id)
    }
    else {
      callback({success: false, error: `QA entry ${id} not found or not allowed to update.`})
    }
  }

  function isEditAllowed(message: QAEntry) : boolean {
    return message != null && ((message.userid == userid) || admin) 
  }

}

async function getUsernameForUpdate(userid: string, anonymous?: boolean) : Promise<string|undefined> {
  if (!anonymous) {
    const originalPoster = await UserModel.findOne({_id:userid}).exec()
    if (originalPoster) {
      return originalPoster.username
    }
  }
  return undefined
}
