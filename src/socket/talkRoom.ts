import { Server, Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from './socket.types'
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
    ;(await MessageModel.find({talkId}).sort({date:1}).exec()).forEach(doc => {
      socket.emit('message', doc.id, doc.date, doc.userid, doc.username, doc.text)
    })
    ;(await QAEntryModel.find({talkId}).sort({date:1}).exec()).forEach(doc => {
      socket.emit('qaEntry', doc.id, doc.date, doc.userid, doc.username, doc.text)
    })
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
