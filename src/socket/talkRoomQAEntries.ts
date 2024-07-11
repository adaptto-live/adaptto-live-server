import { Socket } from 'socket.io'
import { ClientToServerEvents, OperationResult, QAEntryAnsweredToServer, QAEntryLikeToServer, QAEntryToServer, ServerToClientEvents } from './socket.types'
import { InterServerEvents, SocketData } from './socket.server.types'
import { QAEntry, QAEntryLikeModel, QAEntryModel, UserModel } from '../repository/mongodb.schema'
import log from '../util/log'
import { qaEntryAnsweredToServerObject, qaEntryLikeToServerObject, qaEntryToServerObject, uuidString } from '../repository/validation.schema'
import isInputValid from '../util/isInputValid'
import { v4 as uuidv4 } from 'uuid'

export async function handleTalkRoomQAEntries(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const { userid, username, admin, qaadmin } = socket.data
  if (!userid || !username) {
    return
  }

  // CRUD handling for Q&A entries
  socket.on('qaEntry', handleNew)
  socket.on('qaEntryUpdate', handleUpdate)
  socket.on('qaEntryUpdateAnswered', handleUpdateAnswered)
  socket.on('qaEntryDelete', handleDelete)
  socket.on('qaEntryLike', handleLike)

  async function handleNew(newQaEntry: QAEntryToServer, callback: (result: OperationResult) => void) {
    if (!isInputValid(qaEntryToServerObject, newQaEntry, callback)) {
      return
    }

    const { id, talkId, text, anonymous, replyTo, highlight, answered } = newQaEntry
    log.debug(`User ${username} created Q&A entry in ${talkId}: ${text}`)
    const date = new Date()
    const qaEntryUsername = anonymous ? undefined : username
    await QAEntryModel.create({ _id:id, talkId, date, userid, username: qaEntryUsername, text, replyTo, highlight, answered })
    callback({success: true})
    socket.in(talkId).emit('qaEntries', [{id, date, userid, username: qaEntryUsername, text, replyTo, highlight, answered, likeUserIds: []}])
  }

  /**
   * Updates all properties of Q&A entry. Only allowed for creator of entry and for admins.
   */
  async function handleUpdate(updatedQaEntry: QAEntryToServer, callback: (result: OperationResult) => void) {
    if (!isInputValid(qaEntryToServerObject, updatedQaEntry, callback)) {
      return
    }

    const { id, text, anonymous, highlight, answered } = updatedQaEntry
    log.debug(`User ${username} updated Q&A entry ${id}: ${text}`)
    const message = await QAEntryModel.findById(id).exec()
    if (message != null && isEditAllowed(message)) {
      message.username = await getUsernameForUpdate(message.userid, anonymous)
      message.text = text
      message.highlight = highlight
      message.answered = answered
      await message.save()
      callback({success: true})
      emitMessageWithLikeUserIds(message)
    }
    else {
      callback({success: false, error: `QA entry ${id} not found or not allowed to update.`})
    }
  }

  /**
   * Updates only 'answered' flag of Q&A entry. Allowed for everyone.
   */
  async function handleUpdateAnswered(updatedQaEntryAnswered: QAEntryAnsweredToServer, callback: (result: OperationResult) => void) {
    if (!isInputValid(qaEntryAnsweredToServerObject, updatedQaEntryAnswered, callback)) {
      return
    }

    const { id, answered } = updatedQaEntryAnswered
    log.debug(`User ${username} updated Q&A entry answered ${id}: ${answered}`)
    const message = await QAEntryModel.findById(id).exec()
    if (message != null && isUpdateAnsweredAllowed(message)) {
      message.answered = answered
      await message.save()
      callback({success: true})
      emitMessageWithLikeUserIds(message)
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

  /**
   * Like/unlike Q&A entry by user.
   */
  async function handleLike(like: QAEntryLikeToServer, callback: (result: OperationResult) => void) {
    if (!isInputValid(qaEntryLikeToServerObject, like, callback)) {
      return
    }

    const { id } = like

    // fetch QA entry
    const message = await QAEntryModel.findById(id).exec()
    if (message == null) {
      callback({success: false, error: `QA entry ${id} not found.`})
      return
    }

    // store new like or remove existing like
    const existingLike = await QAEntryLikeModel.findOne({qaEntryId:id, userid}).exec()
    if (existingLike != null) {
      log.debug(`User ${username} unlikes Q&A ${id}`)
      await existingLike.deleteOne()
    }
    else {
      log.debug(`User ${username} likes Q&A ${id}`)
      const likeId = uuidv4()
      const date = new Date()
      await QAEntryLikeModel.create({ _id:likeId, talkId:message.talkId, qaEntryId:id, date, userid })
    }

    // send updated QA entry with updated user likes
    callback({success: true})
    emitMessageWithLikeUserIds(message)
}

  function isEditAllowed(message: QAEntry) : boolean {
    return message != null && ((message.userid == userid) || admin)
  }

  function isUpdateAnsweredAllowed(message: QAEntry) : boolean {
    return message != null && ((message.userid == userid) || admin || qaadmin)
  }

  async function emitMessageWithLikeUserIds(message: QAEntry) {
    const likeUserIds = await getLikeUserIds(message._id)
    socket.in(message.talkId).emit('qaEntryUpdate', 
      {id:message._id, date: message.date, userid: message.userid, username: message.username, text: message.text, highlight: message.highlight, answered: message.answered, likeUserIds})
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

async function getLikeUserIds(qaEntryId: string) : Promise<string[]> {
  const likes = await QAEntryLikeModel.find({qaEntryId}).exec()
  return likes.map(like => like.userid)
}
