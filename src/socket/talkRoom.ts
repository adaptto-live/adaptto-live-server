import { Server, Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents } from './socket.types'
import { InterServerEvents, SocketData } from './socket.server.types'
import { MessageModel, QAEntryModel } from '../repository/mongodb.schema'
import log from '../util/log'
import RoomUsers from '../util/RoomUsers'

const roomUsers = new RoomUsers()

export async function handleTalkRoom(io : Server<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>,
    socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>) {
  const { userid, username } = socket.data
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
      .map(({id, date, userid, username, text, replyTo, highlight, answered}) => ({id, date, userid, username, text, replyTo, highlight, answered}))
    if (qaEntries.length > 0) {
      socket.emit('qaEntries', qaEntries)
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
