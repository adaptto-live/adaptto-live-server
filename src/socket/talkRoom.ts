import { Server, Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from './socket.types'
import { MessageModel, QAEntryModel, UserModel } from '../repository/mongodb.schema'
import log from '../util/log'
import AuthenticationInfo from '../util/AuthenticationInfo'
import RoomUsers from '../util/RoomUsers'

const roomUsers = new RoomUsers()

export async function handleTalkRoom(io : Server<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>,
    socket : Socket<ClientToServerEvents,ServerToClientEvents,InterServerEvents,SocketData>,
    authenticationInfo : AuthenticationInfo) : Promise<void> {
  const { userid, username, admin } = authenticationInfo

  // join room for messages and Q&A entries
  socket.on('roomEnter', async (talkId: string) => {
    log.debug(`User ${username} joins room ${talkId}`)
    socket.join(talkId)

    // emit all users currently in this room
    io.to(talkId).emit('roomUsers', roomUsers.joinsRoom(talkId, socket, username))

    // emit all existing messages and Q&A entries
    ;(await MessageModel.find({talkId}).sort({date:1})).forEach(doc => {
      socket.emit('message', doc.id, doc.date, doc.userid, doc.username, doc.text)
    })
    ;(await QAEntryModel.find({talkId}).sort({date:1})).forEach(doc => {
      socket.emit('qaEntry', doc.id, doc.date, doc.userid, doc.username, doc.text)
    })
  })
  socket.on('roomLeave', (talkId: string) => {
    log.debug(`User ${username} leaves room ${talkId}`)
    socket.leave(talkId)

    // emit all users currently in this room
    io.to(talkId).emit('roomUsers', roomUsers.leavesRoom(talkId, socket))
  })
  socket.on('disconnect', () => {
    // emit all users currently in this room
    roomUsers.disconnected(socket).forEach(({talkId, usernames}) =>
        io.to(talkId).emit('roomUsers', usernames))
  })

  // CRUD handling for chat messages
  socket.on('message', (id: string, talkId: string, text: string) => {
    log.debug(`User ${username} created message in ${talkId}: ${text}`)
    const date = new Date()
    MessageModel.create({ _id:id, talkId, date, userid, username, text })
    socket.in(talkId).emit('message', id, date, userid, username, text)
  })
  socket.on('messageUpdate', async (id: string, text: string) => {
    log.debug(`User ${username} updated message ${id}: ${text}`)
    const message = await MessageModel.findById(id)
    if (message != null && ((message.userid == userid) || admin)) {
      message.text = text
      await message.save()
      socket.in(message.talkId).emit('messageUpdate', id, message.date, message.userid, message.username, message.text)
    }
  })
  socket.on('messageDelete', async (id: string) => {
    log.debug(`User ${username} deleted message ${id}`)
    const message = await MessageModel.findById(id)
    if (message != null && ((message.userid == userid) || admin)) {
      await message.deleteOne()
      socket.in(message.talkId).emit('messageDelete', id)
    }
  })

  // CRUD handling for Q&A entries
  socket.on('qaEntry', (id: string, talkId: string, text: string, anonymous?: boolean) => {
    log.debug(`User ${username} created Q&A entry in ${talkId}: ${text}`)
    const date = new Date()
    const qaEntryUsername = anonymous ? undefined : username
    QAEntryModel.create({ _id:id, talkId, date, userid, username: qaEntryUsername, text })
    socket.in(talkId).emit('qaEntry', id, date, userid, qaEntryUsername, text)
  })
  socket.on('qaEntryUpdate', async (id: string, text: string, anonymous?: boolean) => {
    log.debug(`User ${username} updated Q&A entry ${id}: ${text}`)
    const message = await QAEntryModel.findById(id)
    if (message != null && ((message.userid == userid) || admin)) {
      if (anonymous) {
        message.username = undefined
      }
      else {
        message.username = (await UserModel.findOne({_id:message.userid}))?.username
      }
      message.text = text
      await message.save()
      socket.in(message.talkId).emit('qaEntryUpdate', id, message.date, message.userid, message.username, message.text)
    }
  })
  socket.on('qaEntryDelete', async (id: string) => {
    log.debug(`User ${username} deleted Q&A entry ${id}`)
    const message = await QAEntryModel.findById(id)
    if (message != null && ((message.userid == userid) || admin)) {
      await message.deleteOne()
      socket.in(message.talkId).emit('qaEntryDelete', id)
    }
  })

}
