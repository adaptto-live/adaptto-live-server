import { Server, Socket } from 'socket.io'
import { ClientToServerEvents, QAEntryFromServer, ServerToClientEvents } from './socket.types'
import { InterServerEvents, SocketData } from './socket.server.types'
import { MessageModel, QAEntryLikeModel, QAEntryModel, TalkModeratorNotesModel } from '../repository/mongodb.schema'
import log from '../util/log'
import RoomUsers from '../util/RoomUsers'

const roomUsers = new RoomUsers()

export async function handleTalkRoom(io : Server<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>,
    socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const { userid, username, qaadmin, admin } = socket.data
  if (!userid || !username) {
    return
  }

  // join room for messages and Q&A entries
  socket.on('roomEnter', async (talkId: string) => {
    log.debug(`User ${username} joins room ${talkId}`)
    await socket.join(talkId)

    // emit all users currently in this room
    io.to(talkId).emit('roomUsers', roomUsers.joinsRoom(talkId, socket, username))

    // emit all existing messages and Q&A entries
    const messages = (await MessageModel.find({talkId}).sort({date:1}).exec())
      .map(({id, date, userid, username, text, highlight}) => ({id, date, userid, username, text, highlight}))
    if (messages.length > 0) {
      socket.emit('messages', messages)
    }
    const qaEntries = (await QAEntryModel.find({talkId}).sort({date:1}).exec())
      .map(({id, date, userid, username, text, entryIndex, replyTo, highlight, answered}) => ({id, date, userid, username, text,
          entryIndex: entryIndex ?? 0, replyTo, highlight, answered, likeUserIds:[]}))
    if (qaEntries.length > 0) {
      await applyLikeUserIds(talkId, qaEntries)
      socket.emit('qaEntries', qaEntries)
    }

    // moderator notes (for Q&A admin)
    if (qaadmin || admin) {
      const notes = await TalkModeratorNotesModel.findOne({talkId})
      if (notes != null) {
        const { text, updated } = notes
        socket.emit('talkModeratorNotes', { text, updated })
      }
    }
  })
  socket.on('roomLeave', async (talkId: string) => {
    log.debug(`User ${username} leaves room ${talkId}`)
    await socket.leave(talkId)

    // emit all users currently in this room
    io.to(talkId).emit('roomUsers', roomUsers.leavesRoom(talkId, socket))
  })
  socket.on('disconnect', () => {
    // emit all users currently in this room
    roomUsers.disconnected(socket).forEach(({talkId, usernames}) =>
        io.to(talkId).emit('roomUsers', usernames))
  })

}

async function applyLikeUserIds(talkId: string, qaEntries: QAEntryFromServer[]) {
  const likes = await QAEntryLikeModel.find({talkId}).exec()
  likes.forEach(({qaEntryId, userid}) => {
    qaEntries.find(qaEntry => qaEntry.id === qaEntryId)?.likeUserIds.push(userid)
  })
}
