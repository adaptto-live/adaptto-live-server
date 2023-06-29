import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents } from './socket.types'
import { InterServerEvents, SocketData } from './socket.server.types'
import { QAEntryModel, UserModel } from '../repository/mongodb.schema'
import log from '../util/log'
import { qaEntryToServerObject, uuidString } from '../repository/validation.schema'

export async function handleTalkRoomQAEntries(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const { userid, username, admin } = socket.data
  if (!userid || !username) {
    return
  }

  // CRUD handling for Q&A entries
  socket.on('qaEntry', async (newQaEntry, callback) => {
    // validate input
    const { error } = qaEntryToServerObject.validate(newQaEntry)
    if (error) {
      callback({success:false, error:error.message})
      return
    }

    const { id, talkId, text, anonymous, replyTo } = newQaEntry
    log.debug(`User ${username} created Q&A entry in ${talkId}: ${text}`)
    const date = new Date()
    const qaEntryUsername = anonymous ? undefined : username
    await QAEntryModel.create({ _id:id, talkId, date, userid, username: qaEntryUsername, text, replyTo })
    callback({success: true})
    socket.in(talkId).emit('qaEntries', [{id, date, userid, username: qaEntryUsername, text, replyTo}])
  })

  socket.on('qaEntryUpdate', async (updatedQaEntry, callback) => {
    // validate input
    const { error } = qaEntryToServerObject.validate(updatedQaEntry)
    if (error) {
      callback({success:false, error:error.message})
      return
    }

    const { id, text, anonymous } = updatedQaEntry
    log.debug(`User ${username} updated Q&A entry ${id}: ${text}`)
    const message = await QAEntryModel.findById(id).exec()
    if (message != null && ((message.userid == userid) || admin)) {
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
  })

  socket.on('qaEntryDelete', async (id, callback) => {
    // validate input
    const { error } = uuidString.validate(id)
    if (error) {
      callback({success:false, error:error.message})
      return
    }

    log.debug(`User ${username} deleted Q&A entry ${id}`)
    const message = await QAEntryModel.findById(id).exec()
    if (message != null && ((message.userid == userid) || admin)) {
      await QAEntryModel.deleteMany({replyTo:id}).exec()
      await message.deleteOne()
      callback({success: true})
      socket.in(message.talkId).emit('qaEntryDelete', id)
    }
    else {
      callback({success: false, error: `QA entry ${id} not found or not allowed to update.`})
    }
  })

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
