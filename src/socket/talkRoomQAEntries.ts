import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from './socket.types'
import { QAEntry, QAEntryModel, UserModel } from '../repository/mongodb.schema'
import log from '../util/log'

export async function handleTalkRoomQAEntries(socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const { userid, username, admin } = socket.data
  if (!userid || !username) {
    return
  }

  // CRUD handling for Q&A entries
  socket.on('qaEntry', async (id: string, talkId: string, text: string, anonymous?: boolean) => {
    log.debug(`User ${username} created Q&A entry in ${talkId}: ${text}`)
    const date = new Date()
    const qaEntryUsername = anonymous ? undefined : username
    await QAEntryModel.create({ _id:id, talkId, date, userid, username: qaEntryUsername, text })
    socket.in(talkId).emit('qaEntry', id, date, userid, qaEntryUsername, text)
  })
  socket.on('qaEntryUpdate', async (id: string, text: string, anonymous?: boolean) => {
    log.debug(`User ${username} updated Q&A entry ${id}: ${text}`)
    const message = await QAEntryModel.findById(id).exec()
    if (message != null && ((message.userid == userid) || admin)) {
      message.username = await getUsernameForUpdate(message.userid, anonymous)
      message.text = text
      await message.save()
      socket.in(message.talkId).emit('qaEntryUpdate', id, message.date, message.userid, message.username, message.text)
    }
  })
  socket.on('qaEntryDelete', async (id: string) => {
    log.debug(`User ${username} deleted Q&A entry ${id}`)
    const message = await QAEntryModel.findById(id).exec()
    if (message != null && ((message.userid == userid) || admin)) {
      await message.deleteOne()
      socket.in(message.talkId).emit('qaEntryDelete', id)
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
